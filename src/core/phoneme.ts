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

export function matchesFeatures(_p: Phoneme, _q: FeatureQuery): boolean {
  throw new Error('not implemented');
}

export function naturalClass(_inv: Inventory, _q: FeatureQuery): Phoneme[] {
  throw new Error('not implemented');
}
