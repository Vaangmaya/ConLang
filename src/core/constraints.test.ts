import { describe, expect, it } from 'vitest';
import { checkConstraints, type Constraint } from './constraints';
import type { PhonemeClass } from './classes';

const CLASSES: PhonemeClass[] = [
  { symbol: 'C', members: ['p', 't', 'k', 'm', 'n', 's'] },
  { symbol: 'V', members: ['a', 'i', 'u'] },
  { symbol: 'N', members: ['m', 'n'] },
];

describe('checkConstraints: BannedSequence', () => {
  it('passes when the sequence never occurs (scope anywhere)', () => {
    const c: Constraint = { type: 'BannedSequence', sequence: ['s', 't'], scope: 'anywhere' };
    const result = checkConstraints(['p', 'a', 't'], [0], [c], CLASSES);
    expect(result.ok).toBe(true);
  });

  it('fails when the sequence occurs anywhere', () => {
    const c: Constraint = { type: 'BannedSequence', sequence: ['s', 't'], scope: 'anywhere' };
    const result = checkConstraints(['p', 's', 't', 'a'], [0], [c], CLASSES);
    expect(result.ok).toBe(false);
    expect(result.failedConstraint).toEqual(c);
  });

  it('resolves class-ref tokens against phoneme classes', () => {
    // N (nasal class) followed by "p" is banned.
    const c: Constraint = { type: 'BannedSequence', sequence: ['N', 'p'], scope: 'anywhere' };
    expect(checkConstraints(['a', 'm', 'p', 'a'], [0], [c], CLASSES).ok).toBe(false);
    expect(checkConstraints(['a', 'm', 'a'], [0], [c], CLASSES).ok).toBe(true);
  });

  it('wordInitial only checks the first window', () => {
    const c: Constraint = { type: 'BannedSequence', sequence: ['s', 't'], scope: 'wordInitial' };
    expect(checkConstraints(['s', 't', 'a'], [0], [c], CLASSES).ok).toBe(false);
    expect(checkConstraints(['a', 's', 't'], [0], [c], CLASSES).ok).toBe(true);
  });

  it('wordFinal only checks the last window', () => {
    const c: Constraint = { type: 'BannedSequence', sequence: ['s', 't'], scope: 'wordFinal' };
    expect(checkConstraints(['a', 's', 't'], [0], [c], CLASSES).ok).toBe(false);
    expect(checkConstraints(['s', 't', 'a'], [0], [c], CLASSES).ok).toBe(true);
  });

  it('withinSyllable vs acrossSyllableBoundary disagree given the same sequence', () => {
    // "s","t" straddling a syllable boundary at index 2: syllables are "as" and "ta".
    const phonemeIds = ['a', 's', 't', 'a'];
    const syllableBreaks = [0, 2];
    const within: Constraint = { type: 'BannedSequence', sequence: ['s', 't'], scope: 'withinSyllable' };
    const across: Constraint = {
      type: 'BannedSequence',
      sequence: ['s', 't'],
      scope: 'acrossSyllableBoundary',
    };
    expect(checkConstraints(phonemeIds, syllableBreaks, [within], CLASSES).ok).toBe(true);
    expect(checkConstraints(phonemeIds, syllableBreaks, [across], CLASSES).ok).toBe(false);
  });

  it('withinSyllable fails when the sequence is inside one syllable', () => {
    const phonemeIds = ['s', 't', 'a'];
    const syllableBreaks = [0];
    const c: Constraint = { type: 'BannedSequence', sequence: ['s', 't'], scope: 'withinSyllable' };
    expect(checkConstraints(phonemeIds, syllableBreaks, [c], CLASSES).ok).toBe(false);
  });
});

