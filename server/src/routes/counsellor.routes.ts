// SECURITY: using Supabase client — parameterized queries, no raw SQL concatenation
import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { getTenantId } from '../utils/tenant';
import { validateBody } from '../middleware/validateBody';
import { counsellorStatusSchema, profileEditRequestSchema } from '../validators/counsellor.validators';
import { logger } from '../lib/logger';

const router = Router();

const MS_PER_DAY = 86_400_000;
const REPORT_WINDOW_DAYS = 28;
const ASSIGNMENT_STATUSES = ['pending_contact', 'contacted', 'ongoing', 'resolved', 'escalated'];
const VALID_STATUS_UPDATES = ['contacted', 'ongoing', 'resolved', 'escalated'];

async function buildStudentReport(studentId: string, tenantId: string) {
  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - REPORT_WINDOW_DAYS);
  const fourWeeksAgoStr = fourWeeksAgo.toISOString().split('T')[0];

  const [studentRes, signalsRes, checkinsRes, flagsRes] = await Promise.all([
    supabase.from('users').select('id, full_name, branch, batch, semester, roll_number, created_at')
      .eq('id', studentId).eq('tenant_id', tenantId).single(),
    supabase.from('wellness_signals')
      .select('academic_status, emotional_status, social_status, academic_score, emotional_score, social_score, calculated_at')
      .eq('student_id', studentId).eq('tenant_id', tenantId)
      .order('calculated_at', { ascending: false }).limit(1).single(),
    supabase.from('checkins')
      .select('week_start, dimension, response_score')
      .eq('student_id', studentId).eq('tenant_id', tenantId)
      .gte('week_start', fourWeeksAgoStr)
      .order('week_start', { ascending: true }),
    supabase.from('flags')
      .select('risk_level, triggered_dimensions, weeks_flagged, status, created_at')
      .eq('student_id', studentId).eq('tenant_id', tenantId)
      .order('created_at', { ascending: false }),
  ]);

  if (!studentRes.data) return null;

  const checkinByWeek: Record<string, any> = {};
  checkinsRes.data?.forEach(c => {
    if (!checkinByWeek[c.week_start]) checkinByWeek[c.week_start] = { week_start: c.week_start };
    checkinByWeek[c.week_start][`${c.dimension}_score`] = c.response_score;
  });

  return {
    student: studentRes.data,
    wellness_snapshot: signalsRes.data || null,
    checkin_trend: Object.values(checkinByWeek),
    flag_history: flagsRes.data || [],
  };
}

async function notifyManager(tenantId: string, actorId: string, action: string, metadata: Record<string, unknown>) {
  const { data: managers } = await supabase
    .from('users')
    .select('id, full_name')
    .eq('tenant_id', tenantId)
    .eq('role', 'manager')
    .eq('is_active', true)
    .limit(10);

  logger.info({ action, managerCount: managers?.length || 0 }, 'Mock manager notification sent');

  await supabase.from('audit_logs').insert({
    tenant_id: tenantId,
    actor_id: actorId,
    action,
    metadata: { manager_ids: (managers || []).map(m => m.id), ...metadata },
  });
}

