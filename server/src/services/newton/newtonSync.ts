// SECURITY: access tokens are never logged — only error types and student IDs
import { supabase } from '../../lib/supabase';
import { logger } from '../../lib/logger';
import { decryptToken } from '../../utils/encryption';
import { isTokenExpired, isTokenExpiringSoon, daysUntilExpiry } from '../../utils/newtonTokenExpiry';
import { notify } from '../notificationService';
import { calculateAcademicStatus } from '../wellnessCalculator';
import {
  newtonListCourses,
  newtonGetCourseOverview,
  newtonGetArenaStats,
  pickActiveCourse,
  NewtonAuthError,
} from './newtonRestClient';

interface NewtonData {
  courseHash: string;
  courseName: string;
  lecturesAttended: number;
  lecturesTotal: number;
  assignmentsCompleted: number;
  assignmentsTotal: number;
  assessmentsCompleted: number;
  assessmentsTotal: number;
  xpTotal: number;
  batchRank: number;
  batchSize: number;
}

export async function fetchNewtonData(accessToken: string): Promise<NewtonData> {
  const courses = await newtonListCourses(accessToken);
  const { hash: courseHash, title: courseName } = pickActiveCourse(courses);

  const [overview, arena] = await Promise.all([
    newtonGetCourseOverview(accessToken, courseHash),
    newtonGetArenaStats(accessToken, courseHash),
  ]);

  return {
    courseHash,
    courseName,
    lecturesAttended: overview.total_lectures_attended ?? 0,
    lecturesTotal: overview.total_lectures ?? 0,
    assignmentsCompleted: overview.total_completed_assignment_questions ?? 0,
    assignmentsTotal: overview.total_assignment_questions ?? 0,
    assessmentsCompleted: overview.total_completed_assessments ?? 0,
    assessmentsTotal: overview.total_assessments ?? 0,
    xpTotal: arena.total_earned_points ?? 0,
    batchRank: arena.overall_rank ?? 0,
    batchSize: arena.student_count ?? 0,
  };
}

export async function syncStudent(studentId: string, tenantId: string): Promise<void> {
  const now = new Date().toISOString();

  try {
    // a. Fetch credentials
    const { data: cred, error: credErr } = await supabase
      .from('newton_credentials')
      .select('encrypted_token, expires_at')
      .eq('student_id', studentId)
      .eq('tenant_id', tenantId)
      .single();

    if (credErr || !cred) throw new Error('No Newton credentials found for student');

    // b. Check token expiry
    if (cred.expires_at && isTokenExpired(cred.expires_at)) {
      await supabase
        .from('newton_credentials')
        .update({ last_sync_status: 'token_expired', last_sync_at: now })
        .eq('student_id', studentId);
      throw new Error('Newton token expired');
    }

    // c. Decrypt token
    const accessToken = decryptToken(cred.encrypted_token);

    // d. Fetch data from Newton API
    const data = await fetchNewtonData(accessToken);

    // e. Calculate percentages (guard against division by zero)
    const attendancePct = data.lecturesTotal > 0
      ? (data.lecturesAttended / data.lecturesTotal) * 100
      : 0;
    const assignmentPct = data.assignmentsTotal > 0
      ? (data.assignmentsCompleted / data.assignmentsTotal) * 100
      : 0;

    // f. Upsert lms_data
    await supabase.from('lms_data').upsert({
      student_id: studentId,
      tenant_id: tenantId,
      source: 'newton_mcp',
      attendance_pct: Math.round(attendancePct * 100) / 100,
      assignment_completion_pct: Math.round(assignmentPct * 100) / 100,
      assessments_completed: data.assessmentsCompleted,
      assessments_total: data.assessmentsTotal,
      lectures_attended: data.lecturesAttended,
      lectures_total: data.lecturesTotal,
      xp_total: data.xpTotal,
      batch_rank: data.batchRank,
      batch_size: data.batchSize,
      raw_data: data as unknown as object,
      synced_at: now,
    }, { onConflict: 'student_id' });

    // g. Recalculate wellness academic status
    await calculateAcademicStatus(studentId, tenantId);

    // h. Update credentials row
    await supabase
      .from('newton_credentials')
      .update({
        last_sync_at: now,
        last_sync_status: 'success',
        last_sync_error: null,
        newton_course_hash: data.courseHash,
        newton_course_name: data.courseName,
        newton_student_count: data.batchSize,
      })
      .eq('student_id', studentId);

    // i. Token expiry warning (30-day window)
    if (cred.expires_at && isTokenExpiringSoon(cred.expires_at)) {
      const days = daysUntilExpiry(cred.expires_at);
      void notify(
        studentId,
        tenantId,
        `Your Newton School connection expires in ${days} day${days === 1 ? '' : 's'}. Please reconnect to keep your academic data syncing.`,
        'newton_expiry_warning',
        'in_app',
      );
    }

  } catch (err: any) {
    const errorMessage = (err?.message ?? 'Unknown error').slice(0, 500);
    const isExpired =
      err instanceof NewtonAuthError ||
      errorMessage.includes('expired') ||
      errorMessage.includes('token_expired');

    // Update credentials with failure
    await supabase
      .from('newton_credentials')
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_status: isExpired ? 'token_expired' : 'failed',
        last_sync_error: errorMessage,
      })
      .eq('student_id', studentId);

    // Audit log (NO token in metadata)
    void supabase.from('audit_logs').insert({
      tenant_id: tenantId,
      actor_id: studentId,
      action: 'newton_sync_failed',
      metadata: { student_id: studentId, error_type: isExpired ? 'token_expired' : 'sync_error' },
    });

    logger.warn({ studentId, errorType: isExpired ? 'token_expired' : 'sync_error' }, 'Newton sync failed for student');
    // Do NOT rethrow — one student's failure is isolated
  }
}

export async function syncAllStudents(tenantId?: string): Promise<void> {
  const startMs = Date.now();
  logger.info({ tenantId }, 'Newton sync batch starting');

  let query = supabase
    .from('newton_credentials')
    .select('student_id, tenant_id')
    .not('last_sync_status', 'eq', 'syncing');

  if (tenantId) query = query.eq('tenant_id', tenantId);

  const { data: rows, error } = await query;
  if (error || !rows) {
    logger.error({ err: error }, 'Failed to query newton_credentials for batch sync');
    return;
  }

  let succeeded = 0;
  let failed = 0;
  const BATCH_SIZE = 10;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(row =>
        syncStudent(row.student_id, row.tenant_id)
          .then(() => { succeeded++; })
          .catch(() => { failed++; }),
      ),
    );

    if (i + BATCH_SIZE < rows.length) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  const durationMs = Date.now() - startMs;

  // Log batch completion (find a manager for the audit log actor)
  const { data: managers } = await supabase
    .from('users')
    .select('id, tenant_id')
    .eq('role', 'manager')
    .limit(1);

  if (managers?.length) {
    void supabase.from('audit_logs').insert({
      tenant_id: managers[0].tenant_id,
      actor_id: managers[0].id,
      action: 'newton_sync_batch_complete',
      metadata: {
        students_attempted: rows.length,
        students_succeeded: succeeded,
        students_failed: failed,
        duration_ms: durationMs,
      },
    });
  }

  logger.info({ attempted: rows.length, succeeded, failed, durationMs }, 'Newton sync batch complete');
}
