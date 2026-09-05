import { describe, expect, it } from 'vitest';
import { matchesFeatures, naturalClass, starterInventory, type Phoneme } from './phoneme';

const p = (overrides: Partial<Phoneme> = {}): Phoneme => ({
  id: 'p',
  ipa: 'p',
  features: { kind: 'consonant', place: 'bilabial', manner: 'stop', voiced: false },
  weight: 1,
  romanization: 'p',
  ...overrides,
});

describe('matchesFeatures', () => {
  it('matches on a single feature', () => {
    expect(matchesFeatures(p(), { manner: 'stop' })).toBe(true);
    expect(matchesFeatures(p(), { manner: 'fricative' })).toBe(false);
  });

  it('matches on multiple features conjunctively', () => {
    expect(matchesFeatures(p(), { place: 'bilabial', voiced: false })).toBe(true);
    expect(matchesFeatures(p(), { place: 'bilabial', voiced: true })).toBe(false);
  });

  it('matches everything on an empty query', () => {
    expect(matchesFeatures(p(), {})).toBe(true);
  });

  it('rejects cross-kind queries whose feature is absent', () => {
    const vowel: Phoneme = {
      id: 'a',
      ipa: 'a',
      features: {
        kind: 'vowel',
        height: 'low',
        backness: 'front',
        rounded: false,
        long: false,
      },
      weight: 1,
      romanization: 'a',
    };
    expect(matchesFeatures(vowel, { manner: 'stop' })).toBe(false);
  });
});

describe('naturalClass', () => {
  it('filters an inventory by feature query', () => {
    const inv = starterInventory();
    const voicelessStops = naturalClass(inv, {
      kind: 'consonant',
      manner: 'stop',
      voiced: false,
    });
    expect(voicelessStops.length).toBeGreaterThan(0);
    for (const ph of voicelessStops) {
      expect(ph.features).toMatchObject({
        kind: 'consonant',
        manner: 'stop',
        voiced: false,
      });
    }
  });

  it('returns an empty array when nothing matches', () => {
    const inv = starterInventory();
    expect(
      naturalClass(inv, { kind: 'consonant', place: 'bilabial', manner: 'trill' }),
    ).toEqual([]);
  });
});

describe('starterInventory', () => {
  it('loads with both consonants and vowels', () => {
    const inv = starterInventory();
    const consonants = inv.phonemes.filter((ph) => ph.features.kind === 'consonant');
    const vowels = inv.phonemes.filter((ph) => ph.features.kind === 'vowel');
    expect(consonants.length).toBeGreaterThan(0);
    expect(vowels.length).toBeGreaterThan(0);
  });

  it('has unique phoneme ids', () => {
    const inv = starterInventory();
    const ids = inv.phonemes.map((ph) => ph.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has unique romanizations, each a single codepoint', () => {
    const inv = starterInventory();
    const roms = inv.phonemes.map((ph) => ph.romanization);
    expect(new Set(roms).size).toBe(roms.length);
    for (const rom of roms) {
      expect([...rom].length).toBe(1);
    }
  });

  it('has no two phonemes sharing an identical feature bundle', () => {
    const inv = starterInventory();
    const keys = inv.phonemes.map((ph) => JSON.stringify(ph.features));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('returns independent copies on each call', () => {
    const a = starterInventory();
    const b = starterInventory();
    a.phonemes[0].romanization = 'mutated';
    expect(b.phonemes[0].romanization).not.toBe('mutated');
  });
});
