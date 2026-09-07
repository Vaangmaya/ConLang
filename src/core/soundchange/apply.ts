// Ordered rule application (DESIGN.md §4.7). Rules apply in list order; within one
// rule, matches are found left-to-right on the input form, non-overlapping, and
// applied simultaneously (a rule's output cannot feed itself in the same pass).

import { resolveClasses } from '../classes';
import type { FeatureBundle } from '../features';
import type { Inventory, Phoneme } from '../phoneme';
import type { Atom, FeatureSpec } from './ast';
import type { SoundChangeRule } from './parser';

export interface ApplyRuleResult {
  phonemeIds: string[];
  changed: boolean;
  warnings: string[];
}

/** A resolved view of a phonemeId: real inventory data, or a raw stand-in for an emergent segment. */
interface View {
  id: string;
  ipa: string;
  features?: FeatureBundle;
}

function view(id: string, byId: Map<string, Phoneme>): View {
  const p = byId.get(id);
  return p ? { id: p.id, ipa: p.ipa, features: p.features } : { id, ipa: id };
}

function matchesFeatureSpecs(features: FeatureBundle, specs: FeatureSpec[]): boolean {
  const f: Record<string, unknown> = features;
  return specs.every((s) => f[s.name] === (s.sign === '+'));
}

function matchAtom(
  atom: Atom,
  id: string | undefined,
  byId: Map<string, Phoneme>,
  classMembers: Map<string, Set<string>>,
): View | null {
  if (id === undefined) return null;
  const v = view(id, byId);
  switch (atom.type) {
    case 'ipaLiteral':
      return v.ipa === atom.value ? v : null;
    case 'classRef':
      return classMembers.get(atom.symbol)?.has(v.id) ? v : null;
    case 'featureSet':
      return v.features && matchesFeatureSpecs(v.features, atom.features) ? v : null;
    case 'boundary':
      throw new Error(
        'matchAtom: boundary atoms never appear inside target/context bodies.',
      );
  }
}

function matchSeqAt(
  atoms: Atom[],
  phonemeIds: string[],
  start: number,
  byId: Map<string, Phoneme>,
  classMembers: Map<string, Set<string>>,
): View[] | null {
  const out: View[] = [];
  for (let k = 0; k < atoms.length; k++) {
    const m = matchAtom(atoms[k], phonemeIds[start + k], byId, classMembers);
    if (!m) return null;
    out.push(m);
  }
  return out;
}

function contextOkBefore(
  before: Atom[] | undefined,
  phonemeIds: string[],
  i: number,
  byId: Map<string, Phoneme>,
  classMembers: Map<string, Set<string>>,
): boolean {
  if (before === undefined || before.length === 0) return true;
  if (before[0].type === 'boundary') {
    const rest = before.slice(1);
    return (
      i - rest.length === 0 &&
      matchSeqAt(rest, phonemeIds, 0, byId, classMembers) !== null
    );
  }
  const start = i - before.length;
  return start >= 0 && matchSeqAt(before, phonemeIds, start, byId, classMembers) !== null;
}

function contextOkAfter(
  after: Atom[] | undefined,
  phonemeIds: string[],
  j: number,
  byId: Map<string, Phoneme>,
  classMembers: Map<string, Set<string>>,
): boolean {
  if (after === undefined || after.length === 0) return true;
  const last = after[after.length - 1];
  if (last.type === 'boundary') {
    const rest = after.slice(0, -1);
    return (
      j + rest.length === phonemeIds.length &&
      matchSeqAt(rest, phonemeIds, j, byId, classMembers) !== null
    );
  }
  return (
    j + after.length <= phonemeIds.length &&
    matchSeqAt(after, phonemeIds, j, byId, classMembers) !== null
  );
}

function featuresEqual(a: FeatureBundle, b: FeatureBundle): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'consonant' && b.kind === 'consonant') {
    return a.place === b.place && a.manner === b.manner && a.voiced === b.voiced;
  }
  if (a.kind === 'vowel' && b.kind === 'vowel') {
    return (
      a.height === b.height &&
      a.backness === b.backness &&
      a.rounded === b.rounded &&
      a.long === b.long
    );
  }
  return false;
}

