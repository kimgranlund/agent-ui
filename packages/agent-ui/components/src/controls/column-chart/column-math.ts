// column-math.ts — the pure, DOM-free math for `ui-column-chart` (ADR-0229 cl.1/cl.2). No DOM, no
// signals, unit-testable without a browser — the sparkline-math.ts/bar-math.ts/line-chart-math.ts/
// pie-math.ts construction discipline: each chart control owns its own self-contained pure module: input
// hardening (SPEC-R7-class safe codec) + the geometry the shared `_chart/axis-math.ts` module does not
// own itself (per-row STACKING is this control's own law, not the shared axis module's — axis-math.ts
// stays generic nice-number/percent primitives any axis-bearing chart composes, never a per-mark law).
//
// The data schema is category-major (ADR-0229 cl.2): `data: { label: string; values: number[] }[]` +
// `series: string[]`. A row survives hardening iff its `label` is a non-empty string AND every one of
// its OWN given `values` is a finite, non-negative number (stack semantics — a negative segment cannot
// be drawn in a stack, the ADR-0219 "meaningless value dropped, not clamped" hardening class, applied to
// the WHOLE row rather than a single datum, since a stack's segments are not independently addressable
// data points the way a bar-list row is). A row's `values` array is then padded with trailing zeros (NOT
// truncated — the "given" length may be shorter than the resolved series count) or sliced to the
// resolved series count when longer — the "ragged rows padded with 0, never thrown" rule (cl.2).

import type { PropConfig, PropType } from '../../dom/props.ts'
import { niceScale, categoryPercentCenters, nowMarkerPercent, thinnedIndices, type NiceScale } from '../_chart/axis-math.ts'

/** One raw category-major datum (the A2UI-emittable shape, ADR-0229 cl.2): `{ label, values }`. */
export interface ColumnDatum {
  label: string
  values: number[]
}

/** One rendered stack segment — a series' slice of one category's column, in `[0, 100]` PERCENT of the
 *  resolved value scale (0 = the shared zero baseline). */
export interface ColumnSegment {
  seriesIndex: number
  value: number
  startPct: number
  lengthPct: number
}

/** One rendered category row: the hardened datum plus its stacked segments, category-axis percent
 *  center, total (printed), and whether it falls in the trailing PROJECTED span (ADR-0228 cl.4). */
export interface ColumnRow {
  label: string
  values: readonly number[]
  segments: readonly ColumnSegment[]
  total: number
  totalText: string
  centerPct: number
  projected: boolean
}

/** One resolved value-scale gridline: the tick VALUE, its printed text, and its percent-from-BOTTOM
 *  position (0 = baseline, 100 = the scale's top) — a consuming control flips to a block-start
 *  distance from the top (`100 - pct`, ADR-0230 cl.1: `inset-block-start` on an HTML div, never SVG
 *  `y`) at the render boundary, never here. */
export interface GridTick {
  value: number
  text: string
  pct: number
}

export interface ColumnChartGeometry {
  rows: readonly ColumnRow[]
  series: readonly string[]
  scale: NiceScale
  gridTicks: readonly GridTick[]
  /** Category-axis chip indices to actually RENDER after chip-collision thinning (ADR-0228 cl.2) — a
   *  subset of `[0, rows.length)`, ascending, first/last always present for a non-empty axis. */
  categoryChipIndices: readonly number[]
  /** The COARSE subset of `categoryChipIndices` that survives the container-query ladder's medium rung
   *  (ADR-0230 cl.4) — `thinnedIndices` re-applied over the RENDERED chip list at a cap of 4, endpoint-
   *  preserving by construction, mapped back onto original row indices. A consuming control marks every
   *  rendered category chip NOT in this subset with the fine-tier density attribute; the medium rung's
   *  CSS hides it. Count-derived at render, width-blind — only the CSS rung itself is width-aware. */
  coarseCategoryChipIndices: readonly number[]
  /** The actual/projected boundary percent (ADR-0228 cl.4's now-marker), or `null` when there is none. */
  nowPct: number | null
}

const numberFormat = new Intl.NumberFormat()

