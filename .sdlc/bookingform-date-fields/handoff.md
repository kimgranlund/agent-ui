---
id: T-0106
title: "BookingForm: two date input fields with a picker button, no nested cards, smaller buttons"
type: feature        # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P1         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-12
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Kim 2026-10-12, after seeing T-0092 (#1913): "just have two input fields for arrival/departure and a way to open the date picker. avoid the nested containers" and "button sizes should be 1 or 2 steps down in size". Today each date is a ui-card inside the form card with a full-width lg button (nested containers, huge buttons).

## Scope (one brief paragraph, per the Inner loop rule)
In the Concierge BookingForm factory (packages/agent-ui/a2ui/src/catalog/personas/concierge/factories.ts and its tests and seeds): replace the two date cards with two labelled input-style fields, Arrival and Departure, side by side where width allows and stacked on a phone, each field a single row (the formatted locale date as the field text, or a placeholder like "Choose date") with a small icon button inside or beside it (calendar icon) that opens the existing calendar popover; clicking the field text opens it too. No ui-card inside the form card. Keep the behaviour from T-0092 (opens on the booked month, picking closes the popover, departure min is arrival, ISO is the value, Yes/No booleans). Button sizes step down: the picker button is size sm (24px) and the form's own actions (Reserve) drop from lg to md (28px), so the form uses sm and md only, and the persona action row for the form stops stamping lg on these. Screenshots at 400px and 1000px before and after in the ticket folder, viewed. Local gate: npm run check plus the touched folders' tests; no per-ticket verifier (Kim reviews screenshots); regenerate generated files with their scripts; no em dashes; commit locally, do not push; report in one short message.

## Closed

2026-10-13: merged via the foundations campaign (#1920 to #1932, ADR-0245)
