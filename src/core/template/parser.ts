// Syllable-template grammar parser and printer (DESIGN.md §4.3).
// Invariant T: print(parse(t)) normalizes to canonical form and
// parse(print(parse(t))) equals parse(t).

import type { ClassRefNode, OptionalNode, TemplateNode } from './ast';

export interface TemplateParseError {
  position: number;
  message: string; // located, human-readable, e.g. `Unknown class "L" at position 2 — define it under Classes.`
}

export type TemplateParseResult =
  { ok: true; ast: TemplateNode } | { ok: false; error: TemplateParseError };

const DEFAULT_PROB = 0.5;

class InternalParseError extends Error {
  position: number;

  constructor(message: string, position: number) {
    super(message);
    this.position = position;
  }
}

export function parseTemplate(raw: string, knownClasses: string[]): TemplateParseResult {
  const known = new Set(knownClasses);
  let pos = 0;

  function peek(): string | undefined {
    return raw[pos];
  }

  function parseClassRef(): ClassRefNode {
    const at = pos;
    const symbol = raw[pos];
    pos++;
    if (!known.has(symbol)) {
      throw new InternalParseError(
        `Unknown class "${symbol}" at position ${at} — define it under Classes.`,
        at,
      );
    }
    return { type: 'ClassRef', symbol };
  }

  function parseProb(): number {
    const colonPos = pos;
    pos++; // consume ':'
    const match = /^\d*\.?\d+/.exec(raw.slice(pos));
    if (!match) {
      throw new InternalParseError(
        `Invalid probability at position ${colonPos} — expected a decimal between 0 and 1, e.g. ":0.3".`,
        colonPos,
      );
    }
    const numPos = pos;
    pos += match[0].length;
    const value = Number(match[0]);
    if (!(value > 0 && value < 1)) {
      throw new InternalParseError(
        `Probability ${match[0]} at position ${numPos} is out of range — must be strictly between 0 and 1.`,
        numPos,
      );
    }
    return value;
  }

  function parseGroup(): OptionalNode {
    const openPos = pos;
    pos++; // consume '('
    const elements = parseElements(')');
    if (elements.length === 0) {
      throw new InternalParseError(
        `Empty group at position ${openPos} — a group needs at least one class reference inside the parentheses.`,
        openPos,
      );
    }
    if (peek() !== ')') {
      throw new InternalParseError(`Expected ")" to close group opened at position ${openPos}.`, pos);
    }
    pos++; // consume ')'
    const prob = peek() === ':' ? parseProb() : DEFAULT_PROB;
    const body: TemplateNode = elements.length === 1 ? elements[0] : { type: 'Seq', elements };
    return { type: 'Optional', prob, body };
  }

  function parseElement(): TemplateNode {
    const ch = peek();
    if (ch === '(') return parseGroup();
    if (ch === ')') {
      throw new InternalParseError(`Unexpected ")" at position ${pos} — no matching "(".`, pos);
    }
    if (ch !== undefined && /[A-Z]/.test(ch)) return parseClassRef();
    throw new InternalParseError(
      `Unexpected character "${ch}" at position ${pos} — expected a class letter (A-Z) or "(".`,
      pos,
    );
  }

  function parseElements(stopChar?: string): TemplateNode[] {
    const elements: TemplateNode[] = [];
    while (pos < raw.length && raw[pos] !== stopChar) {
      elements.push(parseElement());
    }
    return elements;
  }

  try {
    if (raw.length === 0) {
      throw new InternalParseError(
        'Template cannot be empty at position 0 — add at least one class reference, e.g. "CV".',
        0,
      );
    }
    const elements = parseElements();
    const ast: TemplateNode = elements.length === 1 ? elements[0] : { type: 'Seq', elements };
    return { ok: true, ast };
  } catch (e) {
    if (e instanceof InternalParseError) {
      return { ok: false, error: { position: e.position, message: e.message } };
    }
    throw e;
  }
}

export function printTemplate(ast: TemplateNode): string {
  switch (ast.type) {
    case 'ClassRef':
      return ast.symbol;
    case 'Seq':
      return ast.elements.map(printTemplate).join('');
    case 'Optional':
      return `(${printTemplate(ast.body)}):${String(ast.prob)}`;
  }
}
