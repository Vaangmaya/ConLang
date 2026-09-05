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

export function frequencyReport(
  _lexicon: GeneratedWord[],
  _inv: Inventory,
): PhonemeFrequency[] {
  throw new Error('not implemented');
}
