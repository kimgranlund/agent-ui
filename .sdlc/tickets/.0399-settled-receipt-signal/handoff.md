---
id: T-0399
title: "A settled ConfirmReceipt counts as a settled signal; concierge checks accept it as the confirm surface"
type: bug             # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-22
claimed_by: claude:a8ce3b21 2026-10-22
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
A settled ConfirmReceipt (status "confirmed", the T-0385 settle in place) is treated like the other settled signals, and the concierge checks accept it as the confirm surface.

## Intent
- Do:
  1. `packages/agent-ui/a2ui/src/catalog/composite-moments.ts` `isSettledSignal` (about line 364) knows Badge, Card, CardHeader and heading Text only; a ConfirmReceipt with a literal `"status":"confirmed"` should count as settled so it stands aside the way a Badge does. Add it with tests.
  2. `packages/agent-ui/a2ui/src/catalog/personas/concierge/checks.ts:149` (or its hospitality successor) requires `['BookingForm', 'BookingConfirmation']`; decide with evidence whether a settled ConfirmReceipt satisfies it now that booking-flow and table-reservation settle with one (T-0385, T-0390), and change it with tests if so.
- Non-goals: grammar or workflow wording (T-0397).
- Done when: the composite-moments and concierge or hospitality check tests, `npm run check` and the whole jsdom suite once exit 0.

## Context
- Raised by the T-0195 verifier (notes under T-0195); made concrete by T-0385/T-0390 (merged #2194), which settle bookings with a literal confirmed ConfirmReceipt.
- Decided by the conductor under Kim's 2026-10-21 overnight goal.

## Constraints
- No em dashes; checks stay deterministic; no model-read text changes.
- Lane: solo because size L1 (steps.py lane); overnight goal 2026-10-21
- Conductor: the solo found that the T-0385 settle-in-place receipt would have fired BOOKING_CONFIRMATION_MISSING; judge that cause and the lacks fix, and the decision to keep concierge requires unchanged (ConfirmReceipt is absent from a2ui-basic and the hospitality fragment).

## Outcome

2026-10-22 · lane: solo L1 · verdict: pass · verifier: verifier-L2 (sonnet) · base: b01f2133ca6d
- Changed: A literal confirmed ConfirmReceipt is a settled signal and answers the booking-confirmation repair; the settle-in-place receipt no longer fires BOOKING_CONFIRMATION_MISSING
- Commits: b182d3f T-0399: a literal confirmed ConfirmReceipt is a settled signal and answers the booking-confirmation repair
- Check: 1 (Do 1) isSettledSignal counts a literal "confirmed" ConfirmReceipt, with tests: pass
- Check: 2 (Do 2) decision on the concierge check with evidence and tests: pass
- Check: 3 composite-moments and hospitality check tests exit 0: pass
- Check: 4 `npm run check` exit 0: pass
- Check: 5 whole jsdom suite once exit 0: pass
- Follow-up: note: the "no finding" test in composite-moments.test.ts passes on base... -> notes.md
- Follow-up: note: NODE_OPTIONS in this shell preloads a missing cmux... -> notes.md
