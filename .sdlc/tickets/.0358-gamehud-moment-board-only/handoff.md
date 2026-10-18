---
id: T-0358
title: "GameHud composite moment fires only beside a BoardGrid, so board-less game personas hand-build their score panels"
type: bug             # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
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

- `npx vitest run packages/agent-ui/a2ui/src/catalog/composite-moments.test.ts` exits 0: the recorded Mentalist, Negotiator and Dungeon Master score strips with no BoardGrid each yield exactly `GAME_HUD_MISSING`; beside a GameHud none; the negative controls (an NPS score and model confidence KPI strip, a concierge Gold member card, a listing with an asking price and a counter offer, a CardTable with zone score Badges, one game-stat Badge, inventory Badges) yield none, and each of the first four fires with the row's game gate or CardTable `lacks` removed.
- `npx vitest run --project scripts scripts/e2e-admin/probe/replays/` exits 0. The three smoke fixtures keep every recorded round byte-for-byte and only append authored repair rounds (a standalone GameHud surface, the hand-built stat items dropped, the meta-line as recorded); each test is re-pinned `expectedFail` to its true remaining cause (T-0361 Timeline, T-0362 recorded rounds that predate the check) and asserts GAME_HUD_MISSING where an authored round repairs it.
- The GameHud row carries no `requires: ['BoardGrid']`, and its repair line reads as ruled.
- `npm run check` exits 0.

## Outcome

2026-10-18 · lane: full L2 · verdict: pass · verifier: verifier-L3 (fable) · base: 39560271fd48
- Changed: GameHud moment fires on board-less game surfaces (#2135)
- Commits: none
- Check: 1 `npx vitest run packages/agent-ui/a2ui/src/catalog/composite-moments.test.ts` exits 0, the three ...: pass
- Check: 2 `npx vitest run --project scripts scripts/e2e-admin/probe/replays/` exits 0; the three fixtures k...: pass
- Check: 3 The GameHud row carries no `requires: ['BoardGrid']`, and its repair line reads as ruled: pass
- Check: 4 `npm run check` exits 0: pass
- Follow-up: decide: .sdlc/tickets/0358-gamehud-moment-board-only/handoff.md:32: decide... -> notes.md
- Follow-up: decide: packages/agent-ui/a2ui/src/catalog/composite-moments.ts:161: note... -> notes.md
- Follow-up: decide: packages/agent-ui/a2ui/src/catalog/composite-moments.ts:158: note... -> notes.md
- Follow-up: decide: packages/agent-ui/a2ui/src/catalog/composite-moments.test.ts:400... -> notes.md
- Follow-up: decide: .sdlc/tickets/0363-gamehud-feed-scope/handoff.md:13: decide: the... -> notes.md
- Follow-up: decide: .sdlc/tickets/.0361-quest-log-timeline-unchecked/handoff.md:1: note... -> notes.md
