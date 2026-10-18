---
id: T-0359
title: "The Stylist answers a palette ask in prose with no token surface"
type: bug             # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-17
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
The Stylist answers a palette ask on a token surface (Swatches for the anchors, a Ramp per family, ContrastPairs for text pairings), never a palette in prose alone, and the pinned smoke replay flips to green.

## Repro
1. `npx vitest run --project scripts scripts/e2e-admin/probe/replays/smoke-stylist-palette-haiku.test.mjs`
2. It passes only because it is pinned (`// expectedFail: T-0359`) to its failing check: `expect-component` on turn 0, no surface touched.

## Expected
"Propose a calm blue palette for a banking app." ships a surface holding a Swatch or a Ramp; the producer sends a prose-only palette turn back for a token surface, and the replay asserts `report.failed` empty, with a repaired round authored where the live turn never reached it (CL-R3).

## Actual
Live smoke round `.sdlc/evals/rounds/2026-10-18-smoke/` (Haiku 5.5), `traces/2026-10-18.jsonl:9`: the reply named a deep navy primary, a steel-blue secondary and a muted sky accent and stated contrast ratios in prose, with no `render_surface` call and no retry. The persona says palette questions are answered with rendered token surfaces, never hex lists in prose.

## Context
Found by T-0343's smoke round. Guess, not yet checked: no producer check covers the Stylist (no persona semantic check, and no composite-moment row for Swatch, Ramp or ContrastPair), so a prose-only turn ships uncorrected. Persona: `site/agent-content/personas/stylist/agent.md`; skill `palette-presentation`; persona catalog `packages/agent-ui/a2ui/src/catalog/personas/stylist/`.

## Constraints
The failing test lands before or with the fix, never after. Re-pin the replay to green in the fix's change (`scripts/e2e-admin/README.md`, Fixtures and regressions). A prompt-stack edit follows skill `a2ui-prompt-authoring`.

## Rulings
- Kim, 2026-10-18 close-out: the palette ask check judges the first palette ask of a session only; later turns stay unchecked.
- Kim, 2026-10-18 (after verifier 4): a Stylist-only gate. The ask check (`composite-ask-swatch`) rides the Stylist's catalog alone (it requires Swatch, Ramp and ContrastPair, and ContrastPair is the Stylist's type), so Concierge, dashboard, invoice and game turns never fire. A token surface is a Swatch, a Ramp or a ContrastPair: one shown ends the first ask, and a ContrastPair-only answer satisfies it. Pinned: "Open the colour palette panel in Figma.", "Tell me about the palette of the Mona Lisa." and "The palette looks washed out on my monitor." are no ask; "Here's our palette: #1f3a5f, #4a6f8a, #9cc3e0. Does it pass AA?" is one under the Stylist.

## Acceptance criteria
- `npx vitest run --project scripts scripts/e2e-admin/probe/replays/smoke-stylist-palette-haiku.test.mjs` exits 0, and the test carries no `expectedFail` pin: the prose palette turn is sent back and the repaired turn ships a token surface with every probe check green.
- `npx vitest run packages/agent-ui/a2ui/src/catalog/composite-moments.test.ts packages/agent-ui/a2ui/src/live-agent/check-contracts.test.ts scripts/e2e-admin/probe/trace.test.mjs` exits 0: the palette ask is a `COMPOSITE_MOMENTS` row (the Swatch row's ask), riding the Stylist's catalog alone (Rulings). It judges the first palette ask only: while no prior turn of the session has written a token surface (a closed or rebuilt one still counts), a palette request whose turn writes none is flagged, while a command or tool palette, a palette knife, a product color option, a game color question, a request whose object is not the palette, a targeted edit, a question about an answer, a read-back, a thanks or a dismissal is not; once a palette is shown, no later turn is flagged (every later-turn phrasing the three verifier passes named is a negative).
- `npm run check` exits 0.
