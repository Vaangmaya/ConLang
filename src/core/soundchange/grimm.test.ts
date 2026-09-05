// Golden test for DESIGN.md §4.7's worked fixture: an ordered, deliberately
// simplified and ahistorical rule set that pins down counterfeeding order —
// "bʰ" only deaspirates to "b" after devoicing has already run, so the new
// "b" is never re-devoiced (must yield "braθer", not "praθer").

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Inventory } from '../phoneme';
import { render } from '../romanization';
import { derive } from './derivation';
import { parseRulesFile } from './parser';

import expectedRaw from '../../../fixtures/grimm.expected.json';

const expected = expectedRaw as unknown as {
  inventory: Inventory;
  words: { input: string[]; expected: string[] }[];
};

const rulesPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../fixtures/grimm.rules',
);
const rulesText = readFileSync(rulesPath, 'utf-8');

describe('Grimm golden fixture', () => {
  it('parses all 9 rules from fixtures/grimm.rules with zero errors', () => {
    const { rules, errors } = parseRulesFile(rulesText, ['C', 'V']);
    expect(errors).toEqual([]);
    expect(rules.map((r) => r.id)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9']);
    expect(rules.every((r) => r.ast !== undefined)).toBe(true);
  });

  const { rules } = parseRulesFile(rulesText, ['C', 'V']);
  const romanized = ['faθer', 'texem', 'braθer'];

  expected.words.forEach(({ input, expected: expectedIds }, i) => {
    it(`derives "${render(input, expected.inventory)}" correctly`, () => {
      const result = derive(input, rules, expected.inventory);
      expect(result.finalPhonemeIds).toEqual(expectedIds);
      expect(render(result.finalPhonemeIds, expected.inventory)).toBe(romanized[i]);
      expect(result.warnings).toEqual([]);
    });
  });

  it('locks in the counterfeeding order for "bʰrater" (not "praθer")', () => {
    const bhraterInput = expected.words[2].input;
    const result = derive(bhraterInput, rules, expected.inventory);
    const rule4Step = result.steps.find((s) => s.ruleId === '4');
    const rule7Step = result.steps.find((s) => s.ruleId === '7');
    expect(rule4Step?.changed).toBe(false); // devoicing does not touch "bʰ"
    expect(rule7Step?.changed).toBe(true); // deaspiration fires afterward
    expect(render(result.finalPhonemeIds, expected.inventory)).toBe('braθer');
  });
});
