---
id: T-0175
title: "Default-catalog TextField type=date publishes the typed text, not the ISO date"
type: bug             # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P1         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
A date typed into an A2UI default-catalog `TextField type=date` (e.g. "Dec 1, 2026") reaches the data model as the ISO date (`2026-12-01`), the same value the picker writes. Found by T-0171.

## Intent
- Do: find where the default-catalog TextField factory reads its value mark (it reads `value`, the display text) and publish the codec's parsed form value instead for codec types (date, and check time, number, currency, unit). Keep the display text in the field. Keyless browser test in both engines: typed locale date and picker date both publish ISO; an invalid typed date publishes nothing new and shows the field's invalid state.
- Done when: `npm run check` exit 0; the touched a2ui catalog and renderer tests exit 0 (browser ones in chromium and webkit); `bind-guest-edit.browser.test.ts` stays green.

## Context
- T-0171 added the codec `commit()` before `change` in `text-field.ts`; BookingForm already publishes ISO. Commit on `chore/textfield-date-iso` off origin/main, never push. Heavy tests via `gate_lock.py run`, foreground.

## Constraints
- No em dashes.

## Closed

2026-10-14: merged as PR #1976
