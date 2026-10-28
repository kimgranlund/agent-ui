---
id: T-0495
title: "ui-text-field type=color stops leaking the swatch value text as a vertical strip"
type: bug             # feature | bug | chore | spike | idea
status: done     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-28
claimed_by: claude:a8ce3b21 2026-10-28
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 5
---

## Goal
In ui-text-field `type=color`, the swatch adornment shows only the color chip; its value text does not render as a vertical strip.

## Context
Found by T-0488 (F4). The swatch-button's composed ui-swatch renders its `[data-part="value"]` span at 8px wide by 150px tall, stacking "#3b82f6" one character per line over the field and the specimen below (text-field-permutations, both widths). `text-field-geometry.browser.test.ts` checks the swatch is not collapsed but not that the value part is hidden. Crop: /private/tmp/claude-501/-Users-kimgranlund-Projects-nonoun-agent-ui/a8ce3b21-c0a4-4e5f-b099-1796666e5f7f/scratchpad/0488-shots/crops/text-field-color.png

## Constraints
Fix at the control (text-field or swatch), with a failing-first browser test on the value part's box. Screenshot before and after. No em dashes.

## Acceptance criteria
- A browser test asserts the adornment's swatch value part takes no visible box (or is absent), and it fails with the fix reverted.
- The text-field and swatch browser tests pass.
- `npm run check` exits 0.
- Lane: solo because size L1 (steps.py lane)

## Outcome

2026-10-28 · lane: solo L1 · verdict: pass · verifier: verifier-L1 (opus) · base: c01455b8045c
- Changed: ui-text-field type=color no longer leaks the swatch value text as a vertical strip
- Commits: none
- Check: 1 A browser test asserts the adornment's swatch value part takes no visible box (or is absent), and...: pass
- Check: 2 The text-field and swatch browser tests pass: pass
- Check: 3 `npm run check` exits 0: pass
- Check: 4 Lane: solo because size L1: pass
- Follow-up: note: text-field-geometry.browser.test.ts:870 the assertions are guarded... -> notes.md
