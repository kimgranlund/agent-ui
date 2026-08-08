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
//
// SPEC-R1 Amendment v1 (2026-08-08, GH #614) — discrete "step N of M" mode: a fourth prop, `segments`,
// additively widens the value model. `resolveState()` is the ONE place both effects (mark + ARIA) derive
// the effective triple from — never two divergent computations of the same hardening table. Discrete mode
// (a `segments` that hardens to a finite integer >= 2) ignores `max` entirely and floors the clamped value
// to an integer step count; `segments` absent/null/non-finite/<2/fractional/malformed falls back to the
// pre-amendment continuous contract, byte-identical. Rendering swaps the track's SOLE child between the
// continuous `fill` and a lazily-built `cells` strip (append/remove TAIL cells only — the otp-field
// LLD-C3 precedent, never a full rebuild) — cells exist only when discrete AND determinate.

import { UIElement, type ReactiveProps } from '../../dom/index.ts'
// Generated from progress.md's `attributes[]` (ADR-0173) — `node scripts/generate-props.mjs progress` to
// regenerate; never hand-edit progress.props.gen.ts. `current` was renamed from `value` (TKT-0069 item 1
// ruling: `value` = the FACE form value, reserved — this rename spends real native-<progress> parity
// deliberately; the A2UI catalog keeps wire `value`, mapped in its bespoke factory).
import { props } from './progress.props.gen.ts'

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

/** SPEC-R1 Amendment v1: only a finite integer >= 2 activates discrete mode — `Number.isInteger` already
 *  excludes NaN/±Infinity/fractional in one check; anything else (incl. a malformed attribute, which the
 *  props layer already coerces to `null`) falls back to `null` ⇒ continuous mode, no new failure surface. */
function normalizeSegments(segments: number | null): number | null {
  return segments !== null && Number.isInteger(segments) && segments >= 2 ? segments : null
}

/** The resolved effective triple — the ONE derivation both the mark and ARIA effects read (never two
 *  divergent copies of the hardening table). Discrete mode ignores `max` entirely (`eMax := segments`) and
 *  additionally floors the clamped value to an integer step count (SPEC-R1 Amendment v1) — a step counts
 *  only when fully reached, so the painted cell count and the announced value are the same number. */
function resolveState(current: number | null, max: number | null, segments: number | null): { eMax: number; eValue: number | null; discrete: boolean } {
  const normSegments = normalizeSegments(segments)
  const discrete = normSegments !== null
  const eMax = discrete ? normSegments : effectiveMax(max)
  const raw = effectiveValue(current, eMax)
  const eValue = discrete && raw !== null ? Math.floor(raw) : raw
  return { eMax, eValue, discrete }
}

export interface UIProgressElement extends ReactiveProps<typeof props> {}
export class UIProgressElement extends UIElement {
  static props = props

  #track: HTMLElement | null = null
  #fill: HTMLElement | null = null
  #cells: HTMLElement | null = null // lazily built on first discrete-determinate activation
  #cellEls: HTMLElement[] = [] // tail-append/remove only (the otp-field LLD-C3 precedent) — never rebuilt

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
    const track = this.#track!
    const fill = this.#fill!

    // Mark effect (SPEC-R2 + Amendment v1): continuous or indeterminate paints the single `fill`
    // (--_pct / data-indeterminate, unchanged); discrete-determinate swaps the track's SOLE child to a
    // lazily-built `cells` strip — the first eValue cells carry `data-filled`, the rest do not — no
    // partial cell ever paints. Cells exist ONLY when determinate (an indeterminate stepper has nothing
    // to count) — segments never changes the determinate/indeterminate switch.
    this.effect(() => {
      const { eMax, eValue, discrete } = resolveState(this.current, this.max, this.segments)
      const showCells = discrete && eValue !== null

      if (showCells) {
        if (!this.#cells) {
          this.#cells = document.createElement('span')
          this.#cells.setAttribute('data-part', 'cells')
        }
        const cells = this.#cells
        while (this.#cellEls.length < eMax) {
          const cell = document.createElement('span')
          cell.setAttribute('data-part', 'cell')
          cells.append(cell)
          this.#cellEls.push(cell)
        }
        while (this.#cellEls.length > eMax) {
          this.#cellEls.pop()!.remove()
        }
        for (let i = 0; i < this.#cellEls.length; i++) {
          if (i < eValue!) this.#cellEls[i]!.setAttribute('data-filled', '')
          else this.#cellEls[i]!.removeAttribute('data-filled')
        }
        if (track.firstElementChild !== cells) track.replaceChildren(cells)
      } else {
        if (eValue === null) {
          fill.setAttribute('data-indeterminate', '')
          fill.style.removeProperty('--_pct')
        } else {
          fill.removeAttribute('data-indeterminate')
          fill.style.setProperty('--_pct', String((eValue / eMax) * 100))
        }
        if (track.firstElementChild !== fill) track.replaceChildren(fill)
      }
    })

    // ARIA effect (SPEC-R3 + Amendment v1): role=progressbar is ALWAYS set — status data, never silent
    // (the chart inversion, ADR-0112 cl.2). Determinate+continuous publishes the percent ariaValueText;
    // determinate+discrete publishes the snapped integer + "Step N of M" (never the percent reading —
    // the OQ1 misrepresentation ruling); indeterminate omits both while role/min/max persist (max =
    // segments while discrete) — the ARIA-native indeterminate signal.
    this.effect(() => {
      const { eMax, eValue, discrete } = resolveState(this.current, this.max, this.segments)
      this.internals.role = 'progressbar'
      this.internals.ariaValueMin = '0'
      this.internals.ariaValueMax = String(eMax)
      if (eValue === null) {
        this.internals.ariaValueNow = null
        this.internals.ariaValueText = null
      } else if (discrete) {
        this.internals.ariaValueNow = String(eValue)
        this.internals.ariaValueText = `Step ${eValue} of ${eMax}`
      } else {
        this.internals.ariaValueNow = String(eValue)
        this.internals.ariaValueText = percentFormat.format(eValue / eMax)
      }
      this.internals.ariaLabel = this.label || null
    })
  }
}

if (!customElements.get('ui-progress')) customElements.define('ui-progress', UIProgressElement) // idempotent self-define
