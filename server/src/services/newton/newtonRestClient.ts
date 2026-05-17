// Typed REST client for the Newton School API.
//
// All endpoints below are documented in scripts/newton-api-contract.json
// and were discovered against a live token. Token never appears in logs.
//
// On Render (Linux), we cannot spawn the compiled @newtonschool/newton-mcp
// binary, so this client uses fetch() exclusively — no subprocess fallback
// is reached in the primary code path. A platform-gated fallback hook is
// included for completeness (Phase 3) but only fires for endpoints that
// were not discovered and only on macOS arm64 local development.

import os from 'node:os';
import { logger } from '../../lib/logger';
import type {
  NewtonMe,
  NewtonCourses,
  NewtonCourseOverview,
  NewtonArenaStats,
} from './types';

const NEWTON_BASE = 'https://my.newtonschool.co';
const USER_AGENT = 'newton-mcp/0.3.2';

// ── Errors ──────────────────────────────────────────────────────────

export class NewtonAuthError extends Error {
  constructor(message = 'Newton token invalid or expired (401)') {
    super(message);
    this.name = 'NewtonAuthError';
  }
}

export class NewtonApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'NewtonApiError';
    this.status = status;
  }
}

// ── Internal fetch helper ───────────────────────────────────────────

async function newtonGet<T>(token: string, path: string): Promise<T> {
  logger.debug({ path }, 'newton REST request');

  const res = await fetch(`${NEWTON_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'User-Agent': USER_AGENT,
    },
  });

  if (res.status === 401) {
    throw new NewtonAuthError();
  }
  if (!res.ok) {
    throw new NewtonApiError(res.status, `Newton API error: ${res.status} for ${path}`);
  }

  return (await res.json()) as T;
}

// ── Public typed endpoints ──────────────────────────────────────────

/** GET /api/v1/user/me — student profile. Used to verify a freshly pasted token. */
export async function newtonGetMe(token: string): Promise<NewtonMe> {
  return newtonGet<NewtonMe>(token, '/api/v1/user/me');
}

/**
 * GET /api/v2/course/all/applied/ — every course the student is enrolled in.
 * NST students have a single "parent" course whose semesters live under
 * children_courses.admin_unit_courses; non-NST students have flat courses.
 */
export async function newtonListCourses(token: string): Promise<NewtonCourses> {
  return newtonGet<NewtonCourses>(
    token,
    '/api/v2/course/all/applied/?pagination=false&completed=false',
  );
}

/**
 * GET /api/v2/course/h/{hash}/self_performance/ — aggregate progress numbers
 * for one course (lectures, assignments, assessments). This is what we read
 * to compute attendance_pct and assignment_completion_pct.
 */
export async function newtonGetCourseOverview(
  token: string,
  courseHash: string,
): Promise<NewtonCourseOverview> {
  return newtonGet<NewtonCourseOverview>(
    token,
    `/api/v2/course/h/${encodeURIComponent(courseHash)}/self_performance/`,
  );
}

/**
 * GET /api/v2/course/h/{hash}/experience_points/ — XP, rank, and batch size
 * for the arena leaderboard.
 */
export async function newtonGetArenaStats(
  token: string,
  courseHash: string,
): Promise<NewtonArenaStats> {
  return newtonGet<NewtonArenaStats>(
    token,
    `/api/v2/course/h/${encodeURIComponent(courseHash)}/experience_points/`,
  );
}

// ── Course-hash resolution helper ───────────────────────────────────

/**
 * Picks the active course hash from a course list. NST students get the first
 * semester under their parent course; non-NST students get their first
 * enrolled course (user_status === 8 = ENROLLED).
 */
export function pickActiveCourse(
  courses: NewtonCourses,
): { hash: string; title: string } {
  if (!Array.isArray(courses) || courses.length === 0) {
    throw new NewtonApiError(0, 'No courses found in Newton account');
  }

  const nst = courses.find((c) => c.children_courses && (c.children_courses as any).is_parent_admin_unit_course === true);
  if (nst) {
    const semesters = ((nst.children_courses as any)?.admin_unit_courses ?? []) as Array<{
      hash: string;
      title: string;
    }>;
    if (semesters.length === 0) {
      throw new NewtonApiError(0, 'NST course found but no semester data available');
    }
    return { hash: semesters[0].hash, title: semesters[0].title };
  }

  const enrolled = courses.find((c) => c.user_status === 8);
  if (!enrolled) {
    throw new NewtonApiError(0, 'No enrolled courses found in Newton account');
  }
  return { hash: enrolled.hash, title: enrolled.title };
}

// ── Platform-gated subprocess fallback (Phase 3) ────────────────────
//
// Endpoints NOT YET DISCOVERED via REST:
//   - get_subject_progress  (per-subject breakdown)
//
// For these we cannot fall back via REST. On macOS arm64 (local dev) the
// developer can ALSO have the @newtonschool/newton-mcp binary installed
// and we could spawn it. On Render's Linux runtime the binary will not
// run, and we simply return null so the wellness calculator falls back
// to self-report data. This keeps the primary code path subprocess-free.

const canUseBinary = os.platform() === 'darwin' && os.arch() === 'arm64';

/**
 * Placeholder for undocumented endpoints. Returns null on Linux and warns;
 * on macOS arm64 a future implementation could spawn the local binary, but
 * for now we deliberately return null on all platforms so the production
 * code path never relies on a subprocess.
 *
 * Used by: get_subject_progress (currently undocumented).
 */
export async function newtonFallback<T>(
  _token: string,
  toolName: string,
  _args: Record<string, unknown>,
): Promise<T | null> {
  if (canUseBinary) {
    logger.warn(
      { toolName },
      'Newton REST endpoint not discovered — binary fallback not implemented; returning null',
    );
    return null;
  }
  logger.warn({ toolName }, 'Newton tool not available on Linux (REST endpoint undiscovered)');
  return null;
}
