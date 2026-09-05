// Recognizer: memoized recursive descent over positions x templates (DESIGN.md §4.6).
// Invariant G: every generated word is accepted by the recognizer.

import { resolveClasses } from './classes';
import { checkConstraints } from './constraints';
import type { PhonotacticGrammar, SyllableTemplate } from './generator';
import type { Inventory } from './phoneme';
import type { TemplateNode } from './template/ast';

export interface SyllableParse {
  start: number;
  end: number;
  templateRaw: string;
}

export interface RecognizeResult {
  ok: boolean;
  parse?: SyllableParse[];
}

/**
 * All end positions j such that `node` matches phonemeIds[pos:j] exactly.
 * Memoized per node (nodes are small, immutable ASTs owned by one template,
 * so a node object's matches at a given start position never change).
 */
function matchNodeEnds(
  node: TemplateNode,
  phonemeIds: string[],
  pos: number,
  classMembers: Map<string, Set<string>>,
  memo: WeakMap<TemplateNode, Map<number, number[]>>,
): number[] {
  let byPos = memo.get(node);
  if (byPos === undefined) {
    byPos = new Map();
    memo.set(node, byPos);
  }
  const cached = byPos.get(pos);
  if (cached !== undefined) return cached;

  let ends: number[];
  switch (node.type) {
    case 'ClassRef': {
      const members = classMembers.get(node.symbol);
      ends =
        members && pos < phonemeIds.length && members.has(phonemeIds[pos])
          ? [pos + 1]
          : [];
      break;
    }
    case 'Optional': {
      const bodyEnds = matchNodeEnds(node.body, phonemeIds, pos, classMembers, memo);
      ends = [...new Set([pos, ...bodyEnds])];
      break;
    }
    case 'Seq': {
      let current = new Set([pos]);
      for (const el of node.elements) {
        const next = new Set<number>();
        for (const p of current) {
          for (const e of matchNodeEnds(el, phonemeIds, p, classMembers, memo))
            next.add(e);
        }
        current = next;
      }
      ends = [...current];
      break;
    }
  }
  byPos.set(pos, ends);
  return ends;
}

/** Whether some sequence of `remaining` syllables can consume phonemeIds[pos:length]. */
function feasible(
  pos: number,
  remaining: number,
  length: number,
  templates: SyllableTemplate[],
  phonemeIds: string[],
  classMembers: Map<string, Set<string>>,
  matchMemo: WeakMap<TemplateNode, Map<number, number[]>>,
  feasMemo: Map<string, boolean>,
): boolean {
  if (remaining === 0) return pos === length;
  const key = `${remaining}:${pos}`;
  const cached = feasMemo.get(key);
  if (cached !== undefined) return cached;

  let result = false;
  for (const t of templates) {
    for (const end of matchNodeEnds(t.ast, phonemeIds, pos, classMembers, matchMemo)) {
      if (
        feasible(
          end,
          remaining - 1,
          length,
          templates,
          phonemeIds,
          classMembers,
          matchMemo,
          feasMemo,
        )
      ) {
        result = true;
        break;
      }
    }
    if (result) break;
  }
  feasMemo.set(key, result);
  return result;
}

/** Lazily enumerates syllable segmentations, pruned by `feasible`. */
function* enumerateSegmentations(
  pos: number,
  remaining: number,
  length: number,
  templates: SyllableTemplate[],
  phonemeIds: string[],
  classMembers: Map<string, Set<string>>,
  matchMemo: WeakMap<TemplateNode, Map<number, number[]>>,
  feasMemo: Map<string, boolean>,
): Generator<SyllableParse[]> {
  if (remaining === 0) {
    if (pos === length) yield [];
    return;
  }
  for (const t of templates) {
    for (const end of matchNodeEnds(t.ast, phonemeIds, pos, classMembers, matchMemo)) {
      if (
        !feasible(
          end,
          remaining - 1,
          length,
          templates,
          phonemeIds,
          classMembers,
          matchMemo,
          feasMemo,
        )
      ) {
        continue;
      }
      for (const rest of enumerateSegmentations(
        end,
        remaining - 1,
        length,
        templates,
        phonemeIds,
        classMembers,
        matchMemo,
        feasMemo,
      )) {
        yield [{ start: pos, end, templateRaw: t.raw }, ...rest];
      }
    }
  }
}

export function accepts(
  phonemeIds: string[],
  grammar: PhonotacticGrammar,
  inv: Inventory,
): RecognizeResult {
  const classes = resolveClasses(grammar.classes, inv);
  const classMembers = new Map(classes.map((c) => [c.symbol, new Set(c.members)]));
  const matchMemo = new WeakMap<TemplateNode, Map<number, number[]>>();
  const length = phonemeIds.length;
  const { min, max } = grammar.syllableCount;

  for (let k = min; k <= max; k++) {
    const feasMemo = new Map<string, boolean>();
    if (
      !feasible(
        0,
        k,
        length,
        grammar.templates,
        phonemeIds,
        classMembers,
        matchMemo,
        feasMemo,
      )
    ) {
      continue;
    }
    for (const segments of enumerateSegmentations(
      0,
      k,
      length,
      grammar.templates,
      phonemeIds,
      classMembers,
      matchMemo,
      feasMemo,
    )) {
      const syllableBreaks = segments.map((s) => s.start);
      const result = checkConstraints(
        phonemeIds,
        syllableBreaks,
        grammar.constraints,
        classes,
      );
      if (result.ok) {
        return { ok: true, parse: segments };
      }
    }
  }
  return { ok: false };
}
