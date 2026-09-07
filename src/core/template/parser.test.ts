import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { parseTemplate, printTemplate } from './parser';

const CLASSES = ['A', 'B', 'C', 'V', 'N', 'L'];

describe('parseTemplate', () => {
  it('parses a simple sequence: CV(C)', () => {
    const result = parseTemplate('CV(C)', CLASSES);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ast).toEqual({
      type: 'Seq',
      elements: [
        { type: 'ClassRef', symbol: 'C' },
        { type: 'ClassRef', symbol: 'V' },
        { type: 'Optional', prob: 0.5, body: { type: 'ClassRef', symbol: 'C' } },
      ],
    });
  });

  it('parses nested groups with explicit probabilities: (C)(L)V(N):0.3', () => {
    const result = parseTemplate('(C)(L)V(N):0.3', CLASSES);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ast).toEqual({
      type: 'Seq',
      elements: [
        { type: 'Optional', prob: 0.5, body: { type: 'ClassRef', symbol: 'C' } },
        { type: 'Optional', prob: 0.5, body: { type: 'ClassRef', symbol: 'L' } },
        { type: 'ClassRef', symbol: 'V' },
        { type: 'Optional', prob: 0.3, body: { type: 'ClassRef', symbol: 'N' } },
      ],
    });
  });

  it('parses deeply nested groups: CV((N):0.8)', () => {
    const result = parseTemplate('CV((N):0.8)', CLASSES);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ast).toEqual({
      type: 'Seq',
      elements: [
        { type: 'ClassRef', symbol: 'C' },
        { type: 'ClassRef', symbol: 'V' },
        {
          type: 'Optional',
          prob: 0.5,
          body: { type: 'Optional', prob: 0.8, body: { type: 'ClassRef', symbol: 'N' } },
        },
      ],
    });
  });

  it('reports a located error for an unknown class', () => {
    const result = parseTemplate('CX', CLASSES);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.position).toBe(1);
    expect(result.error.message).toMatch(/Unknown class "X" at position 1/);
  });

  it('reports a located error for an unclosed group', () => {
    const result = parseTemplate('C(V', CLASSES);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toMatch(/close group opened at position 1/);
  });

  it('reports a located error for an empty group', () => {
    const result = parseTemplate('C()', CLASSES);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toMatch(/Empty group at position 1/);
  });

  it('reports a located error for a stray closing paren', () => {
    const result = parseTemplate('CV)', CLASSES);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.position).toBe(2);
    expect(result.error.message).toMatch(/no matching "\("/);
  });

  it('reports a located error for invalid probability syntax', () => {
    const result = parseTemplate('(C):x', CLASSES);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toMatch(/Invalid probability at position 3/);
  });

  it('reports a located error for an out-of-range probability', () => {
    const result = parseTemplate('(C):1', CLASSES);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toMatch(/out of range/);
  });

  it('reports a located error for an unexpected character', () => {
    const result = parseTemplate('C v', CLASSES);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.position).toBe(1);
    expect(result.error.message).toMatch(/Unexpected character " "/);
  });

  it('reports a located error for an empty template', () => {
    const result = parseTemplate('', CLASSES);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.position).toBe(0);
    expect(result.error.message).toMatch(/cannot be empty/);
  });
});

describe('printTemplate', () => {
  it('always includes an explicit probability, even the 0.5 default', () => {
    const parsed = parseTemplate('(C)', CLASSES);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(printTemplate(parsed.ast)).toBe('(C):0.5');
  });

  it('canonicalizes an omitted outer probability explicitly on re-print', () => {
    // The outer group here has no ":prob" in the source, so it defaults to 0.5;
    // canonical printing must make that explicit rather than omitting it.
    const parsed = parseTemplate('CV((N):0.8)', CLASSES);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const printed = printTemplate(parsed.ast);
    expect(printed).toBe('CV((N):0.8):0.5');
    const reparsed = parseTemplate(printed, CLASSES);
    expect(reparsed.ok).toBe(true);
    if (!reparsed.ok) return;
    expect(reparsed.ast).toEqual(parsed.ast);
  });
});

describe('Invariant T: parse(print(parse(t))) === parse(t)', () => {
  const knownClasses = ['A', 'B', 'C', 'V'];
  const symbolArb = fc.constantFrom(...knownClasses);
  const probArb = fc.integer({ min: 1, max: 9 }).map((n) => n / 10);

  function elementArb(depth: number): fc.Arbitrary<string> {
    if (depth <= 0) return symbolArb;
    return fc.oneof(
      { weight: 3, arbitrary: symbolArb },
      {
        weight: 1,
        arbitrary: fc
          .tuple(seqArb(depth - 1), probArb)
          .map(([inner, prob]) => `(${inner}):${prob}`),
      },
    );
  }

  function seqArb(depth: number): fc.Arbitrary<string> {
    return fc
      .array(elementArb(depth), { minLength: 1, maxLength: 4 })
      .map((els) => els.join(''));
  }

  const templateStringArb = seqArb(3);

  it('holds for arbitrary valid template strings', () => {
    fc.assert(
      fc.property(templateStringArb, (t) => {
        const r1 = parseTemplate(t, knownClasses);
        expect(r1.ok).toBe(true);
        if (!r1.ok) return;
        const printed = printTemplate(r1.ast);
        const r2 = parseTemplate(printed, knownClasses);
        expect(r2.ok).toBe(true);
        if (!r2.ok) return;
        expect(r2.ast).toEqual(r1.ast);
      }),
    );
  });
});
