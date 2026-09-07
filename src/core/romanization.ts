// Longest-match tokenizer and renderer (DESIGN.md §4.2).
// Invariant R: tokenize(render(w)) deep-equals w.phonemeIds for every word.

import type { Inventory, Phoneme } from './phoneme';

export interface RomanizationCollision {
  kind: 'duplicate' | 'ambiguous-parse';
  detail: string;
}

function phonemeById(inv: Inventory): Map<string, Phoneme> {
  return new Map(inv.phonemes.map((p) => [p.id, p]));
}

export function render(phonemeIds: string[], inv: Inventory): string {
  const byId = phonemeById(inv);
  return phonemeIds
    .map((id) => {
      const p = byId.get(id);
      if (!p) throw new Error(`render: unknown phoneme id "${id}".`);
      return p.romanization;
    })
    .join('');
}

/**
 * Greedy longest-match tokenizer: at each position, consume the longest
 * romanization (over all phonemes in the inventory) that matches a prefix
 * of the remaining string.
 */
export function tokenize(s: string, inv: Inventory): string[] {
  const candidates = inv.phonemes
    .filter((p) => p.romanization.length > 0)
    .sort((a, b) => b.romanization.length - a.romanization.length);

  const result: string[] = [];
  let pos = 0;
  while (pos < s.length) {
    const match = candidates.find((p) => s.startsWith(p.romanization, pos));
    if (!match) {
      throw new Error(
        `tokenize: no phoneme romanization matches "${s.slice(pos, pos + 10)}" at position ${pos} in "${s}".`,
      );
    }
    result.push(match.id);
    pos += match.romanization.length;
  }
  return result;
}

/**
 * Detects (a) two phonemes sharing an identical romanization, and
 * (b) pairs of phonemes whose concatenated romanizations parse back to a
 * different sequence under longest-match tokenization (DESIGN.md §4.2).
 */
export function findCollisions(inv: Inventory): RomanizationCollision[] {
  const collisions: RomanizationCollision[] = [];

  const byRomanization = new Map<string, Phoneme[]>();
  for (const p of inv.phonemes) {
    const group = byRomanization.get(p.romanization) ?? [];
    group.push(p);
    byRomanization.set(p.romanization, group);
  }
  for (const [romanization, group] of byRomanization) {
    if (group.length > 1) {
      collisions.push({
        kind: 'duplicate',
        detail: `Phonemes ${group.map((p) => p.id).join(', ')} all use romanization "${romanization}".`,
      });
    }
  }

  for (const a of inv.phonemes) {
    for (const b of inv.phonemes) {
      const concatenated = a.romanization + b.romanization;
      if (!concatenated) continue;
      let parsed: string[];
      try {
        parsed = tokenize(concatenated, inv);
      } catch {
        continue;
      }
      const expected = [a.id, b.id];
      const matches =
        parsed.length === expected.length && parsed.every((id, i) => id === expected[i]);
      if (!matches) {
        collisions.push({
          kind: 'ambiguous-parse',
          detail: `"${a.romanization}" + "${b.romanization}" (phonemes ${a.id} + ${b.id}) concatenates to "${concatenated}", which longest-match tokenizes as ${parsed.join(' + ')} instead.`,
        });
      }
    }
  }

  return collisions;
}
