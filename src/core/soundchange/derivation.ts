// Derivation traces (DESIGN.md §4.7). derive() returns the final form plus the
// full per-rule trace.

import type { Inventory } from '../phoneme';
import { applyRule } from './apply';
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

/**
 * Renders phonemeIds for display, falling back to the raw id for any id not
 * in the inventory (an emergent segment produced by an earlier rule) rather
 * than throwing like romanization.ts's `render` does.
 */
function renderOrRaw(phonemeIds: string[], inv: Inventory): string {
  const byId = new Map(inv.phonemes.map((p) => [p.id, p]));
  return phonemeIds.map((id) => byId.get(id)?.romanization ?? id).join('');
}

export function derive(
  phonemeIds: string[],
  rules: SoundChangeRule[],
  inv: Inventory,
): DerivationResult {
  let current = phonemeIds;
  const steps: DerivationStep[] = [];
  const warnings: string[] = [];

  for (const rule of rules) {
    if (!rule.enabled) continue;
    if (!rule.ast) {
      warnings.push(`[rule ${rule.id}] not parsed — skipped.`);
      continue;
    }
    const before = current;
    const result = applyRule(current, rule, inv);
    current = result.phonemeIds;
    for (const w of result.warnings) warnings.push(`[rule ${rule.id}] ${w}`);
    steps.push({
      ruleId: rule.id,
      before: renderOrRaw(before, inv),
      after: renderOrRaw(current, inv),
      changed: result.changed,
    });
  }

  return { finalPhonemeIds: current, steps, warnings };
}
