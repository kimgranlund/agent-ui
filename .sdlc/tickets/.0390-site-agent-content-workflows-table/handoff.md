---
id: T-0390
title: "site/agent-content/workflows/table-reservation/WORKFLOW.md:12..."
type: idea            # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-21
claimed_by: claude:a8ce3b21 2026-10-21
from: T-0197
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
The concierge table-reservation and booking-flow workflows teach one consistent confirm shape (the BookingForm as the confirm step, or a ConfirmReceipt read-back after it), not both.

## Context
Follow-up from T-0197 (verifier notes):

site/agent-content/workflows/table-reservation/WORKFLOW.md:12: decide: the reservation now runs a BookingForm with its own confirm Button and then a pending ConfirmReceipt read-back (two confirm steps, as the Do prescribes), while `booking-flow/WORKFLOW.md:12`, seeded on the same concierge persona, says the BookingForm IS the confirm step and "never ... a separate ConfirmReceipt before the confirm"; a table ask from the concierge reads both.

## Constraints
Model-read workflow text goes through the debate rule; no em dashes; seedVersion bumps re-pin digests.

## Outcome

2026-10-21 · lane: full L2 · verdict: closed by reason (delivered with T-0385 (table-reservation and booking-flow now teach one confirm shape: the BookingForm confirms and settles in place; debated; verified by the 0385 verifier-L3)) · verifier: none · base: none
- Changed: see commits
- Commits: none
