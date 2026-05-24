import { describe, it, expect } from 'vitest';
import {
  computeDropoutRisk,
  type LmsCurrentRow,
  type LmsSnapshotRow,
} from '../src/services/wellness/dropoutRiskService';

const ROBUST_STUDENT: LmsCurrentRow = {
  attendance_pct: 90,
  assignment_completion_pct: 95,
  assessments_completed: 18,
  assessments_total: 20,
  batch_rank: 10,
  batch_size: 100,
};

const STRUGGLING_STUDENT: LmsCurrentRow = {
  attendance_pct: 45,
  assignment_completion_pct: 40,
  assessments_completed: 5,
  assessments_total: 30,
  batch_rank: 95,
  batch_size: 100,
};

// Snapshots arrive newest-first from the DB; the service reverses to chronological.
const DECLINING_SNAPSHOTS: LmsSnapshotRow[] = [
  { attendance_pct: 45, assessments_completed: 5, assessments_total: 30, captured_at: 'w-now' },
  { attendance_pct: 55, assessments_completed: 10, assessments_total: 30, captured_at: 'w-1' },
  { attendance_pct: 65, assessments_completed: 15, assessments_total: 30, captured_at: 'w-2' },
];

const STABLE_SNAPSHOTS: LmsSnapshotRow[] = [
  { attendance_pct: 88, assessments_completed: 18, assessments_total: 20, captured_at: 'w-now' },
  { attendance_pct: 90, assessments_completed: 17, assessments_total: 20, captured_at: 'w-1' },
  { attendance_pct: 89, assessments_completed: 18, assessments_total: 20, captured_at: 'w-2' },
];

