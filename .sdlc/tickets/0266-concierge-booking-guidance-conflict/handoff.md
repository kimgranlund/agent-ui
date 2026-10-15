---
id: T-0266
title: "Concierge booking guidance conflicts: booking-flow teaches a read-back Card and a settled Badge, the catalog teaches BookingForm and BookingConfirmation"
type: bug             # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-15
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
A ruling, then one consistent booking teaching for the Concierge. The ruling answers whether a fully specified booking ask ("Book a 60-minute massage ... Thursday 19 November 2026 at 15:00 ... Alex Moreau") shows a BookingForm prefilled for review, or a read-back ask, and whether the settled booking is a BookingConfirmation or the `booking-flow` receipt with a "Booked" Badge.

## Repro
Read `.sdlc/evals/rounds/2026-10-15-r3-routing/``runs/long-concierge-booking-{haiku,sonnet,opus}-1/report.json` and `routing-long-session-sonnet-1`. Compare with `site/pages/agent-admin-libraries.ts` (`booking-flow`, scene 5 and the settled receipt) and `packages/agent-ui/a2ui/src/catalog/personas/concierge/selection.json`.

## Expected
The playbook, the catalog selection and the composite checks name the same composite for the same moment.

## Actual
Across 83 Concierge turns on three models, BookingForm was drawn once and BookingConfirmation twice. Every model answers a booking ask with a read-back Card (DescriptionList and a confirm Button on an `ask-N` surface), as `booking-flow` scene 5 teaches, and settles it with a Badge, which BOOKING_CONFIRMATION_MISSING then sends back (9 fires). BookingForm's composite check needs 2 or more inputs, so a read-back Card never trips it. `booking-flow` and every skill stay `index-only` (83 of 83 turns), and the booking exemplar ranks first on every booking turn (routing-expect passes).

## Context
This is a guidance conflict, not a routing or model gap. Related: T-0197 (BookingForm field kinds), T-0262, and T-0231 (facts fixed; teaching is still index-only). Found by T-0261.

## Ruling (Kim, 2026-10-15)
When a booking ask already carries every detail, Concierge shows the BookingForm composite pre-filled for the guest to confirm, never a read-back Card. Change the booking-flow playbook to match the composite catalog, and have the composite-moment check enforce it.

## Lane bundle
This solo lane delivers these tickets in order, one commit each:
- .sdlc/tickets/0266-concierge-booking-guidance-conflict/handoff.md
- .sdlc/tickets/0267-concierge-no-spa-menu/handoff.md

## Acceptance criteria
- `npx vitest run packages/agent-ui/a2ui/src/catalog/composite-moments.test.ts` exits 0: the recorded Sonnet read-back (DescriptionList and a "Confirm booking" Button) yields BOOKING_FORM_MISSING alone with a pre-fill repair, and the info-card, one-input and pre-filled BookingForm controls stay quiet (the read-back case fails on the pre-change detector).
- `npx vitest run --project site site/pages/agent-admin-app.test.ts site/pages/agent-admin-presets.test.ts site/pages/agent-admin-ambient-budget.test.ts site/lib/agent-manifest` exits 0: the seeded `booking-flow` and the Concierge House facts teach the pre-filled BookingForm confirm and the BookingConfirmation settle (no read-back, no settled Badge), seedVersion is 11, and the manifest digest is fresh.
- `npm run check` exits 0.
