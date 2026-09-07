// Word generation (DESIGN.md §4.4). Deterministic given a seed; all randomness
// flows through the injected PRNG from random.ts.

import { type PhonemeClass, resolveClasses } from './classes';
import { checkConstraints, type Constraint } from './constraints';
import type { Inventory, Phoneme } from './phoneme';
import { bernoulli, mulberry32, weightedChoice, type Rng } from './random';
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
  syllableBreaks: number[]; // start index of each syllable, including 0; length === syllable count
  seed: number; // regenerate this exact word deterministically
}

export interface GenDiagnostics {
  rejectedWords: number;
  topRejectingConstraints: { constraint: string; rejections: number }[];
}

export interface GenerateResult {
  words: GeneratedWord[];
  diagnostics: GenDiagnostics;
}

export const MAX_ATTEMPTS = 200;
export const TOP_REJECTING_LIMIT = 3;

/**
 * Eager, fail-fast checks for grammar/inventory mismatches that checkConstraints
 * or the sampler would otherwise only discover deep in the per-word retry loop
 * (e.g. crashing on word 9,999 because a rare phoneme has no Sonority entry).
 */
function validateGrammar(
  grammar: PhonotacticGrammar,
  inv: Inventory,
  classes: PhonemeClass[],
): void {
  const validIds = new Set(inv.phonemes.map((p) => p.id));
  const classSymbols = new Set(classes.map((c) => c.symbol));

  for (const cls of classes) {
    for (const id of cls.members) {
      if (!validIds.has(id)) {
        throw new Error(
          `generate: class "${cls.symbol}" references unknown phoneme id "${id}".`,
        );
      }
    }
  }

  const { min, max, weights } = grammar.syllableCount;
  if (weights.length !== max - min + 1) {
    throw new Error(
      `generate: syllableCount.weights has ${weights.length} entries but max-min+1 is ${max - min + 1}.`,
    );
  }

  const cMembers = classes.find((c) => c.symbol === 'C')?.members ?? [];
  const vMembers = classes.find((c) => c.symbol === 'V')?.members ?? [];

  for (const constraint of grammar.constraints) {
    if (constraint.type === 'Sonority') {
      for (const id of [...cMembers, ...vMembers]) {
        if (constraint.scale[id] === undefined) {
          throw new Error(
            `generate: Sonority constraint has no scale entry for phoneme id "${id}".`,
          );
        }
      }
    } else if (constraint.type === 'VowelHarmony') {
      const covered = new Set([...constraint.sets.flat(), ...constraint.neutral]);
      for (const id of vMembers) {
        if (!covered.has(id)) {
          throw new Error(
            `generate: VowelHarmony constraint does not cover vowel phoneme id "${id}" — add it to a set or to neutral.`,
          );
        }
      }
    } else if (constraint.type === 'BannedSequence') {
      for (const token of constraint.sequence) {
        if (!classSymbols.has(token) && !validIds.has(token)) {
          throw new Error(
            `generate: BannedSequence token "${token}" is not a known class symbol or phoneme id.`,
          );
        }
      }
    }
  }
}

function walkNode(
  node: TemplateNode,
  classMembers: Map<string, Phoneme[]>,
  rng: Rng,
): string[] {
  switch (node.type) {
    case 'ClassRef': {
      const members = classMembers.get(node.symbol);
      if (!members || members.length === 0) {
        throw new Error(
          `generate: class "${node.symbol}" has no members to sample from.`,
        );
      }
      const chosen = weightedChoice(
        members,
        members.map((p) => p.weight),
        rng,
      );
      return [chosen.id];
    }
    case 'Optional':
      return bernoulli(node.prob, rng) ? walkNode(node.body, classMembers, rng) : [];
    case 'Seq':
      return node.elements.flatMap((el) => walkNode(el, classMembers, rng));
  }
}

function sampleWord(
  grammar: PhonotacticGrammar,
  classMembers: Map<string, Phoneme[]>,
  rng: Rng,
): { phonemeIds: string[]; syllableBreaks: number[] } {
  const { min, weights } = grammar.syllableCount;
  const counts = weights.map((_, i) => min + i);
  const syllableCount = weightedChoice(counts, weights, rng);

  const phonemeIds: string[] = [];
  const syllableBreaks: number[] = [];
  const templateWeights = grammar.templates.map((t) => t.weight);
  for (let i = 0; i < syllableCount; i++) {
    syllableBreaks.push(phonemeIds.length);
    const template = weightedChoice(grammar.templates, templateWeights, rng);
    phonemeIds.push(...walkNode(template.ast, classMembers, rng));
  }
  return { phonemeIds, syllableBreaks };
}

function describeConstraint(c: Constraint): string {
  switch (c.type) {
    case 'BannedSequence':
      return `BannedSequence(${c.sequence.join(' ')}, scope=${c.scope})`;
    case 'Sonority':
      return `Sonority(allowPlateaus=${c.allowPlateaus})`;
    case 'VowelHarmony':
      return `VowelHarmony(${c.sets.length} sets)`;
    case 'RequiredOnset':
      return `RequiredOnset(${c.scope})`;
  }
}

export function generate(
  grammar: PhonotacticGrammar,
  inv: Inventory,
  n: number,
  seed: number,
): GenerateResult {
  const classes = resolveClasses(grammar.classes, inv);
  validateGrammar(grammar, inv, classes);

  const phonemeById = new Map(inv.phonemes.map((p) => [p.id, p]));
  const classMembers = new Map(
    classes.map((c) => [c.symbol, c.members.map((id) => phonemeById.get(id)!)]),
  );

  const masterRng = mulberry32(seed);
  const words: GeneratedWord[] = [];
  let rejectedWords = 0;
  // Pre-seeded in constraints order so ties in topRejectingConstraints are
  // broken deterministically by that order (Map iteration order == insertion order).
  const rejectionCounts = new Map<Constraint, number>(
    grammar.constraints.map((c) => [c, 0]),
  );

  for (let i = 0; i < n; i++) {
    const wordSeed = Math.floor(masterRng() * 4294967296) >>> 0;
    // Reused across retries for this word (never reset) — resetting would make
    // every retry resample the identical, already-rejected candidate.
    const rng = mulberry32(wordSeed);
    let accepted: { phonemeIds: string[]; syllableBreaks: number[] } | null = null;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const candidate = sampleWord(grammar, classMembers, rng);
      const result = checkConstraints(
        candidate.phonemeIds,
        candidate.syllableBreaks,
        grammar.constraints,
        classes,
      );
      if (result.ok) {
        accepted = candidate;
        break;
      }
      const failed = result.failedConstraint as Constraint;
      rejectionCounts.set(failed, (rejectionCounts.get(failed) ?? 0) + 1);
    }

    if (accepted) {
      words.push({
        phonemeIds: accepted.phonemeIds,
        syllableBreaks: accepted.syllableBreaks,
        seed: wordSeed,
      });
    } else {
      rejectedWords++;
    }
  }

  const topRejectingConstraints = [...rejectionCounts.entries()]
    .filter(([, rejections]) => rejections > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_REJECTING_LIMIT)
    .map(([constraint, rejections]) => ({
      constraint: describeConstraint(constraint),
      rejections,
    }));

  return {
    words,
    diagnostics: { rejectedWords, topRejectingConstraints },
  };
}
