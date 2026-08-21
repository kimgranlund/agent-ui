// axis-math.ts — the shared, DOM-free axis-math module (ADR-0228 cl.1/cl.2): the fleet's ONE nice-
// number tick algorithm (1/2/5 × 10ⁿ over a resolved value domain, honoring optional min/max pins) plus
// the percent-position primitives every axis-bearing chart's own per-control math module composes into
// its OWN gridline/tick-label/category-label/now-marker geometry. Pure, DOM-free, unit-testable without
// a browser — the `_base`/`_surface` shared-module precedent (ADR-0107 cl.3/cl.7), generalized to the
// axis subsystem ADR-0228 names. Not a trait, not an element (ADR-0228 cl.1's own rejection of both) —
// this module has no lifecycle and no host; it is math only. Each consuming control still stamps its OWN
// `data-part` DOM from the positions this module returns (the descriptor/trip-wire system stays
// per-control, ADR-0228 cl.1).
//
// Coordinate convention: every position this module returns is a PERCENT (0..100) within the plot box,
// with the VALUE axis measured bottom-up (0% = the domain minimum / bottom edge, 100% = the domain
// maximum / top edge) — a consuming control's SVG viewBox (y grows down) converts with `100 - pct`
// exactly once, at the render boundary, never inside this module. The CATEGORY axis is index-based and
// left-to-right (0% = the first category's leading edge, 100% = the last category's trailing edge) —
// deliberately physical, not bidi-mirrored (the ui-sparkline/ui-line-chart precedent: a series reads
// data order, not text direction).

/** One resolved value-axis scale: the nice-rounded [min, max] domain, its step, and every tick VALUE the
 *  domain spans (inclusive of both ends, evenly spaced by `step`). */
export interface NiceScale {
  readonly min: number
  readonly max: number
  readonly step: number
  readonly ticks: readonly number[]
}

/** Round `rawStep` UP to the nearest "nice" 1/2/5 × 10ⁿ step (ADR-0228 cl.2's tick math) — the classic
 *  d3/uPlot-class algorithm, hand-rolled under the zero-dep pillar (ADR-0107). A non-finite or
 *  non-positive input degenerates to `1` (never throws, never returns 0/negative/NaN — the family's
 *  input-hardening law applied to axis math itself). */
export function niceStep(rawStep: number): number {
  if (!Number.isFinite(rawStep) || rawStep <= 0) return 1
  const exponent = Math.floor(Math.log10(rawStep))
  const base = Math.pow(10, exponent)
  const fraction = rawStep / base
  const niceFraction = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10
  return niceFraction * base
}

/** Resolve a nice-number scale over `[dataMin, dataMax]` (both ALWAYS include 0 in the span — every
 *  chart-family axis is zero-anchored, the ui-bar-chart precedent — unless a pin overrides one end).
 *  `opts.pinMin`/`opts.pinMax` (ADR-0228's "honoring optional min/max pins") clamp that end to the
 *  caller's exact value instead of the auto-zero-inclusion; `opts.maxTicks` (default 5) is the target
 *  tick COUNT the nice step aims for — never a hard cap, since a nice step can under/overshoot by one.
 *  Degenerate inputs (a zero-span domain, non-finite data) still resolve to a real, positive span so a
 *  caller never divides by zero (mirrors bar-math.ts's `span === 0` guard, generalized). */
export function niceScale(
  dataMin: number,
  dataMax: number,
  opts?: { readonly maxTicks?: number; readonly pinMin?: number; readonly pinMax?: number },
): NiceScale {
  const maxTicks = opts?.maxTicks ?? 5
  const safeMin = Number.isFinite(dataMin) ? dataMin : 0
  const safeMax = Number.isFinite(dataMax) ? dataMax : 0
  let lo = opts?.pinMin ?? Math.min(0, safeMin)
  let hi = opts?.pinMax ?? Math.max(0, safeMax)
  if (hi <= lo) hi = lo + 1 // degenerate guard — always a real, positive span (all-zero / single-value data)
  const step = niceStep((hi - lo) / Math.max(1, maxTicks))
  const min = Math.floor(lo / step) * step
  const max = Math.ceil(hi / step) * step
  const ticks: number[] = []
  // `step / 1e6` slack absorbs float accumulation over the loop so the true top tick is never dropped.
  for (let v = min; v <= max + step / 1e6; v += step) ticks.push(round2(v))
  return { min: round2(min), max: round2(max), step: round2(step), ticks }
}

/** `value` as a percent (0..100, CLAMPED) within `[domainMin, domainMax]` — 0 at the domain minimum, 100
 *  at the domain maximum. A zero-span domain (degenerate) reads every value as `0` rather than dividing
 *  by zero. */
export function valueToPercent(value: number, domainMin: number, domainMax: number): number {
  const span = domainMax - domainMin
  if (span <= 0) return 0
  return clamp(((value - domainMin) / span) * 100, 0, 100)
}

/** The `n` category BAND CENTERS, evenly spaced across `[0, 100]` (each band is `100/n` wide) — the
 *  category axis's own tick positions (month/day labels, one per rendered row). `n <= 0` is `[]` (the
 *  empty-data case a consuming control's own hardening already reduces to before calling this). */
export function categoryPercentCenters(n: number): readonly number[] {
  if (n <= 0) return []
  const band = 100 / n
  return Array.from({ length: n }, (_, i) => round2((i + 0.5) * band))
}

/** The BOUNDARY percent between the last ACTUAL and first PROJECTED category (ADR-0228 cl.4's
 *  now-marker position) — the left edge of the first projected band, i.e. `(categoryCount -
 *  projectedCount) / categoryCount * 100`. `null` when there is no real boundary to draw: no projected
 *  span (`projectedCount <= 0`), every category projected (`projectedCount >= categoryCount`), or no
 *  categories at all — the ADR-0228 cl.4 / REQ-F-016 "explicit no-op is a contract, not an accident"
 *  rule, realized as a typed absence rather than a degenerate `0`/`100`. */
export function nowMarkerPercent(categoryCount: number, projectedCount: number): number | null {
  if (categoryCount <= 0 || projectedCount <= 0 || projectedCount >= categoryCount) return null
  const boundaryIndex = categoryCount - projectedCount
  return round2((boundaryIndex / categoryCount) * 100)
}

/** Density thinning over an ordered set of category positions (ADR-0228 cl.2's chip-collision law,
 *  "overlapping intermediate pills DROP — density thinning, never font shrink"): keep every category
 *  when `n <= max`, else keep the FIRST, the LAST, and an evenly-stepped subset between them so the kept
 *  count never exceeds `max` — indices into the original `[0, n)` range, ascending, first/last always
 *  present (the corner-clearance anchors a consuming control's chip layout relies on). `max < 2` still
 *  returns at least the first/last pair when `n >= 2` (a chip set with only start/end is the honest
 *  floor, never zero chips for a non-empty axis). */
export function thinnedIndices(n: number, max: number): readonly number[] {
  if (n <= 0) return []
  if (n === 1 || max <= 1) return [0]
  if (n <= max) return Array.from({ length: n }, (_, i) => i)
  const keep = Math.max(2, max)
  const out = new Set<number>()
  for (let k = 0; k < keep; k++) out.add(Math.round((k / (keep - 1)) * (n - 1)))
  return [...out].sort((a, b) => a - b)
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

/** Round to 2 decimals — stable coordinate/value strings (the bar-math.ts/line-chart-math.ts precedent:
 *  test-friendly, avoids float-tail churn). */
export function round2(v: number): number {
  return Math.round(v * 100) / 100
}
