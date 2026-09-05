import { describe, expect, it } from 'vitest';
import { frequencyReport, gueseinZadeWeights } from './stats';
import type { GeneratedWord } from './generator';
import type { Inventory, Phoneme } from './phoneme';

function mkPhoneme(id: string, kind: 'consonant' | 'vowel', weight: number): Phoneme {
  return {
    id,
    ipa: id,
    features:
      kind === 'consonant'
        ? { kind: 'consonant', place: 'alveolar', manner: 'stop', voiced: false }
        : {
            kind: 'vowel',
            height: 'low',
            backness: 'front',
            rounded: false,
            long: false,
          },
    weight,
    romanization: id,
  };
}

function word(phonemeIds: string[]): GeneratedWord {
  return { phonemeIds, syllableBreaks: [0], seed: 0 };
}

describe('gueseinZadeWeights', () => {
  it('returns n strictly positive, monotonically decreasing weights', () => {
    const w = gueseinZadeWeights(8);
    expect(w).toHaveLength(8);
    for (const x of w) expect(x).toBeGreaterThan(0);
    for (let i = 1; i < w.length; i++) expect(w[i]).toBeLessThan(w[i - 1]);
  });

  it('matches the closed form w_i = (1/n) * ln((n+1)/i)', () => {
    const n = 5;
    const w = gueseinZadeWeights(n);
    for (let i = 1; i <= n; i++) {
      expect(w[i - 1]).toBeCloseTo((1 / n) * Math.log((n + 1) / i), 10);
    }
  });
});

describe('frequencyReport', () => {
  const inv: Inventory = {
    phonemes: [
      mkPhoneme('p', 'consonant', 3),
      mkPhoneme('t', 'consonant', 1),
      mkPhoneme('a', 'vowel', 1),
      mkPhoneme('i', 'vowel', 1),
    ],
  };

  it('configured frequency is the phoneme weight normalized within its kind', () => {
    const report = frequencyReport([], inv);
    const p = report.find((r) => r.phonemeId === 'p')!;
    const t = report.find((r) => r.phonemeId === 't')!;
    const a = report.find((r) => r.phonemeId === 'a')!;
    expect(p.configured).toBeCloseTo(3 / 4, 10);
    expect(t.configured).toBeCloseTo(1 / 4, 10);
    expect(a.configured).toBeCloseTo(1 / 2, 10);
  });

  it('observed frequency is the phoneme share of its kind in the lexicon', () => {
    const lexicon = [word(['p', 'a']), word(['p', 'i']), word(['t', 'a'])];
    const report = frequencyReport(lexicon, inv);
    const p = report.find((r) => r.phonemeId === 'p')!;
    const t = report.find((r) => r.phonemeId === 't')!;
    const a = report.find((r) => r.phonemeId === 'a')!;
    const i = report.find((r) => r.phonemeId === 'i')!;
    // Consonants: p,p,t -> p = 2/3, t = 1/3.
    expect(p.observed).toBeCloseTo(2 / 3, 10);
    expect(t.observed).toBeCloseTo(1 / 3, 10);
    // Vowels: a,i,a -> a = 2/3, i = 1/3.
    expect(a.observed).toBeCloseTo(2 / 3, 10);
    expect(i.observed).toBeCloseTo(1 / 3, 10);
  });

  it('reports zero observed frequency for an empty lexicon', () => {
    const report = frequencyReport([], inv);
    for (const r of report) expect(r.observed).toBe(0);
  });

  it('reports one entry per inventory phoneme, ignoring unknown ids in the lexicon', () => {
    const lexicon = [word(['p', 'a', 'zzz'])];
    const report = frequencyReport(lexicon, inv);
    expect(report).toHaveLength(inv.phonemes.length);
    const p = report.find((r) => r.phonemeId === 'p')!;
    expect(p.observed).toBe(1);
  });
});
