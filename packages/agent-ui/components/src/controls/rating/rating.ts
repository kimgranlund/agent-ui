// rating.ts — UIRatingElement, the Indicator-class star-value Range control (ADR-0216; range-element.lld.md;
// GH #1395). Extends UIRangeElement — inherits min/max/step/value/size/label/layout/name/disabled/required
// (the Slider row's shape) — and adds ONE new leaf prop, `readonly` (ADR-0216 cl.4/cl.5: the base declares
// none, `readonly` is per-leaf today — text-field.ts/textarea.ts's precedent).
//
// ADR-0216 clause 2 (the codec): `max` defaults to 5 (not the base's 100 — a 0–100 slider default would
// misrepresent a star scale); `step` keeps the base's default 1 (`0.5` opts a consumer into halves). Display
// renders the fraction-ACCURATE value (`value/max` clip, regardless of `step`); only the WRITE path (keyboard/
// pointer) quantizes to `step` — the shared normaliser below is used by both.
//
// ADR-0216 clause 3 (the mark): an OWNED inline-SVG star row, `currentColor` ink — a low-alpha BASE row of
// `max` stars stacked under a full-ink FILL row of the same `max` stars, the fill row clipped via
// `clip-path: inset()` to `value/max` of its own width (rating.css). No icons-pack dependency (ADR-0065/0066's
// `resolveIcon` degrades to an EMPTY svg on a pack-less consumer — unacceptable for a control whose mark IS
// its entire information content). One glyph, fraction-accurate at any size — no `star-half` variant needed.
//
// ADR-0216 clause 4 (input semantics ride UIRangeElement, but the write path needs a NEW gate `readonly`
// does not exist on): `ownsValueModel()` is overridden to `false` so the base's own single-`value`
// normaliser/ARIA-value/geometry/keyboard/focus-blur effects (range-element.ts) never activate — this leaf
// re-implements each (the UISliderMultiElement precedent for a leaf that needs materially different write-
// path semantics), adding a `this.readonly` short-circuit to the keyboard listener and the valueDrag
// `onValue` callback that the base's copies have no hook for. Pointer pick reuses the shared `valueDrag`
// trait unmodified — a click position along the star ROW maps to a snapped value exactly as it does along a
// slider rail (clicking near star *k* lands near `k·step`), so no bespoke "which star" hit-testing is needed.
//
// ADR-0216 Amendment 1 (2026-08-20, Kim ruling; GH #1438): commit-timing splits by INPUT MODALITY, the
// same two-path shape native `<input type=range>` has. POINTER: a star picked by pointer commits
// immediately — `change` fires on `pointerup` (the `input`→`value` commit already lands synchronously
// via valueDrag's `onValue`; only the `change` NOTIFICATION moves earlier). KEYBOARD: unchanged base
// range law — arrow-step fires `input`, `change` waits for blur. The catalog's
// `value: { prop: 'value', event: 'change' }` mark is unaffected either way (commit still strictly
// precedes the event on both paths — Fork-T1/D1-safe, PR #1363's discipline).
//
// `super.connected()` IS called (GH #1153 precedent) — it still supplies: the committed-baseline reset
// (unused here; this leaf owns its own `#committed`), `internals.role = 'slider'`, and the model-agnostic
// `label` → `internals.ariaLabel` effect.
//
// Zero-dep; controls → dom+traits inward only (✓); erasableSyntaxOnly ✓ (no enum/decorator).

import { prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import type { FormValue } from '../../dom/index.ts'
import { UIRangeElement } from '../_base/index.ts'
import { tabbable } from '../../traits/tabbable.ts'
import { valueDrag } from '../../traits/value-drag.ts'

const SVG_NS = 'http://www.w3.org/2000/svg'

// The owned star path (24×24 viewBox, five-point star) — hand-rolled coordinates, not an icons-pack glyph
// (ADR-0216 cl.3). Reused for every star in both rows.
const STAR_PATH = 'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z'

const ratingProps = {
  ...UIRangeElement.props, // min · max · step · value · size · label · layout · name · disabled · required
  // ADR-0216 cl.2 — a star scale, not a percentage: max defaults to 5 (min stays the base's 0 default,
  // unexposed as a meaningful axis but left settable — the slider-multi valueLo/valueHi precedent of an
  // inherited prop staying in the spread for structural reasons).
  max: { ...prop.number(5), reflect: true },
  // ADR-0216 cl.4/cl.5 — the write-path inert switch (a NEW leaf prop; the base declares none). Default
  // false — input-parity with every shipped form row (Slider/Checkbox default interactive); a bound
  // aggregate score pairs with `readonly: true` explicitly (the display-case idiom, cl.5).
  readonly: { ...prop.boolean(false), reflect: true },
} satisfies PropsSchema

export interface UIRatingElement extends ReactiveProps<typeof ratingProps> {}
export class UIRatingElement extends UIRangeElement {
  static props = ratingProps

  // LLD-C2-equivalent subclass contract: the role this leaf carries (the base hardcodes
  // `this.internals.role = 'slider'` in connected() — this declaration is confirmatory, the slider.ts precedent).
  static role = 'slider'

  // The value at focus — committed baseline for `change` emission on blur (this leaf's own copy;
  // `ownsValueModel()` below gates off the base's identically-shaped but private `#committed` field).
  #committed: number | null = null

  // Light-DOM parts — built once (idempotent across reconnect, the slider.ts #buildDOM precedent).
  #labelEl: HTMLElement | undefined
  #starsEl: HTMLElement | undefined
  #baseRowEl: HTMLElement | undefined
  #fillRowEl: HTMLElement | undefined

  // valueDrag cleanup — re-assigned on each reconnect (connected() re-runs).
  protected _releaseDrag: (() => void) = () => {}

  /** ADR-0216 cl.2 — BOUNDS-ONLY clamp, no step snap. This is the codec's DISPLAY half: a bound aggregate
   *  score (`value: 4.3`) must paint fraction-accurately regardless of `step` — rounding it to the input
   *  granularity merely because it was ASSIGNED would lie. Drives the reactive value effect, the ARIA
   *  value* effect, the geometry (`--value-pct`) seam, and `formValue()` — every path EXCEPT a live
   *  keyboard/pointer commit, which calls `#snap` (below) instead. */
  #clamp(raw: number): number {
    const min = this.min ?? 0
    const max = this.max ?? 5
    // Non-finite guard (checker MINOR-1): NaN propagates through Math.min/max and Object.is(NaN,NaN)
    // short-circuits the bounds effect, leaving --value-pct invalid (all stars paint full) and the
    // keyboard stuck at NaN±step. Fall to min — the same floor an under-range write takes.
    if (!Number.isFinite(raw)) return min
    if (min > max) return min
    return Math.max(min, Math.min(max, raw))
  }

  /** ADR-0216 cl.2 — the WRITE path's clamp+snap (same algorithm as the base's private normaliser,
   *  range-element.ts — redeclared here since `ownsValueModel()` gates the base's copy off entirely).
   *  Used ONLY by the keyboard handler and valueDrag's `onValue` below — never by a reactive effect —
   *  so an assigned display value is never silently re-quantized to `step`. */
  #snap(raw: number): number {
    const min = this.min ?? 0
    const max = this.max ?? 5
    const step = this.step ?? 1
    const clamped = this.#clamp(raw)
    if (step <= 0) return clamped
    if (clamped === max) return max
    const steps = Math.round((clamped - min) / step)
    const snapped = min + steps * step
    return snapped > max ? min + (steps - 1) * step : snapped
  }

  /** Percentage position of `value` along [min, max] — the `--value-pct` geometry seam (the slider.ts
   *  precedent, byte-identical name: family-coherence.test.ts's token-namespace invariant explicitly
   *  carves an ungoverned per-instance custom property like this one out of scope, see slider.ts/css). */
  #valuePct(value: number): number {
    const min = this.min ?? 0
    const max = this.max ?? 5
    if (min >= max) return 0
    return ((value - min) / (max - min)) * 100
  }

  /** ADR-0216 cl.2 — the submitted form value is the CLAMPED (not force-snapped) value: after a real
   *  keyboard/pointer commit `this.value` is already the snapped result (assigned directly by those
   *  handlers below), so this is byte-identical to the base's `String(normalize(value))` in the
   *  interacted case, and correctly preserves an un-interacted bound fraction (e.g. a `readonly`
   *  display row) in the un-interacted case. */
  protected override formValue(): FormValue {
    return String(this.#clamp(this.value ?? 0))
  }

  /** ADR-0216 — the ARIA value text names the scale, not a bare number ("4.3 out of 5"). */
  protected override valueText(value: number): string {
    return `${value} out of ${this.max ?? 5}`
  }

  /** GH #1153 hook — this leaf needs a `readonly`-aware write path the base's single-`value` machinery has
   *  no gate for; opt OUT of the base's normaliser/ARIA-value/geometry/keyboard/focus-blur effects entirely
   *  (range-element.ts's `connected()`) so they never run alongside this leaf's own equivalents below. */
  protected override ownsValueModel(): boolean {
    return false
  }

  /** Build one `<svg>` star (24×24 viewBox, currentColor fill, decorative). */
  #buildStar(): SVGSVGElement {
    const svg = document.createElementNS(SVG_NS, 'svg')
    svg.setAttribute('viewBox', '0 0 24 24')
    svg.setAttribute('aria-hidden', 'true')
    svg.setAttribute('focusable', 'false')
    const path = document.createElementNS(SVG_NS, 'path')
    path.setAttribute('d', STAR_PATH)
    svg.append(path)
    return svg
  }

  /** Fill (or refill) a star row with exactly `count` stars — a whole-row rebuild, matching sparkline's
   *  whole-array-swap posture (star COUNT is structural, not a per-star reactive patch). */
  #fillRow(row: HTMLElement, count: number): void {
    if (row.childElementCount === count) return
    row.replaceChildren()
    for (let i = 0; i < count; i++) row.append(this.#buildStar())
  }

  /** Build the light-DOM structure once (no-op on reconnect — the fields are already set). */
  #buildDOM(): void {
    if (this.#starsEl) return

    // The visible label — a DUPLICATE of `internals.ariaLabel` (aria-hidden so it never doubles that
    // announcement), the slider.ts `[data-part='label']` precedent.
    const label = document.createElement('span')
    label.setAttribute('data-part', 'label')
    label.setAttribute('aria-hidden', 'true')
    this.#labelEl = label

    // The interactive star track — valueDrag's `track()` target (LLD-C4-equivalent pointer pick).
    const stars = document.createElement('span')
    stars.className = 'stars'
    stars.setAttribute('data-part', 'stars')
    this.#starsEl = stars

    // ADR-0216 cl.3 — two stacked rows: BASE (low-alpha, always all `max` stars) under FILL (full-ink,
    // clipped to value/max). Both start empty; the count effect below fills them to the current `max`.
    const base = document.createElement('span')
    base.className = 'stars-base'
    base.setAttribute('aria-hidden', 'true')
    this.#baseRowEl = base

    const fill = document.createElement('span')
    fill.className = 'stars-fill'
    fill.setAttribute('aria-hidden', 'true')
    this.#fillRowEl = fill

    stars.append(base, fill)
    this.append(label, stars)
  }

  protected override connected(): void {
    super.connected() // base: committed-baseline reset (unused; this leaf owns #committed) ·
    //                     internals.role='slider' · the shared label/internals.ariaLabel effect.
    //                     ownsValueModel()=false (above) gates off the base's own single-`value`
    //                     normaliser/ARIA-value/geometry/keyboard/focus-blur machinery entirely — every
    //                     equivalent below is this leaf's own copy, the only one that runs.

    this.#committed = null
    this.#buildDOM()

    // Keyboard-focusable while enabled; readonly does NOT remove tab order (the text-field/textarea
    // precedent: readonly stays focusable/announced, only the WRITE path inerts — ADR-0216 cl.4).
    tabbable(this, { disabled: () => this.effectiveDisabled() })

    // Label text + visibility — the labelPartVisible() base helper (empty label ⇒ hidden; also hidden
    // while field-associated, GH #1162 — the field owns the one visible label then).
    this.effect(() => {
      if (!this.#labelEl) return
      this.#labelEl.textContent = this.label ?? ''
      this.#labelEl.hidden = !this.labelPartVisible()
    })

    // Star COUNT effect — `max` is structural (how many stars exist), not a styled property; rebuild
    // both rows whenever it changes. Guards a negative/fractional max (Math.max(0, Math.floor(...))).
    this.effect(() => {
      const count = Math.max(0, Math.floor(this.max ?? 5))
      if (this.#baseRowEl) this.#fillRow(this.#baseRowEl, count)
      if (this.#fillRowEl) this.#fillRow(this.#fillRowEl, count)
    })

    // Bounds effect — ADR-0216 cl.2: clamp `value` into [min, max] on every change to any of the three,
    // but NEVER snap to `step` here — a bound display fraction (e.g. 4.3) must stay exactly 4.3 merely
    // because it was assigned. Only the keyboard/pointer write-path handlers below call `#snap`.
    this.effect(() => {
      const raw = this.value ?? 0
      const clamped = this.#clamp(raw)
      if (!Object.is(clamped, raw)) this.value = clamped
    })

    // ARIA value* — publishes ariaValueNow/Min/Max/Text reactively, fraction-accurate (cl.2 — the
    // clamped, not snapped, value).
    this.effect(() => {
      const value = this.#clamp(this.value ?? 0)
      this.internals.ariaValueNow = String(value)
      this.internals.ariaValueMin = String(this.min ?? 0)
      this.internals.ariaValueMax = String(this.max ?? 5)
      this.internals.ariaValueText = this.valueText(value)
    })

    // ADR-0216 cl.4 — announce readonly via ElementInternals (never a host attribute beyond the reflected
    // `readonly` prop itself, which CSS also keys off for the pointer-inert rule, rating.css).
    this.effect(() => {
      this.internals.ariaReadOnly = this.readonly ? 'true' : null
    })

    // Geometry seam — `--value-pct` on the host style; rating.css's `.stars-fill` clip-path consumes it
    // (the slider.ts `--value-pct` precedent, byte-identical name/shape). Fraction-accurate (cl.2).
    this.effect(() => {
      const value = this.#clamp(this.value ?? 0)
      this.style.setProperty('--value-pct', String(this.#valuePct(value)))
    })

    // Keyboard step — Arrow ±step, PageUp/Down ±largeStep (10×step), Home/End → min/max. ADR-0216 cl.2:
    // the WRITE path quantizes — `next` is computed via `#snap` (clamp+snap), stepping from the current
    // CLAMPED-not-snapped display value. ADR-0216 cl.4: readonly inerts this path too (not just disabled)
    // — the base has no such gate, hence the full re-implementation (ownsValueModel()=false above).
    this.listen(this, 'keydown', (event) => {
      if (this.effectiveDisabled() || this.readonly) return
      const e = event as KeyboardEvent
      const min = this.min ?? 0
      const max = this.max ?? 5
      const step = this.step ?? 1
      const largeStep = step * 10
      const current = this.#clamp(this.value ?? 0)
      let next: number | null = null

      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowUp':
          next = this.#snap(current + step)
          break
        case 'ArrowLeft':
        case 'ArrowDown':
          next = this.#snap(current - step)
          break
        case 'PageUp':
          next = this.#snap(current + largeStep)
          break
        case 'PageDown':
          next = this.#snap(current - largeStep)
          break
        case 'Home':
          next = min
          break
        case 'End':
          next = max
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

    // Change on commit — track value at focus; emit `change` on blur when value has moved. ADR-0216
    // Amendment 1 (2026-08-20, Kim ruling): this is the KEYBOARD path's law only — arrow-step adjusts
    // `value` + fires `input`, `change` on blur, byte-identical to the base range law (native
    // `<input type=range>`'s own two-path split). A POINTER commit fires `change` on `pointerup`
    // instead (below) and re-baselines `#committed` there, so this blur handler naturally no-ops for a
    // value already reported — it only ever fires for a delta the pointer path didn't already commit
    // (a keyboard edit made after a pointer pick, in the same focus session). The Fork-T1/D1 probe in
    // rating.test.ts proves `value` is already final by the time `change` fires on EITHER path.
    this.listen(this, 'focus', () => {
      this.#committed = this.#clamp(this.value ?? 0)
    })

    this.listen(this, 'blur', () => {
      const current = this.#clamp(this.value ?? 0)
      if (this.#committed !== null && !Object.is(current, this.#committed)) {
        this.emit('change')
      }
      this.#committed = null
    })

    // Pointer commit (ADR-0216 Amendment 1, 2026-08-20 Kim ruling) — a star picked by POINTER commits
    // immediately: `change` fires on `pointerup`, not blur. valueDrag's `onValue` below already lands
    // the `input`→`value` commit synchronously (unchanged); only the `change` NOTIFICATION moves
    // earlier, to the gesture's own end. Scoped to the star track (`#starsEl.contains`, the same test
    // valueDrag's own pointerdown listener applies — a pointerup elsewhere on the host is not a pick).
    // readonly/disabled both no-op naturally here: `onValue` never wrote `this.value` for them, so
    // `current` never diverges from `#committed` and nothing emits (the same belt-and-suspenders CSS
    // `pointer-events: none` gate `onValue` itself already carries). After firing, `#committed` is
    // re-baselined to the just-committed value so the blur handler above does not re-report the same
    // delta a second time.
    this.listen(this, 'pointerup', (event) => {
      if (!this.#starsEl?.contains((event as PointerEvent).target as Node | null)) return
      const current = this.#clamp(this.value ?? 0)
      if (this.#committed !== null && !Object.is(current, this.#committed)) {
        this.emit('change')
      }
      this.#committed = current
    })

    // Pointer pick (ADR-0216 cl.4) — click position along `.stars` maps to a snapped value exactly as a
    // slider rail does (clicking near star *k* lands near `k·step`); readonly/disabled both gate the
    // WRITE inside `onValue` (the base has no such hook, hence the check here rather than at the trait) —
    // rating.css ALSO sets `pointer-events: none` on `.stars` under `[readonly]`/`[disabled]` (the
    // slider.css `[disabled] .rail` precedent), so this is belt-and-suspenders against a synthetic pointer
    // event dispatched directly at `.stars` in a test harness (never reachable via a real gesture).
    this._releaseDrag = valueDrag(this, {
      track: () => this.#starsEl ?? null,
      min: () => this.min ?? 0,
      max: () => this.max ?? 5,
      step: () => this.step ?? 1,
      onValue: (v) => {
        if (this.effectiveDisabled() || this.readonly) return
        if (!Object.is(v, this.value ?? 0)) {
          this.value = v
          this.emit('input')
        }
      },
    })
  }

  protected override disconnected(): void {
    this._releaseDrag()
    this._releaseDrag = () => {}
  }
}

if (!customElements.get('ui-rating')) customElements.define('ui-rating', UIRatingElement)
