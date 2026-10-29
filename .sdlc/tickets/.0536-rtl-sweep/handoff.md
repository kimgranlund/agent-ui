---
id: T-0536
title: "RTL sweep: physical CSS and arrow keys that break under dir=rtl"
type: chore           # feature | bug | chore | spike | idea
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
A ranked list of places where ui-* controls or app compositions misbehave under `dir="rtl"`: physical left/right CSS (margin-left, left:, translateX with a fixed sign, border-left), arrow-key handling that does not flip, and icons or carets that should mirror.

## Intent
- Do: grep the CSS and TS under `packages/agent-ui/components/src` and `packages/agent-ui/app/src` for physical properties and direction-blind key handling; screenshot the riskiest controls (slider, split, tabs, menu, drawer, nav-rail, swiper, pagination, text-field affixes) in a real browser at `dir="rtl"`. Write `## Acceptance criteria
- `grep -c '^### High' .sdlc/tickets/0536-rtl-sweep/handoff.md` prints 1, and the same for Medium and Low: `grep -cE '^### (High|Medium|Low)$' .sdlc/tickets/0536-rtl-sweep/handoff.md` prints 3.
- Each group ends with one `Proposed ticket` line: `grep -c '^Proposed ticket' .sdlc/tickets/0536-rtl-sweep/handoff.md` prints 3.
- Each High finding cites a file:line and a run or quoted line; the cited lines match the source at base 5a4ff7e81 (spot-check `slider.css:250`, `slider-multi.css:231`, `overlay.ts:283`, `value-drag.ts:42`).
- No em dash in the handoff: `grep -c $'\xe2\x80\x94' .sdlc/tickets/0536-rtl-sweep/handoff.md` prints 0 (exit 1).
- Read-only outside `.sdlc`: `git status --short -- . ':!.sdlc'` prints nothing.

## Findings` to this handoff.
- Non-goals: fixing anything.
- Done when: `## Findings` exists grouped High / Medium / Low, each with file:line, evidence and a one-line fix, plus a proposed ticket per group; High findings confirmed by a run or a quoted line; `git status --short -- . ':!.sdlc'` prints nothing.

## Constraints
Read-only outside `.sdlc`. Browser runs through `scripts/gate_lock.py`. No em dashes. No paid runs.
- Lane: solo because size L2 (steps.py lane)

## Findings

Sweep of `packages/agent-ui/components/src` and `packages/agent-ui/app/src` at base 5a4ff7e81. Ranked by agreement: a control is a finding when, under `dir="rtl"`, its visual, pointer and keyboard paths disagree with each other or with the platform. Paths below are relative to `packages/agent-ui/`.

Method: a grep of every `*.css` for physical left/right, `translate`/`rotate`, and every `*.ts` for `ArrowLeft|ArrowRight`, `clientX`, `rect.left`, `style.left`; then two Chromium runs (Playwright plus a Vite server over the worktree, through `gate_lock.py`) of a probe page at `<html dir="rtl">` with a native `<input type=range>` as the platform oracle. Probe sources and screenshots: `.sdlc/runtime/tasks/0536-rtl-sweep/` (`rtl.html`, `probe.mjs`, `rtl2.html`, `probe2.mjs`, `shots/*.png`).

Already RTL-correct (negative controls, no finding): segmented-control (`segmented-control.css:93` `:dir(rtl)` sign token; probe: segments laid out 434, 302, 169 px), tabs and nav-rail arrows (`traits/roving-focus.ts`), split and super-shell resize (`traits/pane-resize.ts`), swiper scrolling (`swiper.ts`), drawer (logical `edge`), drill crumb separator (`drill.css:188`), column-chart and bar-chart, text-field affixes (`order`, `text-field.css:208`), pagination (text labels, no glyphs), otp-field (pinned `direction: ltr`, `otp-field.css:106`, deliberate), line-chart and sparkline (SVG physical by design, documented).

### High

