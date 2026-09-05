// Feature system and natural-class queries (DESIGN.md §3, §4.1).

export type Place =
  | 'bilabial'
  | 'labiodental'
  | 'dental'
  | 'alveolar'
  | 'postalveolar'
  | 'retroflex'
  | 'palatal'
  | 'velar'
  | 'uvular'
  | 'glottal';

export type Manner =
  | 'stop'
  | 'fricative'
  | 'affricate'
  | 'nasal'
  | 'trill'
  | 'tap'
  | 'lateral'
  | 'approximant';

export type Height = 'high' | 'mid-high' | 'mid' | 'mid-low' | 'low';
export type Backness = 'front' | 'central' | 'back';

export interface ConsonantFeatures {
  kind: 'consonant';
  place: Place;
  manner: Manner;
  voiced: boolean;
}

export interface VowelFeatures {
  kind: 'vowel';
  height: Height;
  backness: Backness;
  rounded: boolean;
  long: boolean;
}

export type FeatureBundle = ConsonantFeatures | VowelFeatures;
