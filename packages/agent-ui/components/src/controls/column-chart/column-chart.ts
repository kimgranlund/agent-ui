// column-chart.ts — UIColumnChartElement, the Display-class axis-bearing STACKED column chart (ADR-0229
// cl.1/cl.2, consuming the shared axis/inset/series vocabulary ADR-0228 mints). BEHAVIOUR + props + the
// generated `role=img` summary + the component-built two-layer DOM (SVG plot + CSS columns + DOM chrome)
// + self-define ONLY; the pure stacking/scale/hardening math lives in column-math.ts (DOM-free,
// unit-testable) and the CSS geometry/paint lives in column-chart.css (aliasing the shared `_chart/
// chart-axis.css` chain into its own `--ui-column-chart-*` token block, the family-tunnel pattern).
//
// Mint, never a `ui-bar-chart` variant (ADR-0229 cl.1): the codec (`values[]` + series meta vs `value`),
// the anatomy (a full axis system vs none), the value semantics (a stack drops negatives as meaningless
// vs `ui-bar-chart`'s legal magnitudes), and the a11y model (role=img + a generated summary vs role=list
// with printed per-row values) all fork from `ui-bar-chart`'s own contract.
//
// The two-layer model (ADR-0228 cl.1-3), realized as THREE full-overlay grid children (`grid-area: 1/1`,
// column-chart.css):
//   1. `[data-part='plot']` — an `aria-hidden` `<svg>` spanning the box edge-to-edge at ZERO inset: nice-
//      number gridlines + the now-marker (baseline dot + a SHORT tick — never a full-height rule).
//   2. `[data-part='columns']` — the CSS-drawn stacked column marks (bar-chart's box-mark law: length-
//      proportional CSS, real DOM text for the printed facts, never SVG `<text>`), ALSO edge-to-edge at
//      zero inset — columns are plot-layer citizens, not chrome.
//   3. `[data-part='chrome']` — every real-DOM TEXT element (tick-label/category-label pills + the
//      static highlight callout), padded by `--ui-column-chart-chrome-inset` so labels float INSIDE the
//      plot box rather than pushing it inward (Kim's zero-padding-container contract, ADR-0228 cl.3) —
//      real DOM text, pruned from the accessible tree by the host's `role=img` (the ARIA img-pruning
//      rule) but sighted and REPEATED in the generated summary for AT parity (cl.5's own citation of the
//      ui-line-chart min/max precedent).
//
// `internals.role = 'img'` is a CONSTANT set directly in connected() (the ui-line-chart precedent) —
// never inside an effect. `ariaLabel` is a SECOND effect: the generated summary (per-series totals/
// extents + point count + the highlighted row's fact, cl.5), recomputed on every geometry-affecting
// prop. `cleanData`/`cleanSeries` run again at the render boundary (not just inside the codec): a
// PROPERTY write of garbage never reaches the math either (the SPEC-R3 AC2 sibling rule the whole family
// applies).

