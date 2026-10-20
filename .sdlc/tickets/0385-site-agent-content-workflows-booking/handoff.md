---
id: T-0385
title: "site/agent-content/workflows/booking-flow/WORKFLOW.md:12 settles..."
type: idea            # feature | bug | chore | spike | idea
status: proposed     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-20
from: T-0195
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
One or two sentences: the outcome, not the method.

## Context
Follow-up from T-0195 (verifier notes):

`site/agent-content/workflows/booking-flow/WORKFLOW.md:12` settles with "exactly one updateComponents ... status bound to a path holding "confirmed"", but nothing in that flow writes "confirmed" to the draft (the confirm press is the BookingForm's, not a ConfirmReceipt's); a model following it literally either precedes it with an updateDataModel (two messages against grammar's one settle update) or renders a pending receipt with Back and Confirm (`confirm-receipt.ts:272-274`), the re-ask the task goal bars. The taught shape is right; the conductor's live `chat:probe` should watch this turn.

## Constraints
What must not change. "None" if none.
