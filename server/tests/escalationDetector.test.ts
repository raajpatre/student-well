import { describe, it, expect } from 'vitest';
import {
  L1_TRIGGERS,
  L2_TRIGGERS,
  L3_TRIGGERS,
} from '../src/services/escalationDetector';

/** Helper: does any trigger in the set match the input? */
function matches(triggers: RegExp[], input: string): boolean {
  return triggers.some((t) => t.test(input));
}

/** Same shape used by detectEscalation to count L1 hits across a window. */
function countL1(input: string): number {
  return L1_TRIGGERS.reduce((n, t) => (t.test(input) ? n + 1 : n), 0);
}

describe('escalation triggers', () => {
  describe('Level 3 — immediate risk', () => {
    it.each([
      ['I am going to hurt myself tonight'],
      ["I'm going to hurt myself"],
      ['I have a plan to end this'],
      ['kill myself'],
      ['I want to end my life'],
      ['suicide has crossed my mind'],
    ])('matches "%s"', (text) => {
      expect(matches(L3_TRIGGERS, text)).toBe(true);
    });

    it('is case-insensitive', () => {
      expect(matches(L3_TRIGGERS, 'SUICIDE')).toBe(true);
      expect(matches(L3_TRIGGERS, 'KILL Myself')).toBe(true);
    });

    it('does not match unrelated text', () => {
      expect(matches(L3_TRIGGERS, 'I feel okay today')).toBe(false);
      expect(matches(L3_TRIGGERS, 'I went to a friends birthday party')).toBe(false);
    });
  });

  describe('Level 2 — single-message escalation', () => {
    it.each([
      ['cutting myself'],
      ['I keep hurting myself'],
      ['I want to disappear'],
      ['nobody would miss me'],
      ["what's the point"],
      ['whats the point of trying'],
      ['better off dead'],
      ['not wanting to be alive'],
    ])('matches "%s"', (text) => {
      expect(matches(L2_TRIGGERS, text)).toBe(true);
    });

    it('does not match ordinary stress language', () => {
      expect(matches(L2_TRIGGERS, 'I am stressed about exams')).toBe(false);
      expect(matches(L2_TRIGGERS, 'I feel sad')).toBe(false);
    });
  });

  describe('Level 1 — sustained distress (requires 3+ hits)', () => {
    it.each([
      'overwhelmed',
      'hopeless',
      'exhausted',
      "can't do this anymore",
      'cant do this anymore',
      'falling apart',
      'giving up',
    ])('matches "%s" as a single hit', (text) => {
      expect(matches(L1_TRIGGERS, text)).toBe(true);
    });

    it('single L1 keyword in a message does not on its own reach the L1 threshold', () => {
      // The DB-touching detectEscalation requires l1Matches >= 3 across new message
      // plus session history. A single message hitting one L1 keyword is below threshold.
      expect(countL1('I feel overwhelmed today')).toBe(1);
    });

    it('counts multiple L1 keywords in one message correctly', () => {
      const text = 'I am overwhelmed and exhausted and hopeless and giving up';
      expect(countL1(text)).toBe(4);
    });

    it('does not match harmless language', () => {
      expect(countL1('I went to class and worked on my project')).toBe(0);
    });
  });

  describe('cross-level ordering invariant', () => {
    it('L3 patterns are distinct from L1 patterns (no accidental promotion)', () => {
      // None of the single L1 keywords should accidentally match an L3 pattern.
      const l1Words = ['overwhelmed', 'hopeless', 'exhausted', 'falling apart', 'giving up'];
      for (const w of l1Words) {
        expect(matches(L3_TRIGGERS, w)).toBe(false);
      }
    });

    it('L2 patterns are distinct from L1 patterns', () => {
      const l1Words = ['overwhelmed', 'hopeless', 'exhausted', 'falling apart', 'giving up'];
      for (const w of l1Words) {
        expect(matches(L2_TRIGGERS, w)).toBe(false);
      }
    });
  });
});
