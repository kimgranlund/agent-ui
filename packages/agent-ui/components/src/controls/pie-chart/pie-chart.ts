// pie-chart.ts — UIPieChartElement, the Display-class part-of-whole chart (ADR-0219, lifting
// ADR-0107's pie fence on its own three stated conditions). BEHAVIOUR + props + list-semantics ARIA +
// the component-built ring/rows + self-define ONLY; the pure slice geometry (angles, paths, percents,
// hardening) lives in pie-math.ts (DOM-free, unit-testable) and the CSS ring/key-list geometry lives
// in pie-chart.css.
//
// A chart is data, not decoration (ADR-0107 cl.4, carried into ADR-0219): the host carries `role=list`
// via `ElementInternals` (the `ui-bar-chart` precedent) — never a host attribute — named by `label`
// when non-empty. The key list IS the legend (ADR-0219 cl.5): each rendered slice gets a real
// `role=listitem` row whose text content is `{label} · {percent}`, real DOM text — the ring `<svg>` is
// a sibling, `aria-hidden` (the rows are the accessible rendering, the `ui-bar-chart`/`ui-line-chart`
// law).
//
// Content model — component-built, NOT host-as-grid: `data`/`variant` is display-only, whole-array
// derived state (no positional reconcile — the bar-chart/line-chart precedent: inert rows with no
// focus/selection worth reconciling), so `render()` stays the inherited no-op and the mark effect
// rebuilds the full light-DOM child list (ring svg + key rows) on every change via `replaceChildren`.
// Per ADR-0219 cl.6/SPEC §5.2, this control is DISPLAY-ONLY with NO children of its own — the donut
// center is a SIBLING composition in the CONSUMER's layout (a Stat/Text placed there by the consumer's
// own CSS), never a slot this control renders into.
//
// Imports inward only (controls → dom): UIElement + prop + the typed-schema helpers from the dom
// barrel; the pure math from the co-located pie-math.ts (the ADR-0065 pure-core split).

import { UIElement, prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import { pieDataProp, pieRows, cleanData, VIEWBOX_SIZE, type PieGeometry, type PieSlice } from './pie-math.ts'

const SVG_NS = 'http://www.w3.org/2000/svg'

const props = {
  data: pieDataProp, // { label: string; value: number }[] · safe JSON codec (pie-math.ts) · default []
  label: { ...prop.string(''), reflect: true }, // the list's accessible name — an unlabeled list is legal, never a silent state
  variant: prop.enum(['donut', 'pie'] as const, 'donut'), // ADR-0219 cl.1 — donut is the ring default (leaves a center); enumType snaps unknowns to 'donut'
} satisfies PropsSchema

export interface UIPieChartElement extends ReactiveProps<typeof props> {}
export class UIPieChartElement extends UIElement {
  static props = props

  protected override connected(): void {
    // List semantics (the `ui-bar-chart`/`ui-list` precedent) — a constant semantic role, set directly
    // (not inside an effect); re-set on each connect (idempotent).
    this.internals.role = 'list'

    // The label effect — `label` names the list when non-empty; an unlabeled list is legal.
    this.effect(() => {
      this.internals.ariaLabel = this.label || null
    })

    // The mark effect (ADR-0219 cl.2/cl.4): whole-array derived state — every `data`/`variant` change
    // rebuilds the ring svg + the full key-row list via one `replaceChildren`. `cleanData` runs again
    // here (not just inside the codec), so a PROPERTY write of garbage never reaches the math either.
    this.effect(() => {
      const g = pieRows(cleanData(this.data), this.variant)
      this.replaceChildren(this.#ringNode(g), ...g.slices.map((slice) => this.#rowNode(slice)))
    })
  }

  /** The component-built, aria-hidden ring: one `<path>` per slice (fill = its lightness-ramp token,
   *  a constant-width surface-role separator stroke) when the rendered total is > 0; a single track
   *  path (the empty/all-zero case, cl.2) otherwise. The HOST carries `role=list`; the svg must never
   *  double-announce. */
  #ringNode(g: PieGeometry): SVGSVGElement {
    const svg = document.createElementNS(SVG_NS, 'svg')
    svg.setAttribute('viewBox', `0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`)
    svg.setAttribute('data-part', 'ring')
    svg.setAttribute('aria-hidden', 'true')
    svg.setAttribute('focusable', 'false')

    if (g.slices.length === 0) {
      const track = document.createElementNS(SVG_NS, 'path')
      track.setAttribute('data-part', 'track')
      track.setAttribute('fill-rule', 'evenodd')
      track.setAttribute('d', g.trackPathD)
      svg.append(track)
      return svg
    }

    for (const slice of g.slices) {
      const path = document.createElementNS(SVG_NS, 'path')
      path.setAttribute('data-part', 'slice')
      path.setAttribute('data-index', String(slice.index))
      path.setAttribute('fill-rule', 'evenodd')
      path.setAttribute('d', slice.pathD)
      path.setAttribute('vector-effect', 'non-scaling-stroke')
      path.style.setProperty('--_slice-ink', `var(--ui-pie-chart-slice-${slice.tokenIndex}-ink)`)
      svg.append(path)
    }
    return svg
  }

  /** One key-list row (ADR-0219 cl.3/cl.4/cl.5 — the legend IS this row, not an SVG legend layer):
   *  `role=listitem`, whose text content is exactly `{label} · {percent}` (real DOM text — the
   *  accuracy carrier for the weak angle channel). A leading swatch (aria-hidden, fill = the SAME
   *  token as its slice) shares the fill carrier with the row without making it the ONLY carrier. */
  #rowNode(slice: PieSlice): HTMLElement {
    const item = document.createElement('div')
    item.setAttribute('role', 'listitem')
    item.setAttribute('data-index', String(slice.index))

    const swatch = document.createElement('span')
    swatch.setAttribute('data-part', 'key-swatch')
    swatch.setAttribute('aria-hidden', 'true')
    swatch.style.setProperty('--_slice-ink', `var(--ui-pie-chart-slice-${slice.tokenIndex}-ink)`)

    const label = document.createElement('span')
    label.setAttribute('data-part', 'key-label')
    label.textContent = slice.label

    const percent = document.createElement('span')
    percent.setAttribute('data-part', 'key-percent')
    percent.textContent = slice.percentText

    // `{label} · {percent}` as the row's exact text content (cl.3) — a plain separator text node
    // between the label and percent spans (the swatch carries no text).
    item.append(swatch, label, document.createTextNode(' · '), percent)
    return item
  }
}

if (!customElements.get('ui-pie-chart')) customElements.define('ui-pie-chart', UIPieChartElement) // idempotent self-define
