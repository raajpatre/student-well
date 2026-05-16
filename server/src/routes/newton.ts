// SECURITY: using Supabase client — parameterized queries, no raw SQL concatenation
// SECURITY: access tokens are never logged
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../lib/supabase';
import { encryptToken } from '../utils/encryption';
import { fetchNewtonData, syncStudent } from '../services/newton/newtonSync';
import { newtonGetMe, NewtonAuthError } from '../services/newton/newtonRestClient';
import { daysUntilExpiry, isTokenExpiringSoon } from '../utils/newtonTokenExpiry';
import { newtonSyncLimiter } from '../middleware/rateLimiters';
import { logger } from '../lib/logger';

const router = Router();

// ── Validation ────────────────────────────────────────────────────────────────

const connectSchema = z.object({
  access_token: z
    .string()
    .min(10)
    .max(500)
    .regex(/^[A-Za-z0-9_\-.]+$/, 'Token contains invalid characters'),
  expires_at: z.number().optional(),
});

// ── POST /api/student/newton/connect ─────────────────────────────────────────

router.post('/connect', async (req: Request, res: Response): Promise<void> => {
  const parsed = connectSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' });
    return;
  }

  const { access_token, expires_at } = parsed.data;
  const studentId = req.user!.id;
  const tenantId = req.user!.tenant_id;

  // Verify token works before storing — newtonGetMe is the cheap dedicated check;
  // fetchNewtonData would also throw, but a profile call gives a clearer 401 signal.
  let newtonData: Awaited<ReturnType<typeof fetchNewtonData>>;
  try {
    await newtonGetMe(access_token);
    newtonData = await fetchNewtonData(access_token);
  } catch (err: any) {
    // Token is invalid — do not create any DB rows
    const userMessage =
      err instanceof NewtonAuthError
        ? 'That token is invalid or expired. Please run `npx @newtonschool/newton-mcp@latest login` again and paste the new access_token.'
        : "We couldn't connect to your Newton account with that token. Make sure you copied the full access_token value from credentials.json.";
    res.status(400).json({ error: userMessage });
    return;
  }

  // Encrypt before storing
  let encryptedToken: string;
  try {
    encryptedToken = encryptToken(access_token);
  } catch (err) {
    logger.error({ err }, 'Encryption failed during Newton connect');
    res.status(500).json({ error: 'Internal error — could not secure token' });
    return;
  }

  const attendancePct =
    newtonData.lecturesTotal > 0
      ? Math.round((newtonData.lecturesAttended / newtonData.lecturesTotal) * 100 * 100) / 100
      : 0;
  const assignmentPct =
    newtonData.assignmentsTotal > 0
      ? Math.round((newtonData.assignmentsCompleted / newtonData.assignmentsTotal) * 100 * 100) / 100
      : 0;

  const now = new Date().toISOString();

  // Upsert credentials
  const { error: credErr } = await supabase.from('newton_credentials').upsert(
    {
      student_id: studentId,
      tenant_id: tenantId,
      encrypted_token: encryptedToken,
      expires_at: expires_at ?? null,
      newton_course_hash: newtonData.courseHash,
      newton_course_name: newtonData.courseName,
      newton_student_count: newtonData.batchSize,
      last_sync_at: now,
      last_sync_status: 'success',
      last_sync_error: null,
      connected_at: now,
    },
    { onConflict: 'student_id' },
  );

  if (credErr) {
    logger.error({ err: credErr, studentId }, 'Failed to upsert newton_credentials');
    res.status(500).json({ error: 'Failed to save credentials' });
    return;
  }

  // Upsert lms_data
  await supabase.from('lms_data').upsert(
    {
      student_id: studentId,
      tenant_id: tenantId,
      source: 'newton_mcp',
      attendance_pct: attendancePct,
      assignment_completion_pct: assignmentPct,
      assessments_completed: newtonData.assessmentsCompleted,
      assessments_total: newtonData.assessmentsTotal,
      lectures_attended: newtonData.lecturesAttended,
      lectures_total: newtonData.lecturesTotal,
      xp_total: newtonData.xpTotal,
      batch_rank: newtonData.batchRank,
      batch_size: newtonData.batchSize,
      raw_data: newtonData as unknown as object,
      synced_at: now,
    },
    { onConflict: 'student_id' },
  );

  // Audit log (no token)
  void supabase.from('audit_logs').insert({
    tenant_id: tenantId,
    actor_id: studentId,
    action: 'newton_connected',
    metadata: { course_name: newtonData.courseName },
  });

  res.json({
    connected: true,
    course_name: newtonData.courseName,
    student_count: newtonData.batchSize,
    attendance_pct: attendancePct,
    assignment_completion_pct: assignmentPct,
    expires_at: expires_at ?? null,
    days_until_expiry: expires_at ? daysUntilExpiry(expires_at) : null,
  });
});

// ── GET /api/student/newton/status ────────────────────────────────────────────

