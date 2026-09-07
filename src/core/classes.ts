// Phoneme-class resolution for phonotactic grammars (DESIGN.md §4.3-4.5).
// Not itself part of DESIGN.md's original §2 tree; extracted as a shared leaf
// module so both constraints.ts and generator.ts can resolve class symbols
// (including the auto-derived "C"/"V" classes) without importing each other.

import { naturalClass, type Inventory } from './phoneme';

export interface PhonemeClass {
  symbol: string; // uppercase single letter -> phoneme ids; C and V are auto-derived, overridable
  members: string[];
}

/**
 * Returns `classes` with auto-derived "C" (all consonants) and "V" (all vowels)
 * entries appended whenever the caller hasn't already defined that symbol.
 * User-provided "C"/"V" entries always win over auto-derivation.
 */
export function resolveClasses(classes: PhonemeClass[], inv: Inventory): PhonemeClass[] {
  const symbols = classes.map((c) => c.symbol);
  if (new Set(symbols).size !== symbols.length) {
    throw new Error('resolveClasses: grammar.classes has duplicate symbols.');
  }

  const bySymbol = new Set(symbols);
  const autoDerived: PhonemeClass[] = [];

  if (!bySymbol.has('C')) {
    autoDerived.push({
      symbol: 'C',
      members: naturalClass(inv, { kind: 'consonant' }).map((p) => p.id),
    });
  }
  if (!bySymbol.has('V')) {
    autoDerived.push({
      symbol: 'V',
      members: naturalClass(inv, { kind: 'vowel' }).map((p) => p.id),
    });
  }

  return [...classes, ...autoDerived];
}
