// Sound-change rule notation parser (DESIGN.md §4.7).
// Parser errors must include a position and a plain-English fix suggestion.

import type { Atom, Replacement, SoundChangeAst, Target } from './ast';

export interface SoundChangeRule {
  id: string;
  raw: string;
  enabled: boolean;
  ast?: SoundChangeAst; // parsed form; absent if the raw rule fails to parse
}

export interface RuleParseError {
  position: number;
  message: string;
}

export type RuleParseResult =
  { ok: true; ast: SoundChangeAst } | { ok: false; error: RuleParseError };

const BOOLEAN_FEATURES = ['voiced', 'rounded', 'long'];
const ATOM_STOP_CHARS = /[\s[\]#>/_,]/;

class InternalParseError extends Error {
  position: number;

  constructor(message: string, position: number) {
    super(message);
    this.position = position;
  }
}

type BoundaryPolicy = 'none' | 'leadingOnly' | 'trailingOnly';

/**
 * Parses a single sound-change rule (DESIGN.md §4.7's `rule` production).
 *
 * `knownClasses` is validated only syntactically here — `applyRule`/`derive`
 * only ever resolve `classRef` atoms against the inventory's auto-derived
 * "C"/"V" classes (they receive no grammar/custom-class list), so passing any
 * symbol other than "C" or "V" will parse fine but can never match at apply
 * time.
 */
export function parseRule(raw: string, knownClasses: string[]): RuleParseResult {
  const known = new Set(knownClasses);
  let pos = 0;

  function peek(): string | undefined {
    return raw[pos];
  }

  function skipWs(): void {
    while (pos < raw.length && /\s/.test(raw[pos])) pos++;
  }

  function parseFeatureSet(): Atom {
    const openPos = pos;
    pos++; // consume '['
    const features: { sign: '+' | '-'; name: string }[] = [];
    for (;;) {
      skipWs();
      const sign = peek();
      if (sign !== '+' && sign !== '-') {
        throw new InternalParseError(
          `Expected "+" or "-" at position ${pos} inside the feature set opened at position ${openPos}.`,
          pos,
        );
      }
      pos++;
      const namePos = pos;
      const match = /^[a-zA-Z]+/.exec(raw.slice(pos));
      if (!match) {
        throw new InternalParseError(`Expected a feature name at position ${pos}.`, pos);
      }
      pos += match[0].length;
      if (!BOOLEAN_FEATURES.includes(match[0])) {
        throw new InternalParseError(
          `Unknown feature "${match[0]}" at position ${namePos} — valid features are voiced, rounded, long (use a class reference for place/manner-based sets).`,
          namePos,
        );
      }
      features.push({ sign, name: match[0] });
      skipWs();
      if (peek() === ',') {
        pos++;
        continue;
      }
      break;
    }
    skipWs();
    if (peek() !== ']') {
      throw new InternalParseError(
        `Expected "]" to close the feature set opened at position ${openPos}.`,
        pos,
      );
    }
    pos++; // consume ']'
    return { type: 'featureSet', features };
  }

  function parseAtom(): Atom {
    const ch = peek();
    if (ch === '#') {
      pos++;
      return { type: 'boundary' };
    }
    if (ch === '[') return parseFeatureSet();
    if (ch !== undefined && /[A-Z]/.test(ch)) {
      const at = pos;
      pos++;
      if (!known.has(ch)) {
        throw new InternalParseError(
          `Unknown class "${ch}" at position ${at} — define it under Classes.`,
          at,
        );
      }
      return { type: 'classRef', symbol: ch };
    }
    const start = pos;
    while (
      pos < raw.length &&
      !ATOM_STOP_CHARS.test(raw[pos]) &&
      !/[A-Z]/.test(raw[pos])
    ) {
      pos++;
    }
    if (pos === start) {
      throw new InternalParseError(
        `Unexpected character "${ch}" at position ${pos}.`,
        pos,
      );
    }
    return { type: 'ipaLiteral', value: raw.slice(start, pos) };
  }

  /** atom* up to (not consuming) any char in `stopChars`, enforcing where "#" may appear. */
  function parseAtoms(stopChars: string[], boundaryPolicy: BoundaryPolicy): Atom[] {
    const atoms: Atom[] = [];
    const positions: number[] = [];
    for (;;) {
      skipWs();
      if (pos >= raw.length || stopChars.includes(raw[pos])) break;
      const atomPos = pos;
      const atom = parseAtom();
      if (atom.type === 'boundary') {
        if (boundaryPolicy === 'none') {
          throw new InternalParseError(
            `Word boundary "#" is not allowed here at position ${atomPos} — it's only valid at the start of a before-context or the end of an after-context.`,
            atomPos,
          );
        }
        if (boundaryPolicy === 'leadingOnly' && atoms.length !== 0) {
          throw new InternalParseError(
            `Word boundary "#" at position ${atomPos} is only valid at the very start of the before-context.`,
            atomPos,
          );
        }
      }
      atoms.push(atom);
      positions.push(atomPos);
    }
    if (boundaryPolicy === 'trailingOnly') {
      atoms.forEach((atom, i) => {
        if (atom.type === 'boundary' && i !== atoms.length - 1) {
          throw new InternalParseError(
            `Word boundary "#" at position ${positions[i]} is only valid at the very end of the after-context.`,
            positions[i],
          );
        }
      });
    }
    return atoms;
  }

  function parseEpsilonOrSeq(stopChars: string[]): Target | Replacement {
    skipWs();
    const startPos = pos;
    if (peek() === '∅' || peek() === '0') {
      const marker = peek();
      const markerPos = pos;
      pos++;
      skipWs();
      if (pos >= raw.length || stopChars.includes(raw[pos])) {
        return { type: 'epsilon' };
      }
      throw new InternalParseError(
        `"${marker}" at position ${markerPos} must stand alone as an empty target/replacement — remove the following content or write a real sequence instead.`,
        markerPos,
      );
    }
    const atoms = parseAtoms(stopChars, 'none');
    if (atoms.length === 0) {
      throw new InternalParseError(
        `Expected a target/replacement sequence at position ${startPos} (or "∅"/"0" for insertion/deletion).`,
        startPos,
      );
    }
    return { type: 'seq', atoms };
  }

  try {
    if (raw.trim().length === 0) {
      throw new InternalParseError('Rule cannot be empty.', 0);
    }

    const target = parseEpsilonOrSeq(['>']);
    skipWs();
    if (peek() !== '>') {
      throw new InternalParseError(`Expected ">" at position ${pos}.`, pos);
    }
    pos++; // consume '>'

    const replacementStart = pos;
    const replacement = parseEpsilonOrSeq(['/']);
    if (replacement.type === 'seq') {
      for (const atom of replacement.atoms) {
        if (atom.type === 'classRef') {
          throw new InternalParseError(
            `A class reference cannot be used in a replacement (near position ${replacementStart}) — a class isn't a single phoneme; write the literal output phoneme or a feature set instead.`,
            replacementStart,
          );
        }
      }
    }

    skipWs();
    let before: Atom[] | undefined;
    let after: Atom[] | undefined;
    if (peek() === '/') {
      pos++;
      before = parseAtoms(['_'], 'leadingOnly');
      skipWs();
      if (peek() !== '_') {
        throw new InternalParseError(
          `Expected "_" in the context clause at position ${pos}.`,
          pos,
        );
      }
      pos++; // consume '_'
      after = parseAtoms([], 'trailingOnly');
    }

    if (target.type === 'epsilon' && before === undefined) {
      throw new InternalParseError(
        'Insertion rules ("∅" target) require a context clause — add "/ before_after", e.g. "∅ > s / a_a".',
        0,
      );
    }
    if (target.type === 'epsilon' && replacement.type === 'epsilon') {
      throw new InternalParseError(
        'A rule cannot have both an empty target and an empty replacement — it does nothing.',
        0,
      );
    }
    if (target.type === 'epsilon' && replacement.type === 'seq') {
      for (const atom of replacement.atoms) {
        if (atom.type === 'featureSet') {
          throw new InternalParseError(
            `A feature-set replacement (near position ${replacementStart}) needs a matched phoneme to copy from, which an insertion doesn't have — use a literal IPA symbol instead.`,
            replacementStart,
          );
        }
      }
    }
    if (
      target.type === 'seq' &&
      replacement.type === 'seq' &&
      target.atoms.length !== replacement.atoms.length
    ) {
      throw new InternalParseError(
        `target has ${target.atoms.length} segment(s) but replacement has ${replacement.atoms.length} — each target segment must map to exactly one replacement segment (or use ∅ for insertion/deletion).`,
        replacementStart,
      );
    }

    return { ok: true, ast: { target, replacement, before, after } };
  } catch (e) {
    if (e instanceof InternalParseError) {
      return { ok: false, error: { position: e.position, message: e.message } };
    }
    throw e;
  }
}

export interface RuleFileError {
  line: number;
  message: string;
}

export interface ParseRulesFileResult {
  rules: SoundChangeRule[];
  errors: RuleFileError[];
}

/**
 * Loads a small line-based rules-file mini-format (not part of `parseRule`'s
 * grammar): blank lines and lines starting with "#" are comments and are
 * skipped; every other line must be "<id>: <rule text>", e.g. "1: p > f".
 */
export function parseRulesFile(
  text: string,
  knownClasses: string[],
): ParseRulesFileResult {
  const rules: SoundChangeRule[] = [];
  const errors: RuleFileError[] = [];

  text.split(/\r?\n/).forEach((line, index) => {
    const lineNo = index + 1;
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) return;

    const match = /^(\d+):\s*(.+)$/.exec(trimmed);
    if (!match) {
      errors.push({ line: lineNo, message: `Malformed rule line: "${trimmed}"` });
      return;
    }
    const [, id, ruleText] = match;
    const result = parseRule(ruleText, knownClasses);
    if (result.ok) {
      rules.push({ id, raw: ruleText, enabled: true, ast: result.ast });
    } else {
      rules.push({ id, raw: ruleText, enabled: true });
      errors.push({ line: lineNo, message: result.error.message });
    }
  });

  return { rules, errors };
}
