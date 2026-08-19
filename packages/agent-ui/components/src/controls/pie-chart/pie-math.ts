// pie-math.ts — the pure, DOM-free math for `ui-pie-chart` (ADR-0219). No DOM, no signals,
// unit-testable without a browser — the same self-contained-module discipline as bar-math.ts/
// line-chart-math.ts (each chart control owns its own pure module; the family shares the SHAPE of
// the split, not the module itself).
//
// Reuses BarChart's `{label, value}[]` data-row shape verbatim (ADR-0219 cl.2/SPEC §5.2) but hardens
// it DIFFERENTLY: a part-of-whole slice is meaningless when negative (there is no "negative share of
// a whole"), so `cleanData` here drops non-finite/negative values AND empty labels — a documented
// hardening difference from `bar-math.ts`'s `cleanData`, which allows both negatives (legal
// magnitudes) and empty-string labels (LLD-C4's duplicate/empty-label row). No "Other" folding, no
// sorting (ADR-0219 cl.2) — the mark makes no analysis; the agent orders its own data.
//
// Geometry (ADR-0219 cl.4/cl.7): one `<path>` arc per slice, clockwise from 12 o'clock, in a
// normalized square viewBox (`VIEWBOX_SIZE`). `variant='donut'` cuts an inner-radius hole (leaving
// room for a SIBLING composition in the consumer's layout, cl.6 — this control paints nothing there);
// `variant='pie'` is a solid sector (innerRadius=0). A single 100%-share slice (or the empty/all-zero
// track) is drawn as a full ANNULUS/disc via `fullRingPath` (an evenodd compound path: outer circle +
// inner circle, opposite winding) — the standard SVG technique that sidesteps the degenerate
// same-start/end-point arc a naive 360° sweep would hit.
//
// Identity (cl.3/cl.4): every rendered slice carries an INDEX (DOM order = data order = clockwise
// order), its label, its Intl-formatted percent (`value / Σ rendered`, 0 decimals default — the
// angle-is-weak condition's numeric carrier), and a `tokenIndex` 1..6 cycling into the
// `--ui-pie-chart-slice-{1..6}-ink` lightness ramp (the hue-never-alone condition's fourth carrier).

import type { PropConfig, PropType } from '../../dom/props.ts'

/** One pie-chart datum — the A2UI-emittable shape (ADR-0219 cl.2, the `BarChart` row schema verbatim). */
export interface PieDatum {
  label: string
  value: number
}

/** A rendered slice: the datum plus its identity carriers (index/percent/path/token) — ADR-0219 cl.3/cl.4. */
export interface PieSlice extends PieDatum {
  /** 0-based DOM order = data order = clockwise order from 12 o'clock (cl.4). */
  index: number
  /** Intl `style: 'percent'`-formatted share of the rendered total, 0 decimals default (cl.3). */
  percentText: string
  /** The slice's SVG path `d`, in the `VIEWBOX_SIZE` x `VIEWBOX_SIZE` viewBox. */
  pathD: string
  /** 1..6, cycling — indexes into `--ui-pie-chart-slice-{tokenIndex}-ink` (cl.4). */
  tokenIndex: number
}

/** The computed geometry for one render pass. `slices` is `[]` when the rendered total is 0 (no
 *  valid data, or every valid value is 0) — cl.2's "an all-zero/empty rendered set paints an empty
 *  track ring + no key rows." `trackPathD` is always computable (the whole-shape floor never depends
 *  on data) and is what's drawn in place of slices when `slices.length === 0`. */
export interface PieGeometry {
  slices: PieSlice[]
  total: number
  trackPathD: string
}

/** The normalized square viewBox side length. */
export const VIEWBOX_SIZE = 100
const CENTER = VIEWBOX_SIZE / 2
/** The ring's outer radius — a small margin inside the viewBox for the non-scaling separator stroke. */
export const OUTER_RADIUS = 48
/** The donut hole's inner radius — leaves visible room for a sibling composition (ADR-0219 cl.6). */
export const INNER_RADIUS = 26

/** Round to 2 decimals — stable coordinate strings (the sparkline/line-chart precedent, test-friendly). */
function round2(v: number): number {
  return Math.round(v * 100) / 100
}

/**
 * Harden an arbitrary input into the rendered datum set (ADR-0219 cl.2): a non-array input yields
 * `[]`; an entry survives only as a plain object with a NON-EMPTY `string` `label` and a finite,
 * NON-NEGATIVE `number` `value` — dropped, never coerced/clamped (a negative part-of-whole value is
 * meaningless, not a legal magnitude to clamp toward zero). Order is preserved — no sorting, no
 * folding (the agent orders its own data).
 */
export function cleanData(input: unknown): PieDatum[] {
  if (!Array.isArray(input)) return []
  const out: PieDatum[] = []
  for (const entry of input) {
    if (
      entry !== null &&
      typeof entry === 'object' &&
      !Array.isArray(entry) &&
      typeof (entry as { label?: unknown }).label === 'string' &&
      (entry as { label: string }).label !== '' &&
      typeof (entry as { value?: unknown }).value === 'number' &&
      Number.isFinite((entry as { value?: unknown }).value) &&
      (entry as { value: number }).value >= 0
    ) {
      const e = entry as { label: string; value: number }
      out.push({ label: e.label, value: e.value })
    }
  }
  return out
}

