// Phoneme, Inventory, and natural-class queries (DESIGN.md §3, §4.1).

import type { ConsonantFeatures, FeatureBundle, VowelFeatures } from './features';

export interface Phoneme {
  id: string; // stable slug, e.g. "p", "kʷ1"
  ipa: string; // display form
  features: FeatureBundle;
  weight: number; // relative sampling weight, > 0
  romanization: string; // orthographic form; may be multi-char ("sh")
}

export interface Inventory {
  phonemes: Phoneme[];
}

export type FeatureQuery = Partial<ConsonantFeatures> | Partial<VowelFeatures>;

export function matchesFeatures(p: Phoneme, q: FeatureQuery): boolean {
  const f: Record<string, unknown> = p.features;
  const query: Record<string, unknown> = q;
  for (const key of Object.keys(query)) {
    if (f[key] !== query[key]) return false;
  }
  return true;
}

export function naturalClass(inv: Inventory, q: FeatureQuery): Phoneme[] {
  return inv.phonemes.filter((p) => matchesFeatures(p, q));
}

// Starter inventory (DESIGN.md §4.1): a generous IPA subset covering every
// Place/Manner and Height/Backness combination that has a standard symbol.
// Romanizations are hand-picked so each is a single Unicode codepoint —
// a length-1 string can never equal the concatenation of two other
// phonemes' romanizations, so the starter set ships with zero collisions
// (see romanization.ts findCollisions).

type ConsonantRow = [
  ipa: string,
  place: ConsonantFeatures['place'],
  manner: ConsonantFeatures['manner'],
  voiced: boolean,
  romanization: string,
];

type VowelRow = [
  ipa: string,
  height: VowelFeatures['height'],
  backness: VowelFeatures['backness'],
  rounded: boolean,
  romanization: string,
];

const CONSONANT_ROWS: ConsonantRow[] = [
  // bilabial
  ['p', 'bilabial', 'stop', false, 'p'],
  ['b', 'bilabial', 'stop', true, 'b'],
  ['m', 'bilabial', 'nasal', true, 'm'],
  ['ɸ', 'bilabial', 'fricative', false, 'ɸ'],
  ['β', 'bilabial', 'fricative', true, 'β'],
  // labiodental
  ['f', 'labiodental', 'fricative', false, 'f'],
  ['v', 'labiodental', 'fricative', true, 'v'],
  // dental
  ['θ', 'dental', 'fricative', false, 'þ'],
  ['ð', 'dental', 'fricative', true, 'ð'],
  // alveolar
  ['t', 'alveolar', 'stop', false, 't'],
  ['d', 'alveolar', 'stop', true, 'd'],
  ['n', 'alveolar', 'nasal', true, 'n'],
  ['s', 'alveolar', 'fricative', false, 's'],
  ['z', 'alveolar', 'fricative', true, 'z'],
  ['t͡s', 'alveolar', 'affricate', false, 'ʦ'],
  ['d͡z', 'alveolar', 'affricate', true, 'ʣ'],
  ['r', 'alveolar', 'trill', true, 'r'],
  ['ɾ', 'alveolar', 'tap', true, 'ɾ'],
  ['l', 'alveolar', 'lateral', true, 'l'],
  ['ɹ', 'alveolar', 'approximant', true, 'ɹ'],
  // postalveolar
  ['ʃ', 'postalveolar', 'fricative', false, 'š'],
  ['ʒ', 'postalveolar', 'fricative', true, 'ž'],
  ['t͡ʃ', 'postalveolar', 'affricate', false, 'ʧ'],
  ['d͡ʒ', 'postalveolar', 'affricate', true, 'ʤ'],
  // retroflex
  ['ʈ', 'retroflex', 'stop', false, 'ṭ'],
  ['ɖ', 'retroflex', 'stop', true, 'ḍ'],
  ['ɳ', 'retroflex', 'nasal', true, 'ṇ'],
  ['ʂ', 'retroflex', 'fricative', false, 'ṣ'],
  ['ʐ', 'retroflex', 'fricative', true, 'ẓ'],
  // palatal
  ['c', 'palatal', 'stop', false, 'c'],
  ['ɟ', 'palatal', 'stop', true, 'ɟ'],
  ['ɲ', 'palatal', 'nasal', true, 'ñ'],
  ['ç', 'palatal', 'fricative', false, 'ç'],
  ['ʝ', 'palatal', 'fricative', true, 'ʝ'],
  ['j', 'palatal', 'approximant', true, 'j'],
  ['ʎ', 'palatal', 'lateral', true, 'ʎ'],
  // velar
  ['k', 'velar', 'stop', false, 'k'],
  ['ɡ', 'velar', 'stop', true, 'g'],
  ['ŋ', 'velar', 'nasal', true, 'ŋ'],
  ['x', 'velar', 'fricative', false, 'x'],
  ['ɣ', 'velar', 'fricative', true, 'ɣ'],
  ['w', 'velar', 'approximant', true, 'w'], // labial-velar, simplified as velar
  // uvular
  ['q', 'uvular', 'stop', false, 'q'],
  ['ɢ', 'uvular', 'stop', true, 'ɢ'],
  ['ɴ', 'uvular', 'nasal', true, 'ɴ'],
  ['χ', 'uvular', 'fricative', false, 'χ'],
  ['ʁ', 'uvular', 'fricative', true, 'ʁ'],
  ['ʀ', 'uvular', 'trill', true, 'ʀ'],
  // glottal
  ['ʔ', 'glottal', 'stop', false, 'ʔ'],
  ['h', 'glottal', 'fricative', false, 'h'],
  ['ɦ', 'glottal', 'fricative', true, 'ɦ'],
];