describe('computeDropoutRisk', () => {
  describe('band mapping', () => {
    it('a healthy student lands in the low band', () => {
      const r = computeDropoutRisk(ROBUST_STUDENT, []);
      expect(r.riskLevel).toBe('low');
      expect(r.riskScore).toBeLessThanOrEqual(25);
    });

    it('a student missing one threshold scores in low or medium', () => {
      const r = computeDropoutRisk(
        { ...ROBUST_STUDENT, attendance_pct: 68 },
        [],
      );
      // 15 points for attendance in the 60-75 band, nothing else.
      expect(r.riskScore).toBe(15);
      expect(r.riskLevel).toBe('low');
    });

    it('a student missing every threshold AND declining lands in critical', () => {
      const r = computeDropoutRisk(STRUGGLING_STUDENT, DECLINING_SNAPSHOTS);
      expect(r.riskLevel).toBe('critical');
      expect(r.riskScore).toBe(100); // capped
    });
  });

  describe('attendance factor', () => {
    it('30 points when attendance < 60%', () => {
      const r = computeDropoutRisk({ ...ROBUST_STUDENT, attendance_pct: 55 }, []);
      expect(r.contributingFactors.overallAttendance.pointsAdded).toBe(30);
    });

    it('15 points when attendance is in 60-75%', () => {
      const r = computeDropoutRisk({ ...ROBUST_STUDENT, attendance_pct: 70 }, []);
      expect(r.contributingFactors.overallAttendance.pointsAdded).toBe(15);
    });

    it('0 points when attendance >= 75%', () => {
      const r = computeDropoutRisk({ ...ROBUST_STUDENT, attendance_pct: 75 }, []);
      expect(r.contributingFactors.overallAttendance.pointsAdded).toBe(0);
    });

    it('annotates the factor as missing when attendance is null', () => {
      const r = computeDropoutRisk({ ...ROBUST_STUDENT, attendance_pct: null }, []);
      expect(r.contributingFactors.overallAttendance.pointsAdded).toBe(0);
      expect(r.contributingFactors.overallAttendance.note).toBe('missing');
    });
  });

  describe('trend factors', () => {
    it('attendance trend fires only with 3+ snapshots showing strict decline', () => {
      const r = computeDropoutRisk(STRUGGLING_STUDENT, DECLINING_SNAPSHOTS);
      expect(r.contributingFactors.attendanceTrend.pointsAdded).toBe(15);
      expect(r.contributingFactors.attendanceTrend.value).toBe('declining');
    });

    it('stays at 0 when fewer than 3 snapshots are available', () => {
      const r = computeDropoutRisk(STRUGGLING_STUDENT, DECLINING_SNAPSHOTS.slice(0, 2));
      expect(r.contributingFactors.attendanceTrend.pointsAdded).toBe(0);
      expect(r.contributingFactors.attendanceTrend.note).toContain('need ≥3');
    });

    it('stays at 0 when 3 snapshots are stable', () => {
      const r = computeDropoutRisk(ROBUST_STUDENT, STABLE_SNAPSHOTS);
      expect(r.contributingFactors.attendanceTrend.pointsAdded).toBe(0);
      expect(r.contributingFactors.attendanceTrend.value).toBe('stable');
    });

    it('assessment trend follows the same pattern', () => {
      const r = computeDropoutRisk(STRUGGLING_STUDENT, DECLINING_SNAPSHOTS);
      expect(r.contributingFactors.assessmentTrend.pointsAdded).toBe(20);
    });
  });

  describe('assignment + assessment factors', () => {
    it('10 points when assignment completion < 50%', () => {
      const r = computeDropoutRisk(
        { ...ROBUST_STUDENT, assignment_completion_pct: 40 },
        [],
      );
      expect(r.contributingFactors.assignmentCompletion.pointsAdded).toBe(10);
    });

    it('20 points when assessment completion < 50%', () => {
      const r = computeDropoutRisk(
        { ...ROBUST_STUDENT, assessments_completed: 5, assessments_total: 30 },
        [],
      );
      expect(r.contributingFactors.assessmentCompletion.pointsAdded).toBe(20);
    });

    it('skips assessment factor when there is no assessment data', () => {
      const r = computeDropoutRisk(
        { ...ROBUST_STUDENT, assessments_completed: null, assessments_total: null },
        [],
      );
      expect(r.contributingFactors.assessmentCompletion.note).toBe('no assessment data');
    });
  });

  describe('batch rank percentile', () => {
    it('adds 5 points when in the bottom quartile', () => {
      const r = computeDropoutRisk(
        { ...ROBUST_STUDENT, batch_rank: 95, batch_size: 100 },
        [],
      );
      expect(r.contributingFactors.batchRankPercentile.pointsAdded).toBe(5);
    });

    it('adds 0 points when in the top quartile', () => {
      const r = computeDropoutRisk(
        { ...ROBUST_STUDENT, batch_rank: 10, batch_size: 100 },
        [],
      );
      expect(r.contributingFactors.batchRankPercentile.pointsAdded).toBe(0);
    });

    it('skips when rank is missing or zero', () => {
      const r = computeDropoutRisk({ ...ROBUST_STUDENT, batch_rank: null }, []);
      expect(r.contributingFactors.batchRankPercentile.note).toBe('no rank data');
    });
  });

  describe('score capping & shape', () => {
    it('caps the score at 100', () => {
      const r = computeDropoutRisk(STRUGGLING_STUDENT, DECLINING_SNAPSHOTS);
      expect(r.riskScore).toBeLessThanOrEqual(100);
    });

    it('always returns a valid risk level', () => {
      for (const current of [ROBUST_STUDENT, STRUGGLING_STUDENT]) {
        const r = computeDropoutRisk(current, []);
        expect(['low', 'medium', 'high', 'critical']).toContain(r.riskLevel);
      }
    });

    it('always includes all six factor entries', () => {
      const r = computeDropoutRisk(ROBUST_STUDENT, []);
      expect(Object.keys(r.contributingFactors).sort()).toEqual(
        [
          'assessmentCompletion',
          'assessmentTrend',
          'assignmentCompletion',
          'attendanceTrend',
          'batchRankPercentile',
          'overallAttendance',
        ].sort(),
      );
    });

    it('exposes a usable computedAt timestamp', () => {
      const r = computeDropoutRisk(ROBUST_STUDENT, []);
      expect(new Date(r.computedAt).getTime()).not.toBeNaN();
    });
  });
});
