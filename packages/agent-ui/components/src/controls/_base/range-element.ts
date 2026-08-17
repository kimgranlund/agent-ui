// range-element.ts — UIRangeElement, the shared base for the Range class (ui-slider · ui-slider-multi).
// range-element.lld.md.
//
// Owns: the numeric value model with clamping/snapping (LLD-C1), the ARIA slider semantics
// (LLD-C2), keyboard step handling (LLD-C3), and the geometry seam — the `--value-pct` custom
// property (LLD-C5). The value-drag controller (LLD-C4) is wired by the leaf subclass from its
// own `connected()`.
//
// Layer: controls/_base/ — imports dom only.
// Inward-only ✓ (controls ← traits ← dom ← reactive).

import { UIFormElement, prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import type { FormValue } from '../../dom/index.ts'

const rangeProps = {
  ...UIFormElement.formProps,
  // LLD-C1: numeric range params. All reflected for attribute-driven construction.
  // prop.number returns PropConfig<number | null>; defaults (0/100/1) mean values are never null in practice.
  min: { ...prop.number(0), reflect: true },
  max: { ...prop.number(100), reflect: true },
  step: { ...prop.number(1), reflect: true },
  value: { ...prop.number(0), reflect: true },
  // ADR-0042 clause-2: the shared widget-box size axis (the track/thumb ride --md-sys-compact-{size}); all
  // Range controls inherit it — typed here, not per-leaf (the same lesson as UIIndicatorElement's size).
  size: { ...prop.enum(['sm', 'md', 'lg'] as const, 'md'), reflect: true },
  // GH #1141 — the accessible-name + visible-label seam. Fleet survey (cited in full on the issue's
  // Findings): text-field/select DO own a `label` prop (TKT-0069 item 2: reflects fleet-wide) that is
  // ElementInternals-linked — but for THOSE controls it is an aria-only stand-in, the VISIBLE label is
  // exclusively `ui-field`'s job (a column wrapper: label / control / description / error, stacked). That
  // composition cannot express this control's required layouts (`inline`'s single ROW, `block`'s centred-
  // UNDER-the-rail placement) — ui-field is a fixed vertical column, never a row partner. The closer
  // precedent is `ui-badge`'s `label` prop, which DOES render its own visible `[data-part='label']` text
  // node from the prop (badge.ts) in addition to being the accessible name — Range-class controls follow
  // THAT branch: `label` is both `internals.ariaLabel` (empty ⇒ no accessible name minted, the icon/progress/
  // ramp/ladder precedent) AND the visibly-rendered, layout-positioned label part (own props, ElementInternals-
  // linked — Ruling 3's first branch). Shared here (not per-leaf) since both Range leaves need it identically.
  label: { ...prop.string(), reflect: true },
  // GH #1141 — the layout enum selecting label/value placement relative to the rail: `standard` (label
  // top-left, value top-right, one row above the rail) · `inline` (label/rail/value all one row, rail
  // flexing) · `block` (label centred above, value centred below). Literal union, never `enum`
  // (erasableSyntaxOnly). Shared on the base so ui-slider and ui-slider-multi get byte-identical layouts
  // (Ruling 4).
  layout: { ...prop.enum(['standard', 'inline', 'block'] as const, 'standard'), reflect: true },
} satisfies PropsSchema

export interface UIRangeElement extends ReactiveProps<typeof rangeProps> {}
export class UIRangeElement extends UIFormElement {
  static props = rangeProps

  // LLD-C3: the value at focus — committed baseline for `change` event emission on blur.
  // Reset at connect so a reconnect without an intervening focus cannot fire a stale `change`.
  #committed: number | null = null

  /**
   * LLD-C1: normalise a raw value against the current min/max/step.
   * - min > max → zero-length range; pin to min.
   * - step ≤ 0 → continuous; clamp only, no snap.
   * - step not dividing (max−min) → last reachable step is ≤ max (snap-down);
   *   max itself is always reachable exactly (the platform `<input type=range>` End rule).
   */
  #normalize(raw: number): number {
    const min = this.min ?? 0
    const max = this.max ?? 100
    const step = this.step ?? 1
    if (min > max) return min
    const clamped = Math.max(min, Math.min(max, raw))
    if (step <= 0) return clamped
    // max is always reachable exactly — End → max, and clamping to max lands here too.
    if (clamped === max) return max
    const steps = Math.round((clamped - min) / step)
    const snapped = min + steps * step
    // snap-down if snapped overshoots max
    return snapped > max ? min + (steps - 1) * step : snapped
  }

  /** LLD-C5: percentage position of value along [min, max] for the `--value-pct` geometry seam. */
  #valuePct(value: number): number {
    const min = this.min ?? 0
    const max = this.max ?? 100
    if (min >= max) return 0
    return ((value - min) / (max - min)) * 100
  }

  /**
   * LLD-C1: the normalised value serialised as the form-submitted string.
   * The base normalises before serialising so the form entry always reflects the clamped+snapped value.
   */
  protected override formValue(): FormValue {
    return String(this.#normalize(this.value ?? 0))
  }

  /**
   * LLD-C2: hook for `internals.ariaValueText`. Override to return a locale-formatted value string
   * (e.g. `"$12.00"`). The base returns `String(value)`. Named `valueText` (not `ariaValueText`) to
   * avoid shadowing the `ARIAMixin.ariaValueText` DOM property.
   */
  protected valueText(value: number): string {
    return String(value)
  }

  protected connected(): void {
    // Reset the committed baseline so a reconnect without a focus cannot fire a stale `change`.
    this.#committed = null

    // LLD-C2: role is structural, not data-driven; set once here rather than inside an effect.
    this.internals.role = 'slider'

    // GH #1141 — the `label` prop IS the accessible name when non-empty (the icon/progress/ramp/ladder
    // precedent: `internals.ariaLabel = label || null`, empty ⇒ no accessible name minted, leaving the
    // author-supplied aria-label/aria-labelledby fallback in force, byte-identical prior behavior).
    // GH #1153 — hoisted ABOVE the `ownsValueModel()` gate below: accessible-name wiring is model-agnostic
    // (it has nothing to do with how many values the control carries), so every Range leaf gets exactly
    // ONE copy of this effect. Before GH #1153, UISliderMultiElement skipped `super.connected()` wholesale
    // and re-declared this exact line itself to get it — this hoist is what let that duplicate be deleted.
    this.effect(() => {
      this.internals.ariaLabel = this.label || null
    })

    // GH #1153 — a leaf that WIDENS the value model (UISliderMultiElement's `valueLo`/`valueHi` pair)
    // owns an equivalent — but not identical — copy of every effect/listener below, keyed off its own
    // props, so the base's single-`value` versions must never run alongside them: the keyboard listener
    // would fire a SECOND, spurious `input` on every arrow-key step (this leaf's own listener already
    // emits one), and the ARIA effect would stamp aria-valuenow/min/max/text — single-slider semantics —
    // onto a host whose `internals.role` such a leaf sets to 'group', not 'slider'. `ownsValueModel()` is
    // the subclass hook that draws the line; override to `false` to opt out of everything below this point.
    if (!this.ownsValueModel()) return

    // LLD-C1: normaliser effect — keeps value clamped + snapped on every change to value/min/max/step.
    // The kernel's Object.is cutoff means no signal update + no re-run when the value is already normal.
    this.effect(() => {
      const raw = this.value ?? 0
      const normalized = this.#normalize(raw)
      if (!Object.is(normalized, raw)) this.value = normalized
    })

    // LLD-C2: ARIA effect — publishes ariaValueNow/Min/Max/Text reactively, tracking all four props.
    this.effect(() => {
      const value = this.#normalize(this.value ?? 0)
      this.internals.ariaValueNow = String(value)
      this.internals.ariaValueMin = String(this.min ?? 0)
      this.internals.ariaValueMax = String(this.max ?? 100)
      this.internals.ariaValueText = this.valueText(value)
    })

    // LLD-C5: geometry seam — `--value-pct` on the host style so the subclass CSS can paint the fill
    // and position the thumb without needing to import any JS from this base.
    this.effect(() => {
      const value = this.#normalize(this.value ?? 0)
      this.style.setProperty('--value-pct', String(this.#valuePct(value)))
    })

    // LLD-C3: keyboard step — Arrow ±step, PageUp/Down ±largeStep (10×step), Home/End → min/max.
    // Disabled host is inert (effectiveDisabled covers own + fieldset/form disabled).
    // Each live step emits `input`; `change` is emitted on blur when value moved (below).
    this.listen(this, 'keydown', (event) => {
      if (this.effectiveDisabled()) return
      const e = event as KeyboardEvent
      const min = this.min ?? 0
      const max = this.max ?? 100
      const step = this.step ?? 1
      const largeStep = step * 10
      const current = this.#normalize(this.value ?? 0)
      let next: number | null = null

      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowUp':
          next = this.#normalize(current + step)
          break
        case 'ArrowLeft':
        case 'ArrowDown':
          next = this.#normalize(current - step)
          break
        case 'PageUp':
          next = this.#normalize(current + largeStep)
          break
        case 'PageDown':
          next = this.#normalize(current - largeStep)
          break
        case 'Home':
          next = min
          break
        case 'End':
          next = max // End reaches max exactly (platform rule, matches the normaliser's max fast-path)
          break
        default:
          return
      }

      e.preventDefault()
      if (!Object.is(next, current)) {
        this.value = next
        this.emit('input')
      }
    })

    // LLD-C3: change on commit — track value at focus; emit `change` on blur when value has moved.
    this.listen(this, 'focus', () => {
      this.#committed = this.#normalize(this.value ?? 0)
    })

    this.listen(this, 'blur', () => {
      const current = this.#normalize(this.value ?? 0)
      if (this.#committed !== null && !Object.is(current, this.#committed)) {
        this.emit('change')
      }
      this.#committed = null
    })
  }

  /**
   * GH #1153 subclass hook (LLD-C1/C2/C3/C5): `true` (default) when this leaf uses the base's single
   * `value` prop directly — the normaliser, ARIA value* effect, `--value-pct` geometry seam, keyboard
   * step, and focus/blur commit-on-change all key off it. A leaf that WIDENS the value model (e.g.
   * UISliderMultiElement's `valueLo`/`valueHi` pair) overrides this to `false` and re-implements the
   * equivalent wiring itself against its own props — the base's copy would otherwise run in parallel
   * against the same DOM/ARIA surface and corrupt it (see the call site in `connected()` above).
   */
  protected ownsValueModel(): boolean {
    return true
  }
}
