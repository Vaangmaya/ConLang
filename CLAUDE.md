# Conlang Workbench

Browser-based conlang phonology tool: define a phoneme inventory and phonotactic grammar, generate a lexicon, apply ordered sound changes with derivation traces. The full specification is DESIGN.md — read the referenced section before implementing or changing a module, and keep code consistent with it.

## Commands

- `npm run dev` — Vite dev server
- `npm test` — Vitest, single run (`npm test -- --watch` while iterating)
- `npm run typecheck` — `tsc --noEmit`
- `npm run lint` — ESLint + Prettier check
- `npm run build` — production build

## Architecture rules

- `src/core/**` is a pure library: no React, no DOM APIs, no file or network I/O. `src/ui` imports from `src/core`; never the reverse.
- All randomness flows through the seeded PRNG in `src/core/random.ts`. Never call `Math.random()` anywhere in `src/core`.
- Phonemes are objects with feature bundles (DESIGN.md §3). Core logic never branches on raw IPA strings.
- Anything crossing a JSON boundary (project save/load, imports) is validated with the zod schemas in `src/core/project.ts`.
- UI components delegate every domain operation to a `core` function; no phonology logic in components.

## Invariants — never commit code that breaks these tests

- **G (round-trip):** every generated word passes `recognizer.accepts()` — the fast-check property test over the fixture grammars.
- **R (romanization):** `tokenize(render(word))` equals `word.phonemeIds`.
- **T (templates):** parse/print round-trip on syllable templates.
- **Golden:** the Grimm fixture outputs in `fixtures/grimm.expected.json` match exactly.

## Workflow

- TDD: write or update the failing test in the same change as the implementation. Run `npm test` and `npm run typecheck` before every commit.
- Small commits, one concern each, imperative subject lines.
- Parser errors (templates, sound-change rules) must include a position and a plain-English fix suggestion — treat error quality as a feature.
- If a DESIGN.md decision seems wrong, say so and propose an alternative before coding around it; update DESIGN.md in the same commit as the change.
- Track progress by checking boxes in TODO.md (phases mirror DESIGN.md §7).
