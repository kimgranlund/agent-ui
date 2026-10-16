---
id: T-0269
title: "BoardGrid's intent corner glyph renders at 8px and fails render-lint type-floor on Lexicographer and Admiral boards"
type: bug             # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-15
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
BoardGrid's intent corner glyph passes render-lint type-floor at the widget scale, through a glyph size floor or a ruled pictorial exemption like T-0189's.

## Repro
Read `.sdlc/evals/rounds/2026-10-15-r3-routing/``runs/regress-admiral-*/report.json` and `runs/regress-lexicographer-*/report.json`: `render-lint` reports "type-floor: span[intent] at 8px" on every turn that has a marked cell.

## Expected
render-lint passes on a BoardGrid with intents.

## Actual
render-lint failed 33 times on BoardGrid turns, across both models and both presets. It is the only render-lint failure on the Admiral runs.

## Context
`packages/agent-ui/components/src/controls/board-grid/board-grid.css:152` (`[data-part='intent']`) and `board-grid.md:66` (glyph box `2n - 2c`, ADR-0245 Amendment 6). The Omaha PlayingCard fails the same way (`span[index-rank]` 7.875px, `span[pip]` 8.4px), which is existing T-0189. Found by T-0261.

## Outcome

2026-10-15 · lane: full L1 · verdict: closed by reason (Merged: probe render-lint skips the glyph-box selector for type-floor; verifier L2 pass) · verifier: none · base: none
- Changed: see commits
- Commits: none
