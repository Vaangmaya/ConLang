// Longest-match tokenizer and renderer (DESIGN.md §4.2).
// Invariant R: tokenize(render(w)) deep-equals w.phonemeIds for every word.

import type { Inventory } from './phoneme';

export interface RomanizationCollision {
  kind: 'duplicate' | 'ambiguous-parse';
  detail: string;
}

export function render(_phonemeIds: string[], _inv: Inventory): string {
  throw new Error('not implemented');
}

export function tokenize(_s: string, _inv: Inventory): string[] {
  throw new Error('not implemented');
}

export function findCollisions(_inv: Inventory): RomanizationCollision[] {
  throw new Error('not implemented');
}
