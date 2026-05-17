// Dropout risk scoring.
//
// Ported (with substantial adaptation) from a sibling Newton-integration
// backend whose author wrote against mock data. The original algorithm
// expected fields Newton doesn't expose (per-subject attendance, weekly
// trend, per-exam grades, late-vs-on-time assignment split). This version
// uses only what the real Newton REST surface gives us — see
// scripts/newton-api-contract.json — plus our own lms_snapshots history
// for trend factors.
//
// The score is the SUM of factor contributions, capped at 100, banded into
// low / medium / high / critical. We persist score + level + the factor
// breakdown so managers can see *why* a student is flagged, not just that
// they are.
//
// Factor weights (mirrors the source model where the signal is available):
//
//   attendancePct                   0-30 pts   (≤60% → 30, ≤75% → 15, else 0)
//   attendanceTrend (3-week decline) 0-15 pts  (needs ≥3 snapshots; else skip)
//   assignmentCompletionPct          0-10 pts  (≤50% → 10, else 0)
//   assessmentCompletionPct          0-20 pts  (≤50% → 20, else 0)
//                                              (proxy for exam score —
//                                               Newton doesn't expose marks)
//   assessmentTrend (3-week decline) 0-20 pts  (needs ≥3 snapshots; else skip)
//   batchRankPercentile              0-5 pts   (bottom quartile → 5)
//
//   Total max = 100. Bands: ≤25 low, ≤50 medium, ≤75 high, else critical.

import { supabase } from '../../lib/supabase';
import { logger } from '../../lib/logger';

export type DropoutRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface FactorContribution {
  value: number | string | null;
  pointsAdded: number;
  note?: string;
}

export interface DropoutRiskResult {
  riskScore: number; // 0-100
  riskLevel: DropoutRiskLevel;
  contributingFactors: {
    overallAttendance: FactorContribution;
    attendanceTrend: FactorContribution;
    assignmentCompletion: FactorContribution;
    assessmentCompletion: FactorContribution;
    assessmentTrend: FactorContribution;
    batchRankPercentile: FactorContribution;
  };
  computedAt: string;
}

export interface LmsCurrentRow {
  attendance_pct: number | null;
  assignment_completion_pct: number | null;
  assessments_completed: number | null;
  assessments_total: number | null;
  batch_rank: number | null;
  batch_size: number | null;
}

export interface LmsSnapshotRow {
  attendance_pct: number | null;
  assessments_completed: number | null;
  assessments_total: number | null;
  captured_at: string;
}

function pctOrNull(completed: number | null, total: number | null): number | null {
  if (completed == null || total == null || total <= 0) return null;
  return (completed / total) * 100;
}

function bandFor(score: number): DropoutRiskLevel {
  if (score <= 25) return 'low';
  if (score <= 50) return 'medium';
  if (score <= 75) return 'high';
  return 'critical';
}

/**
 * Detects "declining for 3+ consecutive observations". Returns true when the
 * series strictly decreases across the most recent 3 readings (oldest → newest).
 */
function isDeclining(series: Array<number | null>): boolean {
  const cleaned = series.filter((v): v is number => typeof v === 'number');
  if (cleaned.length < 3) return false;
  const tail = cleaned.slice(-3);
  return tail[0] > tail[1] && tail[1] > tail[2];
}

