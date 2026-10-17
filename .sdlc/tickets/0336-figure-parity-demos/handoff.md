---
id: T-0336
title: "Site demos align captioned figures to a shared top edge (figure-parity allowlist debt)"
type: chore           # feature | bug | chore | spike | idea
status: ready     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P3         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-17
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
The 10 site demos with captioned figures align them to start, so figure tops match.

## Intent
- Do: the fix in Context, one cause.
- Non-goals: other round 9 clusters.
- Done when: Remove the 10 allowlist lines; site/pages/dogfood-render.browser.test.ts green in both engines. `npm run check` plus the touched folders' tests exit 0.

## Context
T-0168 added the figure-parity render rule; debt allowlisted in scripts/dogfood-render-allowlist.json: button, checkbox, icon, otp-field, radio, rating, slider, slider-multi, switch, text-field demos center-align figures, tops differ 2 to 26px. Fix: align start on those rows.

## Constraints
None.
