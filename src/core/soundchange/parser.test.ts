import { describe, expect, it } from 'vitest';
import { parseRule, parseRulesFile } from './parser';

const CLASSES = ['C', 'V'];

describe('parseRule: basic substitution', () => {
  it('parses a single-atom substitution', () => {
    const result = parseRule('p > f', CLASSES);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ast).toEqual({
      target: { type: 'seq', atoms: [{ type: 'ipaLiteral', value: 'p' }] },
      replacement: { type: 'seq', atoms: [{ type: 'ipaLiteral', value: 'f' }] },
      before: undefined,
      after: undefined,
    });
  });

  it('parses a multi-segment, whitespace-separated, paired substitution', () => {
    const result = parseRule('p t k > f θ x', CLASSES);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ast.target).toEqual({
      type: 'seq',
      atoms: [
        { type: 'ipaLiteral', value: 'p' },
        { type: 'ipaLiteral', value: 't' },
        { type: 'ipaLiteral', value: 'k' },
      ],
    });
    expect(result.ast.replacement).toEqual({
      type: 'seq',
      atoms: [
        { type: 'ipaLiteral', value: 'f' },
        { type: 'ipaLiteral', value: 'θ' },
        { type: 'ipaLiteral', value: 'x' },
      ],
    });
  });
});

describe('parseRule: context clauses', () => {
  it('parses a word-initial context (leading boundary)', () => {
    const result = parseRule('t > d / #_', CLASSES);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ast.before).toEqual([{ type: 'boundary' }]);
    expect(result.ast.after).toEqual([]);
  });

  it('parses a word-final context (trailing boundary)', () => {
    const result = parseRule('p > f / _#', CLASSES);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ast.before).toEqual([]);
    expect(result.ast.after).toEqual([{ type: 'boundary' }]);
  });

  it('parses both edges anchored', () => {
    const result = parseRule('p > f / #_#', CLASSES);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ast.before).toEqual([{ type: 'boundary' }]);
    expect(result.ast.after).toEqual([{ type: 'boundary' }]);
  });

  it('parses a literal context on both sides', () => {
    const result = parseRule('p > f / a_a', CLASSES);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ast.before).toEqual([{ type: 'ipaLiteral', value: 'a' }]);
    expect(result.ast.after).toEqual([{ type: 'ipaLiteral', value: 'a' }]);
  });
});

describe('parseRule: classRef and featureSet atoms', () => {
  it('parses a classRef target with epsilon replacement (deletion)', () => {
    const result = parseRule('C > ∅ / V_V', CLASSES);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ast.target).toEqual({
      type: 'seq',
      atoms: [{ type: 'classRef', symbol: 'C' }],
    });
    expect(result.ast.replacement).toEqual({ type: 'epsilon' });
    expect(result.ast.before).toEqual([{ type: 'classRef', symbol: 'V' }]);
    expect(result.ast.after).toEqual([{ type: 'classRef', symbol: 'V' }]);
  });

  it('parses a featureSet target and replacement', () => {
    const result = parseRule('[+voiced] > [-voiced] / _#', CLASSES);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ast.target).toEqual({
      type: 'seq',
      atoms: [{ type: 'featureSet', features: [{ sign: '+', name: 'voiced' }] }],
    });
    expect(result.ast.replacement).toEqual({
      type: 'seq',
      atoms: [{ type: 'featureSet', features: [{ sign: '-', name: 'voiced' }] }],
    });
  });

  it('parses a multi-feature set', () => {
    const result = parseRule('[+long,-rounded] > i', CLASSES);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ast.target).toEqual({
      type: 'seq',
      atoms: [
        {
          type: 'featureSet',
          features: [
            { sign: '+', name: 'long' },
            { sign: '-', name: 'rounded' },
          ],
        },
      ],
    });
  });
});

describe('parseRule: insertion and deletion', () => {
  it('parses an insertion with "∅"', () => {
    const result = parseRule('∅ > ə / C_C', CLASSES);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ast.target).toEqual({ type: 'epsilon' });
    expect(result.ast.replacement).toEqual({
      type: 'seq',
      atoms: [{ type: 'ipaLiteral', value: 'ə' }],
    });
  });

  it('parses "0" identically to "∅" for insertion', () => {
    const withZero = parseRule('0 > i / C_C', CLASSES);
    const withEpsilon = parseRule('∅ > i / C_C', CLASSES);
    expect(withZero.ok).toBe(true);
    expect(withEpsilon.ok).toBe(true);
    if (!withZero.ok || !withEpsilon.ok) return;
    expect(withZero.ast).toEqual(withEpsilon.ast);
  });

  it('parses a deletion', () => {
    const result = parseRule('h > ∅', CLASSES);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ast.replacement).toEqual({ type: 'epsilon' });
  });
});

