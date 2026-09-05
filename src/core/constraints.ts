// Constraint types and evaluator (DESIGN.md §4.5).

export type ConstraintScope =
  'anywhere' | 'wordInitial' | 'wordFinal' | 'withinSyllable' | 'acrossSyllableBoundary';

export interface BannedSequenceConstraint {
  type: 'BannedSequence';
  sequence: string[]; // class refs and/or phoneme literals
  scope: ConstraintScope;
}

export interface SonorityConstraint {
  type: 'Sonority';
  scale: Record<string, number>;
  allowPlateaus: boolean;
}

export interface VowelHarmonyConstraint {
  type: 'VowelHarmony';
  sets: string[][]; // 2+ harmony sets of phoneme ids
  neutral: string[];
}

export interface RequiredOnsetConstraint {
  type: 'RequiredOnset';
  scope: 'everySyllable' | 'wordInitial';
}

export type Constraint =
  | BannedSequenceConstraint
  | SonorityConstraint
  | VowelHarmonyConstraint
  | RequiredOnsetConstraint;

export interface ConstraintCheckResult {
  ok: boolean;
  failedConstraint?: Constraint;
}

export function checkConstraints(
  _phonemeIds: string[],
  _syllableBreaks: number[],
  _constraints: Constraint[],
): ConstraintCheckResult {
  throw new Error('not implemented');
}