describe('checkConstraints: Sonority', () => {
  // stop=1, nasal=4, vowel=7 (subset of the DESIGN.md default scale)
  const scale = { p: 1, t: 1, k: 1, m: 4, n: 4, s: 3, a: 7, i: 7, u: 7 };

  it('passes a rising-then-falling syllable', () => {
    const c: Constraint = { type: 'Sonority', scale, allowPlateaus: false };
    // p(1) t... use m,a,m: nasal(4) < vowel(7) > nasal(4) - unimodal
    const result = checkConstraints(['m', 'a', 'm'], [0], [c], CLASSES);
    expect(result.ok).toBe(true);
  });

  it('fails a non-unimodal syllable (rise, fall, rise)', () => {
    const c: Constraint = { type: 'Sonority', scale, allowPlateaus: false };
    // m(4) a(7) p(1) a(7): falls then rises again -> invalid
    const result = checkConstraints(['m', 'a', 'p', 'a'], [0], [c], CLASSES);
    expect(result.ok).toBe(false);
  });

  it('bans plateaus when allowPlateaus is false', () => {
    const c: Constraint = { type: 'Sonority', scale, allowPlateaus: false };
    // m(4) n(4): equal sonority values adjacent -> plateau
    expect(checkConstraints(['m', 'n', 'a'], [0], [c], CLASSES).ok).toBe(false);
  });

  it('allows plateaus when allowPlateaus is true', () => {
    const c: Constraint = { type: 'Sonority', scale, allowPlateaus: true };
    expect(checkConstraints(['m', 'n', 'a'], [0], [c], CLASSES).ok).toBe(true);
  });

  it('throws when a phoneme id has no scale entry', () => {
    const c: Constraint = { type: 'Sonority', scale: { p: 1 }, allowPlateaus: false };
    expect(() => checkConstraints(['p', 'a'], [0], [c], CLASSES)).toThrow(/no scale entry/);
  });
});

describe('checkConstraints: VowelHarmony', () => {
  const c: Constraint = {
    type: 'VowelHarmony',
    sets: [['a'], ['u']],
    neutral: ['i'],
  };

  it('passes when all non-neutral vowels come from one set', () => {
    expect(checkConstraints(['a', 'k', 'a'], [0], [c], CLASSES).ok).toBe(true);
  });

  it('fails when vowels from two different sets are both present', () => {
    expect(checkConstraints(['a', 'k', 'u'], [0], [c], CLASSES).ok).toBe(false);
  });

  it('passes trivially for a word with only neutral vowels', () => {
    expect(checkConstraints(['i', 'k', 'i'], [0], [c], CLASSES).ok).toBe(true);
  });

  it('neutral vowels may co-occur with either set', () => {
    expect(checkConstraints(['a', 'k', 'i'], [0], [c], CLASSES).ok).toBe(true);
    expect(checkConstraints(['u', 'k', 'i'], [0], [c], CLASSES).ok).toBe(true);
  });
});

describe('checkConstraints: RequiredOnset', () => {
  it('wordInitial requires the first phoneme to be a consonant', () => {
    const c: Constraint = { type: 'RequiredOnset', scope: 'wordInitial' };
    expect(checkConstraints(['p', 'a'], [0], [c], CLASSES).ok).toBe(true);
    expect(checkConstraints(['a', 'p'], [0], [c], CLASSES).ok).toBe(false);
  });

  it('everySyllable requires every syllable to start with a consonant', () => {
    const c: Constraint = { type: 'RequiredOnset', scope: 'everySyllable' };
    expect(checkConstraints(['p', 'a', 't', 'a'], [0, 2], [c], CLASSES).ok).toBe(true);
    expect(checkConstraints(['p', 'a', 'a', 't'], [0, 2], [c], CLASSES).ok).toBe(false);
  });
});

describe('checkConstraints: ordering', () => {
  it('reports the first failing constraint in array order', () => {
    const banned: Constraint = { type: 'BannedSequence', sequence: ['s', 't'], scope: 'anywhere' };
    const onset: Constraint = { type: 'RequiredOnset', scope: 'wordInitial' };
    // "ast" fails both: contains "st" and starts with a vowel.
    const forward = checkConstraints(['a', 's', 't'], [0], [banned, onset], CLASSES);
    expect(forward.failedConstraint).toEqual(banned);

    const reversed = checkConstraints(['a', 's', 't'], [0], [onset, banned], CLASSES);
    expect(reversed.failedConstraint).toEqual(onset);
  });

  it('passes when every constraint is satisfied', () => {
    const banned: Constraint = { type: 'BannedSequence', sequence: ['s', 't'], scope: 'anywhere' };
    const onset: Constraint = { type: 'RequiredOnset', scope: 'wordInitial' };
    const result = checkConstraints(['p', 'a'], [0], [banned, onset], CLASSES);
    expect(result).toEqual({ ok: true });
  });
});
