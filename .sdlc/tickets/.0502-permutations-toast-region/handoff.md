---
id: T-0502
title: "layout-permutations keeps fixed-position hosts such as ui-toast-region out of the four-primitives grid"
type: bug             # feature | bug | chore | spike | idea
status: done
size: L1
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-28
claimed_by: claude:a8ce3b21 2026-10-28
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 5
---

## Goal
The layout-permutations demo's four-primitives grid shows only in-flow layout primitives, so no fixed-position host (ui-toast-region) anchors its boxes to the viewport outside the content column, and its render-lint allowlist line is gone.

## Intent
- Do: in the layout-permutations site page, exclude fixed-position hosts (ui-toast-region, and any other `position: fixed` tier-layout descriptor) from the grid that `membersOfTier` feeds; delete the `demo/layout-permutations#column` entry from `scripts/dogfood-render-allowlist.json`.
- Non-goals: changing ui-toast-region itself or its descriptor tier.
- Done when: the dogfood render lint (`site/pages/dogfood-render.browser.test.ts`, the `site` shard, run for that page) passes without the allowlist line; a screenshot at 1000px and 400px shows the grid inside its card; `npm run check` exits 0.

## Context
T-0494 found it when the render lint first visited this page; allowlist reason in `scripts/dogfood-render-allowlist.json:3`.

## Constraints
Page change only. No em dashes.
- Lane: solo because size L1 (steps.py lane)

## Outcome

2026-10-28 · lane: solo L1 · verdict: pass · verifier: verifier-L1 (opus) · base: 993df87857a2
- Changed: layout-permutations keeps fixed-position hosts out of the four-primitives grid
- Commits: none
- Check: 1 render lint for layout-permutations passes without the allowlist line: pass
- Check: 2 screenshot at 1000px and 400px shows the grid inside its card: pass
- Check: 3 `npm run check` exits 0: pass
- Follow-up: note: site/pages/layout-permutations.ts:48 the filter keys on descriptor... -> notes.md
