// Sound-change rule notation parser (DESIGN.md §4.7).
// Parser errors must include a position and a plain-English fix suggestion.

import type { SoundChangeAst } from './ast';

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

export function parseRule(_raw: string, _knownClasses: string[]): RuleParseResult {
  throw new Error('not implemented');
}
