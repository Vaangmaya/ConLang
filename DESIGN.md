# Conlang Workbench — Design Specification

Version 1.0 · Status: approved for implementation
This document is the source of truth for the project. Implement against the section references; if a decision here proves wrong in practice, propose a change and update this file in the same commit as the code.

---

## 1. Overview

A browser-based tool for constructed-language phonology. A user defines a phoneme inventory and a phonotactic grammar, generates a statistically natural lexicon that obeys it, then applies ordered sound-change rules to derive daughter languages, with full per-word derivation histories.

**v1 goals:** inventory editor with feature bundles and romanization · syllable-template grammar with user-defined classes · constraint system (banned sequences, sonority, vowel harmony) · weighted, seeded word generation · a recognizer that validates words against the grammar · sound-change rule parser and ordered applier with derivation traces · project save/load as JSON · lexicon export (CSV/JSON) · static deploy to GitHub Pages.

**v1 non-goals (do not build):** morphology/paradigms, Optimality-Theory constraint ranking, phonotactic induction from real corpora, user accounts or any backend, suprasegmentals beyond vowel length, mobile-optimized UI.

## 2. Stack and repository layout

TypeScript (strict) · React 18 · Vite · Vitest + fast-check (property tests) · zod (schema validation) · ESLint + Prettier · GitHub Actions CI (typecheck, lint, test on push) · GitHub Pages deploy. No backend; persistence is JSON file download/upload plus localStorage autosave.

```
conlang-workbench/
├── DESIGN.md              # this file
├── CLAUDE.md              # instructions for Claude Code
├── TODO.md                # phase checklist (mirrors §7)
├── src/
│   ├── core/              # PURE library: no React, no DOM, no I/O
│   │   ├── random.ts      # seeded PRNG (mulberry32); sole randomness source
│   │   ├── features.ts    # feature system, natural-class queries
│   │   ├── phoneme.ts     # Phoneme, Inventory
│   │   ├── romanization.ts# longest-match tokenizer, renderer
│   │   ├── classes.ts     # PhonemeClass resolution, auto C/V (shared by constraints.ts, generator.ts)
│   │   ├── template/
│   │   │   ├── ast.ts
│   │   │   └── parser.ts  # syllable-template grammar (§4.3)
│   │   ├── constraints.ts # constraint types + evaluator (§4.5)
│   │   ├── generator.ts   # word generation (§4.4)
│   │   ├── recognizer.ts  # accepts(word, grammar) (§4.6)
│   │   ├── soundchange/
│   │   │   ├── parser.ts  # rule notation (§4.7)
│   │   │   ├── apply.ts   # ordered application
│   │   │   └── derivation.ts
│   │   ├── stats.ts       # default weights, frequency reports (§4.9)
│   │   └── project.ts     # zod schemas, (de)serialization (§4.8)
│   ├── ui/
│   │   ├── state/         # store (zustand); thin wrapper over core + the `view` nav slice
│   │   ├── components/    # Button, Field, Panel, Table (§5.6)
│   │   ├── assets/fonts/  # self-hosted woff2: Noto Sans IPA subsets + Fraunces (+ OFL-Fraunces.txt)
│   │   └── pages/         # Landing, Learn, Inventory, Phonotactics, Lexicon, SoundChanges, Project
│   └── main.tsx
├── fixtures/              # hawaiian.json, japanese-lite.json, grimm.rules, grimm.expected.json
└── .claude/commands/      # custom slash commands (e.g. checkpoint.md)
```

Dependency rule: `ui` imports `core`; `core` never imports `ui`, React, or DOM APIs. Everything in `core` must run in Node under Vitest with no browser.

## 3. Domain model

