import { describe, expect, it } from 'vitest';
import { resolveClasses } from './classes';
import { starterInventory, type Inventory, type Phoneme } from './phoneme';

function mkPhoneme(id: string, kind: 'consonant' | 'vowel'): Phoneme {
  return {
    id,
    ipa: id,
    features:
      kind === 'consonant'
        ? { kind: 'consonant', place: 'alveolar', manner: 'stop', voiced: false }
        : { kind: 'vowel', height: 'low', backness: 'front', rounded: false, long: false },
    weight: 1,
    romanization: id,
  };
}

describe('resolveClasses', () => {
  it('auto-derives C and V from the inventory when not user-defined', () => {
    const inv: Inventory = {
      phonemes: [mkPhoneme('p', 'consonant'), mkPhoneme('t', 'consonant'), mkPhoneme('a', 'vowel')],
    };
    const resolved = resolveClasses([], inv);
    const c = resolved.find((cl) => cl.symbol === 'C');
    const v = resolved.find((cl) => cl.symbol === 'V');
    expect(c?.members.sort()).toEqual(['p', 't']);
    expect(v?.members).toEqual(['a']);
  });

  it('lets a user-defined C class override auto-derivation', () => {
    const inv: Inventory = {
      phonemes: [mkPhoneme('p', 'consonant'), mkPhoneme('t', 'consonant'), mkPhoneme('a', 'vowel')],
    };
    const resolved = resolveClasses([{ symbol: 'C', members: ['p'] }], inv);
    const c = resolved.find((cl) => cl.symbol === 'C');
    expect(c?.members).toEqual(['p']);
    // Only one C entry — not merged with the auto-derived one.
    expect(resolved.filter((cl) => cl.symbol === 'C')).toHaveLength(1);
  });

  it('passes through non-C/V user classes unchanged', () => {
    const inv = starterInventory();
    const resolved = resolveClasses([{ symbol: 'N', members: ['m', 'n'] }], inv);
    expect(resolved.find((cl) => cl.symbol === 'N')).toEqual({ symbol: 'N', members: ['m', 'n'] });
  });

  it('throws on duplicate user-defined symbols', () => {
    const inv = starterInventory();
    expect(() =>
      resolveClasses(
        [
          { symbol: 'N', members: ['m'] },
          { symbol: 'N', members: ['n'] },
        ],
        inv,
      ),
    ).toThrow(/duplicate/);
  });

  it('works against the starter inventory', () => {
    const inv = starterInventory();
    const resolved = resolveClasses([], inv);
    const c = resolved.find((cl) => cl.symbol === 'C');
    const v = resolved.find((cl) => cl.symbol === 'V');
    expect(c?.members.length).toBeGreaterThan(0);
    expect(v?.members.length).toBeGreaterThan(0);
  });
});
