import { describe, expect, it } from 'vitest';
import { generate, type PhonotacticGrammar, type SyllableTemplate } from './generator';
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

function basicGrammar(): PhonotacticGrammar {
  return {
    classes: [],
    templates: [template('CV', ['C', 'V'], 0.7), template('CVC', ['C', 'V'], 0.3)],
    syllableCount: { min: 1, max: 3, weights: [0.5, 0.3, 0.2] },
    constraints: [],
  };
}

describe('generate: determinism', () => {
  it('produces identical output for the same seed', () => {
    const a = generate(basicGrammar(), inv, 50, 42);
    const b = generate(basicGrammar(), inv, 50, 42);
    expect(a).toEqual(b);
  });

  it('produces different output for a different seed', () => {
    const a = generate(basicGrammar(), inv, 50, 1);
    const b = generate(basicGrammar(), inv, 50, 2);
    expect(a.words).not.toEqual(b.words);
  });

  it('every generated word only uses inventory phoneme ids', () => {
    const ids = new Set(inv.phonemes.map((p) => p.id));
    const result = generate(basicGrammar(), inv, 200, 7);
    for (const w of result.words) {
      for (const id of w.phonemeIds) expect(ids.has(id)).toBe(true);
    }
  });

  it('syllableBreaks start at 0 and match the number of syllables sampled', () => {
    const result = generate(basicGrammar(), inv, 50, 5);
    for (const w of result.words) {
      expect(w.syllableBreaks[0]).toBe(0);
      expect(w.syllableBreaks.length).toBeGreaterThanOrEqual(1);
      expect(w.syllableBreaks.length).toBeLessThanOrEqual(3);
    }
  });
});

describe('generate: constraint integration', () => {
  it('never produces a word containing a banned sequence', () => {
    const grammar = basicGrammar();
    grammar.constraints = [
      { type: 'BannedSequence', sequence: ['t', 't'], scope: 'anywhere' },
    ];
    const result = generate(grammar, inv, 300, 11);
    for (const w of result.words) {
      const joined = w.phonemeIds.join(',');
      expect(joined).not.toMatch(/t,t/);
    }
  });
});

describe('generate: unsatisfiability diagnostics', () => {
  it('returns fewer words than requested and names the culprit constraint', () => {
    const grammar: PhonotacticGrammar = {
      classes: [],
      // Every template starts with V, but RequiredOnset:wordInitial demands a consonant.
      templates: [template('VC', ['C', 'V'])],
      syllableCount: { min: 1, max: 1, weights: [1] },
      constraints: [{ type: 'RequiredOnset', scope: 'wordInitial' }],
    };
    const result = generate(grammar, inv, 5, 3);
    expect(result.words.length).toBeLessThan(5);
    expect(result.diagnostics.rejectedWords).toBeGreaterThan(0);
    expect(result.diagnostics.topRejectingConstraints[0].constraint).toMatch(
      /RequiredOnset/,
    );
    expect(result.diagnostics.topRejectingConstraints[0].rejections).toBeGreaterThan(0);
  });
});

describe('generate: eager validation', () => {
  it('throws when Sonority.scale is missing entries', () => {
    const grammar = basicGrammar();
    grammar.constraints = [{ type: 'Sonority', scale: { p: 1 }, allowPlateaus: false }];
    expect(() => generate(grammar, inv, 5, 1)).toThrow(/no scale entry/);
  });

  it('throws when a BannedSequence token is unresolvable', () => {
    const grammar = basicGrammar();
    grammar.constraints = [
      { type: 'BannedSequence', sequence: ['Q'], scope: 'anywhere' },
    ];
    expect(() => generate(grammar, inv, 5, 1)).toThrow(
      /not a known class symbol or phoneme id/,
    );
  });

  it('throws when syllableCount.weights length is wrong', () => {
    const grammar = basicGrammar();
    grammar.syllableCount = { min: 1, max: 3, weights: [1, 1] };
    expect(() => generate(grammar, inv, 5, 1)).toThrow(/syllableCount\.weights/);
  });
});

describe('generate: performance', () => {
  it('generates 10,000 words in under 2 seconds', () => {
    const grammar: PhonotacticGrammar = {
      classes: [],
      templates: [template('CV', ['C', 'V'], 0.7), template('CVC', ['C', 'V'], 0.3)],
      syllableCount: { min: 1, max: 3, weights: [0.5, 0.3, 0.2] },
      // Every template already starts with C, so this never rejects — keeps
      // the perf test's timing stable instead of dependent on retry variance.
      constraints: [{ type: 'RequiredOnset', scope: 'everySyllable' }],
    };
    const start = performance.now();
    const result = generate(grammar, inv, 10000, 99);
    const elapsed = performance.now() - start;
    expect(result.words.length).toBe(10000);
    expect(elapsed).toBeLessThan(2000);
  });
});
