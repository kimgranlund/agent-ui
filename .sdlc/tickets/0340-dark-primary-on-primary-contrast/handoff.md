---
id: T-0340
title: "Dark primary under on-primary is 3.25:1: buttons, calendar day, segmented control and checkbox text fail AA"
type: bug             # feature | bug | chore | spike | idea
status: ready     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-17
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
In dark mode every control that sets on-primary ink on a primary fill reaches 4.5:1.

## Intent
- Do: retune the dark `--md-sys-color-primary` / `--md-sys-color-primary-on-primary` pair at the token level (shared/tokens.css or the foundations generator), not per control; add a contrast gate over the system pair.
- Non-goals: light mode, other color roles.
- Done when: the dark pair measures 4.5:1 or better; a screenshot set of button, calendar selected day, segmented control and checkbox, dark, before and after, is approved by Kim; npm run check plus the touched folders' tests exit 0.

## Context
Found by the T-0337 code review: dark primary is primary-450 and on-primary is primary-050, 3.25:1. ui-button default fill, calendar selected day, segmented-control selected ink and checkbox checkmark use the pair. T-0337 fixed only the column-chart callout locally (dark-only color-mix of the highlight ink). Needs Kim's look-and-feel ruling: darken dark primary, or retune on-primary.

## Constraints
Foundations are generated (ADR-0245); never hand-edit the .gen.css files.

## Ruling
Kim 2026-10-17: darken dark primary (around 600 to 650) with the same on-primary ink; bring before/after screenshots of button, calendar selected day, segmented control and checkbox for Kim's approval.

## Acceptance criteria
- `npx vitest run packages/agent-ui/shared/src/tokens/tokens.test.ts` exits 0, including the anchor-pair gate (dark on-primary on `--md-sys-color-primary` at 600 = 5.64:1) and its negative control (450 fails).
- `npm run check` exits 0.
- `npx vitest run --config vitest.browser.config.ts --project packages packages/agent-ui/components/src/controls/button packages/agent-ui/components/src/controls/checkbox packages/agent-ui/components/src/controls/radio` exits 0.
- Before/after dark screenshots of button, calendar selected day, segmented control and checkbox sit in the run artifacts dir for Kim's approval (calendar and segmented read `--md-sys-color-primary-selected`, already 600, so they do not change).
