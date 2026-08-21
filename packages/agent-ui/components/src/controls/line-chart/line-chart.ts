// line-chart.ts — UILineChartElement, the fleet's FIRST axis-bearing chart (ADR-0205, realizing the
// "line-with-axes new intake" ADR-0107 cl.1 named), EXTENDED by ADR-0229 cl.3 with an `axes` opt-in
// state consuming the shared `_chart/` vocabulary (ADR-0228) + a token-driven gradient area fill.
//
// DEFAULT state (axes=false) is BYTE-FOR-BYTE UNTOUCHED (ADR-0229 cl.3's own clause): the exact same
// three light-DOM children on every `values`/`variant` change via one `replaceChildren` — label-max /
// svg (polyline [+area] + baseline) / label-min — built by the SAME `#defaultMarkNodes` path as before
// this wave (renamed from the inline effect body, logic identical). No ticks, no gridlines, no legend,
// no tooltip, no time axis, no multi-series (cl.2/cl.7) — all still named LATER for this state.
//
// AXES state (axes=true, ADR-0229 cl.3) swaps the min/max label rows for the ADR-0228 two-layer model:
//   1. `<svg data-part="plot" aria-hidden="true">` (viewBox "0 0 100 100", the axis-math percent
//      convention) — nice-number gridlines, the baseline `<line>` (cl.1, inherited unchanged), the
//      polyline (split into a solid ACTUAL segment + a dashed PROJECTED segment when `projected > 0`,
//      REQ-F-015's "dashed stroke over the provisional span"), the area polygon (ACTUAL span only —
//      REQ-F-015's fill-suppressed treatment for the projected span, this control's own considered call
//      per the gen-ui-kit foundations spec's OPEN-3), and the now-marker (baseline dot + a SHORT tick
//      through the category-label band — wave 1's `ui-column-chart` mechanism, reused verbatim, REQ-F-008).
//   2. `<div data-part="chrome">` — real-DOM tick-label (value scale) + category-label (from the optional
//      `labels` prop, aligned by index; absent ⇒ value ticks only, cl.3) chips, inset by
//      `--ui-line-chart-chrome-inset` — Kim's zero-padding-container contract (ADR-0228 cl.3): the plot
//      layer bleeds to the box edge, the chrome floats INSIDE it, never shrinking the plot.
//
// The gradient area fill (ADR-0229 cl.3, both states — NOT gated on `axes`; cl.3's byte-untouched clause
// names only the baseline + min/max rows, never the area-fill paint mechanism) is an SVG
// `<linearGradient>` (CSS cannot paint a gradient into an SVG fill cross-engine) — two `<stop>`s reading
// `--ui-line-chart-area-fill-stop-{start,end}` (stop-opacity), so a consumer wanting the ORIGINAL flat
// low-alpha wash back sets both stops equal — the ADR's own "existing flat wash as the token fallback."
// `--ui-line-chart-area-opacity` still multiplies on top, unchanged default — a real byte change to
// `variant="area"`'s `fill` attribute (now `url(#id)`, an instance-unique gradient id), booked here, not
// silent (the ADR-0228 pie-ramp-repoint "booked, not silent" precedent for an intentional test update).
//
// `internals.role = 'img'` is a CONSTANT set directly in connected() (the list.ts/sparkline.ts precedent) —
// never inside an effect. `ariaLabel` is a SECOND effect: the generated summary (label + min/max + point
// count, cl.6) — UNCHANGED by `axes` (ADR-0229 cl.5: "the axes-state line chart" reads "the ADR-0205 cl.6
// pattern" verbatim, not a new summary shape) — recomputed on `values`/`label` change, never null.
//
// `cleanSeries`/`cleanLabels` run again at the render boundary (not just inside the codec): a PROPERTY
// write of garbage never reaches the math either (the SPEC-R3 AC2 sibling rule).

