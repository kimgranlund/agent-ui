---
id: T-0539
title: "Arrow keys and directional glyphs flip under dir=rtl"
type: bug             # feature | bug | chore | spike | idea
status: done
size: L2
priority: P2         # P1 | P2 | P3
depends: [T-0538]
created: 2026-10-28
claimed_by: claude:a8ce3b21 2026-10-28
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
The Medium findings below are fixed: arrow keys in range-element, slider-multi, calendar and board-grid flip under `dir="rtl"`, and directional glyphs and drill transitions mirror.

## Intent
- Do: fix each finding in the Context below using logical CSS properties and direction-aware key handling (read `dir` through the existing helpers or `getComputedStyle(host).direction`, not a hard-coded check); add an RTL browser test per control that compares against the native or LTR behavior and fails on base.
- Non-goals: changing LTR behavior.
- Done when: each new RTL test fails on base and passes after, in Chromium and WebKit through `scripts/gate_lock.py`; the existing LTR tests for the touched controls still pass; `npm run check` exits 0.

## Context
From the T-0536 RTL sweep (#2335):

### Medium

4. Range-family arrow keys do not flip where the visual does. `components/src/controls/_base/range-element.ts:157-163` `case 'ArrowRight': case 'ArrowUp': next = ... current + step`; `slider-multi.ts:363-364`, `:381-382` the same. Run: from 50, ArrowRight gives ui-slider 51 and the native range 49. Fix: swap the Left/Right sign when the host's computed `direction` is rtl (the `roving-focus.ts` precedent); lands with item 1 so key, pointer and visual agree.
5. ui-calendar day-grid arrows. `components/src/controls/calendar/calendar.ts:885-890` `case 'ArrowLeft': target = advanceDate(..., -1)`. The grid mirrors (Saturday column at the left, `shots/disclosure-calendar-rtl.png`), so ArrowRight from the 15th moves focus to the 16th, which is physically to the LEFT (run). Fix: swap the +/-1 day under rtl so the arrow matches the visual move (APG date grid practice in RTL locales).
6. ui-board-grid arrows. `components/src/controls/board-grid/board-grid.ts:28-29` `ArrowLeft: [0, -1], ArrowRight: [0, 1]` over a CSS grid that mirrors. Quoted line, not run. Fix: negate the column step under rtl.
7. Directional glyphs that do not mirror. `components/src/controls/calendar/calendar.ts:614` `createGlyph('caret-left')` on prev and `:628` `caret-right` on next: in the run the prev button sits at the right with a left-pointing caret, so both carets point inward (`shots/disclosure-calendar-rtl.png`). `components/src/controls/swiper/swiper-paddles.ts:36-37` the same (run: prev paddle at 835 px carries `caret-left`, next at 333 px carries `caret-right`). `components/src/controls/disclosure/disclosure.ts:291` collapsed `caret-right` points away from the text in rtl (run, same shot). Quoted only: `step-flow/step-flow.ts:196`, `:202`, `confirm-receipt/confirm-receipt.ts:212`. No shared mirror rule exists (no `:dir(rtl)` on `ui-glyph`). Fix: one `ui-glyph[symbol^='caret-left'], ui-glyph[symbol^='caret-right'] { &:dir(rtl) { transform: scaleX(-1) } }` rule in `glyph.css` (the `drill.css:188` `:dir(rtl)` glyph precedent), or a `mirror` flag on inline-axis symbols in `glyph-paths.ts`.
8. ui-drill panel slide. `components/src/controls/drill/drill.css:341-348` `translateX(calc(var(--ui-drill-slide-distance) * var(--_drill-dir-sign, 1)))` carries only forward/back, so a forward drill enters from the right in rtl too, against the reading direction. Quoted line, not run. Fix: multiply by a `:dir(rtl)` `-1` token beside `--_drill-dir-sign` (segmented-control precedent).

Proposed ticket (Medium): `rtl-arrows-and-glyphs`, size L2, scope `range-element.ts`, `slider-multi.ts` keys, `calendar.ts`, `board-grid.ts`, `glyph.css` (or `glyph-paths.ts`), `drill.css`, with one RTL browser test per control asserting key direction against the visual move.

## Constraints
LTR behavior unchanged. Descriptors updated where they describe keys or geometry. No em dashes.
- Lane: solo because size L2 (steps.py lane)

## Acceptance criteria
- Item 4 (range-element and slider-multi arrow keys) already landed with T-0538 and its RTL tests (`slider.browser.test.ts`, `slider-multi.browser.test.ts`); no change here.
- The new RTL tests (calendar arrows, board-grid arrows, glyph caret mirror with the disclosure open turn, drill forward slide) failed on base 387b335bf in Chromium and WebKit and pass after, with the existing tests of the touched controls: `python3 /Users/kimgranlund/.claude/plugins/cache/sdlc-lite/sdlc-lite/0.40.0/scripts/gate_lock.py run --need compute_units=2 --nice -- npx vitest run --config vitest.browser.config.ts --project packages packages/agent-ui/components/src/controls/calendar/calendar.browser.test.ts packages/agent-ui/components/src/controls/board-grid/board-grid.browser.test.ts packages/agent-ui/components/src/controls/drill/drill.browser.test.ts packages/agent-ui/components/src/controls/glyph/glyph.browser.test.ts packages/agent-ui/components/src/controls/disclosure/disclosure.browser.test.ts packages/agent-ui/components/src/controls/swiper` exits 0.
- The jsdom suites of the touched folders and the styling gates stay green: `npx vitest run packages/agent-ui/components/src/controls/calendar packages/agent-ui/components/src/controls/board-grid packages/agent-ui/components/src/controls/glyph packages/agent-ui/components/src/controls/disclosure packages/agent-ui/components/src/controls/drill packages/agent-ui/components/src/controls/styling-gates.test.ts` exits 0.
- `npm run check` exits 0.

## Outcome

2026-10-28 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: 387b335bfaa1
- Changed: Arrow keys in calendar and board-grid flip under dir=rtl, and directional glyphs, the disclosure chevron and drill slides mirror
- Commits: none
- Check: 1 Item 4 already landed with T-0538, no change here: pass
- Check: 2 New RTL tests fail on base 387b335bf and pass after, in Chromium and WebKit, with the existing te...: pass
- Check: 3 jsdom suites of the touched folders and styling-gates stay green: pass
- Check: 4 `npm run check` exits 0: pass
- Follow-up: note: packages/agent-ui/components/src/controls/drill/drill.css:341-356... -> notes.md
- Follow-up: note: packages/agent-ui/components/src/controls/glyph/glyph.css:50 the... -> notes.md
