// Word generation (DESIGN.md §4.4). Deterministic given a seed; all randomness
// flows through the injected PRNG from random.ts.

import type { PhonemeClass } from './classes';
import type { Constraint } from './constraints';
import type { Inventory } from './phoneme';
import type { TemplateNode } from './template/ast';

export interface SyllableTemplate {
  raw: string;
  ast: TemplateNode;
  weight: number;
}

export interface PhonotacticGrammar {
  classes: PhonemeClass[];
  templates: SyllableTemplate[];
  syllableCount: { min: number; max: number; weights: number[] }; // weights.length === max-min+1
  constraints: Constraint[];
}

export interface GeneratedWord {
  phonemeIds: string[];
  syllableBreaks: number[]; // indices into phonemeIds where new syllables start
  seed: number; // regenerate deterministically
}

export interface GenDiagnostics {
  rejectedWords: number;
  topRejectingConstraints: { constraint: string; rejections: number }[];
}

export interface GenerateResult {
  words: GeneratedWord[];
  diagnostics: GenDiagnostics;
}

export function generate(
  _grammar: PhonotacticGrammar,
  _inv: Inventory,
  _n: number,
  _seed: number,
): GenerateResult {
  throw new Error('not implemented');
}