const VOWEL_ROWS: VowelRow[] = [
  ['i', 'high', 'front', false, 'i'],
  ['y', 'high', 'front', true, 'y'],
  ['ɨ', 'high', 'central', false, 'ɨ'],
  ['ʉ', 'high', 'central', true, 'ʉ'],
  ['ɯ', 'high', 'back', false, 'ɯ'],
  ['u', 'high', 'back', true, 'u'],
  ['e', 'mid-high', 'front', false, 'e'],
  ['ø', 'mid-high', 'front', true, 'ø'],
  ['ɤ', 'mid-high', 'back', false, 'ɤ'],
  ['o', 'mid-high', 'back', true, 'o'],
  ['ə', 'mid', 'central', false, 'ə'],
  ['ɛ', 'mid-low', 'front', false, 'ɛ'],
  ['œ', 'mid-low', 'front', true, 'œ'],
  ['ʌ', 'mid-low', 'back', false, 'ʌ'],
  ['ɔ', 'mid-low', 'back', true, 'ɔ'],
  ['a', 'low', 'front', false, 'a'],
  ['ɑ', 'low', 'back', false, 'ɑ'],
  ['ɒ', 'low', 'back', true, 'ɒ'],
];

function buildStarterPhonemes(): Phoneme[] {
  const consonants: Phoneme[] = CONSONANT_ROWS.map(
    ([ipa, place, manner, voiced, romanization]) => ({
      id: ipa,
      ipa,
      features: { kind: 'consonant', place, manner, voiced },
      weight: 1,
      romanization,
    }),
  );
  const vowels: Phoneme[] = VOWEL_ROWS.map(
    ([ipa, height, backness, rounded, romanization]) => ({
      id: ipa,
      ipa,
      features: { kind: 'vowel', height, backness, rounded, long: false },
      weight: 1,
      romanization,
    }),
  );
  return [...consonants, ...vowels];
}

/** Fresh copy of the built-in starter IPA inventory (DESIGN.md §4.1). */
export function starterInventory(): Inventory {
  return {
    phonemes: buildStarterPhonemes().map((p) => ({ ...p, features: { ...p.features } })),
  };
}
