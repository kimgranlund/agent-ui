---
id: T-0473
title: "A concierge room-booking StepFlow ends with its BookingForm step"
type: bug             # feature | bug | chore | spike | idea
status: dropped     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-26
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
A room-booking StepFlow whose last step is not the BookingForm gets a deterministic check and repair.

## Context
T-0457 live run 3 (`.sdlc/runtime/tasks/0457-concierge-stepflow-pull/live/reach-concierge-room-stepflow-haiku-3/report.json`) shipped a StepFlow ending in a Select scene with no BookingForm, against the agent.md v25 sentence "that one booking form is its last step". Teaching alone did not hold in 1 of 3. Wave 2.

## Constraints
Prefer a persona check in `packages/agent-ui/a2ui/src/catalog/personas/concierge/checks.ts` over more prompt text. Model-read text changes follow the debate rule (Opus author, Fable review). No em dashes.

## Done when
- A keyless replay of run 3 fails the new check; a compliant flow passes.
- A false-positive sweep over recorded concierge runs reports the new hits.
- `npm run check` plus the touched folders' tests pass.
- Lane: solo because size L2 (steps.py lane)

## Outcome

2026-10-26 · dropped (Kim): premise wrong. T-0457 live run 3 ends in a BookingForm (scene-book); 12 of 13 recorded concierge StepFlows end in one, the one miss is the pre-v25 T-0451 replay. Solo report: .sdlc/runtime/tasks/0473-concierge-booking-last-step/0473-solo-L2.md (worktree run records).
