// Syllable-template AST (DESIGN.md §4.3).

export interface ClassRefNode {
  type: 'ClassRef';
  symbol: string; // "A".."Z"
}

export interface OptionalNode {
  type: 'Optional';
  prob: number; // (0,1)
  body: TemplateNode;
}

export interface SeqNode {
  type: 'Seq';
  elements: TemplateNode[];
}

export type TemplateNode = ClassRefNode | OptionalNode | SeqNode;
