// Ordered rule application (DESIGN.md §4.7). Rules apply in list order; within one
// rule, matches are found left-to-right on the input form, non-overlapping, and
// applied simultaneously (a rule's output cannot feed itself in the same pass).

import type { Inventory } from '../phoneme';
import type { SoundChangeRule } from './parser';

export interface ApplyRuleResult {
  phonemeIds: string[];
  changed: boolean;
  warnings: string[];
}

export function applyRule(
  _phonemeIds: string[],
  _rule: SoundChangeRule,
  _inv: Inventory,
): ApplyRuleResult {
  throw new Error('not implemented');
}
