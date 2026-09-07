import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { findCollisions, render, tokenize } from './romanization';
import { starterInventory, type Inventory, type Phoneme } from './phoneme';

function mkPhoneme(id: string, romanization: string): Phoneme {
  return {
    id,
    ipa: id,
    features: { kind: 'consonant', place: 'alveolar', manner: 'stop', voiced: false },
    weight: 1,
    romanization,
  };
}

describe('render', () => {
  it('concatenates romanizations in order', () => {
    const inv = starterInventory();
    expect(render(['p', 'a', 't'], inv)).toBe('pat');
  });

  it('throws on an unknown phoneme id', () => {
    const inv = starterInventory();
    expect(() => render(['zzz'], inv)).toThrow(/unknown phoneme id/);
  });
});

describe('tokenize', () => {
  it('inverts render for simple single-char romanizations', () => {
    const inv = starterInventory();
    expect(tokenize('pat', inv)).toEqual(['p', 'a', 't']);
  });

  it('prefers the longest match at each position', () => {
    const inv: Inventory = {
      phonemes: [mkPhoneme('sh', 'sh'), mkPhoneme('s', 's'), mkPhoneme('h', 'h')],
    };
    expect(tokenize('sh', inv)).toEqual(['sh']);
  });

  it('throws a located error when nothing matches', () => {
    const inv: Inventory = { phonemes: [mkPhoneme('p', 'p')] };
    expect(() => tokenize('px', inv)).toThrow(/position 1/);
  });
});

describe('findCollisions', () => {
  it('reports no collisions for the starter inventory', () => {
    expect(findCollisions(starterInventory())).toEqual([]);
  });

  it('detects duplicate romanizations', () => {
    const inv: Inventory = { phonemes: [mkPhoneme('p', 'x'), mkPhoneme('b', 'x')] };
    const collisions = findCollisions(inv);
    expect(collisions).toContainEqual(expect.objectContaining({ kind: 'duplicate' }));
  });

  it('detects ambiguous-parse collisions from digraphs', () => {
    // "sh" (its own phoneme) collides with the concatenation of "s" + "h".
    const inv: Inventory = {
      phonemes: [mkPhoneme('sh', 'sh'), mkPhoneme('s', 's'), mkPhoneme('h', 'h')],
    };
    const collisions = findCollisions(inv);
    expect(collisions).toContainEqual(
      expect.objectContaining({ kind: 'ambiguous-parse' }),
    );
  });

  it('does not flag unrelated single-character romanizations', () => {
    const inv: Inventory = {
      phonemes: [mkPhoneme('p', 'p'), mkPhoneme('t', 't'), mkPhoneme('a', 'a')],
    };
    expect(findCollisions(inv)).toEqual([]);
  });
});

describe('Invariant R: tokenize(render(w)) === w.phonemeIds', () => {
  it('holds for arbitrary phoneme-id sequences over the starter inventory', () => {
    const inv = starterInventory();
    const ids = inv.phonemes.map((p) => p.id);
    fc.assert(
      fc.property(fc.array(fc.constantFrom(...ids), { maxLength: 30 }), (phonemeIds) => {
        const rendered = render(phonemeIds, inv);
        expect(tokenize(rendered, inv)).toEqual(phonemeIds);
      }),
    );
  });
});
