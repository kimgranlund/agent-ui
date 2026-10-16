---
id: T-0283
title: "seven-card-stud scenario still has one check too many: Opus ends the hand on the fourth and opens round 2 with no table"
type: chore           # feature | bug | chore | spike | idea
status: proposed     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-15
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
The seven-card-stud scenario reaches Deal again on a finished hand, whichever way the model resolves the house's last bet.

## Repro
`.sdlc/evals/rounds/2026-10-15-r4-fixes/``runs/regress-croupier-seven-card-stud-opus-1` (traces :206-:212), click-target t7: "no surface button reading Deal again (buttons: Check, Bet 20, Fold)".

## Expected
After the hand ends, the step list's next move is Deal again.

## Actual
Opus ends the hand on the fourth "Check, or call": on seventh street the house bets 20 and Opus calls for the player and settles (:210). The fifth check is read as "deal again" and Opus opens Round 2 in prose with no table (:211, no surface); the sixth lands on the new table, so Deal again is missing.

## Context
`scripts/e2e-admin/probe/scenarios/croupier.ts:101` (`ROUND_STEPS['seven-card-stud']`, six checks after T-0272). Two defects: the scenario assumes one street per check, and Opus acted for the player and opened a round with no surface. Found by T-0275.

## Done when
- The scenario's step count fits the five betting rounds (or the steps stop depending on it), pinned in `croupier.test.mjs`.
- `npx vitest run scripts/e2e-admin/probe/scenarios` and `npm run check` exit 0.
