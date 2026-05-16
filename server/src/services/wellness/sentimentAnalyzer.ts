// Deterministic keyword-based sentiment analyzer.
//
// Ported (with TS types) from the sibling Mental Health & Social Wellness
// Engine. Pure function — no DB, no I/O. The output structure is the
// canonical "sentiment payload" that the rest of the wellness engine
// (recommendations, adaptive questions, escalation hook) consumes.
//
// Why deterministic? It costs nothing per call, runs offline, and gives
// reproducible labels for moderator review. The LLM-based chat path
// already exists in escalationDetector.ts/chat.routes.ts and remains
// untouched.

export type SentimentLabel = 'positive' | 'neutral' | 'negative';
export type Severity = 'Low' | 'Moderate' | 'High' | 'Critical';

export interface Indicators {
  stress: number;
  loneliness: number;
  exhaustion: number;
  motivationDecline: number;
  anxiety: number;
  sleepDecline: number;
}

export interface SentimentResult {
  sentiment: { label: SentimentLabel; confidence: number };
  emotionalScore: number;
  indicators: Indicators;
  detectedKeywords: string[];
  severity: Severity;
  distressDetected: boolean;
}

const lexicon = {
  positive: [
    'calm', 'connected', 'hopeful', 'okay', 'rested', 'supported',
    'motivated', 'balanced', 'better', 'good', 'peaceful', 'steady',
    'fine', 'happy', 'energised', 'energized', 'grateful',
  ],
  stress: ['stressed', 'pressure', 'chaotic', 'panic', 'overwhelmed', 'buried', 'tense', 'drowning'],
  loneliness: ['lonely', 'alone', 'isolated', 'invisible', 'disconnected', 'left out', 'no one', 'withdrawn'],
  exhaustion: ['exhausted', 'tired', 'drained', 'burned out', 'burnt out', 'heavy', 'empty', 'numb'],
  motivationDecline: ['unmotivated', 'pointless', 'behind', 'stuck', 'cannot focus', "can't focus", 'giving up'],
  anxiety: ['anxious', 'worried', 'fear', 'spiral', 'racing thoughts', 'nervous', 'unsafe'],
  sleepDecline: ['no sleep', 'insomnia', 'restless', 'barely slept', 'sleepless', 'nightmares'],
  distress: ['suicide', 'self harm', 'self-harm', 'hurt myself', 'end it', 'kill myself', 'want to die', 'hopeless', 'no reason to live'],
} as const;

const categoryWeights: Record<keyof Indicators | 'distress', number> = {
  stress: 12,
  loneliness: 13,
  exhaustion: 14,
  motivationDecline: 10,
  anxiety: 12,
  sleepDecline: 10,
  distress: 35,
};

const clamp = (v: number, min = 0, max = 100): number => Math.min(max, Math.max(min, Math.round(v)));

const countMatches = (text: string, terms: readonly string[]): number =>
  terms.reduce((n, term) => (text.includes(term) ? n + 1 : n), 0);

export function analyzeSentiment(input = ''): SentimentResult {
  const text = input.toLowerCase();
  const detectedKeywords: string[] = [];
  const indicators: Indicators = {
    stress: 0,
    loneliness: 0,
    exhaustion: 0,
    motivationDecline: 0,
    anxiety: 0,
    sleepDecline: 0,
  };

  let penalty = 0;
  (Object.keys(indicators) as (keyof Indicators)[]).forEach((category) => {
    const matches = lexicon[category].filter((term) => text.includes(term));
    detectedKeywords.push(...matches);
    indicators[category] = clamp(matches.length * 28, 0, 100);
    penalty += matches.length * categoryWeights[category];
  });

  const distressMatches = lexicon.distress.filter((term) => text.includes(term));
  detectedKeywords.push(...distressMatches);
  penalty += distressMatches.length * categoryWeights.distress;

  const positiveMatches = countMatches(text, lexicon.positive);
  const emotionalScore = clamp(72 + positiveMatches * 6 - penalty);
  const totalNegativeMatches = detectedKeywords.length;

  let label: SentimentLabel = 'neutral';
  if (emotionalScore >= 70 && positiveMatches > totalNegativeMatches) label = 'positive';
  if (emotionalScore < 60 || totalNegativeMatches > positiveMatches) label = 'negative';

  let severity: Severity = 'Low';
  if (distressMatches.length > 0 || emotionalScore < 25) severity = 'Critical';
  else if (emotionalScore < 40 || totalNegativeMatches >= 4) severity = 'High';
  else if (emotionalScore < 60 || totalNegativeMatches >= 2) severity = 'Moderate';

  return {
    sentiment: {
      label,
      confidence: Math.min(1, Math.max(0, Math.abs(70 - emotionalScore) / 70)),
    },
    emotionalScore,
    indicators,
    detectedKeywords: Array.from(new Set(detectedKeywords)),
    severity,
    distressDetected: distressMatches.length > 0,
  };
}