import { UIElement, prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import {
  cleanSeries,
  cleanLabels,
  lineChartGeometry,
  lineChartAxesGeometry,
  lineChartSummary,
  lineChartValuesProp,
  lineChartLabelsProp,
  VIEWBOX_WIDTH,
  VIEWBOX_HEIGHT,
  type LineChartGeometry,
  type LineChartAxesGeometry,
} from './line-chart-math.ts'

const SVG_NS = 'http://www.w3.org/2000/svg'
/** The now-marker's short tick length, percent of the 0..100 plot — the `ui-column-chart` constant,
 *  reused verbatim (ADR-0228 cl.4: never a full-height rule, one shared mechanism for the family). */
const NOW_TICK_DEPTH_PCT = 8

/** A per-instance, document-unique SVG gradient id — `<linearGradient>` ids share the document's ID
 *  namespace, so a page with several `variant="area"` charts must never collide (module-level counter,
 *  the simplest collision-free scheme; a fresh id per (re)connect is harmless — gradient defs are cheap
 *  and stable within one connected lifetime). */
let gradientCounter = 0

const props = {
  values: lineChartValuesProp, // number[] · safe JSON codec (line-chart-math.ts)
  label: { ...prop.string(''), reflect: true }, // accessible context (ADR-0205 cl.6), e.g. "Latency, p50"
  variant: prop.enum(['line', 'area'] as const, 'line'), // structural — enumType snaps unknowns to 'line'
  axes: { ...prop.boolean(false), reflect: true }, // ADR-0229 cl.3 — opt-in tick/gridline/category system
  labels: lineChartLabelsProp, // string[] · optional category labels, index-aligned to `values` (cl.3)
  projected: { ...prop.number(0), reflect: true }, // trailing count in the provisional state (ADR-0228 cl.4); axes-only
} satisfies PropsSchema

export interface UILineChartElement extends ReactiveProps<typeof props> {}
export class UILineChartElement extends UIElement {
  static props = props

  #gradientId = `ui-line-chart-area-fill-${gradientCounter++}`

  protected override connected(): void {
    // A chart is data, not decoration (ADR-0205 cl.6, the ADR-0107 cl.4 inversion): role=img is CONSTANT —
    // set directly, once — never through an effect (there is nothing to toggle it away).
    this.internals.role = 'img'

    // Mark effect (reads values, variant, axes, labels, projected): rebuild on any change via one
    // `replaceChildren`. The two states are fully separate render paths (byte-untouched default, cl.3).
    this.effect(() => {
      if (this.axes) {
        const g = lineChartAxesGeometry(cleanSeries(this.values), cleanLabels(this.labels), this.projected ?? 0)
        if (g === null) {
          this.replaceChildren()
          return
        }
        this.replaceChildren(this.#axesPlotNode(g), this.#axesChromeNode(g))
        return
      }
      const g = lineChartGeometry(cleanSeries(this.values))
      if (g === null) {
        this.replaceChildren()
        return
      }
      this.replaceChildren(this.#labelNode('label-max', g.maxText), this.#svgNode(g), this.#labelNode('label-min', g.minText))
    })

    // ARIA effect (reads label, values): the generated accessible name — recomputed on either input.
    // Never null, never aria-hidden (no silent state, with or without a label — cl.6). UNCHANGED by
    // `axes` (ADR-0229 cl.5 — the axes-state line chart reads the SAME cl.6 summary pattern).
    this.effect(() => {
      this.internals.ariaLabel = lineChartSummary(this.label, lineChartGeometry(cleanSeries(this.values)))
    })
  }

  /** One real DOM text label row (ADR-0205 cl.1/cl.3 — never SVG `<text>`). Default state only. */
  #labelNode(part: 'label-max' | 'label-min', text: string): HTMLElement {
    const el = document.createElement('div')
    el.setAttribute('data-part', part)
    el.textContent = text
    return el
  }

  /** The component-built, aria-hidden svg (DEFAULT state): optional area polygon UNDER the stroke, the
   *  baseline `<line>`, then the data polyline on top (paint order: area, baseline, line). */
  #svgNode(g: LineChartGeometry): SVGSVGElement {
    const svg = document.createElementNS(SVG_NS, 'svg')
    svg.setAttribute('viewBox', `0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`)
    svg.setAttribute('preserveAspectRatio', 'none')
    // aria-hidden on the SVG — the HOST carries role=img; the svg must never double-announce.
    svg.setAttribute('aria-hidden', 'true')
    svg.setAttribute('focusable', 'false')

    if (this.variant === 'area' && g.area !== null) {
      svg.append(this.#gradientDefsNode())
      const area = document.createElementNS(SVG_NS, 'polygon')
      area.setAttribute('data-part', 'area')
      area.setAttribute('points', g.area)
      area.setAttribute('fill', `url(#${this.#gradientId})`) // ADR-0229 cl.3's gradient paint upgrade
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

  /** The shared `<defs><linearGradient>` node (both states, `variant="area"` only) — two `<stop>`s
   *  targeted by line-chart.css via `data-part`, never an inline `stop-opacity` attribute value (SVG
   *  presentation attributes read plain numbers; the token indirection lives in CSS, the fleet's
   *  established var()-never-in-an-attribute-string convention). */
  #gradientDefsNode(): SVGDefsElement {
    const defs = document.createElementNS(SVG_NS, 'defs')
    const gradient = document.createElementNS(SVG_NS, 'linearGradient')
    gradient.setAttribute('id', this.#gradientId)
    gradient.setAttribute('data-part', 'area-gradient')
    // Default objectBoundingBox (0,0)→(0,1) — top-to-bottom of the area shape's OWN bounding box,
    // independent of either state's viewBox scale (no coordinate math needed here).
    const stopStart = document.createElementNS(SVG_NS, 'stop')
    stopStart.setAttribute('offset', '0%')
    stopStart.setAttribute('data-part', 'area-gradient-stop-start')
    stopStart.setAttribute('stop-color', 'currentColor')
    const stopEnd = document.createElementNS(SVG_NS, 'stop')
    stopEnd.setAttribute('offset', '100%')
    stopEnd.setAttribute('data-part', 'area-gradient-stop-end')
    stopEnd.setAttribute('stop-color', 'currentColor')
    gradient.append(stopStart, stopEnd)
    defs.append(gradient)
    return defs
  }

  /** Layer 1 (AXES state) — the aria-hidden SVG plot: nice-number gridlines, the baseline (cl.1,
   *  inherited), the actual/projected polyline split + area, and the now-marker. Zero inset — the
   *  ADR-0228 plot-layer citizen. */
  #axesPlotNode(g: LineChartAxesGeometry): SVGSVGElement {
    const svg = document.createElementNS(SVG_NS, 'svg')
    svg.setAttribute('viewBox', '0 0 100 100')
    svg.setAttribute('preserveAspectRatio', 'none')
    svg.setAttribute('data-part', 'plot')
    svg.setAttribute('aria-hidden', 'true')
    svg.setAttribute('focusable', 'false')

    for (const tick of g.gridTicks) {
      const y = 100 - tick.pct
      const line = document.createElementNS(SVG_NS, 'line')
      line.setAttribute('data-part', 'grid-line')
      line.setAttribute('x1', '0')
      line.setAttribute('x2', '100')
      line.setAttribute('y1', String(y))
      line.setAttribute('y2', String(y))
      line.setAttribute('vector-effect', 'non-scaling-stroke')
      svg.append(line)
    }

    const actualCount = g.projectedFromIndex ?? g.points.length
    const actualPoints = g.points.slice(0, actualCount)

    if (this.variant === 'area' && actualPoints.length >= 2) {
      svg.append(this.#gradientDefsNode())
      const baselineY = 100 - g.baselinePct
      const areaPoints = [
        ...actualPoints.map((p) => `${p.xPct},${100 - p.yPct}`),
        `${actualPoints[actualPoints.length - 1].xPct},${baselineY}`,
        `${actualPoints[0].xPct},${baselineY}`,
      ].join(' ')
      const area = document.createElementNS(SVG_NS, 'polygon')
      area.setAttribute('data-part', 'area')
      area.setAttribute('points', areaPoints)
      area.setAttribute('fill', `url(#${this.#gradientId})`)
      area.setAttribute('stroke', 'none')
      svg.append(area)
    }

    const baseline = document.createElementNS(SVG_NS, 'line')
    baseline.setAttribute('data-part', 'baseline')
    baseline.setAttribute('x1', '0')
    baseline.setAttribute('y1', String(100 - g.baselinePct))
    baseline.setAttribute('x2', '100')
    baseline.setAttribute('y2', String(100 - g.baselinePct))
    baseline.setAttribute('stroke', 'currentColor')
    baseline.setAttribute('vector-effect', 'non-scaling-stroke')
    svg.append(baseline)

    if (actualPoints.length >= 1) {
      const line = document.createElementNS(SVG_NS, 'polyline')
      line.setAttribute('data-part', 'line')
      line.setAttribute('points', actualPoints.map((p) => `${p.xPct},${100 - p.yPct}`).join(' '))
      line.setAttribute('fill', 'none')
      line.setAttribute('stroke', 'currentColor')
      line.setAttribute('vector-effect', 'non-scaling-stroke')
      line.setAttribute('stroke-linecap', 'round')
      line.setAttribute('stroke-linejoin', 'round')
      svg.append(line)
    }

    // The projected span: a DASHED continuation starting at the last ACTUAL point (contiguous line),
    // or the whole series when every point is projected (REQ-F-015's provisional-span treatment).
    if (g.projectedFromIndex !== null) {
      const startIdx = Math.max(0, g.projectedFromIndex - 1)
      const projectedPoints = g.points.slice(startIdx)
      const line = document.createElementNS(SVG_NS, 'polyline')
      line.setAttribute('data-part', 'line-projected')
      line.setAttribute('points', projectedPoints.map((p) => `${p.xPct},${100 - p.yPct}`).join(' '))
      line.setAttribute('fill', 'none')
      line.setAttribute('stroke', 'currentColor')
      line.setAttribute('vector-effect', 'non-scaling-stroke')
      line.setAttribute('stroke-linecap', 'round')
      line.setAttribute('stroke-linejoin', 'round')
      svg.append(line)
    }

    // The now-marker (baseline dot + a SHORT tick through the category-label band) — the ADR-0228 cl.4
    // mechanism, wave 1's `ui-column-chart` construction reused verbatim for the time axis.
    if (g.nowPct !== null) {
      const dot = document.createElementNS(SVG_NS, 'circle')
      dot.setAttribute('data-part', 'now-dot')
      dot.setAttribute('cx', String(g.nowPct))
      dot.setAttribute('cy', '100')
      svg.append(dot)

      const tick = document.createElementNS(SVG_NS, 'line')
      tick.setAttribute('data-part', 'now-tick')
      tick.setAttribute('x1', String(g.nowPct))
      tick.setAttribute('x2', String(g.nowPct))
      tick.setAttribute('y1', String(100 - NOW_TICK_DEPTH_PCT))
      tick.setAttribute('y2', '100')
      tick.setAttribute('vector-effect', 'non-scaling-stroke')
      svg.append(tick)
    }

    return svg
  }

  /** Layer 2 (AXES state) — the real-DOM chrome: tick-label pills (value scale) + category-label pills
   *  (from `labels`, thinned per the chip-collision law; absent ⇒ none, cl.3's "value ticks only").
   *  Padded by `--ui-line-chart-chrome-inset` — floats INSIDE the plot box, never pushing it (ADR-0228
   *  cl.3's zero-padding-container contract). Pruned from the a11y tree by the host's role=img. */
  #axesChromeNode(g: LineChartAxesGeometry): HTMLElement {
    const chrome = document.createElement('div')
    chrome.setAttribute('data-part', 'chrome')

    for (const tick of g.gridTicks) {
      const chip = document.createElement('div')
      chip.setAttribute('data-part', 'tick-label')
      chip.textContent = tick.text
      chip.style.setProperty('--_tick-pct', String(tick.pct))
      // The ADR-0228 cl.2 chip-collision clamp law (the `ui-column-chart` formula, reused verbatim).
      chip.style.setProperty('--_tick-shift', String(tick.pct - 100))
      chrome.append(chip)
    }

    for (const i of g.categoryChipIndices) {
      const point = g.points[i]
      const chip = document.createElement('div')
      chip.setAttribute('data-part', 'category-label')
      chip.textContent = g.labels[i]
      chip.style.setProperty('--_cat-pct', String(point.xPct))
      // The SAME clamp law, horizontal axis — a line/area point sits at an exact x (edge-anchored,
      // including the true 0%/100% extremes this clamp law was written for) rather than a band center.
      chip.style.setProperty('--_cat-shift', String(-point.xPct))
      chrome.append(chip)
    }

    return chrome
  }
}

if (!customElements.get('ui-line-chart')) customElements.define('ui-line-chart', UILineChartElement) // idempotent self-define
