---
id: T-0358
title: "GameHud composite moment fires only beside a BoardGrid, so board-less game personas hand-build their score panels"
type: bug             # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-17
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
A game persona with no board (the Mentalist, the Negotiator, the Dungeon Master) that hand-builds its score and status strip out of Card, Stat, Badge or DescriptionList gets a repair round asking for ONE GameHud, so the turn ships the GameHud its skill names. The three pinned smoke replays flip to green.

## Repro
1. `npx vitest run --project scripts scripts/e2e-admin/probe/replays/smoke-mentalist-first-answer-haiku.test.mjs scripts/e2e-admin/probe/replays/smoke-negotiator-first-offer-haiku.test.mjs scripts/e2e-admin/probe/replays/smoke-dungeon-master-first-scene-haiku.test.mjs`
2. Each passes only because it is pinned (`// expectedFail: T-0358`) to its exact failing checks: `expect-component` on every turn and run-level `missing GameHud`.

## Expected
The producer sends a hand-built score panel back (a `GAME_HUD_MISSING` repair round, or an equivalent check) on these personas' surfaces, and a compliant answer ships a GameHud; the replays assert `report.failed` empty, with a repaired round authored where the live turn never reached it (CL-R3).

## Actual
Live smoke round `.sdlc/evals/rounds/2026-10-18-smoke/` (Haiku 5.5): the Mentalist built its scoreboard from Card, Progress, Stat and SegmentedControl (`traces/2026-10-18.jsonl:13` to `:14`), the Negotiator its deal sheet from Card and DescriptionList (`:15` to `:16`), the Dungeon Master its quest log from Card, Row and Badge (`:23` to `:24`). No turn carried a GameHud retry code.

## Context
Found by T-0343's smoke round. Cause (read from the code, not yet proven by a test): the GameHud row in `packages/agent-ui/a2ui/src/catalog/composite-moments.ts` carries `has: ['BoardGrid']` and `requires: ['BoardGrid']`, so `strays()` returns nothing on a surface without a board, and its `words` regex (guess, shot, ship, score, attempts) does not match the Mentalist's, the Negotiator's or the Dungeon Master's vocabulary (questions, confidence, offer, mood, HP, gold). The skills that name the GameHud: `guess-hud`, `deal-sheet`, `quest-log` in `site/agent-content/skills/`. The ResultCard row has the same `has: ['BoardGrid']` gate.

## Constraints
The failing test lands before or with the fix, never after. Re-pin the three replays to green in the fix's change (`scripts/e2e-admin/README.md`, Fixtures and regressions). A prompt-stack edit follows skill `a2ui-prompt-authoring`.

## Acceptance criteria
verifier: L3

- `npx vitest run packages/agent-ui/a2ui/src/catalog/composite-moments.test.ts` exits 0: the recorded Mentalist, Negotiator and Dungeon Master score strips with no BoardGrid each yield exactly `GAME_HUD_MISSING`, the same strip beside a GameHud yields none, and one game-stat Badge, a KPI strip and inventory Badges yield none.
- `npx vitest run --project scripts scripts/e2e-admin/probe/replays/` exits 0, with the three smoke replays asserting `report.failed` empty and their `expectedFail: T-0358` pins removed; each header names its AUTHORED round.
- `npm run check` exits 0.
