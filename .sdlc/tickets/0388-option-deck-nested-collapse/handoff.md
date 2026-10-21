---
id: T-0388
title: "An OptionDeck nested under a centring parent still collapses to 0px"
type: bug             # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-20
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
An OptionDeck placed as a non-root child inside a centring parent fills its column instead of collapsing to 0px. A test that failed before the fix passes after it.

## Context
Found by the T-0387 fix (2026-10-20). ui-option-deck is an inline-size container, so it has no intrinsic width. T-0387 stretched it only as a surface root (`surface-host/artboard.ts` widget roots); a deck nested in a Column with `align: center`, or in any shrink-to-fit parent, still measures 0px. Decide whether the control should carry its own `inline-size: 100%` or `min-inline-size` under the fill-by-default law (ADR-0223), so every parent gets the fix, not just the surface root.

## Constraints
Fill-by-default stays the contract (the `inline` boolean opts out). Run the whole dogfood render lint.
