---
id: T-0132
title: "Foundations look check: every family at 400 and 1000px against the step 0 mockup and later rulings"
type: chore           # feature | bug | chore | spike | idea
status: done
size: L2
priority: P1
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-13
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Campaign rubric item 3 (Look): each control family's screenshots at 400px and 1000px, light and dark, on main match the approved step 0 mockup as amended by Kim's later rulings, in one batched verifier's report.

## Context
Approved mockup: .sdlc/foundations-mockup/ (light and dark PNGs, approval.md with the rulings; the HTML is /private/tmp/claude-501/local-artifact/foundations.html if present). Rulings after the mockup, all on main: ADR-0245 Amendments 2 to 4 (A2UI canvas widget/md; one-step shrink, page root 20 / 24 / 28; control rule, text edge 2n - c, badge 2n + 2c, chip level), the 252px nav pane as a named measure, select and combo-box option text aligned with the trigger text, agent-admin pane tabs Settings / System / Dialog. So compare STRUCTURE and RELATIONS (which parts exist, alignment, glyph versus icon containers, pill and radius shapes, level spacing order group < widget < card < page, no clipping, no overlap, no type under 9px), not literal pixel values from the old anchors.

## Acceptance criteria
- Families (one screenshot set each, 400 and 1000, light and dark, from the docs site demo pages on main): actions (button, toggle, segmented control), entry (text-field, textarea, select, combo-box, multi-select, otp-field), indicators (checkbox, radio, switch, slider), atoms (badge, avatar, text, glyph, icon), navigation (tabs, pagination, breadcrumb, menu), data display (table, calendar, timeline, stat, sparkline), charts (bar, column, gauge), containers (card, modal, drawer, popover, toast, disclosure), A2UI widgets (BookingForm, CardTable, QuestionCard, ProductCard, ResultCard, ContrastPair, BoardGrid, GameHud), shell (docs page, agent-admin, chat).
- Per family: pass or fail against the criteria in Context, with the screenshot paths and, for a fail, the exact defect.
- Gates on main to exit 0: `node scripts/foundations-census.mjs --gate`, `node scripts/foundations-probe.mjs --strict`.
- Read-only: no source edits; screenshots go under .sdlc/0132-foundations-look-verify/shots/ in the verifier's scratch, not committed.

## Re-check (attempt 2, after T-0133)
Re-check only the two families that failed in attempt 1, entry and atoms, on current main (T-0133 merged): the sm avatar initials are at least 9px, badge-demo and icon-demo have no escapees at 400px by the escapees() predicate in site/pages/demo-overflow-400.browser.test.ts, and the text-field search demo shows one magnifier with the editor on the 1fr track. Reuse the attempt 1 shot script and contact-sheet approach for these two families only, 400 and 1000, light and dark. The eight families that passed in attempt 1 stand. Census gate and probe --strict to exit 0 again. Known and out of scope: the icon-demo "Sizing" ramp row painting every icon one size (a stale demo premise, filed separately in notes).

## Closed

2026-10-13: verifier pass on attempt 2 (verifier-L2-2.md) after #1950