router.get('/status', async (req: Request, res: Response): Promise<void> => {
  const studentId = req.user!.id;
  const tenantId = req.user!.tenant_id;

  const [credRes, lmsRes] = await Promise.all([
    supabase
      .from('newton_credentials')
      .select(
        'newton_course_name, last_sync_at, last_sync_status, last_sync_error, expires_at, newton_student_count',
      )
      .eq('student_id', studentId)
      .eq('tenant_id', tenantId)
      .single(),
    supabase
      .from('lms_data')
      .select('attendance_pct, assignment_completion_pct, lectures_attended, lectures_total')
      .eq('student_id', studentId)
      .eq('tenant_id', tenantId)
      .single(),
  ]);

  if (credRes.error || !credRes.data) {
    res.json({ connected: false });
    return;
  }

  const cred = credRes.data;
  const lms = lmsRes.data;
  const showError = ['failed', 'token_expired'].includes(cred.last_sync_status ?? '');

  res.json({
    connected: true,
    course_name: cred.newton_course_name,
    last_sync_at: cred.last_sync_at,
    last_sync_status: cred.last_sync_status,
    ...(showError ? { last_sync_error: cred.last_sync_error } : {}),
    expires_at: cred.expires_at,
    days_until_expiry: cred.expires_at ? daysUntilExpiry(cred.expires_at) : null,
    expiring_soon: cred.expires_at ? isTokenExpiringSoon(cred.expires_at) : false,
    attendance_pct: lms?.attendance_pct ?? null,
    assignment_completion_pct: lms?.assignment_completion_pct ?? null,
    lectures_attended: lms?.lectures_attended ?? null,
    lectures_total: lms?.lectures_total ?? null,
  });
});

// ── POST /api/student/newton/sync ─────────────────────────────────────────────

router.post('/sync', newtonSyncLimiter, async (req: Request, res: Response): Promise<void> => {
  const studentId = req.user!.id;
  const tenantId = req.user!.tenant_id;

  await syncStudent(studentId, tenantId);

  // Return same shape as GET /status
  const [credRes, lmsRes] = await Promise.all([
    supabase
      .from('newton_credentials')
      .select('newton_course_name, last_sync_at, last_sync_status, last_sync_error, expires_at')
      .eq('student_id', studentId)
      .eq('tenant_id', tenantId)
      .single(),
    supabase
      .from('lms_data')
      .select('attendance_pct, assignment_completion_pct, lectures_attended, lectures_total')
      .eq('student_id', studentId)
      .eq('tenant_id', tenantId)
      .single(),
  ]);

  const cred = credRes.data;
  const lms = lmsRes.data;
  const showError = ['failed', 'token_expired'].includes(cred?.last_sync_status ?? '');

  res.json({
    connected: true,
    course_name: cred?.newton_course_name,
    last_sync_at: cred?.last_sync_at,
    last_sync_status: cred?.last_sync_status,
    ...(showError ? { last_sync_error: cred?.last_sync_error } : {}),
    expires_at: cred?.expires_at,
    days_until_expiry: cred?.expires_at ? daysUntilExpiry(cred.expires_at) : null,
    expiring_soon: cred?.expires_at ? isTokenExpiringSoon(cred.expires_at) : false,
    attendance_pct: lms?.attendance_pct ?? null,
    assignment_completion_pct: lms?.assignment_completion_pct ?? null,
    lectures_attended: lms?.lectures_attended ?? null,
    lectures_total: lms?.lectures_total ?? null,
  });
});

// ── DELETE /api/student/newton/disconnect ─────────────────────────────────────

router.delete('/disconnect', async (req: Request, res: Response): Promise<void> => {
  const studentId = req.user!.id;
  const tenantId = req.user!.tenant_id;

  await Promise.all([
    supabase
      .from('newton_credentials')
      .delete()
      .eq('student_id', studentId)
      .eq('tenant_id', tenantId),
    supabase
      .from('lms_data')
      .delete()
      .eq('student_id', studentId)
      .eq('tenant_id', tenantId),
  ]);

  void supabase.from('audit_logs').insert({
    tenant_id: tenantId,
    actor_id: studentId,
    action: 'newton_disconnected',
  });

  res.json({ disconnected: true });
});

// ── GET /api/manager/newton/sync-status (manager-only) ───────────────────────
// Exported separately and mounted on the manager router.

export const managerNewtonSyncStatus = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const tenantId = req.user!.tenant_id;

  const [totalRes, credRes] = await Promise.all([
    supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('role', 'student')
      .eq('is_active', true),
    supabase
      .from('newton_credentials')
      .select('student_id, last_sync_at, last_sync_status, expires_at')
      .eq('tenant_id', tenantId),
  ]);

  const total = totalRes.count ?? 0;
  const creds = credRes.data ?? [];

  const connected = creds.filter(c => !['failed', 'token_expired'].includes(c.last_sync_status ?? '')).length;
  const syncFailed = creds.filter(c => c.last_sync_status === 'failed').length;
  const tokenExpired = creds.filter(c => c.last_sync_status === 'token_expired').length;
  const neverConnected = total - creds.length;

  const lastBatchSync = creds.reduce((latest: string | null, c) => {
    if (!c.last_sync_at) return latest;
    if (!latest || c.last_sync_at > latest) return c.last_sync_at;
    return latest;
  }, null);

  // Join student names
  const studentIds = creds.map(c => c.student_id);
  const { data: students } = studentIds.length
    ? await supabase
        .from('users')
        .select('id, full_name')
        .in('id', studentIds)
    : { data: [] };

  const studentMap: Record<string, string> = {};
  (students ?? []).forEach(s => { studentMap[s.id] = s.full_name; });

  res.json({
    total_students: total,
    connected,
    sync_failed: syncFailed,
    token_expired: tokenExpired,
    never_connected: neverConnected,
    last_batch_sync: lastBatchSync,
    students: creds.map(c => ({
      student_id: c.student_id,
      full_name: studentMap[c.student_id] ?? 'Unknown',
      connected: !['failed', 'token_expired'].includes(c.last_sync_status ?? ''),
      last_sync_at: c.last_sync_at,
      last_sync_status: c.last_sync_status,
      days_until_expiry: c.expires_at ? daysUntilExpiry(c.expires_at) : null,
    })),
  });
};

export default router;
