// Recognizer: memoized recursive descent over positions x templates (DESIGN.md §4.6).
// Invariant G: every generated word is accepted by the recognizer.

import type { PhonotacticGrammar } from './generator';
import type { Inventory } from './phoneme';

export interface SyllableParse {
  start: number;
  end: number;
  templateRaw: string;
}

export interface RecognizeResult {
  ok: boolean;
  parse?: SyllableParse[];
}

export function accepts(
  _phonemeIds: string[],
  _grammar: PhonotacticGrammar,
  _inv: Inventory,
): RecognizeResult {
  throw new Error('not implemented');
}
