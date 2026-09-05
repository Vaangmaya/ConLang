// Syllable-template grammar parser and printer (DESIGN.md §4.3).
// Invariant T: print(parse(t)) normalizes to canonical form and
// parse(print(parse(t))) equals parse(t).

import type { TemplateNode } from './ast';

export interface TemplateParseError {
  position: number;
  message: string; // located, human-readable, e.g. `Unknown class "L" at position 2 — define it under Classes.`
}

export type TemplateParseResult =
  { ok: true; ast: TemplateNode } | { ok: false; error: TemplateParseError };

export function parseTemplate(
  _raw: string,
  _knownClasses: string[],
): TemplateParseResult {
  throw new Error('not implemented');
}

export function printTemplate(_ast: TemplateNode): string {
  throw new Error('not implemented');
}