1. ui-slider: thumb mirrors, fill and pointer do not. `components/src/controls/slider/slider.css:290` `inset-inline-start: calc(var(--value-pct, 0) * 1%)` (logical) against `slider.css:250` `linear-gradient(to right, ...)` (physical) and `components/src/traits/value-drag.ts:42` `(clientX - rect.left) / rect.width` (physical). Run: at value 25 the thumb sits near the right end while the fill paints the left 25% (`shots/slider-rtl-value25.png`); a click 25% from the rail's physical left gives ui-slider 25 and the native range 76; the thumb is also off-centre by one thumb width (computed `::after` left 288px of a 400px rail, centre expected at 300px) because `translate(-50%, -50%)` at `slider.css:291` is physical. Fix: gradient `to var(--_dir-end)` via a `:dir(rtl)` token (or `to left` under `:dir(rtl)`), translate X sign from a `:dir(rtl)` token (segmented-control precedent), and invert the ratio in `value-drag.ts` when the track's computed `direction` is rtl.
2. ui-slider-multi: fill mirrors, thumbs and pointer do not. `components/src/controls/slider-multi/slider-multi.css:231-232` `.thumb[data-thumb='lo'] { left: calc(var(--value-pct-lo, 0) * 1%); }` (physical) against the logical fill (`slider-multi.css:173-177`, `inset-inline-start`); `slider-multi.ts:299` `(pe.clientX - rect.left) / rect.width`. Run: lo 20 / hi 60 on a 167 to 567 px rail puts the thumbs at 247 and 407 px but the fill at 327 to 487 px (`shots/slider-multi-rtl.png`). Fix: thumbs to `inset-inline-start` with an RTL-signed translate (and `transition: inset-inline-start`, line 224), pointer ratio inverted under rtl.
3. Overlay alignment: every `*-start` / `*-end` placement resolves to a physical edge. `components/src/traits/overlay.ts:283-284` `if (align === 'start') decl.left = 'max(0px, anchor(left))'` (CSS anchor path), `overlay.ts:204` `left = align === 'start' ? anchorRect.left : anchorRect.right - pW` (JS fallback), and the same physical read in the drift check at `overlay.ts:565-566`. Run: a default `bottom-start` ui-menu with its trigger at 807 to 867 px opens its panel at 807 to 1049 px, hanging past the inline-start edge instead of aligning to the trigger's right edge (`shots/menu-rtl.png`). Fans out to menu, select, combo-box, popover, tooltip, form-popover, and the two composer popups that call the same placement (`app/src/controls/conversation/conversation-composer.ts:1339`, `:1582`). Fix: resolve `start`/`end` to `left`/`right` from the anchor's computed `direction` (swap under rtl), or emit `inset-inline-start: anchor(start)` on the CSS path.

Proposed ticket (High): `rtl-range-and-overlay`, size L2, scope `slider.css`, `slider-multi.css`, `slider-multi.ts`, `traits/value-drag.ts`, `traits/overlay.ts`, each with an RTL browser test that compares against the native range (the probe above is the test shape).

### Medium

4. Range-family arrow keys do not flip where the visual does. `components/src/controls/_base/range-element.ts:157-163` `case 'ArrowRight': case 'ArrowUp': next = ... current + step`; `slider-multi.ts:363-364`, `:381-382` the same. Run: from 50, ArrowRight gives ui-slider 51 and the native range 49. Fix: swap the Left/Right sign when the host's computed `direction` is rtl (the `roving-focus.ts` precedent); lands with item 1 so key, pointer and visual agree.
5. ui-calendar day-grid arrows. `components/src/controls/calendar/calendar.ts:885-890` `case 'ArrowLeft': target = advanceDate(..., -1)`. The grid mirrors (Saturday column at the left, `shots/disclosure-calendar-rtl.png`), so ArrowRight from the 15th moves focus to the 16th, which is physically to the LEFT (run). Fix: swap the +/-1 day under rtl so the arrow matches the visual move (APG date grid practice in RTL locales).
6. ui-board-grid arrows. `components/src/controls/board-grid/board-grid.ts:28-29` `ArrowLeft: [0, -1], ArrowRight: [0, 1]` over a CSS grid that mirrors. Quoted line, not run. Fix: negate the column step under rtl.
7. Directional glyphs that do not mirror. `components/src/controls/calendar/calendar.ts:614` `createGlyph('caret-left')` on prev and `:628` `caret-right` on next: in the run the prev button sits at the right with a left-pointing caret, so both carets point inward (`shots/disclosure-calendar-rtl.png`). `components/src/controls/swiper/swiper-paddles.ts:36-37` the same (run: prev paddle at 835 px carries `caret-left`, next at 333 px carries `caret-right`). `components/src/controls/disclosure/disclosure.ts:291` collapsed `caret-right` points away from the text in rtl (run, same shot). Quoted only: `step-flow/step-flow.ts:196`, `:202`, `confirm-receipt/confirm-receipt.ts:212`. No shared mirror rule exists (no `:dir(rtl)` on `ui-glyph`). Fix: one `ui-glyph[symbol^='caret-left'], ui-glyph[symbol^='caret-right'] { &:dir(rtl) { transform: scaleX(-1) } }` rule in `glyph.css` (the `drill.css:188` `:dir(rtl)` glyph precedent), or a `mirror` flag on inline-axis symbols in `glyph-paths.ts`.
8. ui-drill panel slide. `components/src/controls/drill/drill.css:341-348` `translateX(calc(var(--ui-drill-slide-distance) * var(--_drill-dir-sign, 1)))` carries only forward/back, so a forward drill enters from the right in rtl too, against the reading direction. Quoted line, not run. Fix: multiply by a `:dir(rtl)` `-1` token beside `--_drill-dir-sign` (segmented-control precedent).

