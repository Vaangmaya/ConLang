// Sound-change rule notation AST (DESIGN.md §4.7).

export interface FeatureSpec {
  sign: '+' | '-';
  name: string;
}

export type Atom =
  | { type: 'ipaLiteral'; value: string }
  | { type: 'classRef'; symbol: string }
  | { type: 'featureSet'; features: FeatureSpec[] }
  | { type: 'boundary' }; // "#"

export type Target = { type: 'seq'; atoms: Atom[] } | { type: 'epsilon' }; // "∅"
export type Replacement = { type: 'seq'; atoms: Atom[] } | { type: 'epsilon' };

export interface SoundChangeAst {
  target: Target;
  replacement: Replacement;
  before?: Atom[];
  after?: Atom[];
}
