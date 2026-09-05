import { describe, expect, it } from 'vitest';
import type { GeneratedWord } from './generator';
import type { Inventory } from './phoneme';
import {
  exportLexiconCsv,
  exportLexiconJson,
  lexiconToRows,
  parseProject,
  serializeProject,
} from './project';

const inv: Inventory = {
  phonemes: [
    {
      id: 'p',
      ipa: 'p',
      features: { kind: 'consonant', place: 'bilabial', manner: 'stop', voiced: false },
      weight: 1,
      romanization: 'p',
    },
    {
      id: 'a',
      ipa: 'a',
      features: {
        kind: 'vowel',
        height: 'low',
        backness: 'central',
        rounded: false,
        long: false,
      },
      weight: 1,
      romanization: 'a',
    },
    {
      id: 'comma',
      ipa: 'a,b',
      features: {
        kind: 'vowel',
        height: 'low',
        backness: 'central',
        rounded: false,
        long: false,
      },
      weight: 1,
      romanization: 'a,b',
    },
  ],
};

const lexicon: GeneratedWord[] = [
  { phonemeIds: ['p', 'a'], syllableBreaks: [0], seed: 1 },
  { phonemeIds: ['comma'], syllableBreaks: [0], seed: 2 },
];

describe('parseProject', () => {
  it('produces field-level errors for malformed JSON rather than throwing', () => {
    const result = parseProject({ formatVersion: 1, name: 'x' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toHaveProperty('path');
      expect(result.errors[0]).toHaveProperty('message');
    }
  });

  it('round-trips a value serialized by serializeProject', () => {
    const project = {
      formatVersion: 1 as const,
      name: 'Test',
      inventory: inv,
      grammar: {
        classes: [],
        templates: [],
        syllableCount: { min: 1, max: 1, weights: [1] },
        constraints: [],
      },
      lexicon: [],
      rules: [],
    };
    const result = parseProject(JSON.parse(serializeProject(project)));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.project).toEqual(project);
  });
});

describe('lexiconToRows', () => {
  it('maps phonemeIds to ipa/romanized/syllables', () => {
    expect(lexiconToRows(lexicon, inv)).toEqual([
      { ipa: 'pa', romanized: 'pa', syllables: 1 },
      { ipa: 'a,b', romanized: 'a,b', syllables: 1 },
    ]);
  });
});

describe('exportLexiconCsv', () => {
  it('emits a header and escapes fields containing commas', () => {
    const csv = exportLexiconCsv(lexicon, inv);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('ipa,romanized,syllables');
    expect(lines[1]).toBe('pa,pa,1');
    expect(lines[2]).toBe('"a,b","a,b",1');
  });
});

describe('exportLexiconJson', () => {
  it('serializes the same rows as exportLexiconCsv', () => {
    const json = JSON.parse(exportLexiconJson(lexicon, inv));
    expect(json).toEqual(lexiconToRows(lexicon, inv));
  });
});
