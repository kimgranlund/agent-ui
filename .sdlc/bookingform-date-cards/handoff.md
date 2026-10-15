---
id: T-0092
title: "BookingForm: arrival and departure date cards, each with a button that opens a date picker (plus the three small open items)"
type: feature        # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-12
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
The Concierge BookingForm shows the stay dates as two cards, Arrival and Departure, side by side where width allows and stacked on a phone. Each card shows its label, the chosen date in a readable locale format (the ISO value stays the value), and one button ("Choose date" or "Change") that opens the date picker in a popover. Kim 2026-10-12: "there should be a card for arrival / departure dates and a button for each that opens picker".

## Expected
1. Two date cards inside the BookingForm scaffold (concierge fragment, packages/agent-ui/a2ui/src/catalog/personas/concierge/factories.ts), built from fleet parts (Card, Text, Button, the date picker in a popover); the producer payload only declares dateSingle fields, the scaffold draws the cards.
2. Button size is the library lg step (36px) per the Inner loop rule; card surface and ink inset match the other widgets and the ADR-0046 box model.
3. The picker opens on the booked month when a value exists (today's month otherwise); picking a date closes the popover and updates the card text; departure cannot precede arrival.
4. Date text is locale formatted (for example "Mon, 12 Oct 2026"), ISO kept as the value on the wire and in the data model.
5. Boolean fields render as Yes / No choices, not a bare checkbox.
6. Screenshots at 400px and 1000px next to the previous BookingForm, viewed, in the ticket folder.

## Context
Follows T-0085 (bookingform-layout, merged #1908). Open items from its notes: popover opens on booked month, locale dates, Yes/No booleans. Files: concierge/{factories.ts,catalog.json,selection.json,factories.test.ts}, seeds in packages/agent-ui/a2ui/src/examples/persona-exemplars.ts, the showcase page site/pages/a2ui-catalog.ts renderSeedCard. If the foundations ADR (T-0091) later changes geometry, this uses today's tokens.

## Constraints
Local gate: npm run check plus the touched folders' tests (concierge fragment, a2ui examples, registry, agent-manifest, site pages); CI runs the full suite. Regenerate generated files with their scripts. No em dashes.

## Closed

2026-10-12: merged #1913
