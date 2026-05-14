// SECURITY: access tokens are never logged — only error types and student IDs
import { supabase } from '../../lib/supabase';
import { logger } from '../../lib/logger';
import { decryptToken } from '../../utils/encryption';
import { isTokenExpired, isTokenExpiringSoon, daysUntilExpiry } from '../../utils/newtonTokenExpiry';
import { notify } from '../notificationService';
import { calculateAcademicStatus } from '../wellnessCalculator';

const NEWTON_BASE = 'https://my.newtonschool.co';

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

async function newtonGet(path: string, accessToken: string): Promise<any> {
  const res = await fetch(`${NEWTON_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 401) throw new Error('Newton token invalid or expired (401)');
  if (!res.ok) throw new Error(`Newton API error: ${res.status}`);
  return res.json();
}

export async function fetchNewtonData(accessToken: string): Promise<NewtonData> {
  const courses: any[] = await newtonGet(
    '/api/v2/course/all/applied/?pagination=false&completed=false',
    accessToken,
  );

  if (!Array.isArray(courses) || courses.length === 0) {
    throw new Error('No courses found in Newton account');
  }

  // NST courses nest semesters under children_courses.admin_unit_courses; use the first semester hash.
  // Non-NST students get their first enrolled course.
  let courseHash: string;
  let courseName: string;

  const nstCourse = courses.find(c => c.children_courses?.is_parent_admin_unit_course === true);
  if (nstCourse) {
    const semesters: any[] = nstCourse.children_courses?.admin_unit_courses ?? [];
    if (semesters.length === 0) throw new Error('NST course found but no semester data available');
    courseHash = semesters[0].hash;
    courseName = semesters[0].title;
  } else {
    const enrolled = courses.find(c => c.user_status === 8);
    if (!enrolled) throw new Error('No enrolled courses found in Newton account');
    courseHash = enrolled.hash;
    courseName = enrolled.title;
  }

  // Fetch performance metrics and XP concurrently
  const [perf, xp] = await Promise.all([
    newtonGet(`/api/v2/course/h/${courseHash}/self_performance/`, accessToken),
    newtonGet(`/api/v2/course/h/${courseHash}/experience_points/`, accessToken),
  ]);

  return {
    courseHash,
    courseName,
    lecturesAttended: perf.total_lectures_attended ?? 0,
    lecturesTotal: perf.total_lectures ?? 0,
    assignmentsCompleted: perf.total_completed_assignment_questions ?? 0,
    assignmentsTotal: perf.total_assignment_questions ?? 0,
    assessmentsCompleted: perf.total_completed_assessments ?? 0,
    assessmentsTotal: perf.total_assessments ?? 0,
    xpTotal: xp.total_earned_points ?? 0,
    batchRank: xp.overall_rank ?? 0,
    batchSize: xp.student_count ?? 0,
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
    const isExpired = errorMessage.includes('expired') || errorMessage.includes('token_expired');

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
