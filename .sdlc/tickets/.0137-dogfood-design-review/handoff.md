---
id: T-0137
title: "Dogfood design review: look and feel of every control family and A2UI widget on main"
type: chore           # feature | bug | chore | spike | idea
status: done
size: L2
priority: P1
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-13
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Kim 2026-10-13 dogfooded the A2UI sheets and caught what the structural verifier could not (sharp badges and selects, a rectangular icon button, a hand-built date field). Run a look-and-feel review of every family on current main (after #1951 everything pill and #1952 the date input) and turn the findings into fixes and, where measurable, dogfood-lint rules (T-0136). Three ui-designer reviews in part-a, part-b and part-c; findings land in each part's result file.

## Closed

2026-10-13: findings fixed in #1954 to #1958; open rulings and unadded rules in notes.md