export function computeDropoutRisk(
  current: LmsCurrentRow,
  snapshots: LmsSnapshotRow[],
): DropoutRiskResult {
  let score = 0;
  const factors: DropoutRiskResult['contributingFactors'] = {
    overallAttendance: { value: null, pointsAdded: 0 },
    attendanceTrend: { value: null, pointsAdded: 0 },
    assignmentCompletion: { value: null, pointsAdded: 0 },
    assessmentCompletion: { value: null, pointsAdded: 0 },
    assessmentTrend: { value: null, pointsAdded: 0 },
    batchRankPercentile: { value: null, pointsAdded: 0 },
  };

  // 1. Overall attendance (30 pts)
  const attendancePct = current.attendance_pct ?? null;
  if (attendancePct != null) {
    if (attendancePct < 60) {
      score += 30;
      factors.overallAttendance = { value: Math.round(attendancePct), pointsAdded: 30 };
    } else if (attendancePct < 75) {
      score += 15;
      factors.overallAttendance = { value: Math.round(attendancePct), pointsAdded: 15 };
    } else {
      factors.overallAttendance = { value: Math.round(attendancePct), pointsAdded: 0 };
    }
  } else {
    factors.overallAttendance = { value: null, pointsAdded: 0, note: 'missing' };
  }

  // 2. Attendance trend — declining across last 3 snapshots (15 pts).
  // Snapshots arrive newest-first from the DB; reverse to chronological.
  const chronological = snapshots.slice().reverse();
  const attSeries = chronological.map((s) => s.attendance_pct);
  if (attSeries.filter((v) => typeof v === 'number').length >= 3) {
    if (isDeclining(attSeries)) {
      score += 15;
      factors.attendanceTrend = { value: 'declining', pointsAdded: 15 };
    } else {
      factors.attendanceTrend = { value: 'stable', pointsAdded: 0 };
    }
  } else {
    factors.attendanceTrend = {
      value: null,
      pointsAdded: 0,
      note: `need ≥3 snapshots, have ${attSeries.length}`,
    };
  }

  // 3. Assignment completion (10 pts) — substitutes for friend's
  // "submission rate < 50%" since Newton doesn't separate late vs on-time.
  const assignmentPct = current.assignment_completion_pct ?? null;
  if (assignmentPct != null) {
    if (assignmentPct < 50) {
      score += 10;
      factors.assignmentCompletion = { value: Math.round(assignmentPct), pointsAdded: 10 };
    } else {
      factors.assignmentCompletion = { value: Math.round(assignmentPct), pointsAdded: 0 };
    }
  } else {
    factors.assignmentCompletion = { value: null, pointsAdded: 0, note: 'missing' };
  }

  // 4. Assessment completion (20 pts) — proxy for friend's avg-exam-score.
  // Newton's API gives us completion ratios, not marks. Conservative reading:
  // a student who hasn't completed half the assessments is showing
  // disengagement equivalent to the friend's <50% avg score.
  const assessmentPct = pctOrNull(current.assessments_completed, current.assessments_total);
  if (assessmentPct != null) {
    if (assessmentPct < 50) {
      score += 20;
      factors.assessmentCompletion = { value: Math.round(assessmentPct), pointsAdded: 20 };
    } else {
      factors.assessmentCompletion = { value: Math.round(assessmentPct), pointsAdded: 0 };
    }
  } else {
    factors.assessmentCompletion = { value: null, pointsAdded: 0, note: 'no assessment data' };
  }

  // 5. Assessment-completion trend (20 pts) — declining across 3 snapshots.
  const assessmentSeries = chronological.map((s) =>
    pctOrNull(s.assessments_completed, s.assessments_total),
  );
  if (assessmentSeries.filter((v) => typeof v === 'number').length >= 3) {
    if (isDeclining(assessmentSeries)) {
      score += 20;
      factors.assessmentTrend = { value: 'declining', pointsAdded: 20 };
    } else {
      factors.assessmentTrend = { value: 'stable', pointsAdded: 0 };
    }
  } else {
    factors.assessmentTrend = {
      value: null,
      pointsAdded: 0,
      note: `need ≥3 snapshots, have ${assessmentSeries.filter((v) => v != null).length}`,
    };
  }

  // 6. Batch-rank percentile (5 pts) — bottom quartile.
  // Newton-specific signal not in the source model.
  if (
    typeof current.batch_rank === 'number' &&
    typeof current.batch_size === 'number' &&
    current.batch_size > 0 &&
    current.batch_rank > 0
  ) {
    const percentile = current.batch_rank / current.batch_size;
    if (percentile >= 0.75) {
      score += 5;
      factors.batchRankPercentile = {
        value: Math.round(percentile * 100),
        pointsAdded: 5,
      };
    } else {
      factors.batchRankPercentile = {
        value: Math.round(percentile * 100),
        pointsAdded: 0,
      };
    }
  } else {
    factors.batchRankPercentile = { value: null, pointsAdded: 0, note: 'no rank data' };
  }

  const cappedScore = Math.min(score, 100);
  const riskLevel = bandFor(cappedScore);

  return {
    riskScore: cappedScore,
    riskLevel,
    contributingFactors: factors,
    computedAt: new Date().toISOString(),
  };
}

/**
 * Pipeline entry: read current lms_data + recent snapshots for one student,
 * compute risk, persist on lms_data, return the result for callers that
 * also want to act (e.g. raising flags). Errors are logged and swallowed —
 * a failed risk calc must not break the surrounding sync.
 */
export async function recomputeDropoutRiskForStudent(
  studentId: string,
  tenantId: string,
): Promise<DropoutRiskResult | null> {
  try {
    const { data: current, error: currentErr } = await supabase
      .from('lms_data')
      .select(
        'attendance_pct, assignment_completion_pct, assessments_completed, assessments_total, batch_rank, batch_size',
      )
      .eq('student_id', studentId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (currentErr || !current) {
      logger.warn({ studentId, err: currentErr }, 'recomputeDropoutRisk: no lms_data row');
      return null;
    }

    const { data: snapshots } = await supabase
      .from('lms_snapshots')
      .select('attendance_pct, assessments_completed, assessments_total, captured_at')
      .eq('student_id', studentId)
      .eq('tenant_id', tenantId)
      .order('captured_at', { ascending: false })
      .limit(6);

    const result = computeDropoutRisk(
      current as LmsCurrentRow,
      (snapshots ?? []) as LmsSnapshotRow[],
    );

    const { error: persistErr } = await supabase
      .from('lms_data')
      .update({
        dropout_risk_score: result.riskScore,
        dropout_risk_level: result.riskLevel,
        dropout_risk_factors: result.contributingFactors as unknown as object,
        dropout_risk_computed_at: result.computedAt,
      })
      .eq('student_id', studentId)
      .eq('tenant_id', tenantId);

    if (persistErr) {
      logger.error({ err: persistErr, studentId }, 'Failed to persist dropout risk');
    }

    return result;
  } catch (err) {
    logger.error({ err, studentId }, 'recomputeDropoutRiskForStudent failed');
    return null;
  }
}