/**
 * Harden an arbitrary `data` input (ADR-0229 cl.2): a non-array input is `[]`; a row survives only with
 * a non-empty string `label` and an array `values` whose every entry is a finite, non-negative number —
 * an entry that fails EITHER test drops the WHOLE row (stack semantics: a negative/non-finite segment
 * has no legal position in a stack). Order is preserved (positional, the family's duplicate-label law).
 */
export function cleanData(input: unknown): ColumnDatum[] {
  if (!Array.isArray(input)) return []
  const out: ColumnDatum[] = []
  for (const entry of input) {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) continue
    const label = (entry as { label?: unknown }).label
    const values = (entry as { values?: unknown }).values
    if (typeof label !== 'string' || label === '' || !Array.isArray(values)) continue
    if (!values.every((v): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0)) continue
    out.push({ label, values: [...values] })
  }
  return out
}

/** Harden an arbitrary `series` input: a non-array (or non-string-array) input is `[]`; non-string
 *  entries drop (never coerced — a series NAME is identity, not a printable number). */
export function cleanSeries(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  return input.filter((v): v is string => typeof v === 'string')
}

/**
 * The resolved series COUNT: `series.length` when non-empty (the multi-series contract), else the widest
 * surviving row's `values.length` (the single-series/no-series-meta fallback, `values: [n]` with no
 * `series` prop — ADR-0229 cl.2's "one shape, no union codec"), floored at 1 so a chart with data but no
 * series meta and all-empty value rows still resolves a real, positive series count.
 */
function resolveSeriesCount(rows: readonly ColumnDatum[], series: readonly string[]): number {
  if (series.length > 0) return series.length
  let widest = 0
  for (const r of rows) if (r.values.length > widest) widest = r.values.length
  return Math.max(1, widest)
}

/** Pad (with trailing zeros) or slice `values` to exactly `count` entries — the ragged-row law (cl.2). */
function toSeriesCount(values: readonly number[], count: number): number[] {
  if (values.length === count) return [...values]
  if (values.length > count) return values.slice(0, count)
  return [...values, ...Array<number>(count - values.length).fill(0)]
}

/**
 * The full render geometry over the HARDENED row set (call `cleanData`/`cleanSeries` first — this
 * function does not re-harden, mirroring bar-math.ts's `barRows`/line-chart-math.ts's split). `null`
 * when there are no rows to render (the empty-host case every chart-family control shares).
 * `projectedCount` is `Math.max(0, Math.trunc(rawProjected))` clamped to `rows.length` by the caller
 * (this function trusts an already-clamped count, per the props layer's own hardening boundary).
 */
export function columnChartGeometry(
  rows: readonly ColumnDatum[],
  rawSeries: readonly string[],
  projectedCount: number,
  maxTicks = 5,
  maxCategoryChips = 8,
): ColumnChartGeometry | null {
  if (rows.length === 0) return null
  const seriesCount = resolveSeriesCount(rows, rawSeries)
  const series = rawSeries.length > 0 ? rawSeries : Array.from({ length: seriesCount }, (_, i) => `Series ${i + 1}`)
  const normalized = rows.map((r) => toSeriesCount(r.values, seriesCount))
  const totals = normalized.map((values) => values.reduce((sum, v) => sum + v, 0))
  const scale = niceScale(0, Math.max(0, ...totals), { maxTicks })
  const centers = categoryPercentCenters(rows.length)
  const n = rows.length
  const clampedProjected = Math.min(Math.max(0, Math.trunc(projectedCount)), n)

  const renderedRows: ColumnRow[] = rows.map((r, i) => {
    const values = normalized[i]
    const total = totals[i]
    let cursor = 0
    const segments: ColumnSegment[] = values.map((value, seriesIndex) => {
      const startPct = (cursor / scale.max) * 100
      const lengthPct = (value / scale.max) * 100
      cursor += value
      return { seriesIndex, value, startPct, lengthPct }
    })
    return {
      label: r.label,
      values,
      segments,
      total,
      totalText: numberFormat.format(total),
      centerPct: centers[i],
      projected: i >= n - clampedProjected,
    }
  })

  const gridTicks: GridTick[] = scale.ticks.map((value) => ({
    value,
    text: numberFormat.format(value),
    pct: scale.max === scale.min ? 0 : ((value - scale.min) / (scale.max - scale.min)) * 100,
  }))

  const categoryChipIndices = thinnedIndices(n, maxCategoryChips)
  // ADR-0230 cl.4 — the medium container rung's coarse tier: re-apply `thinnedIndices` over the RENDERED
  // chip list (not the raw row indices) at a fixed cap of 4. `thinnedIndices` is endpoint-preserving by
  // construction (its k=0/k=keep-1 slots always pin index 0 and n-1 of whatever list it's given), so this
  // keeps both ends of `categoryChipIndices` — never a parity/`:nth-child` selection, which would drop an
  // endpoint on an even rendered count (the rejected alternative, ADR-0230 Consequences).
  const coarsePositions = thinnedIndices(categoryChipIndices.length, 4)
  const coarseCategoryChipIndices = coarsePositions.map((p) => categoryChipIndices[p])

  return {
    rows: renderedRows,
    series,
    scale,
    gridTicks,
    categoryChipIndices,
    coarseCategoryChipIndices,
    nowPct: nowMarkerPercent(n, clampedProjected),
  }
}