describe('parseRule: located errors', () => {
  it('reports insertion missing a context clause', () => {
    const result = parseRule('∅ > s', CLASSES);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toMatch(/Insertion rules.*require a context clause/);
  });

  it('rejects "∅ > ∅"', () => {
    const result = parseRule('∅ > ∅ / a_a', CLASSES);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toMatch(
      /cannot have both an empty target and an empty replacement/,
    );
  });

  it('rejects a target/replacement atom-count mismatch', () => {
    const result = parseRule('p t > f', CLASSES);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toMatch(
      /target has 2 segment\(s\) but replacement has 1/,
    );
  });

  it('reports an unknown feature name', () => {
    const result = parseRule('[+velar] > p', CLASSES);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toMatch(/Unknown feature "velar"/);
    expect(result.error.message).toMatch(/voiced, rounded, long/);
  });

  it('reports an unknown class symbol', () => {
    const result = parseRule('N > ∅', CLASSES);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toMatch(/Unknown class "N"/);
  });

  it('rejects "#" in the middle of a target', () => {
    const result = parseRule('p # t > f', CLASSES);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toMatch(/Word boundary "#" is not allowed here/);
  });

  it('rejects "#" in the middle of a before-context', () => {
    const result = parseRule('p > f / a#_', CLASSES);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toMatch(
      /only valid at the very start of the before-context/,
    );
  });

  it('rejects "#" in the middle of an after-context', () => {
    const result = parseRule('p > f / _a#b', CLASSES);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toMatch(
      /only valid at the very end of the after-context/,
    );
  });

  it('rejects a classRef in replacement position', () => {
    const result = parseRule('p > C', CLASSES);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toMatch(
      /A class reference cannot be used in a replacement/,
    );
  });

  it('rejects a featureSet replacement under insertion', () => {
    const result = parseRule('∅ > [+voiced] / a_a', CLASSES);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toMatch(
      /feature-set replacement.*needs a matched phoneme/,
    );
  });

  it('rejects an empty rule', () => {
    const result = parseRule('', CLASSES);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toMatch(/Rule cannot be empty/);
  });

  it('reports a missing ">" when the rule never has one', () => {
    const result = parseRule('p f', CLASSES);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toMatch(/Expected ">"/);
  });

  it('rejects a missing "_" in a context clause', () => {
    const result = parseRule('p > f / a', CLASSES);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toMatch(/Expected "_" in the context clause/);
  });

  it('rejects a non-standalone "0"/"∅"', () => {
    const result = parseRule('0p > f', CLASSES);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toMatch(/must stand alone/);
  });
});

describe('parseRule: tokenization gotcha', () => {
  it('parses adjacent unspaced literals as a single atom each side (documented, not an error)', () => {
    const result = parseRule('ptk > fθx', CLASSES);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ast.target).toEqual({
      type: 'seq',
      atoms: [{ type: 'ipaLiteral', value: 'ptk' }],
    });
    expect(result.ast.replacement).toEqual({
      type: 'seq',
      atoms: [{ type: 'ipaLiteral', value: 'fθx' }],
    });
  });
});

describe('parseRulesFile', () => {
  const TEXT = `
# voiceless stops spirantize
1: p > f
2: t > θ
3: k > x

# voiced stops devoice
4: b > p
`;

  it('parses multiple rules, skipping blank and comment lines', () => {
    const { rules, errors } = parseRulesFile(TEXT, CLASSES);
    expect(errors).toEqual([]);
    expect(rules.map((r) => r.id)).toEqual(['1', '2', '3', '4']);
    expect(rules.every((r) => r.ast !== undefined)).toBe(true);
    expect(rules[0].raw).toBe('p > f');
  });

  it('reports a line-numbered error for a bad line while other lines still parse', () => {
    const text = `1: p > f\n2: p t > f\n3: k > x`;
    const { rules, errors } = parseRulesFile(text, CLASSES);
    expect(rules).toHaveLength(3);
    expect(rules[0].ast).toBeDefined();
    expect(rules[1].ast).toBeUndefined();
    expect(rules[2].ast).toBeDefined();
    expect(errors).toEqual([
      { line: 2, message: expect.stringMatching(/target has 2 segment\(s\)/) },
    ]);
  });

  it('counts line numbers correctly across blank and comment lines', () => {
    const text = `# comment\n\n1: p > f\n\n# another\n2: q\n`;
    const { errors } = parseRulesFile(text, CLASSES);
    expect(errors).toEqual([{ line: 6, message: expect.any(String) }]);
  });
});
