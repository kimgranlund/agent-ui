---
id: T-0356
title: "The other seven controls build their glyphs through createGlyph, with no host aria-hidden"
type: chore           # feature | bug | chore | spike | idea
status: ready     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-17
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
Every control that builds a ui-glyph goes through `createGlyph(symbol)` from glyph.ts, and none sets a host aria-hidden on it.

## Intent
- Do: move select, calendar, combo-box, disclosure, form-popover, status-stream and swiper-paddles to `createGlyph`; drop select's host aria-hidden on its caret (ui-glyph hides itself through ElementInternals).
- Non-goals: any visual change.
- Done when: `git grep -n "createElement('ui-glyph')" packages/agent-ui/components/src/controls` matches only glyph.ts; `npm run check` plus those seven folders' jsdom and browser tests and `npm run test:visual` exit 0 with no golden change.
- If Do needs more steps than this level allows (L1-L2 3, L3 6, L4 10, L5 15), file two tickets.

## Acceptance criteria
- `git grep -n "createElement('ui-glyph')" packages/` lists only glyph.ts and glyph's own tests (glyph.test.ts, glyph.visual.browser.test.ts); app's nav-rail also goes through createGlyph.
- No control in the seven folders or nav-rail sets a host `aria-hidden` on a ui-glyph; the select and combo-box tests assert the caret is hidden through ui-glyph's ElementInternals (`ariaHidden === 'true'`).
- The sandbox-frame dogfood bundle is rebuilt (`npm run regen:dogfood-assets`) and its freshness test passes.
- `npm run check`, the seven folders', glyph's, nav-rail's and sandbox-frame's jsdom and browser tests, and `npm run test:visual` exit 0 with no golden change.

## Context
Follow-up from T-0351 (closed, #2117), which added createGlyph and moved six controls.

## Constraints
No golden re-mint; ARIA via ElementInternals only.
