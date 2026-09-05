import { describe, expect, it } from 'vitest';
import { applyRule } from './apply';
import type { ConsonantFeatures, VowelFeatures } from '../features';
import type { Inventory, Phoneme } from '../phoneme';
import { parseRule } from './parser';
import type { SoundChangeRule } from './parser';

function mkConsonant(
  id: string,
  place: ConsonantFeatures['place'],
  manner: ConsonantFeatures['manner'],
  voiced: boolean,
): Phoneme {
  return {
    id,
    ipa: id,
    features: { kind: 'consonant', place, manner, voiced },
    weight: 1,
    romanization: id,
  };
}

function mkVowel(id: string, overrides: Partial<VowelFeatures> = {}): Phoneme {
  return {
    id,
    ipa: id,
    features: {
      kind: 'vowel',
      height: 'low',
      backness: 'front',
      rounded: false,
      long: false,
      ...overrides,
    },
    weight: 1,
    romanization: id,
  };
}

const INV: Inventory = {
  phonemes: [
    mkConsonant('p', 'bilabial', 'stop', false),
    mkConsonant('b', 'bilabial', 'stop', true),
    mkConsonant('f', 'labiodental', 'fricative', false),
    mkConsonant('t', 'alveolar', 'stop', false),
    mkConsonant('d', 'alveolar', 'stop', true),
    // "h" has no voiced counterpart in this small inventory — deliberately,
    // so devoicing/voicing it has nowhere to resolve to (emergent-segment test).
    mkConsonant('h', 'glottal', 'fricative', false),
    mkVowel('a'),
    mkVowel('i'),
  ],
};

function rule(raw: string, id = 'r', knownClasses = ['C', 'V']): SoundChangeRule {
  const result = parseRule(raw, knownClasses);
  if (!result.ok) throw new Error(`bad fixture rule "${raw}": ${result.error.message}`);
  return { id, raw, enabled: true, ast: result.ast };
}

describe('applyRule: basic substitution', () => {
  it('substitutes a matching literal everywhere it occurs', () => {
    const result = applyRule(['p', 'a', 'p'], rule('p > f'), INV);
    expect(result.phonemeIds).toEqual(['f', 'a', 'f']);
    expect(result.changed).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it('is a no-op when the target never occurs', () => {
    const result = applyRule(['t', 'a', 't'], rule('p > f'), INV);
    expect(result.phonemeIds).toEqual(['t', 'a', 't']);
    expect(result.changed).toBe(false);
  });
});

describe('applyRule: deletion', () => {
  it('deletes a classRef target between vowels', () => {
    const result = applyRule(['a', 'h', 'a'], rule('C > ∅ / V_V'), INV);
    expect(result.phonemeIds).toEqual(['a', 'a']);
    expect(result.changed).toBe(true);
  });

  it('does not delete outside the given context', () => {
    const result = applyRule(['h', 'a'], rule('C > ∅ / V_V'), INV);
    expect(result.phonemeIds).toEqual(['h', 'a']);
    expect(result.changed).toBe(false);
  });
});

describe('applyRule: insertion', () => {
  it('inserts mid-word between two consonants', () => {
    const result = applyRule(['p', 't'], rule('∅ > a / C_C'), INV);
    expect(result.phonemeIds).toEqual(['p', 'a', 't']);
  });

  it('inserts at the word-initial edge', () => {
    const result = applyRule(['p', 'a'], rule('∅ > h / #_'), INV);
    expect(result.phonemeIds).toEqual(['h', 'p', 'a']);
  });

  it('inserts at the word-final edge', () => {
    const result = applyRule(['p', 'a'], rule('∅ > h / _#'), INV);
    expect(result.phonemeIds).toEqual(['p', 'a', 'h']);
  });
});

describe('applyRule: non-overlapping consumption', () => {
  it('consumes matches left-to-right without overlap', () => {
    // Four p's: "p p" pairs are (0,1) and (2,3) — non-overlapping — not (1,2).
    const result = applyRule(['p', 'p', 'p', 'p'], rule('p p > ∅'), INV);
    expect(result.phonemeIds).toEqual([]);
  });
});

describe('applyRule: context gating', () => {
  it('only fires when the context matches', () => {
    const r = rule('p > f / a_a');
    expect(applyRule(['a', 'p', 'a'], r, INV).phonemeIds).toEqual(['a', 'f', 'a']);
    expect(applyRule(['t', 'p', 'a'], r, INV).phonemeIds).toEqual(['t', 'p', 'a']);
  });
});

describe('applyRule: feature-bundle replacement', () => {
  it('resolves to an existing phoneme differing only in voicing', () => {
    const result = applyRule(['p'], rule('[-voiced] > [+voiced]'), INV);
    expect(result.phonemeIds).toEqual(['b']);
    expect(result.warnings).toEqual([]);
  });

  it('produces an emergent segment with a warning when no phoneme matches', () => {
    // "h" (glottal fricative) has no voiced counterpart in this inventory.
    const result = applyRule(['h'], rule('[-voiced] > [+voiced]'), INV);
    expect(result.phonemeIds).toEqual(['h[+voiced]']);
    expect(result.warnings).toEqual([
      'Emergent segment "h[+voiced]" (feature change on "h") is not in the inventory — consider adding it to the daughter inventory.',
    ]);
  });

  it('reports changed:false for an identity feature delta', () => {
    const result = applyRule(['p'], rule('[-voiced] > [-voiced]'), INV);
    expect(result.phonemeIds).toEqual(['p']);
    expect(result.changed).toBe(false);
  });
});

describe('applyRule: ipaLiteral emergent segment', () => {
  it('uses the raw literal as the output id with a warning when absent from the inventory', () => {
    const result = applyRule(['p'], rule('p > ʙ'), INV);
    expect(result.phonemeIds).toEqual(['ʙ']);
    expect(result.warnings).toEqual([
      'Emergent segment "ʙ" is not in the inventory — consider adding it to the daughter inventory.',
    ]);
  });
});

describe('applyRule: boundary-anchored rules', () => {
  it('only affects the word-final segment', () => {
    const result = applyRule(['t', 'a', 't'], rule('t > ∅ / _#'), INV);
    expect(result.phonemeIds).toEqual(['t', 'a']);
  });
});

describe('applyRule: simultaneity', () => {
  it('matches are found on the original input, not the partially-rewritten output', () => {
    const result = applyRule(['p', 'a', 'p'], rule('p > f'), INV);
    expect(result.phonemeIds).toEqual(['f', 'a', 'f']);
  });
});

describe('applyRule: contract', () => {
  it('throws when rule.ast is undefined', () => {
    const unparsed: SoundChangeRule = { id: 'x', raw: 'p > f', enabled: true };
    expect(() => applyRule(['p'], unparsed, INV)).toThrow(/has no parsed ast/);
  });

  it("applies even when rule.enabled is false — filtering is derive's job", () => {
    const r = rule('p > f');
    r.enabled = false;
    const result = applyRule(['p'], r, INV);
    expect(result.phonemeIds).toEqual(['f']);
  });
});
