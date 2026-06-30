# LLD — UIRangeElement (the Range-class base) + the value-drag controller (slider · slider-multi)

> Component LLD for the control suite (#49 Wave 0). Trace: ADRs + `goals.md §G6.5`. · proposed · 2026-06-30 ·
> planning-lead
>
> **Composes on:** `UIFormElement` (ADR-0013) · the **`value-drag`** controller (NEW) · the widget geometry
> `--ui-compact` + `--ui-widget-inset` (ADR-0041). · **Layer:** base `controls/_base/`; the controller
> `traits/`.

## Intent

`UIRangeElement` is the base for the **Range** class — a track-and-thumb numeric FACE control: `ui-slider`
(one thumb), `ui-slider-multi` (a value-pair). It owns the numeric value model + the ARIA slider semantics +
the track/thumb geometry; the pointer→value mapping is a **separable controller** (`value-drag`) so the
gesture logic is testable and reusable (slider, slider-multi, a future range-field). Base (not trait) because
the numeric value is the host's form identity.

## Components

- **LLD-C1 — the value model.** `min` / `max` / `step` / `value: number` (reflected props; `value` is the form
  value via `formValue()`). `slider-multi` carries `value: [number, number]` (a low/high pair) — the subclass
  widens the value type + the codec. Clamping: `value` is clamped to `[min, max]` and snapped to `step` on every
  set (the base's normalizer).
- **LLD-C2 — ARIA slider.** A scope-owned effect publishes `internals.ariaValueNow/Min/Max` (+ `ariaValueText`
  hook for formatted values) and `internals.role = 'slider'`. slider-multi exposes two foci (two `slider`
  roles, or `aria-valuetext` lo/hi). ARIA over `ElementInternals` (FACE).
- **LLD-C3 — keyboard step.** Arrow ±`step`, PageUp/Down ±`largeStep` (default 10×step), Home/End → min/max;
  the base wires the keydown; a disabled host is inert. Emits `input` (live) + `change` (on commit/blur).
- **LLD-C4 — the value-drag controller (NEW, `traits/value-drag.ts`).** `valueDrag(host, { track, min, max,
  step, onValue })` → cleanup. Wires `pointerdown`→`setPointerCapture`→`pointermove` mapping the pointer's
  position along the **track rect** to a `[min,max]` value (snapped to `step`), calling `onValue(v)`; releases
  on `pointerup`/`lostpointercapture`. Pure gesture→value; no DOM opinion beyond the track rect + the thumb
  position the host paints. Reused by slider + slider-multi (multi binds two thumbs to the nearer-thumb rule).
- **LLD-C5 — the geometry.** The **track** rides `--ui-compact-{size}` (the rail thickness / the thumb box,
  ADR-0041); the **thumb** insets `--ui-widget-inset` (2px) inside the track box (`thumb = box − 2×2px`),
  density-invariant. The fill (lo→value) + the thumb are painted in `.css`; the value→position is a
  `--value-pct` custom property the controller sets.

## Subclass contract

```
class UISliderElement extends UIRangeElement {
  // single thumb; host.use(valueDrag, {track, …, onValue: v => this.value = v}) (LLD-C4)
}
class UISliderMultiElement extends UIRangeElement {
  // value: [lo, hi]; two thumbs, two value-drag bindings; the nearer-thumb-grabs rule; lo ≤ hi invariant
}
```

## Error / edge handling (L5)

- **step / min / max degeneracy:** `min > max` → treat as a zero-length range (value pinned to min, no drag);
  `step ≤ 0` → continuous (no snap); `step` not dividing `(max−min)` → the last reachable value is `≤ max`
  (snap-down), `End` still reaches `max` exactly (the platform `<input type=range>` rule).
- **slider-multi crossing:** dragging `lo` past `hi` (or vice-versa) **clamps at the sibling** (lo ≤ hi held);
  the grabbed thumb stops, it does not swap identity mid-drag.
- **pointer capture loss / pointercancel:** `lostpointercapture`/`pointercancel` ends the drag cleanly
  (commit the last value, fire `change`); no stuck-drag state.
- **disabled:** pointer-inert + keyboard-inert + removed from tab order; `value` holds.
- **Reconnect / zero-residue:** the value-drag controller's listeners are AbortSignal-scoped; reconnect
  re-arms; connect→disconnect leaves zero residue (C10). The `--value-pct` re-applies from the live `value`.

## New-ADR flags

- **NEW ADR — UIRangeElement + the value-drag controller**, proposed: the base + the `value-drag` trait seam
  (the gesture→value contract) + the ARIA slider mapping + the track/2px-inset geometry. Extends ADR-0013 +
  ADR-0041. slider-multi's value-pair + nearer-thumb rule recorded.

## Acceptance (G6.5)

jsdom: value clamp/snap, keyboard step (Arrow/Page/Home/End), ARIA value props, slider-multi lo≤hi. Browser
smoke: the track on `--ui-compact`, the thumb 2px inset, pointer-drag maps position→value (the value-drag
controller, real pointer events), forced-colors. C10 zero-residue + gz marginal.