Proposed ticket (Medium): `rtl-arrows-and-glyphs`, size L2, scope `range-element.ts`, `slider-multi.ts` keys, `calendar.ts`, `board-grid.ts`, `glyph.css` (or `glyph-paths.ts`), `drill.css`, with one RTL browser test per control asserting key direction against the visual move.

### Low

9. ui-rating is physical on every path and documented (`components/src/controls/rating/rating.css:25` "RTL: NO mirroring rule for the fill clip (documented, not fixed"), with `rating.ts:289-295` keys and `value-drag.ts:42` pointer also physical. Consistent, so not broken, but it does not follow the reading direction (`shots/rating-rtl.png`). Fix: mirror the clip `inset()` under `:dir(rtl)` once item 1's `value-drag.ts` inversion lands, plus the item 4 key swap.
10. ui-slider-multi readout reads reversed. `slider-multi.ts:267` builds `` `${lo} – ${hi}` `` and the run renders "60 – 20" in rtl (`shots/slider-multi-rtl.png`). Fix: wrap the readout in `<bdi>` or set `dir="ltr"` on the numeric span if the range should read low to high, or accept it as correct rtl order and document it.
11. `traits/list-reorder.ts:112` `clientX < overRect.left + overRect.width / 2` and `:189-190` ArrowRight as next are physical for `orientation: 'horizontal'`; no shipped control uses the horizontal axis today (grep: no `listReorder` caller passes it), so the defect is latent. Fix: invert both under rtl before the first horizontal consumer.
12. ui-amount-picker `amount-picker.ts:337-342` treats ArrowRight as increment on a `spinbutton`; APG leaves Left/Right optional for spinbuttons, so the impact is small. Fix: drop Left/Right or flip under rtl with item 4.
13. ui-color-picker pad: `color-picker.ts:443` `thumb.style.left` and keys `:539-540` are both physical over a physical canvas, so the pad is consistent and not mirrored; a deliberate choice worth one line in its descriptor.

Proposed ticket (Low): `rtl-low-polish`, size L1, scope `rating.css`/`rating.ts` mirror after the Medium ticket, the slider-multi readout `<bdi>`, the list-reorder horizontal inversion, the amount-picker key choice, and an RTL note in the color-picker descriptor.

## Outcome

2026-10-28 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: 5a4ff7e81424
- Changed: RTL sweep: ranked dir=rtl defects in range controls, overlays, arrows and glyphs with proposed tickets
- Commits: none
- Check: 1 Heading counts (`grep -c '^### High'` prints 1, same for Medium and Low, `grep -cE '^### (High|Me...: pass
- Check: 2 `grep -c '^Proposed ticket'` prints 3: pass
- Check: 3 Each High finding cites a file:line and a run or quoted line, cited lines match base 5a4ff7e81: pass
- Check: 4 No em dash (`grep -c $'\xe2\x80\x94'` prints 0, exit 1): pass
- Check: 5 Read-only outside `.sdlc` (`git status --short -- . ':!.sdlc'` prints nothing): pass
- Follow-up: note: handoff.md: the ## Acceptance criteria block sits inside the Do... -> notes.md
- Follow-up: note: handoff.md Findings item 1 cites slider.css:250 for... -> notes.md
- Follow-up: note: handoff.md item 11 says no listReorder caller passes horizontal... -> notes.md
