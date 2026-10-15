---
id: T-0085
title: "BookingForm and BookingConfirmation: labelled fields, compact dates, a real summary layout"
type: bug             # feature | bug | chore | spike | idea
status: done     # proposed | ready | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-12
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
The Concierge BookingForm and BookingConfirmation look like finished, well-scaffolded UI, not a bare stack of controls: every field has a visible label, the dates are compact, and the confirmation is a proper label/value summary.

## Repro
1. Render the concierge seeds (persona-concierge-stay-details and persona-concierge-booking; see site/pages/a2ui-catalog.ts renderSeedCard) in headless Playwright at 400px and 1000px and screenshot. Kim's screenshot of the showcase card showed the problems.

## Expected
1. Fields: every BookingForm field (text, number, date, select, checkbox) shows a visible label above or beside its control (use the Field/label pattern the fleet uses, ui-field), with the ADR-0046 rhythm: 8px gap between fields, inset 6px, region padding 12 inline / 6 block. The number field's stepper stays; the unit/label is visible ("Guests").
2. Layout: related fields share a row where width allows (check-in and check-out side by side at 600px and up; stacked on a phone), via the form's own scaffold, not the producer's payload.
3. Dates: dateSingle fields no longer open a full month calendar inline for each date. Use the fleet's compact date control (a date field that opens the calendar in a popover, or the library's date input) if one exists in the default catalog; report what exists. The wire contract (kind dateSingle, path, value, confirmation rows) must not change. If no compact date control exists, stop on that item and report it, do not invent a new control.
4. Confirmation: BookingConfirmation renders as a summary card with a title and a label (left, muted) / value (right, strong) row per entry, row dividers, consistent spacing, long values wrapping; same ADR-0046 spacing.
5. Look: consistent with the other widgets (36px lg primary action Reserve, same card surface, ink inset). Screenshots before and after at 400px and 1000px, viewed, in the ticket folder.

## Actual
Kim 2026-10-12: 'the user inputs (name and amount of guests) and Stay summary feel really unstyled or poorly layout scaffolded.' Measured/seen: fields have no visible labels, two full month calendars stack inside the form, the summary is plain stacked text.

## Context
packages/agent-ui/a2ui/src/catalog/personas/concierge/{factories.ts,catalog.json,selection.json,factories.test.ts}; seeds packages/agent-ui/a2ui/src/examples/persona-exemplars.ts (concierge); teaching in site/pages/agent-admin-presets.ts (concierge) only if the payload shape changes; box-model container-box.css / ADR-0046. This ticket is parallel to T-0084 (croupier/quizmaster/controls gutters); do not touch croupier, quizmaster, product-card, board-grid or game-hud files. If you add or change wire props append a note to ADR-0043's sibling record the concierge fragment cites; keep props additive. Regenerate generated files with their scripts; keep K6 under 46,430 (report it).

## Constraints
Local gate: npm run check plus the touched folders' tests (concierge fragment, a2ui examples, registry, agent-manifest, site pages for catalog/showcase); CI runs the full suite. No em dashes.

## Closed

2026-10-12: merged #1908
