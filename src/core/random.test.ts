import { describe, expect, it } from 'vitest';
import { bernoulli, mulberry32, weightedChoice } from './random';

describe('mulberry32', () => {
  it('is deterministic for a given seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = Array.from({ length: 5 }, () => a());
    const seqB = Array.from({ length: 5 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('produces values in [0, 1)', () => {
    const rng = mulberry32(1);
    for (let i = 0; i < 100; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('weightedChoice', () => {
  it('is deterministic for a given rng', () => {
    const a = weightedChoice(['x', 'y', 'z'], [1, 1, 1], mulberry32(7));
    const b = weightedChoice(['x', 'y', 'z'], [1, 1, 1], mulberry32(7));
    expect(a).toBe(b);
  });

  it('roughly matches weight ratios over many draws', () => {
    const rng = mulberry32(123);
    const counts = { a: 0, b: 0 };
    const n = 20000;
    for (let i = 0; i < n; i++) {
      counts[weightedChoice(['a', 'b'] as const, [1, 3], rng)]++;
    }
    // Expect roughly a 1:3 split; loose tolerance to keep this stable.
    expect(counts.a / n).toBeGreaterThan(0.2);
    expect(counts.a / n).toBeLessThan(0.3);
  });

  it('always returns the sole item when given one option', () => {
    expect(weightedChoice(['only'], [5], mulberry32(1))).toBe('only');
  });

  it('throws on an empty items array', () => {
    expect(() => weightedChoice([], [], mulberry32(1))).toThrow(/non-empty/);
  });

  it('throws when items and weights lengths differ', () => {
    expect(() => weightedChoice(['a', 'b'], [1], mulberry32(1))).toThrow(/same length/);
  });

  it('throws when weights sum to zero', () => {
    expect(() => weightedChoice(['a', 'b'], [0, 0], mulberry32(1))).toThrow(/positive/);
  });
});

describe('bernoulli', () => {
  it('is deterministic for a given rng', () => {
    const a = bernoulli(0.5, mulberry32(9));
    const b = bernoulli(0.5, mulberry32(9));
    expect(a).toBe(b);
  });

  it('is never true for p=0', () => {
    const rng = mulberry32(2);
    for (let i = 0; i < 50; i++) {
      expect(bernoulli(0, rng)).toBe(false);
    }
  });

  it('is always true for p=1', () => {
    const rng = mulberry32(3);
    for (let i = 0; i < 50; i++) {
      expect(bernoulli(1, rng)).toBe(true);
    }
  });
});
