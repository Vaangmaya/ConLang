// Constraint types and evaluator (DESIGN.md §4.5).
//
// checkConstraints operates over pre-resolved phoneme-id classes (classes.ts)
// rather than a raw Inventory: every constraint field that needs to reference
// a class of phonemes (BannedSequence's class-ref tokens, RequiredOnset's
// consonant check) already resolves against phoneme ids, and Sonority/
// VowelHarmony store phoneme ids directly. Resolving classes (including the
// auto-derived "C"/"V") once per generate() call and passing the result in
// is equivalent to passing an Inventory, and avoids re-deriving natural
// classes on every check.

import type { PhonemeClass } from './classes';

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

/** [start, end) index ranges for each syllable, derived from its start indices. */
function syllableSpans(syllableBreaks: number[], length: number): Array<[number, number]> {
  return syllableBreaks.map((start, i): [number, number] => [
    start,
    i + 1 < syllableBreaks.length ? syllableBreaks[i + 1] : length,
  ]);
}

/** Resolves a BannedSequence token to the set of phoneme ids it matches. */
function resolveToken(token: string, classes: PhonemeClass[]): Set<string> {
  const cls = classes.find((c) => c.symbol === token);
  return cls ? new Set(cls.members) : new Set([token]);
}

function windowMatches(phonemeIds: string[], start: number, matchers: Set<string>[]): boolean {
  for (let i = 0; i < matchers.length; i++) {
    if (!matchers[i].has(phonemeIds[start + i])) return false;
  }
  return true;
}

function checkBannedSequence(
  c: BannedSequenceConstraint,
  phonemeIds: string[],
  syllableBreaks: number[],
  classes: PhonemeClass[],
): boolean {
  const matchers = c.sequence.map((token) => resolveToken(token, classes));
  const L = matchers.length;
  const n = phonemeIds.length;

  const anyMatchIn = (starts: Iterable<number>): boolean => {
    for (const start of starts) {
      if (start < 0 || start + L > n) continue;
      if (windowMatches(phonemeIds, start, matchers)) return true;
    }
    return false;
  };

  let found: boolean;
  switch (c.scope) {
    case 'anywhere':
      found = anyMatchIn(rangeIterator(0, n - L + 1));
      break;
    case 'wordInitial':
      found = anyMatchIn([0]);
      break;
    case 'wordFinal':
      found = anyMatchIn([n - L]);
      break;
    case 'withinSyllable': {
      found = false;
      for (const [s, e] of syllableSpans(syllableBreaks, n)) {
        if (anyMatchIn(rangeIterator(s, e - L + 1))) {
          found = true;
          break;
        }
      }
      break;
    }
    case 'acrossSyllableBoundary': {
      const internalBreaks = syllableBreaks.filter((b) => b !== 0);
      found = false;
      for (let start = 0; start + L <= n; start++) {
        const spansBoundary = internalBreaks.some((b) => start < b && b < start + L);
        if (spansBoundary && windowMatches(phonemeIds, start, matchers)) {
          found = true;
          break;
        }
      }
      break;
    }
  }
  return !found;
}

function* rangeIterator(from: number, toExclusive: number): Generator<number> {
  for (let i = from; i < toExclusive; i++) yield i;
}

function checkSonority(
  c: SonorityConstraint,
  phonemeIds: string[],
  syllableBreaks: number[],
): boolean {
  // Sonority carries only a scale + allowPlateaus, with no onset/nucleus/coda
  // markers, so the only implementable reading is a single unimodal
  // (rise-then-fall, one peak) walk over each syllable's sonority values.
  for (const [s, e] of syllableSpans(syllableBreaks, phonemeIds.length)) {
    const values: number[] = [];
    for (let i = s; i < e; i++) {
      const id = phonemeIds[i];
      const v = c.scale[id];
      if (v === undefined) {
        throw new Error(`Sonority constraint: no scale entry for phoneme id "${id}".`);
      }
      values.push(v);
    }
    let falling = false;
    for (let i = 1; i < values.length; i++) {
      if (values[i] > values[i - 1]) {
        if (falling) return false;
      } else if (values[i] === values[i - 1]) {
        if (!c.allowPlateaus) return false;
      } else {
        falling = true;
      }
    }
  }
  return true;
}

function checkVowelHarmony(c: VowelHarmonyConstraint, phonemeIds: string[]): boolean {
  const neutral = new Set(c.neutral);
  const setIndexById = new Map<string, number>();
  c.sets.forEach((set, idx) => set.forEach((id) => setIndexById.set(id, idx)));

  let activeSet: number | null = null;
  for (const id of phonemeIds) {
    if (neutral.has(id)) continue;
    const idx = setIndexById.get(id);
    if (idx === undefined) continue; // not part of the harmony system; treated as neutral
    if (activeSet === null) activeSet = idx;
    else if (activeSet !== idx) return false;
  }
  return true;
}

function checkRequiredOnset(
  c: RequiredOnsetConstraint,
  phonemeIds: string[],
  syllableBreaks: number[],
  classes: PhonemeClass[],
): boolean {
  const cClass = classes.find((cl) => cl.symbol === 'C');
  if (!cClass) throw new Error('RequiredOnset constraint: no "C" class resolved.');
  const consonants = new Set(cClass.members);
  if (c.scope === 'wordInitial') {
    return phonemeIds.length > 0 && consonants.has(phonemeIds[0]);
  }
  return syllableBreaks.every((start) => consonants.has(phonemeIds[start]));
}

/**
 * Checks phonemeIds against constraints in order, returning the first
 * failing constraint (order affects which one gets blamed in diagnostics).
 */
export function checkConstraints(
  phonemeIds: string[],
  syllableBreaks: number[],
  constraints: Constraint[],
  classes: PhonemeClass[],
): ConstraintCheckResult {
  for (const c of constraints) {
    let ok: boolean;
    switch (c.type) {
      case 'BannedSequence':
        ok = checkBannedSequence(c, phonemeIds, syllableBreaks, classes);
        break;
      case 'Sonority':
        ok = checkSonority(c, phonemeIds, syllableBreaks);
        break;
      case 'VowelHarmony':
        ok = checkVowelHarmony(c, phonemeIds);
        break;
      case 'RequiredOnset':
        ok = checkRequiredOnset(c, phonemeIds, syllableBreaks, classes);
        break;
    }
    if (!ok) return { ok: false, failedConstraint: c };
  }
  return { ok: true };
}