```ts
// features.ts
type Place =
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
type Manner =
  | 'stop'
  | 'fricative'
  | 'affricate'
  | 'nasal'
  | 'trill'
  | 'tap'
  | 'lateral'
  | 'approximant';
type Height = 'high' | 'mid-high' | 'mid' | 'mid-low' | 'low';
type Backness = 'front' | 'central' | 'back';

interface ConsonantFeatures {
  kind: 'consonant';
  place: Place;
  manner: Manner;
  voiced: boolean;
}
interface VowelFeatures {
  kind: 'vowel';
  height: Height;
  backness: Backness;
  rounded: boolean;
  long: boolean;
}
type FeatureBundle = ConsonantFeatures | VowelFeatures;

// phoneme.ts
interface Phoneme {
  id: string; // stable slug, e.g. "p", "kʷ1"
  ipa: string; // display form
  features: FeatureBundle;
  weight: number; // relative sampling weight, > 0
  romanization: string; // orthographic form; may be multi-char ("sh")
}
interface Inventory {
  phonemes: Phoneme[];
}

// grammar
interface PhonemeClass {
  symbol: string;
  members: string[];
} // uppercase single letter → phoneme ids; C and V are auto-derived, overridable
interface SyllableTemplate {
  raw: string;
  ast: TemplateNode;
  weight: number;
}
interface PhonotacticGrammar {
  classes: PhonemeClass[];
  templates: SyllableTemplate[];
  syllableCount: { min: number; max: number; weights: number[] }; // weights.length === max-min+1
  constraints: Constraint[];
}

// output
interface GeneratedWord {
  phonemeIds: string[];
  syllableBreaks: number[]; // indices into phonemeIds where new syllables start
  seed: number; // regenerate deterministically
}

// sound change
interface SoundChangeRule {
  id: string;
  raw: string;
  enabled: boolean; /* parsed form per §4.7 */
}
interface DerivationStep {
  ruleId: string;
  before: string;
  after: string;
  changed: boolean;
}

// project.ts — top-level save format, zod-validated
interface Project {
  formatVersion: 1;
  name: string;
  inventory: Inventory;
  grammar: PhonotacticGrammar;
  lexicon: GeneratedWord[];
  rules: SoundChangeRule[];
}
```

## 4. Module specifications

### 4.1 Features and natural classes (`features.ts`, `phoneme.ts`)

Provide `matchesFeatures(p: Phoneme, q: Partial<ConsonantFeatures|VowelFeatures>): boolean` and `naturalClass(inv: Inventory, q): Phoneme[]`. This powers sound-change targets like "all voiceless stops" and class definitions by feature query. Ship a built-in starter inventory (a generous IPA subset: the pulmonic consonants and vowels covered by the types above) from which users pick; custom phonemes are added by choosing features + symbol.

### 4.2 Romanization (`romanization.ts`)

`render(word, inv): string` maps phoneme ids to romanization, `tokenize(s, inv): string[]` inverts it using longest-match. Detect and report collisions at edit time: (a) two phonemes with identical romanization; (b) ambiguity where a concatenation of romanizations parses two ways under longest-match. **Invariant R:** for every word, `tokenize(render(w))` deep-equals `w.phonemeIds` (property-tested).

### 4.3 Syllable-template grammar (`template/`)

Notation (conlang-standard): uppercase letters are class references; parentheses mark optional groups; a group may carry an inclusion probability.

```
template := element+
element  := classRef | group
group    := "(" element+ ")" [ ":" prob ]     // prob ∈ (0,1), default 0.5
classRef := "A".."Z"                           // must be defined in grammar.classes (C, V auto-defined)
```

Examples: `CV(C)` · `(C)(L)V(N):0.3` · `CV((N):0.8)`. Groups nest. Parser produces an AST (`Seq`, `Optional{prob}`, `ClassRef`) and **must** produce located, human-readable errors: `Unknown class "L" at position 2 — define it under Classes.` Include a printer; **Invariant T:** `print(parse(t))` normalizes to a canonical form and `parse(print(parse(t)))` equals `parse(t)` (property-tested over generated templates).

### 4.4 Generator (`generator.ts`, `random.ts`)

Deterministic given a seed. Algorithm per word: sample syllable count from `syllableCount.weights` → for each syllable, pick a template by weight → walk the AST (optional groups: Bernoulli by prob; class refs: weighted sample over member phonemes) → concatenate, recording syllable breaks → constraint check (§4.5); on rejection, resample the whole word. `generate(grammar, inv, n, seed): { words: GeneratedWord[]; diagnostics: GenDiagnostics }`. All randomness goes through the injected PRNG (mulberry32); `Math.random` is banned in `core`.

### 4.5 Constraints (`constraints.ts`)

