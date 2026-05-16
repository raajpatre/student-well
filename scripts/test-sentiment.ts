// Smoke test for the deterministic sentiment analyzer.
// Run with: npx tsx scripts/test-sentiment.ts

import { analyzeSentiment } from '../server/src/services/wellness/sentimentAnalyzer';

const cases: Array<{ label: string; text: string }> = [
  { label: 'positive baseline', text: 'I feel rested, supported, and grateful for my friends. Good week.' },
  { label: 'mild stress', text: 'Pretty stressed about exams, a bit overwhelmed but managing.' },
  { label: 'high burnout', text: 'I am exhausted, burned out, drained, and barely slept all week.' },
  { label: 'loneliness', text: "I feel lonely and disconnected, no one notices when I'm withdrawn." },
  { label: 'critical distress', text: 'I just want to die, I have a plan, no reason to live.' },
];

for (const c of cases) {
  const r = analyzeSentiment(c.text);
  // eslint-disable-next-line no-console
  console.log(`\n[${c.label}] severity=${r.severity}  emotionalScore=${r.emotionalScore}  label=${r.sentiment.label}`);
  // eslint-disable-next-line no-console
  console.log('  indicators:', r.indicators);
  // eslint-disable-next-line no-console
  console.log('  detectedKeywords:', r.detectedKeywords);
  // eslint-disable-next-line no-console
  console.log('  distressDetected:', r.distressDetected);
}
