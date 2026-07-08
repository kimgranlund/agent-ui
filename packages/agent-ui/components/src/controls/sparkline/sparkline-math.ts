// sparkline-math.ts — the pure, DOM-free math for `ui-sparkline` (LLD-C1, chart-family.lld.md §2).
// Everything here is a plain function over numbers/strings — no DOM, no signals, unit-testable without a
// browser (SPEC-N2: jsdom/browser truth is the ELEMENT's job; this module's truth is arithmetic).
//
// Ordinal spacing by index (SPEC §2 "Series"): x(i) = n===1 ? 50 : (i/(n-1))*100. Auto vertical range:
// y(v) = span===0 ? 50 : 100 - ((v-min)/span)*100 — the zero-range case (all-equal, n>=2) and negative
// values both fall out of this one formula (SPEC-R3 rows 4/5), no special-casing beyond span===0.
// n===1 duplicates its single coordinate ("50,{y} 50,{y}") so a round `stroke-linecap` paints a dot
// (SPEC-R3 row 3) with no second element kind. `area` (the closed fill polygon) is built only for n>=2.

import type { PropConfig } from '../../dom/props.ts'

export interface SparklineGeometry {
  points: string // SVG polyline `points` in the 0..100 x 0..100 viewBox (y grows DOWN)
  area: string | null // the closed fill polygon's points (line + `100,100 0,100`); null when count < 2
  count: number
  first: number
  last: number
  min: number
  max: number // facts over the RENDERED set (the summary's inputs)
}

/** Round to 2 decimals — stable coordinate strings (test-friendly, avoids float-tail churn). */
function round2(v: number): number {
  return Math.round(v * 100) / 100
}

/** Hardening (SPEC-R3): non-array -> []; entries kept only if `typeof v === 'number' && Number.isFinite(v)`. */
export function cleanSeries(input: unknown): number[] {
  if (!Array.isArray(input)) return []
  return input.filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
}

/** null when the clean series is empty. Coordinates rounded to 2 decimals (stable strings for tests). */
export function sparklineGeometry(values: readonly number[]): SparklineGeometry | null {
  const n = values.length
  if (n === 0) return null

  let min = values[0]
  let max = values[0]
  for (const v of values) {
    if (v < min) min = v
    if (v > max) max = v
  }
  const span = max - min

  const coords = values.map((v, i) => {
    const x = n === 1 ? 50 : (i / (n - 1)) * 100
    const y = span === 0 ? 50 : 100 - ((v - min) / span) * 100
    return `${round2(x)},${round2(y)}`
  })

  const points = n === 1 ? `${coords[0]} ${coords[0]}` : coords.join(' ')
  const area = n >= 2 ? `${points} 100,100 0,100` : null

  return { points, area, count: n, first: values[0], last: values[n - 1], min, max }
}

// Module-memoized: one Intl.NumberFormat (default locale) for every summary — SPEC-R4's grounding note
// ("numbers formatted with the platform default-locale Intl.NumberFormat") and its own perf hygiene.
const numberFormat = new Intl.NumberFormat()

/** The SPEC-R4 sentence — exact wordings, Intl.NumberFormat (default locale, module-memoized) numbers:
 *  n>=2: `{n} points, starts {first}, ends {last}, low {min}, high {max}` · n=1: `1 point, value {v}`
 *  · n=0/null: `no data`; a non-empty label prefixes as `{label}: {summary}`. */
export function sparklineSummary(label: string, g: SparklineGeometry | null): string {
  const fmt = (v: number): string => numberFormat.format(v)
  const summary =
    g === null
      ? 'no data'
      : g.count === 1
        ? `1 point, value ${fmt(g.first)}`
        : `${g.count} points, starts ${fmt(g.first)}, ends ${fmt(g.last)}, low ${fmt(g.min)}, high ${fmt(g.max)}`
  return label ? `${label}: ${summary}` : summary
}

/** The safe values codec (SPEC-R3 row 1/2): `from(attr)` = null -> [], JSON.parse in try/catch -> [] on
 *  throw, then cleanSeries; `to` = JSON.stringify. dom/props.ts `jsonType` is NOT used — its bare
 *  JSON.parse throws on malformed attributes and maps a removed attribute to `null`, both of which
 *  SPEC-R3 forbids reaching the render path (verified against props.ts:73-82). */
export const sparklineValuesProp: PropConfig<number[]> = {
  type: {
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
  },
  default: [],
}
