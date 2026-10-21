---
id: T-0388
title: "An OptionDeck nested under a centring parent still collapses to 0px"
type: bug             # feature | bug | chore | spike | idea
status: claimed        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-20
claimed_by: claude:a8ce3b21 2026-10-21
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
An OptionDeck placed as a non-root child inside a centring parent fills its column instead of collapsing to 0px. A test that failed before the fix passes after it.

## Context
Found by the T-0387 fix (2026-10-20). ui-option-deck is an inline-size container, so it has no intrinsic width. T-0387 stretched it only as a surface root (`surface-host/artboard.ts` widget roots); a deck nested in a Column with `align: center`, or in any shrink-to-fit parent, still measures 0px. Decide whether the control should carry its own `inline-size: 100%` or `min-inline-size` under the fill-by-default law (ADR-0223), so every parent gets the fix, not just the surface root.

## Constraints
Fill-by-default stays the contract (the `inline` boolean opts out). Run the whole dogfood render lint.
- Lane: solo because size L2 (steps.py lane); fanout 2026-10-21

## Acceptance criteria
- A deck nested in a centring column, a flex row and a centring grid cell fills its parent in Chromium and WebKit (failed at 0px before the fix): `env -u NODE_OPTIONS npx vitest run --config vitest.browser.config.ts --project packages packages/agent-ui/components/src/controls/option-deck`
- The option-deck visual baselines are unchanged: `env -u NODE_OPTIONS npx vitest run --config vitest.browser.config.ts --project visual packages/agent-ui/components/src/controls/option-deck`
- The whole dogfood render lint stays green: `env -u NODE_OPTIONS npx vitest run --config vitest.browser.config.ts --project site site/pages/dogfood-render.browser.test.ts`
- The dogfood compose gate stays green: `env -u NODE_OPTIONS node scripts/dogfood-compose.mjs --gate`
- The standing gate stays green: `env -u NODE_OPTIONS npm run check`
