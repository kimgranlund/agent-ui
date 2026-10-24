---
id: T-0444
title: "/__a2ui/agent/chat buffers the whole reply and writes nothing..."
type: idea            # feature | bug | chore | spike | idea
status: proposed     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-24
from: T-0438
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
One or two sentences: the outcome, not the method.

## Context
Follow-up from T-0438 (verifier notes):

`/__a2ui/agent/chat` buffers the whole reply and writes nothing during the paid call, so a disconnect cannot cancel it even with the flag (the builder's open item). It needs its own ticket.

## Constraints
What must not change. "None" if none.
