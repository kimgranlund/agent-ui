---
id: T-0272
title: "seven-card-stud scenario moves do not fit the fixed-limit house rules, so the hand is still on seventh street at Deal again"
type: bug             # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-15
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
The seven-card-stud scenario's moves are legal under the house rules the model states, so round 1 reaches the showdown before Deal again.

## Repro
Read `.sdlc/evals/rounds/2026-10-15-r3-routing/``traces/2026-10-15.jsonl` lines 269-275 (`regress-croupier-seven-card-stud-opus-1`).

## Expected
Deal again (step 8) finds a settled hand.

## Actual
Opus deals fixed-limit stud with no bring-in. It refuses "Bring it in" (:270) and "Bet 25" ("every bet on third street is exactly 10", :271), so two steps play no street, and Deal again finds Check, Bet 20 and Fold on seventh street. Haiku fails the same way. Sonnet passes.

## Context
`scripts/e2e-admin/probe/scenarios/croupier.ts` (`ROUND_STEPS['seven-card-stud']`). Guess: make each street a "Check, or call" step and add one more. This is a scenario defect, not a model failure. Found by T-0261.
