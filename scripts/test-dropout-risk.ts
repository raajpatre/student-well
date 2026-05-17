// Smoke test for the dropout risk scoring algorithm.
// Pure function tests — no DB, no Newton. Run: npx tsx scripts/test-dropout-risk.ts

import { computeDropoutRisk } from '../server/src/services/wellness/dropoutRiskService';

const cases = [
  {
    label: 'Healthy student — your real Newton data',
    current: {
      attendance_pct: 89.58,
      assignment_completion_pct: 98.97,
      assessments_completed: 60,
      assessments_total: 69,
      batch_rank: null,
      batch_size: 126,
    },
    snapshots: [],
  },
  {
    label: 'Mid-risk student (low attendance)',
    current: {
      attendance_pct: 68,
      assignment_completion_pct: 70,
      assessments_completed: 35,
      assessments_total: 50,
      batch_rank: 80,
      batch_size: 120,
    },
    snapshots: [],
  },
  {
    label: 'High-risk student (everything low, declining)',
    current: {
      attendance_pct: 45,
      assignment_completion_pct: 40,
      assessments_completed: 10,
      assessments_total: 50,
      batch_rank: 115,
      batch_size: 120,
    },
    snapshots: [
      // oldest first when reversed inside service; we pass newest-first like DB does
      { attendance_pct: 45, assessments_completed: 10, assessments_total: 50, captured_at: 'w-now' },
      { attendance_pct: 55, assessments_completed: 20, assessments_total: 50, captured_at: 'w-1' },
      { attendance_pct: 65, assessments_completed: 30, assessments_total: 50, captured_at: 'w-2' },
    ],
  },
];

for (const c of cases) {
  const r = computeDropoutRisk(c.current as any, c.snapshots as any);
  // eslint-disable-next-line no-console
  console.log(`\n[${c.label}]`);
  // eslint-disable-next-line no-console
  console.log(`  riskScore=${r.riskScore}  riskLevel=${r.riskLevel}`);
  for (const [k, v] of Object.entries(r.contributingFactors)) {
    // eslint-disable-next-line no-console
    console.log(`    ${k}: +${v.pointsAdded}  value=${JSON.stringify(v.value)}${v.note ? `  [${v.note}]` : ''}`);
  }
}
