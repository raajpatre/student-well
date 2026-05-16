// SECURITY: using Supabase client — parameterized queries, no raw SQL concatenation
import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { getTenantId } from '../utils/tenant';
import { validateBody } from '../middleware/validateBody';
import { onboardingSchema, updatePreferencesSchema } from '../validators/student.validators';
import { getAdaptiveQuestions } from '../services/wellness/adaptiveQuestionService';

const router = Router();

/* ─────────────────────────────────────────
   GET /api/student/me
───────────────────────────────────────── */
router.get('/me', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = getTenantId(req);
    const userId = req.user!.id;

    // Latest wellness signals
    const { data: signals } = await supabase
      .from('wellness_signals')
      .select('academic_status, emotional_status, social_status, academic_score, emotional_score, social_score, academic_suggestion, emotional_suggestion, social_suggestion, calculated_at, updated_at')
      .eq('student_id', userId)
      .eq('tenant_id', tenantId)
      .order('calculated_at', { ascending: false })
      .limit(1)
      .single();

    // Active counsellor assignment (pending_contact status = waiting to be contacted)
    const { data: assignment } = await supabase
      .from('counsellor_assignments')
      .select('counsellor_id, status')
      .eq('student_id', userId)
      .eq('tenant_id', tenantId)
      .in('status', ['pending_contact', 'contacted', 'ongoing'])
      .order('assigned_at', { ascending: false })
      .limit(1)
      .single();

    res.json({
      counsellor_id: assignment?.counsellor_id || null,
      flag_status: assignment?.status || null,
      wellness_signals: signals
        ? {
            academic_status: signals.academic_status,
            emotional_status: signals.emotional_status,
            social_status: signals.social_status,
            academic_score: signals.academic_score,
            emotional_score: signals.emotional_score,
            social_score: signals.social_score,
            academic_suggestion: signals.academic_suggestion,
            emotional_suggestion: signals.emotional_suggestion,
            social_suggestion: signals.social_suggestion,
            last_updated: signals.updated_at || signals.calculated_at,
          }
        : null,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

/* ─────────────────────────────────────────
   GET /api/student/trends
───────────────────────────────────────── */
router.get('/trends', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = getTenantId(req);
    const userId = req.user!.id;

    const twelveWeeksAgo = new Date();
    twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84);

    const { data: checkins, error } = await supabase
      .from('checkins')
      .select('week_start, dimension, response_score')
      .eq('student_id', userId)
      .eq('tenant_id', tenantId)
      .gte('week_start', twelveWeeksAgo.toISOString().split('T')[0])
      .order('week_start', { ascending: true });

    if (error) {
      res.status(500).json({ error: 'Failed to fetch trends' });
      return;
    }

    // Group by week_start
    const grouped: Record<string, any> = {};
    checkins?.forEach(c => {
      if (!grouped[c.week_start]) grouped[c.week_start] = { week_start: c.week_start };
      grouped[c.week_start][`${c.dimension}_score`] = c.response_score;
    });

    // Calculate streak — consecutive Mondays with at least one check-in
    const { data: allCheckins } = await supabase
      .from('checkins')
      .select('week_start')
      .eq('student_id', userId)
      .eq('tenant_id', tenantId)
      .order('week_start', { ascending: false });

    const uniqueWeeks = [...new Set(allCheckins?.map(c => c.week_start) || [])];
    let streak = 0;
    const now = new Date();
    const thisMonday = new Date(now);
    const day = now.getDay();
    thisMonday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    thisMonday.setHours(0, 0, 0, 0);

    for (let i = 0; i < uniqueWeeks.length; i++) {
      const expected = new Date(thisMonday);
      expected.setDate(thisMonday.getDate() - i * 7);
      const expectedStr = expected.toISOString().split('T')[0];
      if (uniqueWeeks[i] === expectedStr) {
        streak++;
      } else {
        break;
      }
    }

    res.json({ checkin_history: Object.values(grouped), streak });
  } catch (err: any) {
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

/* ─────────────────────────────────────────
   GET /api/student/preferences
───────────────────────────────────────── */
const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const DAY_NUMS: Record<string, number> = { Sunday:0,Monday:1,Tuesday:2,Wednesday:3,Thursday:4,Friday:5,Saturday:6 };

router.get('/preferences', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = getTenantId(req);
    const userId = req.user!.id;

    const { data } = await supabase
      .from('user_preferences')
      .select('checkin_day, checkin_time, delivery_preference, language, notifications_enabled')
      .eq('student_id', userId)
      .eq('tenant_id', tenantId)
      .single();

    res.json({
      preferences: {
        checkin_day: data?.checkin_day !== null && data?.checkin_day !== undefined ? DAY_NAMES[data.checkin_day] : 'Monday',
        checkin_time: data?.checkin_time ? data.checkin_time.slice(0, 5) : '18:00',
        delivery_method: data?.delivery_preference || 'in_app',
        language: data?.language || 'en',
        notifications_enabled: data?.notifications_enabled ?? true,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

/* ─────────────────────────────────────────
   PATCH /api/student/preferences
───────────────────────────────────────── */
router.patch('/preferences', validateBody(updatePreferencesSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = getTenantId(req);
    const userId = req.user!.id;
    const { checkin_day, checkin_time, delivery_method, language, notifications_enabled } = req.body;

    const { error } = await supabase
      .from('user_preferences')
      .upsert({
        student_id: userId,
        tenant_id: tenantId,
        checkin_day: typeof checkin_day === 'string' ? (DAY_NUMS[checkin_day] ?? 1) : (checkin_day ?? 1),
        checkin_time: checkin_time || '18:00:00',
        delivery_preference: delivery_method || 'in_app',
        language: language || 'en',
        notifications_enabled: notifications_enabled ?? true,
      });

    if (error) {
      res.status(500).json({ error: 'Failed to save preferences' });
      return;
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

/* ─────────────────────────────────────────
   DELETE /api/student/checkin-history
───────────────────────────────────────── */
router.delete('/checkin-history', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = getTenantId(req);
    const userId = req.user!.id;

    const { error } = await supabase
      .from('checkins')
      .delete()
      .eq('student_id', userId)
      .eq('tenant_id', tenantId);

    if (error) {
      res.status(500).json({ error: 'Failed to delete history' });
      return;
    }

    try {
      await supabase.from('audit_logs').insert({
        tenant_id: tenantId,
        actor_id: userId,
        action: 'student_deleted_checkin_history',
        target_id: userId,
      });
    } catch { /* non-critical */ }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

/* ─────────────────────────────────────────
   GET /api/student/export
───────────────────────────────────────── */
router.get('/export', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = getTenantId(req);
    const userId = req.user!.id;

    const [checkins, prefs, sessions, signals] = await Promise.all([
      supabase.from('checkins')
        .select('week_start, dimension, response_score, submitted_at')
        .eq('student_id', userId).eq('tenant_id', tenantId),
      supabase.from('user_preferences')
        .select('checkin_day, checkin_time, delivery_preference, language')
        .eq('student_id', userId).eq('tenant_id', tenantId).single(),
      supabase.from('chatbot_sessions')
        .select('id, started_at, ended_at, escalation_level, student_shared')
        .eq('student_id', userId).eq('tenant_id', tenantId),
      supabase.from('wellness_signals')
        .select('academic_status, emotional_status, social_status, calculated_at')
        .eq('student_id', userId).eq('tenant_id', tenantId)
        .order('calculated_at', { ascending: false }).limit(1),
    ]);

    res.json({
      exported_at: new Date().toISOString(),
      checkin_history: checkins.data || [],
      preferences: prefs.data || {},
      chat_sessions_metadata: sessions.data || [],
      latest_wellness_signals: signals.data?.[0] || null,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

/* ─────────────────────────────────────────
   POST /api/student/onboarding (backward compat)
───────────────────────────────────────── */
router.post('/onboarding', validateBody(onboardingSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = getTenantId(req);
    const userId = req.user!.id;
    const { interest_tags, delivery_preference, language } = req.body;

    const { error } = await supabase.from('user_preferences').upsert({
      student_id: userId,
      tenant_id: tenantId,
      interest_tags,
      delivery_preference: delivery_preference || 'in_app',
      language: language || 'en',
      onboarding_complete: true,
    });

    if (error) {
      res.status(500).json({ error: 'Failed to save preferences' });
      return;
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

/* ─────────────────────────────────────────
   GET /api/student/questions/adaptive
   Adaptive question rotation based on recent reflection indicators.
   Returns up to 3 questions, optionally surfaced on the check-in screen.
───────────────────────────────────────── */
router.get('/questions/adaptive', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = getTenantId(req);
    const userId = req.user!.id;
    const result = await getAdaptiveQuestions(userId, tenantId, 3);
    res.json(result);
  } catch {
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

/* ─────────────────────────────────────────
   GET /api/student/recommendations
   Active recommendation cards for this student.
───────────────────────────────────────── */
router.get('/recommendations', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = getTenantId(req);
    const userId = req.user!.id;

    const { data, error } = await supabase
      .from('recommendations')
      .select('id, type, priority, message, source, status, created_at')
      .eq('student_id', userId)
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(8);

    if (error) {
      res.status(500).json({ error: 'Failed to fetch recommendations' });
      return;
    }

    res.json({ recommendations: data ?? [] });
  } catch {
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

/* ─────────────────────────────────────────
   PATCH /api/student/recommendations/:id
   Dismiss or complete a recommendation card.
───────────────────────────────────────── */
router.patch('/recommendations/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = getTenantId(req);
    const userId = req.user!.id;
    const { id } = req.params;
    const nextStatus = req.body?.status;

    if (nextStatus !== 'dismissed' && nextStatus !== 'completed') {
      res.status(400).json({ error: "status must be 'dismissed' or 'completed'" });
      return;
    }

    const { error } = await supabase
      .from('recommendations')
      .update({ status: nextStatus, dismissed_at: new Date().toISOString() })
      .eq('id', id)
      .eq('student_id', userId)
      .eq('tenant_id', tenantId);

    if (error) {
      res.status(500).json({ error: 'Failed to update recommendation' });
      return;
    }

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

export default router;
