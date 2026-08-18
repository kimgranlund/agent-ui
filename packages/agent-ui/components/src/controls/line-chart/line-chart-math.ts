// line-chart-math.ts — the pure, DOM-free math for `ui-line-chart` (ADR-0205). No DOM, no signals,
// unit-testable without a browser — the same construction discipline as sparkline-math.ts/bar-math.ts (each
// chart control owns its own self-contained pure module; the family shares the SHAPE of the split, not the
// module itself).
//
// ADR-0205's axis vocabulary (v1): a baseline `<line>` (the zero line when the series' value range spans
// zero, else the value FLOOR — cl.1) plus two textual min/max labels, always shown (cl.3). The viewBox is a
// real chart TILE (cl.5) — a fixed, wider-than-tall box with vertical margin reserved top/bottom so the
// plotted line/baseline never hug the svg's own edges, room that visually lines up with the two label ROWS
// the element renders as real DOM text ABOVE/BELOW the svg (line-chart.ts's 3-row CSS grid: label-max / svg /
// label-min) — unlike sparkline's decorative normalized 100x100 mark.
//
// Ordinal spacing by index, same formula shape as sparklineGeometry: x(i) = n===1 ? W/2 : (i/(n-1))*W.
// Vertical range auto-normalizes to the rendered set's [min, max] (NOT a zero-based domain — that is the
// bar-chart family's law, not this one): y(v) = span===0 ? mid : PLOT_TOP + PLOT_HEIGHT - ((v-min)/span)*PLOT_HEIGHT.
// The baseline VALUE (cl.1) is 0 when the range spans zero (min <= 0 <= max), else the value floor (min) —
// deliberately NOT the bar-chart zero-baseline law (which always measures from 0); an all-positive line
// chart's "floor" is its own minimum, not the axis origin. The baseline's Y coordinate rides the SAME y(v)
// mapping as every data point, so it always lands inside (or at the edge of) the plotted range.

import type { PropConfig, PropType } from '../../dom/props.ts'

/** The real chart-tile viewBox (cl.5) — wider than tall, unlike sparkline's decorative 100x100 square. */
export const VIEWBOX_WIDTH = 300
export const VIEWBOX_HEIGHT = 150
/** Vertical margin reserved top/bottom for breathing room + visual parity with the two external label rows. */
export const PLOT_MARGIN_Y = 25
export const PLOT_TOP = PLOT_MARGIN_Y // 25
export const PLOT_HEIGHT = VIEWBOX_HEIGHT - 2 * PLOT_MARGIN_Y // 100
export const PLOT_BOTTOM = PLOT_TOP + PLOT_HEIGHT // 125

export interface LineChartGeometry {
  points: string // SVG polyline `points` in the VIEWBOX_WIDTH x VIEWBOX_HEIGHT viewBox (y grows DOWN)
  area: string | null // the closed fill polygon's points (line + a close back to the BASELINE); null when count < 2
  baselineY: number // the baseline <line>'s y1/y2, rounded (same coordinate space as `points`)
  count: number
  min: number
  max: number // facts over the RENDERED set (the summary's + labels' inputs)
  minText: string // locale-formatted min (Intl.NumberFormat, default locale) — the min label's text content
  maxText: string // locale-formatted max — the max label's text content
}

/** Round to 2 decimals — stable coordinate strings (test-friendly, avoids float-tail churn; the sparkline precedent). */
function round2(v: number): number {
  return Math.round(v * 100) / 100
}

/** Hardening (mirrors sparkline's cleanSeries/SPEC-R3): non-array -> []; entries kept only if
 *  `typeof v === 'number' && Number.isFinite(v)`. Runs again at the render boundary (not just inside the
 *  codec) so a PROPERTY write of garbage never reaches the math either. */
export function cleanSeries(input: unknown): number[] {
  if (!Array.isArray(input)) return []
  return input.filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
}

// Module-memoized: one Intl.NumberFormat (default locale) for every label/summary (the sparkline/bar-chart precedent).
const numberFormat = new Intl.NumberFormat()

/** null when the clean series is empty (mirrors sparklineGeometry's `g === null` empty-clears-host contract —
 *  line-chart.ts clears its children the same way sparkline.ts does). Coordinates rounded to 2 decimals. */
export function lineChartGeometry(values: readonly number[]): LineChartGeometry | null {
  const n = values.length
  if (n === 0) return null

  let min = values[0]
  let max = values[0]
  for (const v of values) {
    if (v < min) min = v
    if (v > max) max = v
  }
  const span = max - min

  const yOf = (v: number): number =>
    span === 0 ? PLOT_TOP + PLOT_HEIGHT / 2 : PLOT_TOP + PLOT_HEIGHT - ((v - min) / span) * PLOT_HEIGHT

  const coords = values.map((v, i) => {
    const x = n === 1 ? VIEWBOX_WIDTH / 2 : (i / (n - 1)) * VIEWBOX_WIDTH
    return `${round2(x)},${round2(yOf(v))}`
  })
  const points = n === 1 ? `${coords[0]} ${coords[0]}` : coords.join(' ')

  // cl.1: zero-line when the range spans zero, else the value FLOOR (min) — not the bar-chart zero-baseline.
  const baselineValue = min <= 0 && 0 <= max ? 0 : min
  const baselineY = round2(yOf(baselineValue))

  // area closes to the BASELINE (not the geometric bottom edge, unlike sparkline) — the fill sits between the
  // line and the axis reference, honest even when the baseline sits mid-chart (a spanning-zero series).
  const firstX = round2(n === 1 ? VIEWBOX_WIDTH / 2 : 0)
  const lastX = round2(n === 1 ? VIEWBOX_WIDTH / 2 : VIEWBOX_WIDTH)
  const area = n >= 2 ? `${points} ${lastX},${baselineY} ${firstX},${baselineY}` : null

  return { points, area, baselineY, count: n, min, max, minText: numberFormat.format(min), maxText: numberFormat.format(max) }
}

/** The generated accessible summary (ADR-0205 cl.6: label + min/max + point count) — exact wordings:
 *  n>=2: `{n} points, low {min}, high {max}` · n=1: `1 point, value {v}` · n=0/null: `no data`; a non-empty
 *  label prefixes as `{label}: {summary}` (the sparklineSummary precedent). */
export function lineChartSummary(label: string, g: LineChartGeometry | null): string {
  const summary =
    g === null
      ? 'no data'
      : g.count === 1
        ? `1 point, value ${numberFormat.format(g.min)}`
        : `${g.count} points, low ${g.minText}, high ${g.maxText}`
  return label ? `${label}: ${summary}` : summary
}

/** The safe `values` codec (the SAME construction as sparklineValuesProp — dom/props.ts's generic
 *  `jsonType<T>()` is deliberately NOT used: its bare `JSON.parse` throws on malformed attributes and maps a
 *  removed attribute to `null`, both forbidden from reaching the render path): `from(null) = []`,
 *  malformed JSON caught -> [], the parsed value always run through `cleanSeries`. */
const lineChartValuesType: PropType<number[]> = {
  from(attr) {
    if (attr === null) return []
    try {
      return cleanSeries(JSON.parse(attr))
    } catch {
      return []
    }
  },
  to(value) {
    return JSON.stringify(value)
  },
}

export const lineChartValuesProp: PropConfig<number[]> = {
  type: lineChartValuesType,
  default: [],
}
