// gauge.ts — UIGaugeElement, the Display-class multi-ring RADIAL gauge (ADR-0229 cl.4). BEHAVIOUR +
// props + list-semantics ARIA + the component-built ring/legend rows + self-define ONLY; the pure ring
// geometry (radius/circumference/dash-offset, hardening) lives in gauge-math.ts (DOM-free,
// unit-testable) and the CSS ring/legend geometry lives in gauge.css.
//
// Mint, never a `ui-pie-chart` extension, never composed `ui-stat variant="ring"` tiles (ADR-0229
// cl.4): each ring is an INDEPENDENT 0-100 progress value — rings do not sum, so the part-of-whole
// `value / Σ` math ui-pie-chart's whole contract rests on simply does not apply (a gauge with rings at
// 90/60/30 renders three independent readings, never a 90/60/30-of-180 split); N separate `ui-stat
// variant="ring"` tiles would be N separate boxes with no shared center — a different artifact than
// this control's single concentric mark.
//
// A chart is data, not decoration (ADR-0107 cl.4, carried into ADR-0219/ADR-0229): the host carries
// `role=list` via `ElementInternals` (the `ui-pie-chart` precedent — ADR-0219 cl.5's "the key list IS
// the legend" law verbatim, ADR-0229 cl.5's own citation of it for this control) — never a host
// attribute — named by `label` when non-empty. Each rendered ring gets a real `role=listitem` row
// whose text content is `{label} · {value%}`, real DOM text — the ring `<svg>` is a sibling,
// `aria-hidden` (the rows are the accessible rendering; no generated `role=img` summary is owed here,
// unlike `ui-column-chart`/`ui-line-chart`'s axes state — this is the list-semantics branch of the
// family's two established a11y postures, ADR-0229 cl.5).
//
// Content model — component-built, NOT host-as-grid: `data` is display-only, whole-array derived
// state (no positional reconcile — the bar-chart/pie-chart/column-chart precedent: inert rows with no
// focus/selection worth reconciling), so `render()` stays the inherited no-op and the mark effect
// rebuilds the full light-DOM child list (ring svg + legend rows) on every change via `replaceChildren`.
//
// Axis subsystem (gridlines/ticks/chips), today-marker, and provisional-span are ALL N/A here (ADR-0228's
// own per-mark N/A grammar for radial/part-of-whole types) — this control renders none of that chrome,
// only its own concentric-ring anatomy plus the label/value legend column. The two-layer full-bleed
// inset model DOES still apply (ADR-0228 cl.1-3, generalized to a radial mark, per ADR-0229 cl.4/cl.5's
// own citation of the shared vocabulary): the ring layer bleeds edge-to-edge at zero inset (gauge.css);
// the legend layer floats on top, inset from every edge by exactly `--ui-gauge-chrome-inset`.
//
// Imports inward only (controls → dom): UIElement + prop + the typed-schema helpers from the dom
// barrel; the pure math from the co-located gauge-math.ts (the ADR-0065 pure-core split).

