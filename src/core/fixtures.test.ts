// Fixture-driven tests (DESIGN.md §6): Invariant G, the Hawaiian golden
// snapshot, and the statistical sampling test, run against both fixture
// grammars declared in DESIGN.md §6.

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { generate, type PhonotacticGrammar } from './generator';
import type { Inventory } from './phoneme';
import { accepts } from './recognizer';
import { render } from './romanization';
import { frequencyReport } from './stats';

import hawaiianRaw from '../../fixtures/hawaiian.json';
import japaneseLiteRaw from '../../fixtures/japanese-lite.json';

interface Fixture {
  name: string;
  inventory: Inventory;
  grammar: PhonotacticGrammar;
}

const hawaiian = hawaiianRaw as unknown as {
  inventory: Inventory;
  grammar: PhonotacticGrammar;
};
const japaneseLite = japaneseLiteRaw as unknown as {
  inventory: Inventory;
  grammar: PhonotacticGrammar;
};

const FIXTURES: Fixture[] = [
  { name: 'hawaiian', inventory: hawaiian.inventory, grammar: hawaiian.grammar },
  {
    name: 'japanese-lite',
    inventory: japaneseLite.inventory,
    grammar: japaneseLite.grammar,
  },
];

describe.each(FIXTURES)('Invariant G: $name', ({ inventory, grammar }) => {
  it('every generated word is accepted by the recognizer (1,000 seeded generations)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 0xffffffff }), (seed) => {
        const result = generate(grammar, inventory, 1, seed);
        expect(result.words.length).toBe(1);
        const word = result.words[0];
        const recognized = accepts(word.phonemeIds, grammar, inventory);
        expect(recognized.ok).toBe(true);
      }),
      { numRuns: 1000 },
    );
  });
});

describe('Hawaiian golden snapshot', () => {
  it('matches the recorded 50-word sample at seed 42', () => {
    const result = generate(hawaiian.grammar, hawaiian.inventory, 50, 42);
    expect(result.diagnostics.rejectedWords).toBe(0);
    const romanized = result.words.map((w) => render(w.phonemeIds, hawaiian.inventory));
    expect(romanized).toMatchSnapshot();
  });
});

describe('Statistical test: hawaiian', () => {
  // Restricted to hawaiian: its templates (V, CV) draw every consonant and
  // every vowel from exactly one slot per syllable, so frequencyReport's
  // whole-inventory weight normalization is directly comparable to observed
  // frequency. japanese-lite's CV(N) gives its coda phoneme a second,
  // lower-probability sampling slot that skews this coarse comparison
  // regardless of generator correctness, so it's covered by Invariant G and
  // manual eyeballing (DESIGN.md §6) instead.
  it('observed phoneme frequency is within ±20% relative of configured (n=10,000, seed=1)', () => {
    const result = generate(hawaiian.grammar, hawaiian.inventory, 10000, 1);
    const report = frequencyReport(result.words, hawaiian.inventory);
    for (const { phonemeId, configured, observed } of report) {
      if (configured === 0) continue;
      const relativeError = Math.abs(observed - configured) / configured;
      expect(
        relativeError,
        `phoneme "${phonemeId}": configured=${configured}, observed=${observed}`,
      ).toBeLessThanOrEqual(0.2);
    }
  });
});