/**
 * The generated accessible summary (ADR-0229 cl.5 verbatim: "per-series totals/extents + point
 * count") — never null. `n>=1`: `{n} categories, {k} series: {series[0]} {total[0]}, {series[1]}
 * {total[1]}, …; low {min}, high {max}` — the PER-SERIES totals (summed across every category) print
 * each series' own printed LABEL beside its number, the real-DOM-absent identity carrier ADR-0229
 * cl.2/ADR-0057 require ("series identity = ORDER + printed series label + ink, fill never the sole
 * carrier") — a multi-series stack's series names are otherwise dead data nowhere else printed. The
 * trailing `low`/`high` are the category-TOTAL extents (the "extents" half of cl.5's own conjunction).
 * `n=0`/null geometry: `no data`. A valid `highlight` row's fact is REPEATED here (the ARIA img-pruning
 * rule — sighted callout text + AT parity, the ui-line-chart min/max precedent): `; highlighted {label}
 * {totalText}`. A non-empty `label` prefixes as `{label}: {summary}`.
 */
export function columnChartSummary(label: string, g: ColumnChartGeometry | null, highlightIndex: number | null): string {
  if (g === null) return label ? `${label}: no data` : 'no data'
  const totals = g.rows.map((r) => r.total)
  const min = Math.min(...totals)
  const max = Math.max(...totals)
  const seriesTotals = g.series.map((_, k) => g.rows.reduce((sum, r) => sum + (r.values[k] ?? 0), 0))
  const seriesClause = g.series.map((name, k) => `${name} ${numberFormat.format(seriesTotals[k])}`).join(', ')
  let summary = `${g.rows.length} categor${g.rows.length === 1 ? 'y' : 'ies'}, ${g.series.length} series: ${seriesClause}; low ${numberFormat.format(min)}, high ${numberFormat.format(max)}`
  if (highlightIndex !== null && highlightIndex >= 0 && highlightIndex < g.rows.length) {
    const row = g.rows[highlightIndex]
    summary += `; highlighted ${row.label} ${row.totalText}`
  }
  return label ? `${label}: ${summary}` : summary
}

// ── the safe `data`/`series` codecs (the sparkline/bar-chart/line-chart construction, LLD-C1's own
//    reasoning restated: dom/props.ts's generic jsonType<T>() is deliberately NOT used — its bare
//    JSON.parse throws on malformed attributes and maps a removed attribute to `null`, both forbidden
//    from reaching the render path) ──────────────────────────────────────────────────────────────────

const columnDataType: PropType<ColumnDatum[]> = {
  from(attr) {
    if (attr === null) return []
    try {
      return cleanData(JSON.parse(attr))
    } catch {
      return []
    }
  },
  to(value) {
    return JSON.stringify(value)
  },
}

export const columnDataProp: PropConfig<ColumnDatum[]> = {
  type: columnDataType,
  default: [],
}

const seriesType: PropType<string[]> = {
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

export const seriesProp: PropConfig<string[]> = {
  type: seriesType,
  default: [],
}
