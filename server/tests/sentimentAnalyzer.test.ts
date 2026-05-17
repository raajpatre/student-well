import { describe, it, expect } from 'vitest';
import { analyzeSentiment } from '../src/services/wellness/sentimentAnalyzer';

describe('analyzeSentiment', () => {
  describe('healthy / positive inputs', () => {
    it('rates a calm positive reflection as Low severity', () => {
      const r = analyzeSentiment(
        'I feel rested, supported, and grateful for my friends. Good week.',
      );
      expect(r.severity).toBe('Low');
      expect(r.sentiment.label).toBe('positive');
      expect(r.distressDetected).toBe(false);
      expect(r.emotionalScore).toBeGreaterThan(70);
    });

    it('handles an empty input safely', () => {
      const r = analyzeSentiment('');
      expect(r.severity).toBe('Low');
      expect(r.detectedKeywords).toEqual([]);
      expect(r.distressDetected).toBe(false);
    });

    it('handles a no-signal sentence as neutral', () => {
      const r = analyzeSentiment('Today I went to class and finished my notes.');
      expect(r.distressDetected).toBe(false);
      expect(r.severity).toBe('Low');
    });
  });

  describe('indicator extraction', () => {
    it('flags loneliness from loneliness lexicon', () => {
      const r = analyzeSentiment(
        "I feel lonely and disconnected, no one notices when I'm withdrawn.",
      );
      expect(r.indicators.loneliness).toBeGreaterThan(0);
      expect(r.detectedKeywords).toContain('lonely');
      expect(r.detectedKeywords).toContain('disconnected');
    });

    it('flags exhaustion + sleep decline from burnout language', () => {
      const r = analyzeSentiment(
        'I am exhausted, burned out, drained, and barely slept all week.',
      );
      expect(r.indicators.exhaustion).toBeGreaterThan(0);
      expect(r.indicators.sleepDecline).toBeGreaterThan(0);
      expect(r.severity).toMatch(/High|Critical/);
    });

    it('flags anxiety from worry language', () => {
      const r = analyzeSentiment(
        'I am anxious and worried, with racing thoughts and a constant fear.',
      );
      expect(r.indicators.anxiety).toBeGreaterThan(0);
    });

    it('deduplicates repeated keyword hits', () => {
      const r = analyzeSentiment('lonely lonely lonely lonely lonely');
      expect(r.detectedKeywords).toEqual(['lonely']);
    });
  });

  describe('distress detection (Critical band)', () => {
    it('detects explicit suicide language', () => {
      const r = analyzeSentiment('I just want to die, I have a plan, no reason to live.');
      expect(r.distressDetected).toBe(true);
      expect(r.severity).toBe('Critical');
    });

    it('detects self-harm phrasing', () => {
      const r = analyzeSentiment('I want to hurt myself.');
      expect(r.distressDetected).toBe(true);
      expect(r.severity).toBe('Critical');
    });

    it('does not flag distress for ordinary stress', () => {
      const r = analyzeSentiment('I am stressed about exams but managing.');
      expect(r.distressDetected).toBe(false);
      expect(r.severity).not.toBe('Critical');
    });
  });

  describe('severity bands', () => {
    it('returns severity as one of the four enum values', () => {
      const inputs = [
        '',
        'rested supported',
        'tired stressed',
        'exhausted burned out lonely disconnected',
        'want to die',
      ];
      for (const text of inputs) {
        const sev = analyzeSentiment(text).severity;
        expect(['Low', 'Moderate', 'High', 'Critical']).toContain(sev);
      }
    });
  });

  describe('clamping & shape', () => {
    it('keeps emotionalScore in [0, 100]', () => {
      for (const text of ['', 'good', 'want to die hopeless lonely exhausted']) {
        const score = analyzeSentiment(text).emotionalScore;
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      }
    });

    it('keeps every indicator in [0, 100]', () => {
      const r = analyzeSentiment(
        'lonely lonely lonely lonely exhausted exhausted exhausted exhausted',
      );
      for (const v of Object.values(r.indicators)) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
    });

    it('confidence is in [0, 1]', () => {
      const r = analyzeSentiment('I feel calm and supported.');
      expect(r.sentiment.confidence).toBeGreaterThanOrEqual(0);
      expect(r.sentiment.confidence).toBeLessThanOrEqual(1);
    });
  });
});
