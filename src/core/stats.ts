// Default weights and frequency reports (DESIGN.md §4.9).
// Gusein-Zade distribution over n phonemes ranked 1..n: w_i = (1/n) * ln((n+1)/i)

import type { GeneratedWord } from './generator';
import type { Inventory } from './phoneme';

export function gueseinZadeWeights(n: number): number[] {
  const weights: number[] = [];
  for (let i = 1; i <= n; i++) {
    weights.push((1 / n) * Math.log((n + 1) / i));
  }
  return weights;
}

export interface PhonemeFrequency {
  phonemeId: string;
  configured: number;
  observed: number;
}

/**
 * Compares each phoneme's configured weight (normalized within its kind —
 * consonant or vowel — since that's the partition the default "C"/"V"
 * classes sample over) against its observed share of that kind's occurrences
 * in the lexicon.
 */
export function frequencyReport(
  lexicon: GeneratedWord[],
  inv: Inventory,
): PhonemeFrequency[] {
  const kindById = new Map(inv.phonemes.map((p) => [p.id, p.features.kind]));

  const configuredWeightByKind = new Map<string, number>();
  for (const p of inv.phonemes) {
    configuredWeightByKind.set(
      p.features.kind,
      (configuredWeightByKind.get(p.features.kind) ?? 0) + p.weight,
    );
  }

  const countById = new Map<string, number>();
  const countByKind = new Map<string, number>();
  for (const word of lexicon) {
    for (const id of word.phonemeIds) {
      const kind = kindById.get(id);
      if (kind === undefined) continue;
      countById.set(id, (countById.get(id) ?? 0) + 1);
      countByKind.set(kind, (countByKind.get(kind) ?? 0) + 1);
    }
  }

  return inv.phonemes.map((p) => {
    const configuredTotal = configuredWeightByKind.get(p.features.kind) ?? 0;
    const configured = configuredTotal > 0 ? p.weight / configuredTotal : 0;
    const kindTotal = countByKind.get(p.features.kind) ?? 0;
    const observed = kindTotal > 0 ? (countById.get(p.id) ?? 0) / kindTotal : 0;
    return { phonemeId: p.id, configured, observed };
  });
}
