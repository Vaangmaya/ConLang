# TODO

Phases mirror DESIGN.md §7. Check a box only when its "Done when" criteria pass.

## Phase 1 — Core data model

`features`, `phoneme`, `romanization`, seeded `random` (DESIGN.md §4.1, §4.2).

- [ ] `features.ts`: feature types, `matchesFeatures`, `naturalClass`
- [ ] `phoneme.ts`: `Phoneme`, `Inventory`, starter IPA inventory
- [ ] `romanization.ts`: `render`, `tokenize`, collision detection
- [x] `random.ts`: seeded mulberry32 PRNG
- [ ] Invariant R (romanization round-trip) property test passes
- [ ] Collision detection unit-tested
- [ ] Starter IPA inventory loads

## Phase 2 — Templates, generator, constraints

DESIGN.md §4.3–§4.5.

- [ ] `template/ast.ts`, `template/parser.ts`: parse + print, located errors
- [ ] `constraints.ts`: BannedSequence, Sonority, VowelHarmony, RequiredOnset
- [ ] `generator.ts`: seeded weighted generation, constraint rejection loop
- [ ] Invariant T (template parse/print round-trip) passes
- [ ] All four constraint types unit-tested
- [ ] Unsatisfiability diagnostic test passes
- [ ] 10k-word generation < 2s in CI

## Phase 3 — Recognizer and validation

DESIGN.md §4.6, fixtures, stats.

- [ ] `recognizer.ts`: memoized recursive descent `accepts`
- [ ] `fixtures/hawaiian.json`, `fixtures/japanese-lite.json`
- [ ] `stats.ts`: Gusein-Zade default weights, `frequencyReport`
- [ ] Invariant G passes on both fixtures (1,000 seeded words each)
- [ ] Hawaiian snapshot test (50 words, seed 42) passes
- [ ] Statistical test (n=10,000, seed 1, ±20% relative) passes

## Phase 4 — Sound changes

DESIGN.md §4.7.

- [ ] `soundchange/parser.ts`: rule notation parser, located errors
- [ ] `soundchange/apply.ts`: ordered, simultaneous, non-feeding application
- [ ] `soundchange/derivation.ts`: per-word derivation trace
- [ ] `fixtures/grimm.rules`, `fixtures/grimm.expected.json`
- [ ] Rule parser errors are located and readable
- [ ] Grimm golden test passes
- [ ] Derivation traces recorded for every word

## Phase 5 — UI

DESIGN.md §5, wired to core.

- [ ] Inventory page
- [ ] Phonotactics page (live 10-word preview, debounced 300ms)
- [ ] Lexicon page (generate, sort, reroll, delete, export)
- [ ] Sound Changes page (ordered rules, diff table, derivation trace, fork)
- [ ] Project page (save/load/import, reset, frequency report)
- [ ] Bundled IPA font (Charis SIL or Noto Sans) via `@font-face`
- [ ] Full loop works in-browser: build Hawaiian from scratch, generate 500
      words, apply 3 rules, view a derivation, export CSV, save and reload

## Phase 6 — Ship

- [ ] GitHub Pages deploy via Actions
- [ ] README with end-to-end example-language walkthrough
- [ ] localStorage autosave (debounced)
- [ ] Public URL serves the app; a stranger can follow the README