import { UIElement, prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import {
  cleanData,
  cleanSeries,
  columnChartGeometry,
  columnChartSummary,
  columnDataProp,
  seriesProp,
  type ColumnChartGeometry,
  type ColumnRow,
} from './column-math.ts'

const SVG_NS = 'http://www.w3.org/2000/svg'
/** The now-marker's short tick length, in the SAME 0..100 percent space as every other plot coordinate —
 *  a fixed, density-invariant fraction of the plot height (never a full-height rule, ADR-0228 cl.4). */
const NOW_TICK_DEPTH_PCT = 8

const props = {
  data: columnDataProp, // { label: string; values: number[] }[] · safe JSON codec (column-math.ts) · default []
  series: seriesProp, // string[] · safe JSON codec · default [] (single-series fallback names its own "Series N")
  label: { ...prop.string(''), reflect: true }, // the chart's accessible context, e.g. "Revenue by month"
  projected: { ...prop.number(0), reflect: true }, // count of trailing rows rendered as the projected/ghost state (ADR-0228 cl.4)
  highlight: { ...prop.number(null), reflect: true }, // row index for the static callout (ADR-0228 cl.5); null = none
} satisfies PropsSchema

export interface UIColumnChartElement extends ReactiveProps<typeof props> {}
export class UIColumnChartElement extends UIElement {
  static props = props

  protected override connected(): void {
    // A chart is data, not decoration (ADR-0107 cl.4, the ui-line-chart cl.6 inversion): role=img is
    // CONSTANT — set directly, once — never through an effect (there is nothing to toggle it away).
    this.internals.role = 'img'

    // The mark effect (reads data/series/projected/highlight): rebuild the whole three-layer DOM on any
    // geometry-affecting change via one `replaceChildren` (whole-array swap, the family's no-incremental-
    // patch law — A2UI `updateDataModel` semantics).
    this.effect(() => {
      const g = this.#geometry()
      if (g === null) {
        this.replaceChildren()
        return
      }
      this.replaceChildren(this.#plotNode(g), this.#columnsNode(g), this.#chromeNode(g))
    })

    // ARIA effect (reads label + the same geometry + highlight): the generated accessible summary —
    // never null, never aria-hidden (no silent state, with or without a label — cl.5).
    this.effect(() => {
      this.internals.ariaLabel = columnChartSummary(this.label, this.#geometry(), this.#highlightIndex())
    })
  }

  #geometry(): ColumnChartGeometry | null {
    const clamped = Math.max(0, Math.trunc(this.projected ?? 0))
    return columnChartGeometry(cleanData(this.data), cleanSeries(this.series), clamped)
  }

  #highlightIndex(): number | null {
    const h = this.highlight
    return h === null || !Number.isFinite(h) ? null : Math.trunc(h)
  }

  /** Layer 1 — the aria-hidden SVG plot: nice-number gridlines (percent-from-bottom, flipped to SVG y)
   *  + the now-marker (baseline dot + a SHORT tick, never full-height). Zero inset — plot-layer citizen. */
  #plotNode(g: ColumnChartGeometry): SVGSVGElement {
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

  /** Layer 2 — the CSS-drawn stacked columns (aria-hidden: the printed facts live in the chrome layer +
   *  the generated summary, never here). One `[data-part='category']` track per row, one
   *  `[data-part='segment']` per stack segment, geometry via row/segment-scoped custom properties this
   *  file sets imperatively (the bar-chart `--_bar-start`/`--_bar-length` precedent) — column-chart.css
   *  owns every paint decision, this method never writes a `height`. */
  #columnsNode(g: ColumnChartGeometry): HTMLElement {
    const columns = document.createElement('div')
    columns.setAttribute('data-part', 'columns')
    columns.setAttribute('aria-hidden', 'true')

    const highlightIndex = this.#highlightIndex()
    columns.append(
      ...g.rows.map((row, i) => {
        const category = document.createElement('div')
        category.setAttribute('data-part', 'category')
        if (highlightIndex === i) category.setAttribute('data-highlight', '')

        if (row.projected) {
          // ADR-0228 cl.4 — a projected column is ONE hollow, dashed-outline ghost spanning the row's
          // total (not a per-segment outline, which would seam at every stack boundary): the "not yet
          // actual" state is a single shape, never a fill.
          const totalPct = row.segments.reduce((sum, seg) => sum + seg.lengthPct, 0)
          const ghost = document.createElement('div')
          ghost.setAttribute('data-part', 'segment')
          ghost.setAttribute('data-projected', '')
          ghost.style.setProperty('--_seg-start', '0')
          ghost.style.setProperty('--_seg-length', String(totalPct))
          category.append(ghost)
          return category
        }

        for (const seg of row.segments) {
          const segment = document.createElement('div')
          segment.setAttribute('data-part', 'segment')
          segment.setAttribute('data-series', String(seg.seriesIndex))
          const tokenIndex = (seg.seriesIndex % 6) + 1
          segment.style.setProperty('--_seg-start', String(seg.startPct))
          segment.style.setProperty('--_seg-length', String(seg.lengthPct))
          segment.style.setProperty('--_seg-ink', `var(--ui-column-chart-series-${tokenIndex}-ink)`)
          category.append(segment)
        }
        return category
      }),
    )
    return columns
  }

  /** Layer 3 — the real-DOM chrome: tick-label pills (value scale), category-label pills (thinned per
   *  the chip-collision law), and the static highlight callout (ADR-0228 cl.5 — zero-event, data-driven,
   *  `{value} · {category}`, real DOM text). Padded by `--ui-column-chart-chrome-inset` — floats INSIDE
   *  the plot box, never pushing it. Pruned from the a11y tree by the host's role=img; the printed facts
   *  are REPEATED in the generated summary (cl.5's AT-parity rule). */
  #chromeNode(g: ColumnChartGeometry): HTMLElement {
    const chrome = document.createElement('div')
    chrome.setAttribute('data-part', 'chrome')

    for (const tick of g.gridTicks) {
      const chip = document.createElement('div')
      chip.setAttribute('data-part', 'tick-label')
      chip.textContent = tick.text
      chip.style.setProperty('--_tick-pct', String(tick.pct))
      // ADR-0228 cl.2's chip-collision clamp law: a chip CENTERED on its anchor would overflow the
      // plot box at the two extremes (pct=0 the baseline, pct=100 the scale top) — half its own
      // height sticking out past the chrome's own padding edge. Linearly interpolate the vertical
      // shift from -100% (bottom-most: sit entirely ABOVE the anchor) through -50% (centered, mid-
      // scale) to 0% (top-most: sit entirely BELOW) — `pct - 100` does exactly that over [0, 100].
      chip.style.setProperty('--_tick-shift', String(tick.pct - 100))
      chrome.append(chip)
    }

    for (const i of g.categoryChipIndices) {
      const row = g.rows[i]
      const chip = document.createElement('div')
      chip.setAttribute('data-part', 'category-label')
      chip.textContent = row.label
      chip.style.setProperty('--_cat-pct', String(row.centerPct))
      // The SAME clamp law, horizontal axis: `-centerPct` interpolates 0% (leftmost: sit entirely
      // to the RIGHT of the anchor) through -50% (centered) to -100% (rightmost: sit entirely to
      // the LEFT) over centerPct ∈ [0, 100] — end category chips clamp inward rather than overflow.
      chip.style.setProperty('--_cat-shift', String(-row.centerPct))
      chrome.append(chip)
    }

    const highlightIndex = this.#highlightIndex()
    if (highlightIndex !== null && highlightIndex >= 0 && highlightIndex < g.rows.length) {
      chrome.append(this.#calloutNode(g.rows[highlightIndex]))
    }

    return chrome
  }

  #calloutNode(row: ColumnRow): HTMLElement {
    const callout = document.createElement('div')
    callout.setAttribute('data-part', 'callout')
    callout.style.setProperty('--_cat-pct', String(row.centerPct))
    callout.style.setProperty('--_cat-shift', String(-row.centerPct)) // the SAME horizontal clamp law as category-label
    const value = document.createElement('span')
    value.setAttribute('data-part', 'callout-value')
    value.textContent = row.totalText
    const category = document.createElement('span')
    category.setAttribute('data-part', 'callout-label')
    category.textContent = row.label
    // `{value} · {category}` real DOM text (ADR-0228 cl.5) — a plain separator text node between spans.
    callout.append(value, document.createTextNode(' · '), category)
    return callout
  }
}

if (!customElements.get('ui-column-chart')) customElements.define('ui-column-chart', UIColumnChartElement) // idempotent self-define
