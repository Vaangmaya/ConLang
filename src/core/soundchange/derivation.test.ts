import { describe, expect, it } from 'vitest';
import type { ConsonantFeatures } from '../features';
import type { Inventory, Phoneme } from '../phoneme';
import { derive } from './derivation';
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

const INV: Inventory = {
  phonemes: [
    mkConsonant('a', 'bilabial', 'stop', false),
    mkConsonant('b', 'bilabial', 'stop', true),
    mkConsonant('c', 'velar', 'stop', false),
    mkConsonant('bʰ', 'bilabial', 'stop', true),
  ],
};

function rule(id: string, raw: string, knownClasses = ['C', 'V']): SoundChangeRule {
  const result = parseRule(raw, knownClasses);
  if (!result.ok) throw new Error(`bad fixture rule "${raw}": ${result.error.message}`);
  return { id, raw, enabled: true, ast: result.ast };
}

describe('derive: ordering', () => {
  it('feeds later rules with earlier output (a>b, then b>c)', () => {
    const result = derive(['a'], [rule('1', 'a > b'), rule('2', 'b > c')], INV);
    expect(result.finalPhonemeIds).toEqual(['c']);
    expect(result.steps).toHaveLength(2);
    expect(result.steps[0]).toMatchObject({ ruleId: '1', changed: true });
    expect(result.steps[1]).toMatchObject({ ruleId: '2', changed: true });
  });

  it('counterfeeding: devoicing before deaspiration means the new "b" survives', () => {
    // Mirrors the Grimm fixture's key interaction at a small scale.
    const result = derive(['bʰ'], [rule('4', 'b > a'), rule('7', 'bʰ > b')], INV);
    expect(result.finalPhonemeIds).toEqual(['b']);
    expect(result.steps[0]).toMatchObject({ ruleId: '4', changed: false });
    expect(result.steps[1]).toMatchObject({ ruleId: '7', changed: true });
  });
});

describe('derive: disabled and unparsed rules', () => {
  it('skips disabled rules with no derivation step', () => {
    const disabled = rule('1', 'a > b');
    disabled.enabled = false;
    const result = derive(['a'], [disabled], INV);
    expect(result.finalPhonemeIds).toEqual(['a']);
    expect(result.steps).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('skips a rule with no parsed ast, recording a warning instead of crashing', () => {
    const unparsed: SoundChangeRule = { id: '1', raw: 'a > b', enabled: true };
    const result = derive(['a'], [unparsed], INV);
    expect(result.finalPhonemeIds).toEqual(['a']);
    expect(result.steps).toEqual([]);
    expect(result.warnings).toEqual(['[rule 1] not parsed — skipped.']);
  });
});

describe('derive: warnings and rendering', () => {
  it('renders an emergent segment step via its raw id instead of crashing', () => {
    const result = derive(['a'], [rule('1', 'a > ʙ')], INV);
    expect(result.finalPhonemeIds).toEqual(['ʙ']);
    expect(result.steps[0].before).toBe('a');
    expect(result.steps[0].after).toBe('ʙ');
  });

  it('accumulates warnings across rules, each prefixed with its rule id', () => {
    const result = derive(['a', 'c'], [rule('1', 'a > ʙ'), rule('2', 'c > ʁ')], INV);
    expect(result.warnings).toEqual([
      '[rule 1] Emergent segment "ʙ" is not in the inventory — consider adding it to the daughter inventory.',
      '[rule 2] Emergent segment "ʁ" is not in the inventory — consider adding it to the daughter inventory.',
    ]);
  });
});

describe('derive: edge cases', () => {
  it('is a no-op for an empty rule list', () => {
    const result = derive(['a', 'b'], [], INV);
    expect(result.finalPhonemeIds).toEqual(['a', 'b']);
    expect(result.steps).toEqual([]);
    expect(result.warnings).toEqual([]);
  });
});
