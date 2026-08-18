// line-chart.ts — UILineChartElement, the fleet's FIRST axis-bearing chart (ADR-0205, realizing the
// "line-with-axes new intake" ADR-0107 cl.1 named). Display-class, axis-free-EXCEPT-for-the-minimal-
// vocabulary ADR-0205 admits: a baseline reference line + two always-shown min/max value labels (cl.1/cl.3).
// No ticks, no gridlines, no legend, no tooltip, no time axis, no multi-series (cl.2/cl.7) — all named LATER.
//
// Light DOM; the mark effect rebuilds THREE light-DOM children on every `values`/`variant` change via one
// `replaceChildren` (whole-array swap, no incremental patching — the sparkline/bar-chart precedent):
//   1. `<div data-part="label-max">` — real DOM text (never SVG `<text>`, cl.1/cl.3), the series maximum.
//   2. `<svg>` — the component-built polyline (+ optional area polygon for `variant="area"`) PLUS one
//      `<line data-part="baseline">` (cl.1); aria-hidden (the HOST carries role=img, never double-announced).
//   3. `<div data-part="label-min">` — real DOM text, the series minimum.
// line-chart.css lays these three out as a 3-row CSS grid (label-max / svg / label-min) — "room reserved for
// the min/max label rows above/below the plot area" (ADR-0205 cl.5), matching the pure math's own vertical
// margin inside the viewBox (line-chart-math.ts's PLOT_MARGIN_Y).
//
// `internals.role = 'img'` is a CONSTANT set directly in connected() (the list.ts/sparkline.ts precedent) —
// never inside an effect. `ariaLabel` is a SECOND effect: the generated summary (label + min/max + point
// count, cl.6), recomputed on `values`/`label` change — never null, never aria-hidden.
//
// `cleanSeries` runs again at the render boundary (not just inside the codec): a PROPERTY write of garbage
// never reaches the math either (the SPEC-R3 AC2 sibling rule sparkline.ts/bar-chart.ts both apply).

import { UIElement, prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import {
  cleanSeries,
  lineChartGeometry,
  lineChartSummary,
  lineChartValuesProp,
  VIEWBOX_WIDTH,
  VIEWBOX_HEIGHT,
  type LineChartGeometry,
} from './line-chart-math.ts'

const SVG_NS = 'http://www.w3.org/2000/svg'

const props = {
  values: lineChartValuesProp, // number[] · safe JSON codec (line-chart-math.ts)
  label: { ...prop.string(''), reflect: true }, // accessible context (ADR-0205 cl.6), e.g. "Latency, p50"
  variant: prop.enum(['line', 'area'] as const, 'line'), // structural — enumType snaps unknowns to 'line'
} satisfies PropsSchema

export interface UILineChartElement extends ReactiveProps<typeof props> {}
export class UILineChartElement extends UIElement {
  static props = props

  protected override connected(): void {
    // A chart is data, not decoration (ADR-0205 cl.6, the ADR-0107 cl.4 inversion): role=img is CONSTANT —
    // set directly, once — never through an effect (there is nothing to toggle it away).
    this.internals.role = 'img'

    // Mark effect (reads values, variant): rebuild the label rows + svg on any change. `g === null` (empty
    // rendered set) clears the host entirely — the box still paints via the CSS floors.
    this.effect(() => {
      const g = lineChartGeometry(cleanSeries(this.values))
      if (g === null) {
        this.replaceChildren()
        return
      }
      this.replaceChildren(this.#labelNode('label-max', g.maxText), this.#svgNode(g), this.#labelNode('label-min', g.minText))
    })

    // ARIA effect (reads label, values): the generated accessible name — recomputed on either input.
    // Never null, never aria-hidden (no silent state, with or without a label — cl.6).
    this.effect(() => {
      this.internals.ariaLabel = lineChartSummary(this.label, lineChartGeometry(cleanSeries(this.values)))
    })
  }

  /** One real DOM text label row (ADR-0205 cl.1/cl.3 — never SVG `<text>`). */
  #labelNode(part: 'label-max' | 'label-min', text: string): HTMLElement {
    const el = document.createElement('div')
    el.setAttribute('data-part', part)
    el.textContent = text
    return el
  }

  /** The component-built, aria-hidden svg: optional area polygon UNDER the stroke, the baseline `<line>`,
   *  then the data polyline on top (paint order: area, baseline, line). */
  #svgNode(g: LineChartGeometry): SVGSVGElement {
    const svg = document.createElementNS(SVG_NS, 'svg')
    svg.setAttribute('viewBox', `0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`)
    svg.setAttribute('preserveAspectRatio', 'none')
    // aria-hidden on the SVG — the HOST carries role=img; the svg must never double-announce.
    svg.setAttribute('aria-hidden', 'true')
    svg.setAttribute('focusable', 'false')

    if (this.variant === 'area' && g.area !== null) {
      const area = document.createElementNS(SVG_NS, 'polygon')
      area.setAttribute('data-part', 'area')
      area.setAttribute('points', g.area)
      area.setAttribute('fill', 'currentColor')
      area.setAttribute('stroke', 'none')
      svg.append(area)
    }

    const baseline = document.createElementNS(SVG_NS, 'line')
    baseline.setAttribute('data-part', 'baseline')
    baseline.setAttribute('x1', '0')
    baseline.setAttribute('y1', String(g.baselineY))
    baseline.setAttribute('x2', String(VIEWBOX_WIDTH))
    baseline.setAttribute('y2', String(g.baselineY))
    baseline.setAttribute('stroke', 'currentColor')
    baseline.setAttribute('vector-effect', 'non-scaling-stroke')
    svg.append(baseline)

    const line = document.createElementNS(SVG_NS, 'polyline')
    line.setAttribute('data-part', 'line')
    line.setAttribute('points', g.points)
    line.setAttribute('fill', 'none')
    line.setAttribute('stroke', 'currentColor')
    line.setAttribute('vector-effect', 'non-scaling-stroke')
    line.setAttribute('stroke-linecap', 'round')
    line.setAttribute('stroke-linejoin', 'round')
    svg.append(line)

    return svg
  }
}

if (!customElements.get('ui-line-chart')) customElements.define('ui-line-chart', UILineChartElement) // idempotent self-define
