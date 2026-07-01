# ADR-0042 — FACE widget value-control bases: the `controls/_base/` layer + UIIndicatorElement + UIRangeElement + the value-drag controller

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-06-30
>
> | Field | Value |
> |---|---|
> | **Status** | accepted — ratified 2026-07-01 on the green G6 gate: the `controls/_base/` layer + `UIIndicatorElement` (as refined at the review gate — clause 2) are proven by 4 G6-done Indicator controls (checkbox/switch/radio + radio-group; browser 240, jsdom 1333). The Range half (`UIRangeElement` + `value-drag`) is unit-tested and control-proven at Wave 2 / G6.5 (ui-slider); the base architecture stands. |
> | **Date** | 2026-06-30 *(authored)* · 2026-07-01 *(ratified)* |
> | **Proposed by** | planning-lead — the design seat, on the control-suite foundation (#49 Wave 0); details in `docs/llds/indicator-element.lld.md` + `range-element.lld.md` |
> | **Ratified by** | orchestration-lead — on the green **G6 / G6.5** gates (when checkbox/switch/radio + slider prove the bases) |
> | **Repairs** | **NEW** `controls/_base/indicator-element.ts` (`UIIndicatorElement`) + `controls/_base/range-element.ts` (`UIRangeElement`) + `traits/value-drag.ts` (the pointer→value controller) + their tests + `controls/_base/index.ts` barrel · `goals.md §G6` (the Indicator-class detail) + `§G6.5` (Range, new) · **establishes the `controls/_base/` shared control-base sub-layer** (sibling of `controls/_surface/`). **Extends ADR-0013** (UIFormElement — the value base both extend) + **ADR-0041** (the widget-box geometry both consume). |
> | **Supersedes / Superseded by** | None — new foundation. **Extends ADR-0013** (↔ extended-by). Relates ADR-0010 (tabbable/disabled), ADR-0006/0012 (anatomy). |

## Context

The Indicator class (`ui-checkbox`/`ui-switch`/`ui-radio`) and the Range class (`ui-slider`/`ui-slider-multi`)
are **value-carrying** FACE controls whose box is a **widget box** (`--ui-compact`, ADR-0041), not the
control-height ramp. Each shares a pattern: extend `UIFormElement` (the FACE value base, ADR-0013), wire shared
traits, and consume the widget geometry. Authoring that pattern once — as **shared control-base classes** — keeps
a leaf control to only its glyph/role/grouping. The bases need to **wire traits** (pressActivation, value-drag),
so they live **above** the traits layer: a new `controls/_base/` sub-layer (controls ← dom + traits, inward-only).

## Decision

1. **NEW `controls/_base/` layer.** A shared control-base sub-layer (like `controls/_surface/`): base classes
   that `extends` a dom base (`UIFormElement`) AND wire traits (`host.use(...)`). Layering-legal — `controls/`
   is the outermost ring; importing dom + traits is inward-only. Leaf controls extend these bases.
2. **`UIIndicatorElement`** (`controls/_base/indicator-element.ts`) — the Indicator base: the SHARED props
   **`{checked, value, size}`** (`size: enum(['sm','md','lg'],'md')`, reflected — a shared widget-box prop), the
   `:state(checked)`/`ariaChecked` machine (internals), the subclass-declared `role`, the `pressActivation`
   toggle, and the `--ui-compact`/`--ui-widget-inset` geometry. **`indeterminate` is checkbox-specific** — it
   lives on `UICheckboxElement`, NOT the base (switch/radio have no tri-state). Motion = **unconditional CSS
   transitions + reduced-motion** (the base does NOT arm `:state(ready)` — no rAF; a `ready` gate is dead in an
   indicator, unlike `ui-button`). Full contract: `indicator-element.lld.md` (LLD-C1..C6).
   *(**G6-review refinement, 2026-06-30** — the decision stands; the base's prop ownership was sharpened at the
   review gate: `size` hoisted UP to the base (switch/radio had `[size]` CSS but no typed prop — a no-op);
   `indeterminate` descended DOWN to checkbox (radio/switch wrongly inherited it); the family motion pattern
   pinned (no ready-gate). checkbox passed G5-done; this corrects switch/radio/radio-group.)*
3. **`UIRangeElement`** (`controls/_base/range-element.ts`) + **the `value-drag` controller**
   (`traits/value-drag.ts`) — the Range base: the props `{value, min, max, step, **size**}` (numeric
   value/min/max/step clamped+snapped; **`size: enum(['sm','md','lg'],'md')` reflected — the SHARED widget-box
   axis, same as UIIndicatorElement, typed on the base so slider/slider-multi inherit it, NOT per-leaf**), the
   `ariaValueNow/Min/Max` slider machine, keyboard step (Arrow/Page/Home/End), and the **separable
   `value-drag` controller** (`valueDrag(host,{track,min,max,step,onValue})` → cleanup) for the pointer→value
   gesture. Full contract: `range-element.lld.md` (LLD-C1..C5); slider-multi's value-pair + nearer-thumb + lo≤hi
   recorded there.
4. **Both consume ADR-0041 geometry + ADR-0013 value.** The box rides `--ui-compact`; a thumbed widget insets
   `--ui-widget-inset` (2px); the value/validity ride `UIFormElement`'s `formValue()`/`formValidity()` hooks.

## Consequences

- **A leaf Indicator/Range control is small** — checkbox = `role` + a checkmark glyph; switch = `role` + a
  2px-inset thumb; slider = `host.use(valueDrag)` + the track `.css`. The shared machine lives once.
- **`controls/_base/` is a reusable seam** — future value-control families (a future segmented/pin) compose it.
- **The `value-drag` controller is testable in isolation** (gesture→value, no DOM opinion) and reused by
  slider + slider-multi.
- **Stale → re-verify (on ratify + build):** the LLDs (the contracts) · the new files + tests + barrel · goals
  §G6/§G6.5 · the widget browser smoke (the box/inset + the toggle/drag).

## Acceptance (the G6/G6.5 control bar, proven by the leaf controls)

`UIIndicatorElement`: a checkbox/switch/radio proves boolean value + checked-state + ARIA + toggle + (radio)
group exclusivity (jsdom) and the `--ui-compact` box + 2px thumb (browser). `UIRangeElement`: a slider proves
value clamp/snap + keyboard step + ARIA slider (jsdom) and the track/inset + pointer-drag→value (browser).
Both: C10 connect→disconnect zero-residue + the gz marginal.

## Alternatives considered

- **Traits instead of base classes** — rejected; a trait can't change the host's value identity (a checkbox's
  `checked` IS the form value). The value-carrying machine is base identity.
- **Put the bases in `dom/` (trait-free, controls wire traits)** — rejected; the bases need to wire the shared
  traits ONCE (DRY); `controls/_base/` (above traits) is the legal, DRY home (the team-lead-approved placement).
- **4 separate primitive ADRs** — folded: Indicator + Range share the `controls/_base/` pattern + UIFormElement
  + widget geometry, so one ADR for the **widget value-control bases** reduces sprawl while staying individually
  supersedable (leg-scoped, like ADR-0007). The overlay/selection infra is the separate ADR-0043.
