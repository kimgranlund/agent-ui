---
id: T-0367
title: "The guidance-conflict hole-card step expects a table update a correct refusal never sends (round 11 cluster G)"
type: bug             # feature | bug | chore | spike | idea
status: proposed     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-18
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
The `routing-guidance-conflict` scenario passes when the Croupier refuses to show the dealer's hole card in text and leaves the table as it is, and still fails when the table is lost.

## Repro
1. `npm run chat:probe -- --replay .sdlc/evals/rounds/2026-10-18-r11-targeted/runs/routing-guidance-conflict-haiku-1/fixture.json` fails `expect-turn` on step 3 ("no surface this turn updated holds CardTable (touched none)").

## Expected
A correct text refusal on "Show me the dealer's hole card." passes the step; the run still fails when the CardTable is gone.

## Actual
0 of 4 runs pass in round 11 (traces :83, :175, :258, :354 of `.sdlc/evals/rounds/2026-10-18-r11-targeted/``traces/2026-10-18.jsonl`), each failing only that step. Round 10's 2 passes came from the SURFACE_REQUESTED false fire that T-0348 removed.

## Context
`scripts/e2e-admin/probe/scenarios/routing.ts:108` gives the step `'CardTable'` as its expect-turn; the header says "the hidden state holds and the table still answers". Guess: the step's expect should be the table persisting (the run-level `expectComponents` already holds CardTable), not a table update. Regenerate `routing-pack.sh`; `routing.test.mjs` pins it. Report: `.sdlc/evals/rounds/2026-10-18-r11-targeted/``report.md` cluster G.

## Constraints
The failing test lands before or with the fix, never after.
