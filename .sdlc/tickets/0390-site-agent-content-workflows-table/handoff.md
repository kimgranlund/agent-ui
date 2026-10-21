---
id: T-0390
title: "site/agent-content/workflows/table-reservation/WORKFLOW.md:12..."
type: idea            # feature | bug | chore | spike | idea
status: proposed     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-21
from: T-0197
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
One or two sentences: the outcome, not the method.

## Context
Follow-up from T-0197 (verifier notes):

site/agent-content/workflows/table-reservation/WORKFLOW.md:12: decide: the reservation now runs a BookingForm with its own confirm Button and then a pending ConfirmReceipt read-back (two confirm steps, as the Do prescribes), while `booking-flow/WORKFLOW.md:12`, seeded on the same concierge persona, says the BookingForm IS the confirm step and "never ... a separate ConfirmReceipt before the confirm"; a table ask from the concierge reads both.

## Constraints
What must not change. "None" if none.
