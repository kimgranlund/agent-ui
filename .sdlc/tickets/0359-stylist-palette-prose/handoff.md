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