v1 constraint types, each a predicate over `(phonemeIds, syllableBreaks, inv)`. In practice `checkConstraints` takes pre-resolved `classes: PhonemeClass[]` (see `classes.ts`) rather than a raw `Inventory`: only `BannedSequence`'s class-ref tokens and `RequiredOnset`'s consonant check need class resolution, and both are resolved once per `generate()` call rather than per constraint check.

1. `BannedSequence` — a sequence of class refs and/or phoneme literals; scope: `anywhere | wordInitial | wordFinal | withinSyllable | acrossSyllableBoundary`.
2. `Sonority` — onsets rise, codas fall, per a configurable sonority scale (default: stop 1 < affricate 2 < fricative 3 < nasal 4 < lateral/liquid 5 < approximant/glide 6 < vowel 7); ties configurable as allowed/banned.
3. `VowelHarmony` — user partitions vowels into 2+ harmony sets plus a neutral set; all non-neutral vowels in a word must come from one set.
4. `RequiredOnset` — every syllable (or only word-initial) must begin with a consonant.

Rejection loop: `maxAttempts` per word (default 200). Track a rejection counter per constraint; if a word fails after `maxAttempts`, return a diagnostic naming the top-rejecting constraints so the UI can say _"Your grammar looks unsatisfiable — 'no geminates' rejected 97% of candidates."_ This diagnostic path is a first-class feature, not an afterthought: over-constrained grammars are the most common user error.

### 4.6 Recognizer (`recognizer.ts`)

`accepts(phonemeIds, grammar, inv): { ok: boolean; parse?: SyllableParse[] }` — can the word be segmented into syllables each matching some template, with all constraints satisfied? Implement as memoized recursive descent over positions × templates (input is short; no need for anything fancier). **Invariant G (the core invariant of the project):** every generated word is accepted by the recognizer. Property test: for each fixture grammar, 1,000 seeded generations, zero rejections.

### 4.7 Sound changes (`soundchange/`)

Rule notation:

```
rule        := target ">" replacement [ "/" before "_" after ]
target      := seq | "∅"                 // "∅" (or "0") target = insertion
replacement := seq | "∅"                 // "∅" replacement = deletion
seq         := atom+
atom        := ipaLiteral | classRef | "[" feature ("," feature)* "]" | "#"
feature     := ("+"|"-") name            // e.g. [-voiced], [+long]; consonant/vowel kinds per §3
```

