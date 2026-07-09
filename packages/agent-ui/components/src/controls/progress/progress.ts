// progress.ts — UIProgressElement, the Display-class thin-rail progress bar (LLD-C1, feed-family.lld.md
// §2; SPEC-R1/R2/R3/R18/R19/R20; ADR-0112 cl.2). Non-interactive, non-form-associated leaf: no events, no
// keyboard contract, no [size]/[scale] control geometry — a bar is a rail, not a widget box. Value model
// mirrors the native <progress> semantic: `value === null` (default) ⇒ INDETERMINATE, never a separate
// boolean to desync. `render()` stays the inherited no-op — the track/fill pair is built once in
// `connected()` (survives reconnect via the private field guard) and mutated per-change by two effects.
//
// Hardening (SPEC-R1's table) is a pure in-file pair — the math is two clamps, no separate module:
// `effectiveMax` floors a non-finite/≤0/malformed `max` to the ARIA default (100); `effectiveValue` maps
// an absent/non-finite `value` to `null` (indeterminate) and clamps a real value into [0, effectiveMax].
// No case throws — every input, however malformed, resolves to a paintable, announced state.

import { UIElement, prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'

const props = {
  value: prop.number(null), // null ⇒ indeterminate (the native <progress> semantic — no boolean to desync)
  max: prop.number(100), // the ARIA progressbar default — percent-natural for {value:42} with zero extra props
  label: prop.string(''), // the accessible name (SPEC-R3); empty ⇒ no internals.ariaLabel
} satisfies PropsSchema

/** SPEC-R1: non-finite / ≤0 / malformed `max` floors to the ARIA progressbar default. */
function effectiveMax(max: number | null): number {
  return max !== null && Number.isFinite(max) && max > 0 ? max : 100
}

/** SPEC-R1: absent/non-finite `value` ⇒ null (indeterminate); else clamped into [0, eMax]. */
function effectiveValue(value: number | null, eMax: number): number | null {
  return value === null || !Number.isFinite(value) ? null : Math.min(Math.max(value, 0), eMax)
}

// Module-memoized (SPEC-R3): the percent reading behind `ariaValueText`, default locale.
const percentFormat = new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 0 })

export interface UIProgressElement extends ReactiveProps<typeof props> {}
export class UIProgressElement extends UIElement {
  static props = props

  #track: HTMLElement | null = null
  #fill: HTMLElement | null = null

  protected override connected(): void {
    // Built ONCE (LLD-C1) — a private-field guard so a reconnect (children survive removal/re-append)
    // never mints a second track/fill pair.
    if (!this.#track) {
      this.#track = document.createElement('span')
      this.#track.setAttribute('data-part', 'track')
      this.#fill = document.createElement('span')
      this.#fill.setAttribute('data-part', 'fill')
      this.#track.append(this.#fill)
      this.append(this.#track)
    }
    const fill = this.#fill!

    // Mark effect (SPEC-R2): determinate ⇒ the fill's --_pct custom property; indeterminate ⇒
    // data-indeterminate on the fill (an interior node, never a host attribute — CSS drives the sweep).
    this.effect(() => {
      const eMax = effectiveMax(this.max)
      const eValue = effectiveValue(this.value, eMax)
      if (eValue === null) {
        fill.setAttribute('data-indeterminate', '')
        fill.style.removeProperty('--_pct')
      } else {
        fill.removeAttribute('data-indeterminate')
        fill.style.setProperty('--_pct', String((eValue / eMax) * 100))
      }
    })

    // ARIA effect (SPEC-R3): role=progressbar is ALWAYS set — status data, never silent (the chart
    // inversion, ADR-0112 cl.2). Determinate publishes ariaValueNow/Text; indeterminate omits both while
    // role/min/max persist — the ARIA-native indeterminate signal.
    this.effect(() => {
      const eMax = effectiveMax(this.max)
      const eValue = effectiveValue(this.value, eMax)
      this.internals.role = 'progressbar'
      this.internals.ariaValueMin = '0'
      this.internals.ariaValueMax = String(eMax)
      if (eValue === null) {
        this.internals.ariaValueNow = null
        this.internals.ariaValueText = null
      } else {
        this.internals.ariaValueNow = String(eValue)
        this.internals.ariaValueText = percentFormat.format(eValue / eMax)
      }
      this.internals.ariaLabel = this.label || null
    })
  }
}

if (!customElements.get('ui-progress')) customElements.define('ui-progress', UIProgressElement) // idempotent self-define
