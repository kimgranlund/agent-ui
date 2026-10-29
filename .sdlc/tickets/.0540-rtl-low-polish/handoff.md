---
id: T-0540
title: "RTL polish: rating mirror, slider-multi readout, list reorder, amount-picker keys"
type: chore           # feature | bug | chore | spike | idea
status: done
size: L1
priority: P2         # P1 | P2 | P3
depends: [T-0539]
created: 2026-10-28
claimed_by: claude:a8ce3b21 2026-10-29
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 5
---

## Goal
The Low findings below are fixed or explicitly left with a reason.

## Intent
- Do: fix each finding in the Context below using logical CSS properties and direction-aware key handling (read `dir` through the existing helpers or `getComputedStyle(host).direction`, not a hard-coded check); add an RTL browser test per control that compares against the native or LTR behavior and fails on base.
- Non-goals: changing LTR behavior.
- Done when: each new RTL test fails on base and passes after, in Chromium and WebKit through `scripts/gate_lock.py`; the existing LTR tests for the touched controls still pass; `npm run check` exits 0.

## Context
From the T-0536 RTL sweep (#2335):

### Low

9. ui-rating is physical on every path and documented (`components/src/controls/rating/rating.css:25` "RTL: NO mirroring rule for the fill clip (documented, not fixed"), with `rating.ts:289-295` keys and `value-drag.ts:42` pointer also physical. Consistent, so not broken, but it does not follow the reading direction (`shots/rating-rtl.png`). Fix: mirror the clip `inset()` under `:dir(rtl)` once item 1's `value-drag.ts` inversion lands, plus the item 4 key swap.
10. ui-slider-multi readout reads reversed. `slider-multi.ts:267` builds `` `${lo} – ${hi}` `` and the run renders "60 – 20" in rtl (`shots/slider-multi-rtl.png`). Fix: wrap the readout in `<bdi>` or set `dir="ltr"` on the numeric span if the range should read low to high, or accept it as correct rtl order and document it.
11. `traits/list-reorder.ts:112` `clientX < overRect.left + overRect.width / 2` and `:189-190` ArrowRight as next are physical for `orientation: 'horizontal'`; no shipped control uses the horizontal axis today (grep: no `listReorder` caller passes it), so the defect is latent. Fix: invert both under rtl before the first horizontal consumer.
12. ui-amount-picker `amount-picker.ts:337-342` treats ArrowRight as increment on a `spinbutton`; APG leaves Left/Right optional for spinbuttons, so the impact is small. Fix: drop Left/Right or flip under rtl with item 4.
13. ui-color-picker pad: `color-picker.ts:443` `thumb.style.left` and keys `:539-540` are both physical over a physical canvas, so the pad is consistent and not mirrored; a deliberate choice worth one line in its descriptor.

Proposed ticket (Low): `rtl-low-polish`, size L1, scope `rating.css`/`rating.ts` mirror after the Medium ticket, the slider-multi readout `<bdi>`, the list-reorder horizontal inversion, the amount-picker key choice, and an RTL note in the color-picker descriptor.

## Constraints
LTR behavior unchanged. Descriptors updated where they describe keys or geometry. No em dashes.
- Lane: solo because size L1 (steps.py lane)

## Outcome

2026-10-29 · lane: solo L1 · verdict: pass · verifier: verifier-L1 (opus) · base: 3151f49f7878
- Changed: RTL polish: rating, amount-picker and list-reorder follow dir=rtl, and the slider-multi readout and color-picker are documented
- Commits: none
- Check: 1 Each new RTL test fails on base and passes after, in Chromium and WebKit through gate_lock.py: pass
- Check: 2 Existing LTR tests for the touched controls still pass: pass
- Check: 3 `npm run check` exits 0: pass
