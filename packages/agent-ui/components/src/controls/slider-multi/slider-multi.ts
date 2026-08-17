// slider-multi.ts — UISliderMultiElement, the dual-thumb Range-class control (decomp S2 · ADR-0042 · ADR-0041).
// Light-DOM FACE form control — extends UIRangeElement which owns: min/max/step/size/formProps; this leaf
// WIDENS the value model to a [lo, hi] pair (its own valueLo/valueHi props + formValue() override), provides
// two light-DOM thumb elements (each a focusable div[role=slider]), wires TWO valueDrag bindings (one per
// thumb), and enforces the lo ≤ hi invariant in all write paths.
//
// Architecture decisions:
//   • Value model: `valueLo` / `valueHi` props replace the base's single `value` prop (base `value` is NOT
//     re-declared here; the base's normaliser + ARIA + geometry effects are NOT invoked — no super.connected()).
//   • Nearer-thumb-grabs: a `pointerdown` listener registered BEFORE both valueDrag bindings sets the
//     `#activeThumb` gate ('lo' or 'hi'); each valueDrag binding's `track()` returns null unless it owns the
//     current active thumb → only the correct binding captures the pointer.
//   • lo ≤ hi invariant: enforced in THREE places: (a) the normalization effect clamps after snap; (b)
//     valueDrag's onValue clamps against the sibling; (c) keyboard steps at the sibling boundary clamp.
//   • ARIA: host role='group'; each thumb div carries role="slider" + aria-value* attributes set reactively.
//   • Light DOM: `.rail > (.fill + .thumb[data-thumb=lo] + .thumb[data-thumb=hi])` created once on first
//     connect; reconnect finds the DOM already present (reconnect guard).
//   • Cleanup: valueDrag cleanup functions stored + called in `disconnected()` (idempotent double-release safe).
//
// Zero-dep; controls → dom+traits inward only (✓); erasableSyntaxOnly ✓ (no enum/decorator).

import { prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import type { FormValue } from '../../dom/index.ts'
import { UIRangeElement, RANGE_READOUT_HIDE_MS } from '../_base/index.ts'
import { valueDrag } from '../../traits/value-drag.ts'

// The pair value model (LLD-C1 widened): spread UIRangeElement.props (which includes the shared min/max/step/
// value/size/formProps) and ADD valueLo/valueHi. The base's single `value` prop is kept in the spread for
// TypeScript static-side compatibility (the subclass's static props must structurally extend the base's);
// we do NOT call super.connected(), so the base's normaliser/ARIA/geometry/keyboard effects on `value` are
// never activated — `value` is an inherited prop that slider-multi does not actively use.
// Each class must redeclare all its props (no static-props prototype inheritance — UIFormElement.formProps note).
const sliderMultiProps = {
  ...UIRangeElement.props,                                                   // min · max · step · value · size · formProps
  valueLo: { ...prop.number(0),   reflect: true, attribute: 'value-lo' },   // low bound; HTML attribute = value-lo (kebab)
  valueHi: { ...prop.number(100), reflect: true, attribute: 'value-hi' },   // high bound; HTML attribute = value-hi (kebab)
} satisfies PropsSchema

export interface UISliderMultiElement extends ReactiveProps<typeof sliderMultiProps> {}
export class UISliderMultiElement extends UIRangeElement {
  static override props = sliderMultiProps

  // Light-DOM element refs — created once on first connect; null until then.
  // NOTE: #fill is not stored — the fill div is position-driven by CSS custom properties alone; the JS
  // geometry seam writes --value-pct-lo/hi on the host and CSS computes fill geometry from those.
  #rail: HTMLElement | null = null
  #loThumb: HTMLElement | null = null
  #hiThumb: HTMLElement | null = null

  // GH #1126 — the live value readout (design choice: label-end STATIC overlay, matching ui-slider's;
  // see slider.md's "Value readout" section, the shared rationale). A host-level child (NOT inside
  // `.rail`, so it never competes with `.rail`'s flex:1 for width) — `position: absolute` in
  // slider-multi.css keeps it out of the flex flow entirely.
  #valueEl: HTMLElement | null = null
  #hideTimer: ReturnType<typeof setTimeout> | undefined

  // Nearer-thumb gate: set by the pointerdown picker BEFORE both valueDrag listeners fire.
  // 'lo' / 'hi' tells the correct binding's track() to return the rail; the other returns null.
  #activeThumb: 'lo' | 'hi' | null = null

  // valueDrag cleanup functions (stored for explicit release in disconnected() and test idempotency proof).
  #releaseLoBinding: (() => void) | null = null
  #releaseHiBinding: (() => void) | null = null

  // Focus-time baseline for `change` emission on blur/focusout.
  #committedLo: number | null = null
  #committedHi: number | null = null

  /** LLD-C1: normalise a raw number against min/max/step (same algorithm as the base; redeclared here since
   *  the base's normaliser is #private and we do not call super.connected()). */
  #normalize(raw: number): number {
    const min = this.min ?? 0
    const max = this.max ?? 100
    const step = this.step ?? 1
    if (min > max) return min                                      // degenerate — zero-length range
    const clamped = Math.max(min, Math.min(max, raw))
    if (step <= 0) return clamped                                  // continuous — no snap
    if (clamped === max) return max                                // max always reachable (End rule)
    const steps = Math.round((clamped - min) / step)
    const snapped = min + steps * step
    return snapped > max ? min + (steps - 1) * step : snapped     // snap-down if over max
  }

  /** LLD-C5: percentage position of a value along [min, max] — maps to --value-pct-lo / --value-pct-hi. */
  #valuePct(value: number): number {
    const min = this.min ?? 0
    const max = this.max ?? 100
    if (min >= max) return 0
    return ((value - min) / (max - min)) * 100
  }

  /**
   * LLD-C1: the [lo, hi] form value submitted to the owning form. Submitted as FormData with two
   * entries keyed by the control's `name` (the standard multi-value form-data shape).
   */
  protected override formValue(): FormValue {
    const lo = this.#normalize(this.valueLo ?? 0)
    const hi = this.#normalize(this.valueHi ?? 100)
    const fd = new FormData()
    const name = this.name || ''
    fd.append(name, String(lo))
    fd.append(name, String(hi))
    return fd
  }

  /** Restore to the declared prop defaults on form reset (low = 0, high = 100). */
  protected override formReset(): void {
    this.valueLo = 0
    this.valueHi = 100
  }

  /** Build the light-DOM structure on first connect (reconnect guard: no-op if already built). */
  #buildDOM(): void {
    if (this.#rail) return  // already built — reconnect case

    const rail = document.createElement('div')
    rail.className = 'rail'

    const fill = document.createElement('div')
    fill.className = 'fill'
    fill.setAttribute('aria-hidden', 'true')  // decorative; the aria-value* on the thumbs carry semantics

    const loThumb = document.createElement('div')
    loThumb.className = 'thumb'
    loThumb.setAttribute('data-thumb', 'lo')
    loThumb.setAttribute('role', 'slider')
    loThumb.setAttribute('tabindex', '0')
    loThumb.setAttribute('aria-label', 'Low value')

    const hiThumb = document.createElement('div')
    hiThumb.className = 'thumb'
    hiThumb.setAttribute('data-thumb', 'hi')
    hiThumb.setAttribute('role', 'slider')
    hiThumb.setAttribute('tabindex', '0')
    hiThumb.setAttribute('aria-label', 'High value')

    rail.append(fill, loThumb, hiThumb)

    // GH #1126: the value readout — a host-level sibling of `rail` (not a rail child), so `position:
    // absolute` (slider-multi.css) removes it from the flex flow without ever touching `.rail`'s own
    // flex:1 width math (untouched — the ADR-0041/LLD-C5 geometry this feature must not perturb).
    const value = document.createElement('span')
    value.setAttribute('data-part', 'value')
    value.setAttribute('aria-hidden', 'true')
    value.hidden = true

    this.append(rail, value)

    this.#rail = rail
    this.#loThumb = loThumb
    this.#hiThumb = hiThumb
    this.#valueEl = value
  }

  protected connected(): void {
    // LLD-C2: host role='group' (two-slider composite — a group element contains the two slider foci).
    // The individual thumbs each carry role='slider' via HTML attributes (light-DOM children, not the host).
    this.internals.role = 'group'

    // Reset the committed baseline (prevent a stale baseline from a previous connect firing a spurious change).
    this.#committedLo = null
    this.#committedHi = null

    // Build light DOM structure once (subsequent reconnects find it already present).
    this.#buildDOM()

    // ── LLD-C1: normalization effect ──────────────────────────────────────────────────────────────────
    // Clamp + snap BOTH values and enforce lo ≤ hi in a single combined effect. Reads four signals
    // (valueLo, valueHi, min, max, step), so it re-runs whenever any of them changes. The Object.is
    // cutoff prevents redundant writes when values are already normalised (no infinite loop).
    this.effect(() => {
      const lo = this.#normalize(this.valueLo ?? 0)
      const hi = this.#normalize(this.valueHi ?? 100)
      const clampedLo = Math.min(lo, hi)     // lo ≤ hi invariant: lo cannot exceed hi
      const clampedHi = Math.max(lo, hi)     // hi ≥ lo invariant: hi cannot go below lo
      if (!Object.is(clampedLo, this.valueLo ?? 0)) this.valueLo = clampedLo
      if (!Object.is(clampedHi, this.valueHi ?? 100)) this.valueHi = clampedHi
    })

    // ── LLD-C2: ARIA effect — lo thumb ────────────────────────────────────────────────────────────────
    // The lo thumb's aria-valuenow/min/max: its max is constrained to the current hi value (not the
    // range max) so a screen reader user understands the lo thumb cannot exceed hi.
    this.effect(() => {
      const lo = this.#normalize(this.valueLo ?? 0)
      const hi = this.#normalize(this.valueHi ?? 100)
      const clampedLo = Math.min(lo, hi)
      this.#loThumb?.setAttribute('aria-valuenow', String(clampedLo))
      this.#loThumb?.setAttribute('aria-valuemin', String(this.min ?? 0))
      this.#loThumb?.setAttribute('aria-valuemax', String(hi))
      this.#loThumb?.setAttribute('aria-valuetext', String(clampedLo))
    })

    // ── LLD-C2: ARIA effect — hi thumb ────────────────────────────────────────────────────────────────
    // The hi thumb's aria-valuenow/min/max: its min is constrained to the current lo value.
    this.effect(() => {
      const lo = this.#normalize(this.valueLo ?? 0)
      const hi = this.#normalize(this.valueHi ?? 100)
      const clampedHi = Math.max(lo, hi)
      this.#hiThumb?.setAttribute('aria-valuenow', String(clampedHi))
      this.#hiThumb?.setAttribute('aria-valuemin', String(lo))
      this.#hiThumb?.setAttribute('aria-valuemax', String(this.max ?? 100))
      this.#hiThumb?.setAttribute('aria-valuetext', String(clampedHi))
    })

    // ── LLD-C5: geometry seam — --value-pct-lo / --value-pct-hi ──────────────────────────────────────
    // CSS consumes these to position the fill and both thumbs. Values are dimensionless numbers
    // (0–100) that the CSS multiplies by 1% (e.g. `left: calc(var(--value-pct-lo) * 1%)`).
    this.effect(() => {
      const lo = this.#normalize(this.valueLo ?? 0)
      const hi = this.#normalize(this.valueHi ?? 100)
      const clampedLo = Math.min(lo, hi)
      const clampedHi = Math.max(lo, hi)
      this.style.setProperty('--value-pct-lo', String(this.#valuePct(clampedLo)))
      this.style.setProperty('--value-pct-hi', String(this.#valuePct(clampedHi)))
    })

    // ── GH #1126: value readout text — kept fresh even while hidden ──────────────────────────────────
    // Multi shows BOTH values ("lo – hi"), each formatted via the inherited `valueText()` hook (the same
    // one the base's ARIA effect would use — default String(value); an override formats both ends
    // identically). Visibility is driven separately (below) by the interaction, not this effect.
    this.effect(() => {
      const lo = Math.min(this.#normalize(this.valueLo ?? 0), this.#normalize(this.valueHi ?? 100))
      const hi = Math.max(this.#normalize(this.valueLo ?? 0), this.#normalize(this.valueHi ?? 100))
      if (this.#valueEl) this.#valueEl.textContent = `${this.valueText(lo)} – ${this.valueText(hi)}`
    })

    // ── Disabled state: thumb tabindex + aria-disabled ────────────────────────────────────────────────
    // Disabled removes the tabindex ATTRIBUTE entirely (not tabindex='-1') — the fleet dialect ruled in
    // TKT-0068 item 2: native-parity, a disabled part is not even programmatically focusable (the
    // textarea/text-field/combo-box editor shape).
    this.effect(() => {
      const disabled = this.effectiveDisabled()
      if (disabled) {
        this.#loThumb?.removeAttribute('tabindex')
        this.#hiThumb?.removeAttribute('tabindex')
      } else {
        this.#loThumb?.setAttribute('tabindex', '0')
        this.#hiThumb?.setAttribute('tabindex', '0')
      }
      this.#loThumb?.setAttribute('aria-disabled', String(disabled))
      this.#hiThumb?.setAttribute('aria-disabled', String(disabled))
    })

    // ── LLD-C4: nearer-thumb picker — must register BEFORE both valueDrag bindings ──────────────────
    // On pointerdown, determine which thumb the pointer is closer to (by percentage position along the
    // rail). Sets #activeThumb so the correct valueDrag binding's track() returns the rail (the other
    // returns null). Also focuses the selected thumb for keyboard accessibility post-click.
    this.listen(this, 'pointerdown', (event) => {
      if (this.effectiveDisabled()) return
      const rail = this.#rail
      if (!rail) return
      const pe = event as PointerEvent
      const rect = rail.getBoundingClientRect()
      const ratio = rect.width > 0
        ? Math.max(0, Math.min(1, (pe.clientX - rect.left) / rect.width))
        : 0
      const loPct = this.#valuePct(this.#normalize(this.valueLo ?? 0)) / 100
      const hiPct = this.#valuePct(this.#normalize(this.valueHi ?? 100)) / 100
      const distLo = Math.abs(ratio - loPct)
      const distHi = Math.abs(ratio - hiPct)
      // When equidistant (thumbs coincide at same value), prefer lo so they can be separated.
      this.#activeThumb = distLo <= distHi ? 'lo' : 'hi'
      if (this.#activeThumb === 'lo') this.#loThumb?.focus()
      else this.#hiThumb?.focus()
    })

    // ── LLD-C4: two valueDrag bindings (one per thumb) ────────────────────────────────────────────────
    // Each binding's track() accessor returns the rail ONLY when its thumb was selected by the
    // nearer-thumb picker above (#activeThumb gate). The onValue callback enforces lo ≤ hi before writing
    // (the thumb cannot drag past its sibling — clamped at the sibling's current value).

    this.#releaseLoBinding = valueDrag(this, {
      track: () => this.#activeThumb === 'lo' ? this.#rail : null,
      min:   () => this.min  ?? 0,
      max:   () => this.max  ?? 100,
      step:  () => this.step ?? 1,
      onValue: (v) => {
        // lo ≤ hi: clamp lo at hi so the lo thumb cannot cross past the hi thumb.
        const hi = this.#normalize(this.valueHi ?? 100)
        this.valueLo = Math.min(v, hi)
        this.emit('input')
      },
    })

    this.#releaseHiBinding = valueDrag(this, {
      track: () => this.#activeThumb === 'hi' ? this.#rail : null,
      min:   () => this.min  ?? 0,
      max:   () => this.max  ?? 100,
      step:  () => this.step ?? 1,
      onValue: (v) => {
        // lo ≤ hi: clamp hi at lo so the hi thumb cannot cross past the lo thumb.
        const lo = this.#normalize(this.valueLo ?? 0)
        this.valueHi = Math.max(v, lo)
        this.emit('input')
      },
    })

    // ── LLD-C3: keyboard step ─────────────────────────────────────────────────────────────────────────
    // Arrow ±step, PageUp/Down ±10×step, Home/End → boundary (matching the base's step schema).
    // The event.target determines WHICH thumb receives the step; disabled host is inert.
    // For lo: End clamps to hi (not max); for hi: Home clamps to lo (not min) — the lo ≤ hi invariant.
    this.listen(this, 'keydown', (event) => {
      if (this.effectiveDisabled()) return
      const e = event as KeyboardEvent
      const isLo = e.target === this.#loThumb
      const isHi = e.target === this.#hiThumb
      if (!isLo && !isHi) return

      const min  = this.min  ?? 0
      const max  = this.max  ?? 100
      const step = this.step ?? 1
      const largeStep = step * 10

      if (isLo) {
        const current = this.#normalize(this.valueLo ?? 0)
        const hi      = this.#normalize(this.valueHi ?? 100)
        let next: number | null = null
        switch (e.key) {
          case 'ArrowRight': case 'ArrowUp':   next = this.#normalize(current + step);      break
          case 'ArrowLeft':  case 'ArrowDown':  next = this.#normalize(current - step);      break
          case 'PageUp':                        next = this.#normalize(current + largeStep);  break
          case 'PageDown':                      next = this.#normalize(current - largeStep);  break
          case 'Home':                          next = min;                                   break
          case 'End':                           next = hi;  break  // lo End → the hi value (not max)
          default: return
        }
        // lo ≤ hi: a step that would push lo past hi clamps at hi.
        next = Math.min(next, hi)
        e.preventDefault()
        if (!Object.is(next, current)) { this.valueLo = next; this.emit('input') }

      } else {  // isHi
        const lo      = this.#normalize(this.valueLo ?? 0)
        const current = this.#normalize(this.valueHi ?? 100)
        let next: number | null = null
        switch (e.key) {
          case 'ArrowRight': case 'ArrowUp':   next = this.#normalize(current + step);      break
          case 'ArrowLeft':  case 'ArrowDown':  next = this.#normalize(current - step);      break
          case 'PageUp':                        next = this.#normalize(current + largeStep);  break
          case 'PageDown':                      next = this.#normalize(current - largeStep);  break
          case 'Home':                          next = lo;  break  // hi Home → the lo value (not min)
          case 'End':                           next = max;                                   break
          default: return
        }
        // lo ≤ hi: a step that would push hi below lo clamps at lo.
        next = Math.max(next, lo)
        e.preventDefault()
        if (!Object.is(next, current)) { this.valueHi = next; this.emit('input') }
      }
    })

    // ── LLD-C3: change event on blur ──────────────────────────────────────────────────────────────────
    // Track both values at focus (focusin bubbles from either thumb); emit `change` on focusout if either
    // value moved since the baseline. focusin/focusout bubble (unlike focus/blur), so no capture needed.
    this.listen(this, 'focusin', () => {
      this.#committedLo = this.#normalize(this.valueLo ?? 0)
      this.#committedHi = this.#normalize(this.valueHi ?? 100)
    })

    this.listen(this, 'focusout', () => {
      const lo = this.#normalize(this.valueLo ?? 0)
      const hi = this.#normalize(this.valueHi ?? 100)
      const loMoved = this.#committedLo !== null && !Object.is(lo, this.#committedLo)
      const hiMoved = this.#committedHi !== null && !Object.is(hi, this.#committedHi)
      if (loMoved || hiMoved) this.emit('change')
      this.#committedLo = null
      this.#committedHi = null
    })

    // ── GH #1126: value readout arm/hide ──────────────────────────────────────────────────────────────
    // `input` fires on every live change from BOTH sources (keyboard step above and each valueDrag
    // onValue below) — one listener covers both. `focusout` hides immediately (a separate listener from
    // the change-commit one above; DOM permits multiple listeners per event type).
    this.listen(this, 'input', () => this.#armReadout())
    this.listen(this, 'focusout', (event) => {
      // Tabbing lo→hi keeps focus INSIDE the control — hiding then re-showing on the next arrow would
      // flash the readout (checker finding). Hide only when focus truly leaves the host.
      const to = (event as FocusEvent).relatedTarget
      if (to instanceof Node && this.contains(to)) return
      this.#hideReadoutNow()
    })
  }

  protected override disconnected(): void {
    // Explicitly release both valueDrag bindings so their closures are marked released (the connection
    // AbortController removes the outer pointerdown listeners, but `released = true` is a belt-and-
    // suspenders guard against any edge case where the outer listener fires after abort). Idempotent:
    // calling the cleanup twice sets `released = true` twice — no throw, no state corruption.
    this.#releaseLoBinding?.()
    this.#releaseHiBinding?.()
    this.#releaseLoBinding = null
    this.#releaseHiBinding = null
    this.#activeThumb = null

    // GH #1126: drop any pending hide timer — zero-residue (C10), matching the bindings above; and hide
    // the readout itself so a disconnect mid-scrub cannot reconnect stuck-visible (checker finding).
    if (this.#hideTimer !== undefined) {
      clearTimeout(this.#hideTimer)
      this.#hideTimer = undefined
    }
    if (this.#valueEl) this.#valueEl.hidden = true
  }

  /** GH #1126: show the readout and (re)arm its auto-hide timer — called on every live `input`. */
  #armReadout(): void {
    if (!this.#valueEl) return
    this.#valueEl.hidden = false
    if (this.#hideTimer !== undefined) clearTimeout(this.#hideTimer)
    this.#hideTimer = setTimeout(() => {
      if (this.#valueEl) this.#valueEl.hidden = true
      this.#hideTimer = undefined
    }, RANGE_READOUT_HIDE_MS)
  }

  /** GH #1126: hide the readout immediately (focusout) and cancel any pending timer. */
  #hideReadoutNow(): void {
    if (this.#hideTimer !== undefined) {
      clearTimeout(this.#hideTimer)
      this.#hideTimer = undefined
    }
    if (this.#valueEl) this.#valueEl.hidden = true
  }

  // ── protected test seams ─────────────────────────────────────────────────────────────────────────────
  // These are the minimal seams the test suite drives (idempotency proof, internals access, formValue).

  /** Expose the protected `internals` for test probes that need to read ariaValueText / role / states. */
  protected get internalsSeam(): ElementInternals { return this.internals }

  /** Expose the valueDrag cleanup pair for idempotency proof (C10 zero-residue; call twice, no throw). */
  protected get loBinding(): (() => void) | null { return this.#releaseLoBinding }
  protected get hiBinding(): (() => void) | null { return this.#releaseHiBinding }

  /** Expose formValue() for direct testing (the cast removes the `protected` guard). */
  protected formValueSeam(): FormValue {
    return (this as unknown as { formValue(): FormValue }).formValue.call(this)
  }
}

if (!customElements.get('ui-slider-multi')) {
  customElements.define('ui-slider-multi', UISliderMultiElement)
}