/** A point on a circle of radius `r` centered at `(cx, cy)`, at `angleDeg` measured CLOCKWISE from
 *  12 o'clock (0deg = straight up). SVG's native y-down coordinate system makes this the same
 *  direction as a positive sweep-flag arc — no axis flip needed. */
function polarPoint(cx: number, cy: number, r: number, angleDeg: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180
  return { x: round2(cx + r * Math.sin(rad)), y: round2(cy - r * Math.cos(rad)) }
}

/** A full ring (donut, `innerR > 0`) or full disc (pie, `innerR <= 0`) as ONE evenodd compound path —
 *  the empty/all-zero track AND a single 100%-share slice both draw this (sidesteps the degenerate
 *  0°/360° same-point arc a naive full-sweep arc command would hit). */
export function fullRingPath(cx: number, cy: number, outerR: number, innerR: number): string {
  const outerLeft = round2(cx - outerR)
  const outerRight = round2(cx + outerR)
  const outer = `M ${outerRight} ${cy} A ${outerR} ${outerR} 0 1 0 ${outerLeft} ${cy} A ${outerR} ${outerR} 0 1 0 ${outerRight} ${cy} Z`
  if (innerR <= 0) return outer
  const innerLeft = round2(cx - innerR)
  const innerRight = round2(cx + innerR)
  const inner = `M ${innerRight} ${cy} A ${innerR} ${innerR} 0 1 1 ${innerLeft} ${cy} A ${innerR} ${innerR} 0 1 1 ${innerRight} ${cy} Z`
  return `${outer} ${inner}`
}

/** One slice's wedge path — a donut annulus segment (`innerR > 0`, two arcs + two radial closes) or a
 *  pie sector (`innerR <= 0`, straight lines to/from center). `sweepDeg` in `(0, 360)` exclusive — a
 *  sweep at/past 360 (the single-rendered-slice 100% case) is the caller's `fullRingPath` job instead;
 *  a zero-or-negative sweep (a legal 0-value datum) draws nothing (`''`, harmless as an SVG `d`). */
export function slicePath(cx: number, cy: number, outerR: number, innerR: number, startDeg: number, endDeg: number): string {
  const sweep = endDeg - startDeg
  if (sweep <= 0) return ''
  if (sweep >= 359.999) return fullRingPath(cx, cy, outerR, innerR)
  const largeArc = sweep > 180 ? 1 : 0
  const startOuter = polarPoint(cx, cy, outerR, startDeg)
  const endOuter = polarPoint(cx, cy, outerR, endDeg)
  if (innerR <= 0) {
    return `M ${cx} ${cy} L ${startOuter.x} ${startOuter.y} A ${outerR} ${outerR} 0 ${largeArc} 1 ${endOuter.x} ${endOuter.y} Z`
  }
  const startInner = polarPoint(cx, cy, innerR, endDeg)
  const endInner = polarPoint(cx, cy, innerR, startDeg)
  return `M ${startOuter.x} ${startOuter.y} A ${outerR} ${outerR} 0 ${largeArc} 1 ${endOuter.x} ${endOuter.y} L ${startInner.x} ${startInner.y} A ${innerR} ${innerR} 0 ${largeArc} 0 ${endInner.x} ${endInner.y} Z`
}

// Module-memoized: one Intl percent formatter (default locale, 0 decimals — ADR-0219 cl.3 default).
const percentFormat = new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 0 })

/**
 * The part-of-whole geometry (ADR-0219 cl.2/cl.3/cl.4/cl.7): `total = Σ rendered values`. `total <= 0`
 * (empty input or every valid value is exactly 0) ⇒ `slices: []` — an empty track ring, no key rows
 * (cl.2). Otherwise every datum becomes one slice, in order, its sweep proportional to
 * `value / total`, its fill token cycling 1..6 down the lightness ramp (cl.4).
 */
export function pieRows(data: readonly PieDatum[], variant: 'donut' | 'pie'): PieGeometry {
  const innerR = variant === 'donut' ? INNER_RADIUS : 0
  const trackPathD = fullRingPath(CENTER, CENTER, OUTER_RADIUS, innerR)
  const total = data.reduce((sum, d) => sum + d.value, 0)
  if (data.length === 0 || total <= 0) return { slices: [], total: 0, trackPathD }

  let angle = 0
  const slices = data.map((d, index) => {
    const sweep = (d.value / total) * 360
    const start = angle
    const end = angle + sweep
    angle = end
    return {
      ...d,
      index,
      percentText: percentFormat.format(d.value / total),
      pathD: slicePath(CENTER, CENTER, OUTER_RADIUS, innerR, start, end),
      tokenIndex: (index % 6) + 1,
    }
  })
  return { slices, total, trackPathD }
}

/** The safe `data` codec — the SAME construction as `barDataProp`/`lineChartValuesProp`:
 *  `from(null) = []` (never `null`), malformed JSON caught -> `[]`, the parsed value always run
 *  through `cleanData` so a raw, un-hardened array never reaches a property read. */
const pieDataType: PropType<PieDatum[]> = {
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

export const pieDataProp: PropConfig<PieDatum[]> = {
  type: pieDataType,
  default: [],
}
