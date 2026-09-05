// Seeded PRNG (mulberry32). The sole source of randomness in src/core — never use Math.random() here.

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Picks an item with probability proportional to its weight. Weights need not sum to 1. */
export function weightedChoice<T>(items: T[], weights: number[], rng: Rng): T {
  if (items.length === 0) throw new Error('weightedChoice: items must be non-empty.');
  if (items.length !== weights.length) {
    throw new Error('weightedChoice: items and weights must be the same length.');
  }
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (!(total > 0)) throw new Error('weightedChoice: weights must sum to a positive number.');
  const r = rng() * total;
  let cumulative = 0;
  for (let i = 0; i < items.length; i++) {
    cumulative += weights[i];
    if (r < cumulative) return items[i];
  }
  return items[items.length - 1];
}

/** True with probability p (a draw of exactly 0 or 1 is never true/always true, respectively). */
export function bernoulli(p: number, rng: Rng): boolean {
  return rng() < p;
}
