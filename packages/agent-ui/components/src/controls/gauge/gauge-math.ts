// gauge-math.ts — the pure, DOM-free math for `ui-gauge` (ADR-0229 cl.4). No DOM, no signals,
// unit-testable without a browser — the sparkline-math.ts/bar-math.ts/pie-math.ts/column-math.ts
// construction discipline: each chart control owns its own self-contained pure module.
//
// The data schema (ADR-0229 cl.4) is the fleet row VERBATIM (`BarChart`/`PieChart`'s own shape):
// `data: { label: string; value: number }[]`. Each ring is an INDEPENDENT 0-100 progress value —
// NOT part-of-whole (unlike ui-pie-chart, values never sum to a total and are never renormalized
// against each other; a gauge with three rings at 90/60/30 renders three rings each reading its OWN
// percent, never `value / Σ`). A datum survives hardening with a non-empty string `label` and a
// finite `number` `value`; the surviving value is then CLAMPED into `[0, 100]` — never DROPPED for
// being out of range (a documented hardening DIVERGENCE from `ui-pie-chart`'s `cleanData`, which
// drops a negative/non-finite value instead of clamping it: a negative SHARE of a whole is
// meaningless and has no legal position, but an independent progress reading of -20 or 140 is simply
// an over/under-run of a real metric, clamped to the displayable range — the GH #1208 `ui-stat
// variant="ring"` `ringPercent()` precedent, `stat-model.ts`).
//
// Geometry: concentric SVG `<circle>` rings sharing one center, each drawn as a TRACK circle (the
// full, unfilled ring) plus a PROGRESS circle whose `stroke-dasharray`/`stroke-dashoffset` reveal
// exactly `clampedValue` percent of its circumference, rounded caps via `stroke-linecap` (CSS) — the
// standard SVG radial-gauge technique. Ring order = data order, OUTER to INNER (ADR-0229 cl.4: "ring
// fills step the shared series ramp outer→inner" — ring 0 is the outermost, largest-radius ring and
// gets the ramp's brightest step). No arc-math is shared with `pie-math.ts`'s path-based
// `slicePath`/`fullRingPath` helpers: a circle + dasharray progress ring is a materially different
// SVG technique from a path-sector wedge (no start/end sweep angle, no wedge path to build, no
// donut-hole inner-radius arc) — forcing a shared abstraction over two different primitives for a
// single `round()` helper in common would be an artificial coupling, not a real one. The shared
// `_chart/axis-math.ts` module is likewise not consumed here: it is cartesian axis math (nice-number
// ticks, percent-from-baseline positions) for AXIS-BEARING charts; a radial, axis-free mark is
// explicitly N/A for that vocabulary (ADR-0228's own per-mark N/A grammar) — this control renders no
// gridlines, tick/category chips, now-marker, or projected-ghost treatment at all.

import type { PropConfig, PropType } from '../../dom/props.ts'

/** One raw gauge datum — the fleet's `{label, value}[]` row verbatim (ADR-0229 cl.4). */
export interface GaugeDatum {
  label: string
  value: number
}

/** One rendered ring: the hardened datum plus its identity/geometry carriers. */
export interface GaugeRing extends GaugeDatum {
  /** 0-based, DOM order = data order = OUTER-to-INNER ring order (cl.4). */
  index: number
  /** The datum's `value`, clamped into `[0, 100]` — never dropped for being out of range. */
  clampedValue: number
  /** Intl `style: 'percent'`-formatted (0 decimals default) — the legend row's printed value. */
  percentText: string
  /** This ring's radius, in the `VIEWBOX_SIZE`-square viewBox — OUTER_RADIUS minus `index * RING_STEP`,
   *  floored at 1 so a large ring count still resolves a real, positive, drawable radius (never 0/negative). */
  radius: number
  /** `2 * π * radius` — the `stroke-dasharray` length that makes the progress circle's whole
   *  circumference exactly one dash. */
  circumference: number
  /** `circumference * (1 - clampedValue / 100)` — the `stroke-dashoffset` that reveals exactly
   *  `clampedValue` percent of the circle, clockwise from 12 o'clock (paired with a -90deg rotation
   *  at the render boundary). */
  dashOffset: number
  /** 1..6, cycling — indexes `--ui-gauge-series-{tokenIndex}-ink` (cl.4's outer→inner ramp step). */
  tokenIndex: number
}

