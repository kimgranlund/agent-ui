---
id: T-0284
title: "Haiku opens Battleship with no GameHud, and no check sends the Admiral opening back"
type: bug             # feature | bug | chore | spike | idea
status: done     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P3         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-15
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
The Admiral's opening ships GameHud on Haiku, or a check sends it back.

## Repro
`.sdlc/evals/rounds/2026-10-15-r4-fixes/``runs/regress-admiral-row-sweep-haiku-1` (traces :101), run-level `expect-component`: "missing GameHud (shipped Column, Text, BoardGrid)".

## Expected
"Battleship, please." draws BoardGrid and GameHud, as Haiku's opening-salvo run (:96) and every Sonnet run do.

## Actual
Haiku opened with a Column, a Text and the BoardGrid. No check fired.

## Context
GAME_HUD_MISSING exists for the word board (round 3 :110) but did not fire on the Admiral opening. Haiku-only and seen once. Found by T-0275.

## Done when
- A checks test: a battleship opening with no GameHud is sent back; one with it passes.
- `npm run check` exits 0.

## Acceptance criteria
- `npx vitest run packages/agent-ui/a2ui/src/catalog/hidden-state-checks.test.ts` exits 0: the T-0284 fleet-hud block fails the recorded row-sweep opening with GAME_HUD_MISSING and passes the same opening with a GameHud.
- `npm run check` exits 0.

## Outcome

2026-10-15 · lane: full L1 · verdict: closed by reason (Merged in #2041 (Haiku prose game moves); verifier L2 pass) · verifier: none · base: none
- Changed: see commits
- Commits: none
