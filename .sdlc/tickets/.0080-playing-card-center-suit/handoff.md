---
id: T-0080
title: "ui-playing-card: the center suit glyph is not optically centered in the card"
type: bug             # feature | bug | chore | spike | idea
status: done     # proposed | ready | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-12
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
The bug is fixed and a test that failed before the fix passes after it.

## Repro
1. Render a ui-playing-card with rank A (any suit), or a face card, in the docs site or the croupier surface.
2. Look at the centered suit glyph (pip or letter) against the card's geometric center.

## Expected
The center glyph sits at the exact center of the card face, measured by bounding box in a real-engine test.

## Actual
Reported by Kim 2026-10-12: the family (suit) icon is not absolute-centered in the card.

## Context
packages/agent-ui/components/src/controls/playing-card/playing-card.css, [data-part='pips'] (inset 0.26 / 0.16 of inline-size, 3x9 grid, place-items center) and [data-part='pip'] / 'letter' (line-height 1). Guess: the asymmetric top/bottom inset (0.26 both) is fine, but glyph font metrics or the 9-row grid center offset the ace pip; measure first.
Files: playing-card.css, playing-card.ts, playing-card.browser.test.ts, baselines under __baselines__ (visual re-baseline may be needed).

## Constraints
The failing test lands before or with the fix, never after.

## Closed

2026-10-12: Not a bug in ui-playing-card: measured centered in Chromium and WebKit; the off-center glyph was in the artifact mockup, fixed there