`#` matches a word boundary and is only valid at the outer edge of `before`/`after`. Semantics: rules apply **in list order**; within one rule, matches are found left-to-right on the _input_ form, non-overlapping, and applied simultaneously (standard SCA behavior — a rule's output cannot feed itself in the same pass). A feature-bundle replacement copies the matched phoneme's features, applies the changes, then resolves to the inventory phoneme with those features; if none exists, keep a raw-IPA "emergent segment" and attach a warning inviting the user to add it to the daughter inventory. Every rule application appends a `DerivationStep`; `derive(word, rules)` returns final form + full trace.

Worked fixture (`fixtures/grimm.rules`, deliberately simplified and ahistorical — it exists to pin down ordering semantics):

```
1: p > f    2: t > θ    3: k > x        # voiceless stops spirantize
4: b > p    5: d > t    6: g > k        # voiced stops devoice
7: bʰ > b   8: dʰ > d   9: gʰ > g       # aspirates deaspirate
```

Expected outputs (`grimm.expected.json`): `pater → faθer` · `dekem → texem` · `bʰrater → braθer`. Note the counterfeeding order: `bʰ` becomes `b` only _after_ rule 4 has run, so the new `b` is not devoiced — exactly the kind of interaction the ordered-rule design must get right, and the golden test locks it in.

### 4.8 Persistence and export (`project.ts`)

`Project` is serialized to versioned JSON (`formatVersion: 1`), validated with zod on import; invalid files produce a field-level error report, never a crash. Autosave the working project to localStorage (debounced); explicit Save downloads the JSON. Lexicon export: CSV (`ipa,romanized,syllables`) and JSON. All import/export logic lives in `core` and is unit-tested with malformed-input cases.

### 4.9 Statistics and defaults (`stats.ts`)

Default phoneme weights follow the Gusein-Zade distribution over a class of n phonemes ranked 1..n: `w_i = (1/n) · ln((n+1)/i)` — this makes naive output feel natural rather than uniform-random. Provide `frequencyReport(lexicon, inv)` comparing observed vs. configured phoneme frequencies (for the statistical test in §6 and a small UI readout).

## 5. UI specification

Five pages, one shared store (zustand). The store holds a single `Project` plus UI state; every mutation delegates to a pure `core` function. Components never re-implement core logic. The five subsections below are numbered §5.1–§5.5 in page order; `src/ui/styles.css` is organised into matching per-page section blocks, each headed `/* … (DESIGN.md §5.x) */`.

### 5.1 Inventory

Consonant grid (place × manner, voiced/voiceless pairs per cell) and vowel table (height × backness, rounded/long toggles); click to add/remove; per-phoneme weight slider and romanization field; live collision warnings from §4.2.

### 5.2 Phonotactics

Class editor (symbol → member picker); template list with per-template weight and inline parse errors; constraint builder (forms per §4.5 type); syllable-count sliders; a live preview panel showing 10 sample words, regenerated (debounced 300 ms) on any grammar edit — this live feedback is the heart of the UX.

### 5.3 Lexicon

"Generate N words" (N ≤ 5,000) with seed field; sortable table (IPA, romanization, syllable count); per-row reroll; delete; export buttons; the unsatisfiability diagnostic banner surfaces here and in Phonotactics.

### 5.4 Sound Changes

Ordered rule list (add/edit/enable/disable/reorder with drag handles); inline rule-parse errors; a before → after diff table over the lexicon; click a word to expand its full derivation trace; "fork daughter language" button clones the project with the output lexicon.

### 5.5 Project

Name, save/download, load/import (with zod error display), reset, and the frequency report from §4.9.

IPA rendering: bundle Charis SIL (or Noto Sans) via `@font-face`; do not rely on system fonts.

### 5.6 Visual design system

A dark editorial identity: the workbench reads like a printed grammar — an ink-dark ground, warm cream text, one vermilion accent, and an oversized editorial serif for every heading. §5.1–§5.5 above correspond to the five tool pages in order, and `styles.css` is organised into matching per-page blocks; §5.7 (Home) and §5.8 (Learn) sit in their own blocks.

**Tokens.** `src/ui/theme.css` is the single source of truth — one `:root` block. Dark-only, no light mode.

- _Palette_ — `--paper` (`#14131a`, the ink ground) and `--ink` (`#f4efe6`, cream foreground) keep their names and roles, only the values went dark. `--surface` / `--surface-2` are raised blocks; `--rule` is hairlines; `--muted` is secondary text. `--accent` is vermilion `#e2553d` (+ `--accent-hi` hover, `--accent-ink` for text on fills); `--accent-2` is a muted teal used **only** for color-block variety (Home steps, Learn markers). `--signal` / `--signal-bg` carry warnings and errors on the dark ground. The `body` ground carries two low-opacity radial glows (rgba mirrors of `--accent` and `--accent-2`) for depth — CSS only, no image asset.
- _Type_ — four stacks: `--font-display` (`'Fraunces'`, a self-hosted partial-variable woff2 over wght 340–680 with an optical-size axis, so large headings take the high-contrast display cut automatically; falls back to Georgia) carries every heading, the Home wordmark, and pull quotes; `--font-ui` (`system-ui`) carries controls, labels, nav, and body copy; `--font-mono`; and `--font-conlang` (`'Charis SIL'` → the bundled `'Noto Sans IPA'` webfont) still carries **every piece of conlang data** via `.ipa` — the language is the subject, the page is its book. Editorial scale: `--text-display` (`clamp()` hero) / `--text-hero` / `--text-title` / `--text-headword` / `--text-inline` / `--text-tag`.
- _Spacing_ — `--space-1/2/3/4/6/8` plus `--space-12` / `--space-16` for section rhythm. `--radius: 2px`; color blocks are hard-edged (`--radius-lg: 0`).
- _Motion_ — `--motion-fast` (120 ms, feedback), `--motion-hero` (420 ms), `--motion-page` (600 ms). **Two** orchestrated moments: the Home staggered page-load reveal (§5.7) and the Phonotactics live-preview `materialize` replay on `.preview-stage`. Motion everywhere else is feedback-speed at most; reveal animations use `animation … both` with a visible end state so the global `prefers-reduced-motion: reduce` rule (which still cuts all of it) leaves everything shown.

**Primitives.** `src/ui/components/` (reserved in §2) holds four intentionally minimal, token-driven, prop-forwarding components — no config-object table API:

- `Button` — emits `.btn` plus an optional `.btn--primary` / `.btn--ghost` / `.btn--danger`.
- `Field` — a real `<label htmlFor>` bound to one control (`.field`, `.field--inline`, `.field-label`, `.field-hint`); reuses `.error-text`. Checkboxes keep the native wrapping label (`.checkbox`).
- `Panel` — the bordered editor card (`.panel`, `.panel-head`, `.panel-title`, `.panel-actions`).
- `Table` — `<table class="ptable">` optionally inside `.ptable-scroll`; callers keep native table markup.

Shared form utilities live alongside: `.btn-row`, `.field-row`, `.num-input`.

**Where styles live.** The element resets plus `.ipa` / `.tag` / `.warning-banner` / `.error-text` and the primitives block are shared, at the top of `styles.css`; everything else sits in the per-page block headed `/* … (DESIGN.md §5.x) */`.

## 6. Testing strategy

Colocated `*.test.ts` per module; CI runs typecheck, lint, and tests on every push.

- **Property tests (fast-check):** Invariant R (romanization round-trip), Invariant T (template parse/print), Invariant G (generator ⊆ recognizer, 1,000 seeded words × each fixture grammar).
- **Golden tests:** Grimm fixture (§4.7) exact outputs; a snapshot of 50 words from `hawaiian.json` at seed 42 (guards against accidental generator changes).
- **Statistical test:** at n = 10,000, seed 1, each phoneme's observed frequency within ±20% relative of its configured expectation (loose on purpose; it catches gross sampling bugs, not noise).
- **Fixtures:** `hawaiian.json` (8 consonants /p k ʔ h m n w l/, 5 vowels + length, templates `V`, `CV`, weights favoring `CV`) and `japanese-lite.json` (CV(N), no harmony) double as realism checks — eyeball their output against real word lists during Phase 3.
- **Failure-path tests:** unsatisfiable grammar produces the §4.5 diagnostic within `maxAttempts`; malformed project JSON produces field-level errors.

## 7. Milestones and acceptance criteria

- **Phase 1 — Core data model.** `features`, `phoneme`, `romanization`, seeded `random`. _Done when:_ Invariant R property test passes; collision detection unit-tested; starter IPA inventory loads.
- **Phase 2 — Templates, generator, constraints.** §4.3–4.5. _Done when:_ Invariant T passes; all four constraint types unit-tested; unsatisfiability diagnostic test passes; 10k-word generation < 2 s in CI.
- **Phase 3 — Recognizer and validation.** §4.6, fixtures, stats. _Done when:_ Invariant G passes on both fixtures; Hawaiian snapshot and statistical tests pass.
- **Phase 4 — Sound changes.** §4.7. _Done when:_ rule parser errors are located and readable; Grimm golden test passes; derivation traces recorded for every word.
- **Phase 5 — UI.** §5, wired to core. _Done when:_ full loop works in the browser — build Hawaiian from scratch, generate 500 words, apply 3 rules, view a derivation, export CSV, save and reload the project.
- **Phase 6 — Ship.** GitHub Pages deploy via Actions; README with an end-to-end example-language walkthrough; autosave. _Done when:_ the public URL serves the app and a stranger can follow the README.

## 8. Risks and mitigations

Over-constrained grammars → attempt caps + per-constraint diagnostics (§4.5). Template/rule parser edge cases → located errors, property tests, and a fuzz pass in Phase 4. Romanization ambiguity → edit-time collision detection (§4.2). IPA glyph coverage → bundled font (§5). Rule-notation scope creep → the §4.7 grammar is closed for v1; the parser rejects anything else loudly. Performance on 5k words × 50 rules → linear scans are fine in JS; store derivation traces lazily (compute on expand).

## 9. Post-v1 stretch directions

Weighted/OT-style constraint ranking with visible violation profiles · morphology templates (roots × affix slots) · phonotactic induction: score real word lists with an n-gram phonotactic model, then a MaxEnt learner in the spirit of Hayes & Wilson (2008), turning the workbench into a research instrument · shareable read-only links (compressed project state in the URL hash).
