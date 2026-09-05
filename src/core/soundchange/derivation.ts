// Derivation traces (DESIGN.md §4.7). derive() returns the final form plus the
// full per-rule trace.

import type { Inventory } from '../phoneme';
import type { SoundChangeRule } from './parser';

export interface DerivationStep {
  ruleId: string;
  before: string;
  after: string;
  changed: boolean;
}

export interface DerivationResult {
  finalPhonemeIds: string[];
  steps: DerivationStep[];
  warnings: string[];
}

export function derive(
  _phonemeIds: string[],
  _rules: SoundChangeRule[],
  _inv: Inventory,
): DerivationResult {
  throw new Error('not implemented');
}
