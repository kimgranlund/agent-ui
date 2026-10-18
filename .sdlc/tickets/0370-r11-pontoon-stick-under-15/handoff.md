---
id: T-0370
title: "The pontoon scenario does not stick under 15 (round 11 cluster J)"
type: bug             # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-18
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
The `regress-croupier-pontoon` scenario survives a hand that stands under 15 after "Buy a card.", where pontoon forbids sticking.

## Repro
1. `npm run chat:probe -- --replay .sdlc/evals/rounds/2026-10-18-r11-targeted/runs/regress-croupier-pontoon-haiku-1/fixture.json` fails the last Deal again click (an older table's Deal again, no produce request).

## Expected
A correct refusal to stick on 14 does not fail the scenario; a run that sticks on 15 or more is unchanged.

## Actual
Trace :37 to :38 of `.sdlc/evals/rounds/2026-10-18-r11-targeted/``traces/2026-10-18.jsonl`: after Buy a card the hand is 14, the agent refuses Stick by the rules, the hand never settles and the scripted Deal again has no button on the newest table.

## Context
`scripts/e2e-admin/probe/scenarios/croupier.ts:60` scripts `say('Buy a card.'), say('Stick.'), DEAL_AGAIN`. Guess: a step that twists until 15 (or "Stick, or twist if you must"), or a skip of Deal again while the newest table is still playing, like T-0347's `--skip-if-phase`. Report: `.sdlc/evals/rounds/2026-10-18-r11-targeted/``report.md` cluster J.

## Constraints
The failing test lands before or with the fix, never after.

## Kim ruling (2026-10-18, close-out round)
Promoted to ready; run as a keyless solo lane with one verifier, no live spend.
