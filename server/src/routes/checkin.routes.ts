// SECURITY: using Supabase client — parameterized queries, no raw SQL concatenation
import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { getTenantId } from '../utils/tenant';
import { updateWellnessSignals } from '../services/wellnessCalculator';
import { checkinSubmitLimiter } from '../middleware/rateLimiters';
import { validateBody } from '../middleware/validateBody';
import { submitCheckinSchema } from '../validators/checkin.validators';
import { logger } from '../lib/logger';

const router = Router();

const getWeekStart = (): string => {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
};

/**
 * POST /api/checkins/submit
 * Accepts all dimension scores at once:
 * { emotional_score, sleep_score, academic_score, social_score }
 */
router.post('/submit', checkinSubmitLimiter, validateBody(submitCheckinSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = getTenantId(req);
    const studentId = req.user!.id;
    const weekStart = getWeekStart();

    const { emotional_score, sleep_score, academic_score, social_score } = req.body;

    const scoreMap: Record<string, number> = {};
    if (emotional_score !== undefined) scoreMap['emotional'] = emotional_score;
    if (sleep_score !== undefined) scoreMap['sleep'] = sleep_score;
    if (academic_score !== undefined) scoreMap['academic'] = academic_score;
    if (social_score !== undefined) scoreMap['social'] = social_score;

    // Check existing submissions this week
    const { data: existing } = await supabase
      .from('checkins')
      .select('dimension')
      .eq('student_id', studentId)
      .eq('tenant_id', tenantId)
      .eq('week_start', weekStart);

    const alreadySubmitted = new Set(existing?.map(c => c.dimension) || []);

    const inserts = Object.entries(scoreMap)
      .filter(([dim]) => !alreadySubmitted.has(dim))
      .map(([dimension, response_score]) => ({
        tenant_id: tenantId,
        student_id: studentId,
        week_start: weekStart,
        dimension,
        response_score,
      }));

    if (inserts.length > 0) {
      const { error: insertErr } = await supabase.from('checkins').insert(inserts);
      if (insertErr) {
        res.status(500).json({ error: 'Failed to submit check-in' });
        return;
      }
      // Trigger wellness recalculation async
      updateWellnessSignals(studentId, tenantId).catch(err => logger.error({ err, studentId }, 'Failed to update wellness signals after check-in'));
    }

    res.json({ submitted: true, week_start: weekStart });
  } catch (error: any) {
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

/**
 * GET /api/checkins/status
 * Returns { pending: boolean, last_checkin: string|null }
 */
router.get('/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = getTenantId(req);
    const studentId = req.user!.id;
    const weekStart = getWeekStart();

    const { data: checkins } = await supabase
      .from('checkins')
      .select('dimension, submitted_at')
      .eq('student_id', studentId)
      .eq('tenant_id', tenantId)
      .eq('week_start', weekStart);

    const submitted = checkins?.map(c => c.dimension) || [];
    const allDimensions = ['emotional', 'sleep', 'academic', 'social'];
    const pending = allDimensions.some(d => !submitted.includes(d));

    // Last check-in timestamp across all time
    const { data: lastCheckin } = await supabase
      .from('checkins')
      .select('submitted_at')
      .eq('student_id', studentId)
      .eq('tenant_id', tenantId)
      .order('submitted_at', { ascending: false })
      .limit(1)
      .single();

    res.json({
      pending,
      last_checkin: lastCheckin?.submitted_at || null,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

/**
 * GET /api/checkins/history — 12-week grouped history
 */
router.get('/history', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = getTenantId(req);
    const studentId = req.user!.id;

    const twelveWeeksAgo = new Date();
    twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84);

    const { data: checkins, error } = await supabase
      .from('checkins')
      .select('week_start, dimension, response_score, submitted_at')
      .eq('student_id', studentId)
      .eq('tenant_id', tenantId)
      .gte('week_start', twelveWeeksAgo.toISOString().split('T')[0])
      .order('week_start', { ascending: false });

    if (error) {
      res.status(500).json({ error: 'Failed to fetch history' });
      return;
    }

    const grouped: Record<string, any> = {};
    checkins?.forEach(c => {
      if (!grouped[c.week_start]) grouped[c.week_start] = { week_start: c.week_start };
      grouped[c.week_start][`${c.dimension}_score`] = c.response_score;
    });

    res.json(Object.values(grouped));
  } catch (error: any) {
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

export default router;