router.get('/students', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = getTenantId(req);
    const counsellorId = req.user!.id;

    const { data: assignments, error } = await supabase
      .from('counsellor_assignments')
      .select('id, student_id, flag_id, status, assigned_at')
      .eq('tenant_id', tenantId)
      .eq('counsellor_id', counsellorId)
      .in('status', ASSIGNMENT_STATUSES);

    if (error) { res.status(500).json({ error: 'Failed to fetch students' }); return; }

    const studentIds = [...new Set(assignments?.map(a => a.student_id) || [])];
    const flagIds = [...new Set(assignments?.map(a => a.flag_id) || [])];

    const [studentsRes, flagsRes] = await Promise.all([
      supabase.from('users').select('id, full_name, branch, batch')
        .in('id', studentIds.length ? studentIds : ['00000000-0000-0000-0000-000000000000'])
        .eq('tenant_id', tenantId),
      supabase.from('flags').select('id, triggered_dimensions')
        .in('id', flagIds.length ? flagIds : ['00000000-0000-0000-0000-000000000000'])
        .eq('tenant_id', tenantId),
    ]);

    const studentMap: Record<string, any> = {};
    studentsRes.data?.forEach(s => { studentMap[s.id] = s; });
    const flagMap: Record<string, any> = {};
    flagsRes.data?.forEach(f => { flagMap[f.id] = f; });

    const now = Date.now();
    const students = (assignments || []).map(a => {
      const assignedAt = new Date(a.assigned_at).getTime();
      const student = studentMap[a.student_id] || {};
      return {
        assignment_id: a.id,
        student_id: a.student_id,
        name: student.full_name || 'Unknown',
        branch: student.branch || null,
        batch: student.batch || null,
        assignment_date: a.assigned_at,
        intervention_status: a.status,
        days_since_assigned: Math.max(0, Math.floor((now - assignedAt) / MS_PER_DAY)),
        triggering_dimensions: flagMap[a.flag_id]?.triggered_dimensions || [],
      };
    });

    students.sort((a, b) => {
      if (a.intervention_status === 'pending_contact' && b.intervention_status !== 'pending_contact') return -1;
      if (b.intervention_status === 'pending_contact' && a.intervention_status !== 'pending_contact') return 1;
      return b.days_since_assigned - a.days_since_assigned;
    });

    res.json({ students });
  } catch (err: any) {
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

router.get('/students/:id/report', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = getTenantId(req);
    const counsellorId = req.user!.id;
    const studentId = req.params.id;

    const { data: assignment, error: assignmentErr } = await supabase
      .from('counsellor_assignments')
      .select('id, manager_note, status')
      .eq('tenant_id', tenantId)
      .eq('counsellor_id', counsellorId)
      .eq('student_id', studentId)
      .maybeSingle();

    if (assignmentErr) { res.status(500).json({ error: 'Failed to verify assignment' }); return; }
    if (!assignment) { res.status(403).json({ error: 'Student is not assigned to this counsellor' }); return; }

    const report = await buildStudentReport(studentId, tenantId);
    if (!report) { res.status(404).json({ error: 'Student not found' }); return; }

    void supabase.from('audit_logs').insert({
      tenant_id: tenantId,
      actor_id: counsellorId,
      action: 'counsellor_viewed_student_report',
      target_id: studentId,
      metadata: { assignment_id: assignment.id },
    });

    res.json({
      ...report,
      assignment: {
        id: assignment.id,
        status: assignment.status,
        manager_note: assignment.manager_note,
      },
      manager_note: assignment.manager_note,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

router.patch('/assignments/:id/status', validateBody(counsellorStatusSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = getTenantId(req);
    const counsellorId = req.user!.id;
    const assignmentId = req.params.id;
    const { status, note, resolution_note } = req.body;
    const statusNote = typeof resolution_note === 'string' ? resolution_note : note;

    if (!VALID_STATUS_UPDATES.includes(status)) {
      res.status(400).json({ error: 'Invalid status' });
      return;
    }

    if (status === 'resolved' && (!statusNote || !String(statusNote).trim())) {
      res.status(400).json({ error: 'Resolution note is required when resolving an assignment' });
      return;
    }

    const { data: assignment, error: assignmentErr } = await supabase
      .from('counsellor_assignments')
      .select('id, student_id, flag_id, status, first_contact_at')
      .eq('tenant_id', tenantId)
      .eq('counsellor_id', counsellorId)
      .eq('id', assignmentId)
      .maybeSingle();

    if (assignmentErr) { res.status(500).json({ error: 'Failed to verify assignment' }); return; }
    if (!assignment) { res.status(404).json({ error: 'Assignment not found' }); return; }

    const updates: Record<string, unknown> = { status };
    if (status === 'contacted' && !assignment.first_contact_at) updates.first_contact_at = new Date().toISOString();
    if (status === 'resolved') {
      updates.resolved_at = new Date().toISOString();
      updates.resolution_note = String(statusNote).trim();
    }
    if (status === 'escalated' && statusNote) updates.resolution_note = String(statusNote).trim();

    const { error: updateErr } = await supabase
      .from('counsellor_assignments')
      .update(updates)
      .eq('id', assignmentId)
      .eq('tenant_id', tenantId)
      .eq('counsellor_id', counsellorId);

    if (updateErr) { res.status(500).json({ error: 'Failed to update assignment status' }); return; }

    if (['resolved', 'escalated', 'ongoing'].includes(status)) {
      await supabase.from('flags').update({ status }).eq('id', assignment.flag_id).eq('tenant_id', tenantId);
    }

    void supabase.from('audit_logs').insert({
      tenant_id: tenantId,
      actor_id: counsellorId,
      action: 'counsellor_update_assignment_status',
      target_id: assignmentId,
      metadata: { student_id: assignment.student_id, previous_status: assignment.status, status, note: statusNote || null },
    });

    if (status === 'escalated') {
      void notifyManager(tenantId, counsellorId, 'notify_manager_assignment_escalated', {
        assignment_id: assignmentId,
        student_id: assignment.student_id,
        note: statusNote || null,
      });
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

router.get('/students/:id/shared-sessions', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = getTenantId(req);
    const counsellorId = req.user!.id;
    const studentId = req.params.id;

    const { data: assignment } = await supabase
      .from('counsellor_assignments')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('counsellor_id', counsellorId)
      .eq('student_id', studentId)
      .maybeSingle();

    if (!assignment) { res.status(403).json({ error: 'Student is not assigned to this counsellor' }); return; }

    const { data: sessions, error } = await supabase
      .from('chatbot_sessions')
      .select('id, started_at, shared_summary, escalation_level')
      .eq('student_id', studentId)
      .eq('tenant_id', tenantId)
      .eq('student_shared', true)
      .order('started_at', { ascending: false });

    if (error) { res.status(500).json({ error: 'Failed to fetch shared sessions' }); return; }

    res.json({ sessions: sessions || [] });
  } catch (err: any) {
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

router.get('/profile', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = getTenantId(req);
    const counsellorId = req.user!.id;

    const [userRes, profileRes] = await Promise.all([
      supabase.from('users').select('id, full_name, phone, is_active, created_at')
        .eq('id', counsellorId).eq('tenant_id', tenantId).single(),
      supabase.from('counsellor_profiles')
        .select('specialisation_tags, personality_description, capacity_limit, is_on_leave')
        .eq('counsellor_id', counsellorId).eq('tenant_id', tenantId).maybeSingle(),
    ]);

    if (!userRes.data) { res.status(404).json({ error: 'Profile not found' }); return; }

    res.json({
      ...userRes.data,
      specialisation_tags: profileRes.data?.specialisation_tags || [],
      personality_description: profileRes.data?.personality_description || null,
      capacity_limit: profileRes.data?.capacity_limit || null,
      is_on_leave: profileRes.data?.is_on_leave || false,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

router.post('/profile/edit-request', validateBody(profileEditRequestSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = getTenantId(req);
    const counsellorId = req.user!.id;
    const { requested_changes } = req.body;

    const { data, error } = await supabase
      .from('profile_edit_requests')
      .insert({
        counsellor_id: counsellorId,
        tenant_id: tenantId,
        requested_changes,
        status: 'pending',
      })
      .select('id')
      .single();

    if (error) { res.status(500).json({ error: 'Failed to submit edit request' }); return; }

    void supabase.from('audit_logs').insert({
      tenant_id: tenantId,
      actor_id: counsellorId,
      action: 'counsellor_profile_edit_request_created',
      target_id: data.id,
      metadata: { requested_changes },
    });

    void notifyManager(tenantId, counsellorId, 'notify_manager_profile_edit_request', {
      profile_edit_request_id: data.id,
    });

    res.json({ success: true, request_id: data.id });
  } catch (err: any) {
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

export default router;