import { UIElement, prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import { cleanData, gaugeDataProp, gaugeRows, VIEWBOX_SIZE, type GaugeGeometry, type GaugeRing } from './gauge-math.ts'

const SVG_NS = 'http://www.w3.org/2000/svg'
const CENTER = VIEWBOX_SIZE / 2

const props = {
  data: gaugeDataProp, // { label: string; value: number }[] · safe JSON codec (gauge-math.ts) · default []
  label: { ...prop.string(''), reflect: true }, // the list's accessible name — an unlabeled list is legal, never a silent state
} satisfies PropsSchema

export interface UIGaugeElement extends ReactiveProps<typeof props> {}
export class UIGaugeElement extends UIElement {
  static props = props

  protected override connected(): void {
    // List semantics (the ui-pie-chart/ui-bar-chart precedent) — a constant semantic role, set directly
    // (not inside an effect); re-set on each connect (idempotent).
    this.internals.role = 'list'

    // The label effect — `label` names the list when non-empty; an unlabeled list is legal.
    this.effect(() => {
      this.internals.ariaLabel = this.label || null
    })

    // The mark effect (ADR-0229 cl.4): whole-array derived state — every `data` change rebuilds the
    // rings svg + the full legend-row list via one `replaceChildren`. `cleanData` runs again here (not
    // just inside the codec), so a PROPERTY write of garbage never reaches the math either.
    this.effect(() => {
      const g = gaugeRows(cleanData(this.data))
      this.replaceChildren(this.#ringsNode(g), this.#legendNode(g))
    })
  }

  /** Layer 1 — the aria-hidden, zero-inset SVG rings: one track circle + one rounded-cap progress
   *  circle per datum, OUTER→INNER in data order (ADR-0229 cl.4). `preserveAspectRatio="xMinYMid meet"`
   *  pins the ring drawing to the box's start edge (letterboxing any extra width to the end side) so a
   *  wide host reserves real, empty room for the legend layer WITHOUT shrinking the ring's own
   *  coordinate system or this layer's own full-bleed element box (ADR-0228 cl.2/cl.3's rejected
   *  "residual-gutter" alternative — the ring never shrinks to make room). The HOST carries role=list;
   *  this svg must never double-announce. */
  #ringsNode(g: GaugeGeometry): SVGSVGElement {
    const svg = document.createElementNS(SVG_NS, 'svg')
    svg.setAttribute('viewBox', `0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`)
    svg.setAttribute('preserveAspectRatio', 'xMinYMid meet')
    svg.setAttribute('data-part', 'rings')
    svg.setAttribute('aria-hidden', 'true')
    svg.setAttribute('focusable', 'false')

    for (const ring of g.rings) {
      const track = document.createElementNS(SVG_NS, 'circle')
      track.setAttribute('data-part', 'track')
      track.setAttribute('data-index', String(ring.index))
      track.setAttribute('cx', String(CENTER))
      track.setAttribute('cy', String(CENTER))
      track.setAttribute('r', String(ring.radius))
      svg.append(track)

      // Rotated -90deg so every ring's sweep starts at 12 o'clock and runs clockwise (the standard
      // SVG stroke-dasharray/stroke-dashoffset radial-gauge technique).
      const progress = document.createElementNS(SVG_NS, 'circle')
      progress.setAttribute('data-part', 'progress')
      progress.setAttribute('data-index', String(ring.index))
      progress.setAttribute('cx', String(CENTER))
      progress.setAttribute('cy', String(CENTER))
      progress.setAttribute('r', String(ring.radius))
      progress.setAttribute('transform', `rotate(-90 ${CENTER} ${CENTER})`)
      progress.style.setProperty('--_ring-circumference', String(ring.circumference))
      progress.style.setProperty('--_ring-dashoffset', String(ring.dashOffset))
      progress.style.setProperty('--_ring-ink', `var(--ui-gauge-series-${ring.tokenIndex}-ink)`)
      svg.append(progress)
    }
    return svg
  }

  /** Layer 2 — the real-DOM legend column (ADR-0229 cl.4/ADR-0219 cl.5 — the legend IS the data list,
   *  never an SVG legend layer): one `role=listitem` row per ring, `{label} · {value%}` real DOM text.
   *  Padded by `--ui-gauge-chrome-inset` — floats INSIDE the host box, never pushing/shrinking the
   *  rings layer (ADR-0228 cl.3's zero-padding-container contract, generalized to a radial mark). */
  #legendNode(g: GaugeGeometry): HTMLElement {
    const legend = document.createElement('div')
    legend.setAttribute('data-part', 'legend')
    legend.append(...g.rings.map((ring) => this.#rowNode(ring)))
    return legend
  }

  /** One legend row: `role=listitem`, whose text content is exactly `{label} · {value%}` (real DOM
   *  text — the accuracy carrier alongside the weak, hue-adjacent ring-fill channel). A leading swatch
   *  (aria-hidden, fill = the SAME token as its ring) shares the fill carrier with the row without
   *  making it the ONLY carrier (ADR-0057). */
  #rowNode(ring: GaugeRing): HTMLElement {
    const item = document.createElement('div')
    item.setAttribute('role', 'listitem')
    item.setAttribute('data-index', String(ring.index))

    const swatch = document.createElement('span')
    swatch.setAttribute('data-part', 'key-swatch')
    swatch.setAttribute('aria-hidden', 'true')
    swatch.style.setProperty('--_ring-ink', `var(--ui-gauge-series-${ring.tokenIndex}-ink)`)

    const label = document.createElement('span')
    label.setAttribute('data-part', 'key-label')
    label.textContent = ring.label

    const percent = document.createElement('span')
    percent.setAttribute('data-part', 'key-percent')
    percent.textContent = ring.percentText

    // `{label} · {percent}` as the row's exact text content — a plain separator text node between the
    // label and percent spans (the swatch carries no text, the ui-pie-chart key-row precedent verbatim).
    item.append(swatch, label, document.createTextNode(' · '), percent)
    return item
  }
}

if (!customElements.get('ui-gauge')) customElements.define('ui-gauge', UIGaugeElement) // idempotent self-define
