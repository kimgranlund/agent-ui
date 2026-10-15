---
id: T-0135
title: "A real date input: ui-text-field type=date with its own calendar trigger; BookingForm uses it"
type: feature        # feature | bug | chore | spike | idea
status: done
size: L3
priority: P1
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-13
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Kim 2026-10-13: the BookingForm arrival and departure fields should be a type of input and look and feel like one, and icon buttons are never rectangular. Today BookingForm builds a one-off composite with a pill-shaped icon button wider than tall.

## Scope (one brief paragraph, per the Inner loop rule)
Add type=date to ui-text-field (descriptor first: text-field.md attributes and slots, then generate-props): the control renders the locale-formatted date as its text with ISO as the value (FACE form value), a trailing calendar trigger it draws itself as an icon-only button that is square (block size = inline size = the control height step for its size, fully round), and opens the existing ui-calendar in a popover anchored to the field, opening on the current value's month, honouring min and max, closing on pick and returning focus; keyboard: Enter or Alt+ArrowDown opens, Escape closes. Also make icon-only ui-button square everywhere if it is not already (inline-size equals block-size), with a test. Then rebuild the Concierge BookingForm factory (packages/agent-ui/a2ui/src/catalog/personas/concierge/) to use two ui-text-field type=date fields with the T-0092 / T-0106 behaviour kept (departure min is arrival, ISO values), update its seeds, tests, catalog row and prompt guidance (K6 budget 46,430), and regenerate agent assets and the registry projection by script. Another lane (T-0134, pill radius) edits the radius lines of text-field.css at the same time: leave radius alone. Root is n 5 / 6 / 7 (heights 20 / 24 / 28). Local gate: npm run check, census gate, probe --strict, the touched folders' unit and browser tests (heavy runs through gate_lock.py), then the six browser shards one at a time in the foreground; re-pin what the change turns red from resolve() and re-mint goldens one file at a time with '<file> --update' (filter before the flag) after viewing each. Never wait on a background monitor: run commands in the foreground and send the conductor a one-line progress message after each major step. Regenerate generated files by script. Before and after screenshots at 400 and 1000, light and dark, in the ticket folder, viewed, not committed. Commit locally, do not push, no per-ticket verifier, no em dashes.

## Closed

2026-10-13: merged as #1952
