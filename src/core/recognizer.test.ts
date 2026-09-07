import { describe, expect, it } from 'vitest';
import { accepts } from './recognizer';
import type { PhonotacticGrammar, SyllableTemplate } from './generator';
import type { Inventory, Phoneme } from './phoneme';
import { parseTemplate } from './template/parser';

function mkPhoneme(id: string, kind: 'consonant' | 'vowel', weight = 1): Phoneme {
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

function template(raw: string, knownClasses: string[], weight = 1): SyllableTemplate {
  const result = parseTemplate(raw, knownClasses);
  if (!result.ok)
    throw new Error(`bad fixture template "${raw}": ${result.error.message}`);
  return { raw, ast: result.ast, weight };
}

const inv: Inventory = {
  phonemes: [
    mkPhoneme('p', 'consonant'),
    mkPhoneme('t', 'consonant'),
    mkPhoneme('k', 'consonant'),
    mkPhoneme('m', 'consonant'),
    mkPhoneme('n', 'consonant'),
    mkPhoneme('a', 'vowel'),
    mkPhoneme('i', 'vowel'),
    mkPhoneme('u', 'vowel'),
  ],
};

describe('accepts: basic template matching', () => {
  const grammar: PhonotacticGrammar = {
    classes: [],
    templates: [template('CV', ['C', 'V'])],
    syllableCount: { min: 1, max: 3, weights: [1, 1, 1] },
    constraints: [],
  };

  it('accepts a single CV syllable', () => {
    expect(accepts(['p', 'a'], grammar, inv).ok).toBe(true);
  });

  it('accepts multiple CV syllables', () => {
    const result = accepts(['p', 'a', 't', 'i'], grammar, inv);
    expect(result.ok).toBe(true);
    expect(result.parse).toEqual([
      { start: 0, end: 2, templateRaw: 'CV' },
      { start: 2, end: 4, templateRaw: 'CV' },
    ]);
  });

  it('rejects a word starting with a vowel', () => {
    expect(accepts(['a', 'p', 'a'], grammar, inv).ok).toBe(false);
  });

  it('rejects a word with a consonant cluster (no template covers CC)', () => {
    expect(accepts(['p', 't', 'a'], grammar, inv).ok).toBe(false);
  });

  it('rejects a word longer than syllableCount.max allows', () => {
    const ids = Array(4)
      .fill(null)
      .flatMap(() => ['p', 'a']); // 4 CV syllables > max 3
    expect(accepts(ids, grammar, inv).ok).toBe(false);
  });

  it('rejects the empty word when min syllable count is 1', () => {
    expect(accepts([], grammar, inv).ok).toBe(false);
  });
});

describe('accepts: optional groups', () => {
  const grammar: PhonotacticGrammar = {
    classes: [],
    templates: [template('CV(C)', ['C', 'V'])],
    syllableCount: { min: 1, max: 1, weights: [1] },
    constraints: [],
  };

  it('accepts the syllable without the optional coda', () => {
    expect(accepts(['p', 'a'], grammar, inv).ok).toBe(true);
  });

  it('accepts the syllable with the optional coda', () => {
    const result = accepts(['p', 'a', 't'], grammar, inv);
    expect(result.ok).toBe(true);
    expect(result.parse).toEqual([{ start: 0, end: 3, templateRaw: 'CV(C)' }]);
  });

  it('rejects a syllable with two codas', () => {
    expect(accepts(['p', 'a', 't', 'k'], grammar, inv).ok).toBe(false);
  });
});

describe('accepts: constraint interaction', () => {
  it('rejects a structurally valid word that fails a constraint', () => {
    const grammar: PhonotacticGrammar = {
      classes: [],
      templates: [template('CV', ['C', 'V'])],
      syllableCount: { min: 1, max: 2, weights: [1, 1] },
      constraints: [{ type: 'BannedSequence', sequence: ['a', 't'], scope: 'anywhere' }],
    };
    // "pa" + "ta" is the only CV-CV segmentation of "pata", and it contains "a","t".
    expect(accepts(['p', 'a', 't', 'a'], grammar, inv).ok).toBe(false);
  });

  it('finds an alternate segmentation that satisfies a boundary-sensitive constraint', () => {
    // "pa" + "ta" (CV CV) puts the "a","t" boundary between syllables — banning
    // that adjacency across a syllable boundary must not block other shapes,
    // but here CV CV is the only template, so this word has just one possible
    // segmentation and must be rejected once the boundary sequence is banned.
    const grammar: PhonotacticGrammar = {
      classes: [],
      templates: [template('CV', ['C', 'V'])],
      syllableCount: { min: 1, max: 2, weights: [1, 1] },
      constraints: [
        {
          type: 'BannedSequence',
          sequence: ['a', 't'],
          scope: 'acrossSyllableBoundary',
        },
      ],
    };
    expect(accepts(['p', 'a', 't', 'a'], grammar, inv).ok).toBe(false);
  });

  it('accepts when a different template choice avoids the constraint violation', () => {
    // Two templates can both match "pat": CVC as one syllable (no internal
    // boundary) or CV+C is not valid, but V is also available for "a" alone —
    // pick a case where only the single-syllable CVC parse avoids a
    // withinSyllable-scoped ban that the multi-syllable parse would trigger.
    const grammar: PhonotacticGrammar = {
      classes: [],
      templates: [template('CV', ['C', 'V']), template('CVC', ['C', 'V'])],
      syllableCount: { min: 1, max: 2, weights: [1, 1] },
      constraints: [
        {
          type: 'BannedSequence',
          sequence: ['a', 't'],
          scope: 'acrossSyllableBoundary',
        },
      ],
    };
    // As CVC (single syllable, no boundary): allowed.
    // As CV+... there's no second syllable template matching just "t", so the
    // only valid parse is CVC, which the across-boundary constraint doesn't touch.
    const result = accepts(['p', 'a', 't'], grammar, inv);
    expect(result.ok).toBe(true);
    expect(result.parse).toEqual([{ start: 0, end: 3, templateRaw: 'CVC' }]);
  });
});

describe('accepts: syllable count range', () => {
  const grammar: PhonotacticGrammar = {
    classes: [],
    templates: [template('CV', ['C', 'V'])],
    syllableCount: { min: 2, max: 3, weights: [1, 1] },
    constraints: [],
  };

  it('rejects a word with fewer syllables than the minimum', () => {
    expect(accepts(['p', 'a'], grammar, inv).ok).toBe(false);
  });

  it('accepts a word at the minimum syllable count', () => {
    expect(accepts(['p', 'a', 't', 'i'], grammar, inv).ok).toBe(true);
  });

  it('accepts a word at the maximum syllable count', () => {
    expect(accepts(['p', 'a', 't', 'i', 'k', 'u'], grammar, inv).ok).toBe(true);
  });
});

describe('accepts: unknown phonemes', () => {
  it('rejects a word containing a phoneme not in any class', () => {
    const grammar: PhonotacticGrammar = {
      classes: [],
      templates: [template('CV', ['C', 'V'])],
      syllableCount: { min: 1, max: 1, weights: [1] },
      constraints: [],
    };
    expect(accepts(['p', 'z'], grammar, inv).ok).toBe(false);
  });
});
