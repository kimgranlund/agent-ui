---
id: T-0538
title: "Range controls and overlays behave correctly under dir=rtl"
type: bug             # feature | bug | chore | spike | idea
status: done
size: L2
priority: P2         # P1 | P2 | P3
depends: []
created: 2026-10-28
claimed_by: claude:a8ce3b21 2026-10-28
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
The High findings below are fixed: under `dir="rtl"` ui-slider's fill, pointer mapping and arrow keys follow the mirrored axis like a native range input, slider-multi thumbs mirror, and overlay placement uses logical sides.

## Intent
- Do: fix each finding in the Context below using logical CSS properties and direction-aware key handling (read `dir` through the existing helpers or `getComputedStyle(host).direction`, not a hard-coded check); add an RTL browser test per control that compares against the native or LTR behavior and fails on base.
- Non-goals: changing LTR behavior.
- Done when: each new RTL test fails on base and passes after, in Chromium and WebKit through `scripts/gate_lock.py`; the existing LTR tests for the touched controls still pass; `npm run check` exits 0.

## Context
From the T-0536 RTL sweep (#2335):

### High

1. ui-slider: thumb mirrors, fill and pointer do not. `components/src/controls/slider/slider.css:290` `inset-inline-start: calc(var(--value-pct, 0) * 1%)` (logical) against `slider.css:250` `linear-gradient(to right, ...)` (physical) and `components/src/traits/value-drag.ts:42` `(clientX - rect.left) / rect.width` (physical). Run: at value 25 the thumb sits near the right end while the fill paints the left 25% (`shots/slider-rtl-value25.png`); a click 25% from the rail's physical left gives ui-slider 25 and the native range 76; the thumb is also off-centre by one thumb width (computed `::after` left 288px of a 400px rail, centre expected at 300px) because `translate(-50%, -50%)` at `slider.css:291` is physical. Fix: gradient `to var(--_dir-end)` via a `:dir(rtl)` token (or `to left` under `:dir(rtl)`), translate X sign from a `:dir(rtl)` token (segmented-control precedent), and invert the ratio in `value-drag.ts` when the track's computed `direction` is rtl.
2. ui-slider-multi: fill mirrors, thumbs and pointer do not. `components/src/controls/slider-multi/slider-multi.css:231-232` `.thumb[data-thumb='lo'] { left: calc(var(--value-pct-lo, 0) * 1%); }` (physical) against the logical fill (`slider-multi.css:173-177`, `inset-inline-start`); `slider-multi.ts:299` `(pe.clientX - rect.left) / rect.width`. Run: lo 20 / hi 60 on a 167 to 567 px rail puts the thumbs at 247 and 407 px but the fill at 327 to 487 px (`shots/slider-multi-rtl.png`). Fix: thumbs to `inset-inline-start` with an RTL-signed translate (and `transition: inset-inline-start`, line 224), pointer ratio inverted under rtl.
3. Overlay alignment: every `*-start` / `*-end` placement resolves to a physical edge. `components/src/traits/overlay.ts:283-284` `if (align === 'start') decl.left = 'max(0px, anchor(left))'` (CSS anchor path), `overlay.ts:204` `left = align === 'start' ? anchorRect.left : anchorRect.right - pW` (JS fallback), and the same physical read in the drift check at `overlay.ts:565-566`. Run: a default `bottom-start` ui-menu with its trigger at 807 to 867 px opens its panel at 807 to 1049 px, hanging past the inline-start edge instead of aligning to the trigger's right edge (`shots/menu-rtl.png`). Fans out to menu, select, combo-box, popover, tooltip, form-popover, and the two composer popups that call the same placement (`app/src/controls/conversation/conversation-composer.ts:1339`, `:1582`). Fix: resolve `start`/`end` to `left`/`right` from the anchor's computed `direction` (swap under rtl), or emit `inset-inline-start: anchor(start)` on the CSS path.

Proposed ticket (High): `rtl-range-and-overlay`, size L2, scope `slider.css`, `slider-multi.css`, `slider-multi.ts`, `traits/value-drag.ts`, `traits/overlay.ts`, each with an RTL browser test that compares against the native range (the probe above is the test shape).

## Constraints
LTR behavior unchanged. Descriptors updated where they describe keys or geometry. No em dashes.
- Lane: solo because size L2 (steps.py lane)

## Acceptance criteria
- The new RTL browser tests (slider, slider-multi, overlay) and the existing suites of the touched controls pass in Chromium and WebKit: `python3 /Users/kimgranlund/.claude/plugins/cache/sdlc-lite/sdlc-lite/0.40.0/scripts/gate_lock.py run --need compute_units=2 --nice -- npx vitest run --config vitest.browser.config.ts --project packages packages/agent-ui/components/src/controls/slider packages/agent-ui/components/src/controls/slider-multi packages/agent-ui/components/src/traits/overlay.browser.test.ts`
- Each new RTL test failed on base before the source edits (recorded in the run's `base-red.md`; the `dir=rtl` describe blocks are the tests).
- The jsdom suites of the touched folders pass: `npx vitest run packages/agent-ui/components/src/controls/slider packages/agent-ui/components/src/controls/slider-multi packages/agent-ui/components/src/controls/_base packages/agent-ui/components/src/traits/overlay.test.ts packages/agent-ui/components/src/traits/value-drag.test.ts`
- The standing gate is green: `npm run check`
- LTR unchanged: the overlay consumers' browser suites pass: `python3 /Users/kimgranlund/.claude/plugins/cache/sdlc-lite/sdlc-lite/0.40.0/scripts/gate_lock.py run --need compute_units=2 --nice -- npx vitest run --config vitest.browser.config.ts packages/agent-ui/components/src/controls/menu packages/agent-ui/components/src/controls/select packages/agent-ui/components/src/controls/popover packages/agent-ui/components/src/controls/combo-box packages/agent-ui/components/src/controls/form-popover packages/agent-ui/components/src/controls/tooltip/tooltip.browser.test.ts`

## Outcome

2026-10-28 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: 633d36329434
- Changed: Slider, slider-multi and overlay placement behave correctly under dir=rtl
- Commits: none
- Check: 1 New RTL browser tests and existing slider, slider-multi, overlay suites pass in Chromium and WebKit: pass
- Check: 2 Each new RTL test failed on base before the source edits: pass
- Check: 3 jsdom suites of the touched folders pass: pass
- Check: 4 `npm run check` is green: pass
- Check: 5 LTR unchanged, overlay consumers' browser suites pass: pass
- Follow-up: decide: packages/agent-ui/app/src/controls/conversation/conversation-compos... -> notes.md
- Follow-up: note: packages/agent-ui/components/src/traits/overlay.ts header comments... -> notes.md
- Follow-up: note: WebKit's native range does not mirror arrow keys under rtl builder... -> notes.md