function pushWarningOnce(warnings: string[], message: string): void {
  if (!warnings.includes(message)) warnings.push(message);
}

function resolveReplacementAtom(
  atom: Atom,
  matchedView: View | undefined,
  inv: Inventory,
  warnings: string[],
): string {
  switch (atom.type) {
    case 'ipaLiteral': {
      const p = inv.phonemes.find((p) => p.ipa === atom.value);
      if (p) return p.id;
      pushWarningOnce(
        warnings,
        `Emergent segment "${atom.value}" is not in the inventory — consider adding it to the daughter inventory.`,
      );
      return atom.value;
    }
    case 'featureSet': {
      // Parser guarantees a featureSet replacement is never paired with an
      // insertion (no matched phoneme to copy from) — see parser.ts.
      const matched = matchedView!;
      if (!matched.features) {
        pushWarningOnce(
          warnings,
          `Cannot apply feature changes: matched segment "${matched.id}" has no known feature bundle.`,
        );
        return matched.id;
      }
      const next = { ...matched.features } as Record<string, unknown>;
      for (const spec of atom.features) {
        if (spec.name in next) next[spec.name] = spec.sign === '+';
      }
      const found = inv.phonemes.find((p) =>
        featuresEqual(p.features, next as FeatureBundle),
      );
      if (found) return found.id;
      const synthetic = `${matched.ipa}[${atom.features.map((s) => s.sign + s.name).join(',')}]`;
      pushWarningOnce(
        warnings,
        `Emergent segment "${synthetic}" (feature change on "${matched.ipa}") is not in the inventory — consider adding it to the daughter inventory.`,
      );
      return synthetic;
    }
    case 'classRef':
      throw new Error(
        'resolveReplacementAtom: classRef in replacement (parser must reject).',
      );
    case 'boundary':
      throw new Error(
        'resolveReplacementAtom: boundary in replacement (parser must reject).',
      );
  }
}

export function applyRule(
  phonemeIds: string[],
  rule: SoundChangeRule,
  inv: Inventory,
): ApplyRuleResult {
  if (!rule.ast) {
    throw new Error(`applyRule: rule "${rule.id}" has no parsed ast.`);
  }
  const { target, replacement, before, after } = rule.ast;

  const byId = new Map(inv.phonemes.map((p) => [p.id, p]));
  const classes = resolveClasses([], inv);
  const classMembers = new Map(classes.map((c) => [c.symbol, new Set(c.members)]));
  const warnings: string[] = [];
  const N = target.type === 'epsilon' ? 0 : target.atoms.length;

  const out: string[] = [];
  let i = 0;
  while (i <= phonemeIds.length) {
    if (N === 0) {
      if (
        contextOkBefore(before, phonemeIds, i, byId, classMembers) &&
        contextOkAfter(after, phonemeIds, i, byId, classMembers)
      ) {
        if (replacement.type === 'seq') {
          for (const atom of replacement.atoms) {
            out.push(resolveReplacementAtom(atom, undefined, inv, warnings));
          }
        }
      }
      if (i < phonemeIds.length) out.push(phonemeIds[i]);
      i += 1;
      continue;
    }

    // N > 0: nothing left to match or copy once we've reached the end.
    if (i >= phonemeIds.length) break;

    if (i + N <= phonemeIds.length) {
      const matchedViews = matchSeqAt(target.atoms, phonemeIds, i, byId, classMembers);
      if (
        matchedViews &&
        contextOkBefore(before, phonemeIds, i, byId, classMembers) &&
        contextOkAfter(after, phonemeIds, i + N, byId, classMembers)
      ) {
        if (replacement.type === 'seq') {
          replacement.atoms.forEach((atom, k) => {
            out.push(resolveReplacementAtom(atom, matchedViews[k], inv, warnings));
          });
        }
        i += N;
        continue;
      }
    }

    out.push(phonemeIds[i]);
    i += 1;
  }

  const changed =
    out.length !== phonemeIds.length || out.some((id, k) => id !== phonemeIds[k]);

  return { phonemeIds: out, changed, warnings };
}
