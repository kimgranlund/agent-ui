---
id: T-0318
title: "Replace two corpus records that teach what the rulings forbid (frontier-booking-receipt, frontier-greet-card)"
type: chore           # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-16
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
The scored corpus records `frontier-booking-receipt` (a summary read back before confirming; T-0266 pre-filled BookingForm, T-0289 confirm) and `frontier-greet-card` (a Card around each starter choice; T-0172 one row of buttons) match Kim's rulings. Found by T-0307's sweep.

## Process
Per skill `a2ui-corpus-curation`: author the replacement, a fresh judged review (a2ui-review-agent, never self-graded), then `import-seeds --verdicts` with `--replace`.

## Done when
- Both records replaced through the judged quarantine exit with their verdict files; the corpus tests and `npm run check` exit 0.
