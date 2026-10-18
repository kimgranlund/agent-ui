---
id: T-0362
title: "Re-record the board-less game smoke replays after T-0358"
type: chore           # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: [T-0358]          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-17
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
verifier: L3
---

## Goal
The Mentalist, Negotiator and Dungeon Master smoke replays carry rounds recorded against T-0358's GameHud check, so each pinned turn either goes green or fails for a cause a live model showed.

## Repro
1. `npx vitest run --project scripts scripts/e2e-admin/probe/replays/smoke-mentalist-first-answer-haiku.test.mjs scripts/e2e-admin/probe/replays/smoke-negotiator-first-offer-haiku.test.mjs scripts/e2e-admin/probe/replays/smoke-dungeon-master-first-scene-haiku.test.mjs`
2. Each is pinned `// expectedFail: T-0362` to the turns whose recorded rounds predate the check.

## Expected
A live smoke rerun of the three presets (`scenarios/plan.ts --tag smoke --persona mentalist --persona negotiator --persona dungeon-master --model haiku`), converted with `--from-trace`, replaces the fixtures; the pins drop or name a new live cause.

## Actual
The README rule keeps recorded rounds and only appends authored repair rounds, and the bound is 3 rounds:
- Mentalist turn 0: the three recorded rounds fill the bound (SURFACE_NOT_CREATED, then FEED_SCOPE_RESCOPED at the bound), so GAME_HUD_MISSING only tallies SEMANTIC_UNCORRECTED and the hand-built scoreboard ships.
- Negotiator turn 1: all three recorded rounds rebuild the asking price and mood rows on ask-1 (IDGRAPH, then GAME_HUD_MISSING at the bound), while the authored turn 0 put the GameHud on hud-1.
- Dungeon Master turn 1: the recorded round adds s2 to the scenes Column that turn 0's authored repair replaced with a Timeline, so IDGRAPH drops the update with no recorded retry and the turn updates no surface (`action-updates-surface` and `expect-component` fail on turn 1).

## Context
Found by T-0358's code review. Open question for the rerun: whether GAME_HUD_MISSING should stand aside on a surface when another surface of the session already holds a GameHud (it is per-surface today; Negotiator turn 1 shows the case). A live round needs a key and is a manual run (`scripts/e2e-admin/README.md`, Live rounds).

## Constraints
Recorded rounds are never hand-edited. Spend under the round cap the conductor sets.

## Acceptance criteria
- `npx vitest run --project scripts scripts/e2e-admin/probe/replays/smoke-mentalist-first-answer-haiku.test.mjs scripts/e2e-admin/probe/replays/smoke-negotiator-first-offer-haiku.test.mjs scripts/e2e-admin/probe/replays/smoke-dungeon-master-first-scene-haiku.test.mjs` exits 0, and each fixture's `source` names traces of the new round `.sdlc/evals/rounds/2026-10-18-t0362-smoke/` (lines 1 to 6), whose recorded rounds are not hand-edited.
- No pin names T-0362: every still-red turn carries `// expectedFail: T-0365` (no GAME_HUD_MISSING on a board-less stat strip) or `// expectedFail: T-0366` (a board-less move answered in prose alone), and each new ticket names its live cause.
- `npx vitest run --project scripts scripts/e2e-admin/probe` exits 0.
- `npm run check` exits 0.