/** The computed geometry for one render pass — `rings` is `[]` for empty/all-invalid data (the
 *  empty-host case every chart-family control shares; a real, positive whole-shape floor still
 *  paints via the host's own CSS, never data-dependent). */
export interface GaugeGeometry {
  rings: readonly GaugeRing[]
}

/** The normalized square viewBox side length (the `pie-math.ts` `VIEWBOX_SIZE` convention). */
export const VIEWBOX_SIZE = 100
/** The outermost ring's radius — a small margin inside the viewBox for the non-scaling stroke. */
export const OUTER_RADIUS = 40
/** The radial spacing between successive ring centerlines (outer→inner). */
export const RING_STEP = 11

/** Round to 2 decimals — stable coordinate/value strings (the pie-math.ts/column-math.ts precedent,
 *  test-friendly, avoids float-tail churn). */
function round2(v: number): number {
  return Math.round(v * 100) / 100
}

/**
 * Harden an arbitrary `data` input (ADR-0229 cl.4): a non-array input yields `[]`; an entry survives
 * only as a plain object with a NON-EMPTY `string` `label` and a finite `number` `value` — dropped
 * (never coerced) when either check fails. A SURVIVING value is NOT range-checked here — clamping is
 * `gaugeRows`'s job (the render-geometry boundary), so a caller inspecting the hardened set still sees
 * the raw (unclamped) value if it needs it. Order is preserved — no sorting, no folding (the agent
 * orders its own data, the whole chart-family law).
 */
export function cleanData(input: unknown): GaugeDatum[] {
  if (!Array.isArray(input)) return []
  const out: GaugeDatum[] = []
  for (const entry of input) {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) continue
    const label = (entry as { label?: unknown }).label
    const value = (entry as { value?: unknown }).value
    if (typeof label !== 'string' || label === '') continue
    if (typeof value !== 'number' || !Number.isFinite(value)) continue
    out.push({ label, value })
  }
  return out
}

// Module-memoized: one Intl percent formatter (default locale, 0 decimals — the pie-math.ts default).
const percentFormat = new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 0 })

/**
 * The independent-percent ring geometry (ADR-0229 cl.4): every HARDENED datum (call `cleanData` first
 * — this function does not re-harden, mirroring `pie-math.ts`'s `pieRows`/`column-math.ts`'s
 * `columnChartGeometry` split) becomes one ring, in order, outer→inner, its `value` CLAMPED into
 * `[0, 100]` (never dropped), its fill token cycling 1..6 down the shared series ramp.
 */
export function gaugeRows(data: readonly GaugeDatum[]): GaugeGeometry {
  const rings: GaugeRing[] = data.map((d, index) => {
    const clampedValue = Math.min(100, Math.max(0, d.value))
    const radius = Math.max(1, OUTER_RADIUS - index * RING_STEP)
    const circumference = round2(2 * Math.PI * radius)
    const dashOffset = round2(circumference * (1 - clampedValue / 100))
    return {
      ...d,
      index,
      clampedValue,
      percentText: percentFormat.format(clampedValue / 100),
      radius,
      circumference,
      dashOffset,
      tokenIndex: (index % 6) + 1,
    }
  })
  return { rings }
}

// ── the safe `data` codec — the sparkline/bar-chart/pie-chart/column-chart construction (LLD-C1's own
//    reasoning restated: dom/props.ts's generic jsonType<T>() is deliberately NOT used — its bare
//    JSON.parse throws on malformed attributes and maps a removed attribute to `null`, both forbidden
//    from reaching the render path) ──────────────────────────────────────────────────────────────────

const gaugeDataType: PropType<GaugeDatum[]> = {
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

export const gaugeDataProp: PropConfig<GaugeDatum[]> = {
  type: gaugeDataType,
  default: [],
}
