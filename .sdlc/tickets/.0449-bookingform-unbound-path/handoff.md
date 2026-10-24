---
id: T-0449
title: "A BookingForm bound to a data path the model never writes is sent back"
type: bug             # feature | bug | chore | spike | idea
status: done     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-24
claimed_by: claude:a8ce3b21 2026-10-24
from: T-0445
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
A surface whose BookingForm binds a data path that no `updateDataModel` writes is caught by a check, and a booking cannot be confirmed in prose without a ConfirmReceipt.

## Context
Round 13 cluster R in .sdlc/evals/rounds/2026-10-24-r13-pattern/report.md (round 13, T-0445): :75 writes the booking at the root while the form binds `/booking`, so every field renders blank; :76 ships "booked" note-only with `flowEnd`. `confirmHeldOpen` (T-0278) is the related check.

## Constraints
Code and checks only, no prompt text.

## Done when
- A keyless test built from :75 and :76 fails before and passes after.
- `npm run check` plus the a2ui agent tests pass.
- Lane: solo because size L2 (steps.py lane); overnight goal 2026-10-21

## Outcome

2026-10-24 · lane: solo L2 · verdict: pass · verifier: verifier-L1 (opus) · base: 8c724c43552b
- Changed: A concierge BookingForm bound to a path the data model never writes raises BOOKING_VALUE_UNBOUND
- Commits: none
- Check: 1 A keyless test built from :75 and :76 fails before and passes after: pass
- Check: 2 `npm run check` plus the a2ui agent tests pass: pass
- Check: 3 Lane: solo because size L2: pass
- Follow-up: note: checks.ts:82 flags unbound only when the data model is non-empty; a... -> notes.md
