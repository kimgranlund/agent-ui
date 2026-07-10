// constrain.ts — the pure N-pane ratio math for ui-split (LLD-C3, app-surfaces-m4.lld.md §2.3; SPEC-R2).
// DOM-free by construction (the value-codec / bar-math.ts precedent: the hard math isolated from the
// element so it is independently unit-testable and the element stays a thin DOM/ARIA/event adapter over
// it). Every function here operates purely on ratio vectors (numbers summing to ~1) and [min,max] ratio
// windows — resolving a CSS length (px/%/rem) to a ratio, and measuring the live container extent, is the
// ELEMENT's job (split.ts), which then calls in here with already-resolved ratio-space numbers.
//
// Four functions, each SPEC-R2-traceable:
//   • redistribute   — two-neighbor LOCAL resize (the core drag/keyboard-step math, SPEC-R2 §2 + AC1/AC2).
//   • normalizeRatios — scale a vector to sum 1 (degenerate/zero-sum ⇒ equal-fill, never NaN/throw).
//   • reconcileRatios — a `sizes` length MISMATCH repair: truncate extra, equal-fill missing, normalize
//     (SPEC-R2 AC4 — the controlled-`sizes` path, and the shrink leg of dynamic panes AC5).
//   • seedRatios      — the CONNECT-time seed from each pane's own `size` prop (declared panes keep their
//     seed; undeclared panes equally split what's left), normalized (SPEC-R2 §2 "uncontrolled ... seeded").
//   • rederiveRatios  — the GROWTH leg of dynamic panes (SPEC-R2 AC5): survivors shrink proportionally to
//     make room; new panes take their own `size` seed or an equal share of the carved-out remainder.

/** A pane's [min, max] extent, in RATIO space (already resolved against the live container extent). */
export type Bounds = [number, number]

/** Normalize a possibly-inverted bounds pair: `min > max` clamps to `[min, min]` (SPEC §2.3 "contradictory
 *  bounds ⇒ clamp to min" — the pane is pinned at its own min, never a negative-width window). */
function normalizeBounds([min, max]: Bounds): Bounds {
  return min > max ? [min, min] : [min, max]
}

/**
 * Two-neighbor local redistribution (SPEC-R2 §2, the core contract). Dragging/stepping separator `sepIndex`
 * by `deltaRatio` grows pane `i = sepIndex` and shrinks pane `j = i + 1` by the SAME amount — sum-invariant
 * by construction (adding `d` to one and subtracting `d` from the other never changes their sum) — clamped
 * to the tightest of both neighbors' `[min, max]` windows. The residual (whatever `deltaRatio` couldn't fit)
 * is DROPPED — push-through to non-adjacent panes is reserved (LLD §8 fork F5, not v1). Never throws: an
 * out-of-range `sepIndex` (0/1-pane degenerate case, or a stale index) returns `ratios` unchanged.
 */
export function redistribute(ratios: number[], sepIndex: number, deltaRatio: number, bounds: Bounds[]): number[] {
  const i = sepIndex
  const j = i + 1
  if (!Number.isInteger(i) || i < 0 || j >= ratios.length) return ratios.slice()
  const [minI, maxI] = normalizeBounds(bounds[i] ?? [0, 1])
  const [minJ, maxJ] = normalizeBounds(bounds[j] ?? [0, 1])
  // The achievable delta window: pane i's own [min,max] bounds it directly; pane j's [min,max] bounds it
  // INVERTED (j SHRINKS as delta grows). The combined window is the intersection of both — the tightest
  // constraint wins, and a delta outside it clamps to the nearest edge (the residual silently drops).
  const lo = Math.max(minI - ratios[i], ratios[j] - maxJ)
  const hi = Math.min(maxI - ratios[i], ratios[j] - minJ)
  const clamped = lo > hi ? 0 : Math.max(lo, Math.min(hi, deltaRatio)) // lo>hi: a degenerate/contradictory window — hold in place
  const next = ratios.slice()
  next[i] = ratios[i] + clamped
  next[j] = ratios[j] - clamped
  return next
}

/** Scale a ratio vector to sum to 1. A zero-sum, negative-sum, or non-finite vector (degenerate input)
 *  falls back to an EQUAL split rather than dividing by zero / propagating NaN. Empty stays empty. */
export function normalizeRatios(ratios: number[]): number[] {
  const n = ratios.length
  if (n === 0) return []
  const sum = ratios.reduce((a, b) => a + b, 0)
  if (!Number.isFinite(sum) || sum <= 0) return ratios.map(() => 1 / n)
  return ratios.map((r) => r / sum)
}

/**
 * Reconcile a ratio vector to a target pane COUNT (SPEC-R2 AC4 — a `sizes` length mismatch; also the
 * SHRINK leg of AC5's dynamic panes): extra entries are DROPPED (truncate), missing entries are EQUAL-
 * FILLED, then the whole vector is normalized to sum 1 — so a removed pane's share is absorbed by the
 * survivors automatically (normalizing after truncation redistributes proportionally). Never throws;
 * `count <= 0` returns `[]`.
 */
export function reconcileRatios(ratios: number[], count: number): number[] {
  if (count <= 0) return []
  const next = ratios.slice(0, count)
  while (next.length < count) next.push(0)
  if (next.every((r) => r === 0)) return next.map(() => 1 / count)
  return normalizeRatios(next)
}

/** A pane's declared `size` seed, or `null`/`undefined` when unset (the "equal-fill the rest" case). */
export type SizeSeed = number | null | undefined

const isDeclared = (s: SizeSeed): s is number => typeof s === 'number' && Number.isFinite(s) && s > 0

/**
 * The CONNECT-time seed (SPEC-R2 §2, uncontrolled mode): each pane with a declared, positive, finite
 * `size` keeps it as its seed; panes with none equally split whatever ratio remains. The whole vector is
 * then normalized to sum 1 regardless (so an over-declared set of sizes, e.g. summing > 1, still resolves
 * to a valid ratio vector rather than an invalid one). Empty input ⇒ `[]`.
 */
export function seedRatios(sizes: SizeSeed[]): number[] {
  const n = sizes.length
  if (n === 0) return []
  const declaredSum = sizes.reduce((a: number, s) => a + (isDeclared(s) ? s : 0), 0)
  const undeclaredCount = sizes.filter((s) => !isDeclared(s)).length
  if (undeclaredCount === n) return sizes.map(() => 1 / n) // nobody declared a size — equal split
  const remaining = Math.max(0, 1 - Math.min(1, declaredSum))
  const equalShare = undeclaredCount > 0 ? remaining / undeclaredCount : 0
  return normalizeRatios(sizes.map((s) => (isDeclared(s) ? s : equalShare)))
}

/**
 * Re-derive an UNCONTROLLED ratio vector when the pane COUNT changes after connect (SPEC-R2 AC5, the
 * dynamic-panes contract — load-bearing: the app-tier consumers add/remove panes at runtime).
 *   • Shrink (`nextCount <= prevCount`) — delegates to `reconcileRatios` (truncate + renormalize; the
 *     survivors absorb the removed panes' share).
 *   • No prior panes (`prevCount === 0`) — a pure seed from the new full `sizes` vector.
 *   • Growth — the NEW panes (the tail of `sizes`, one per added slot) take their own declared `size` or
 *     an equal share of a carved-out "reserved" portion (declared-sum, or `addedCount/nextCount` when
 *     none declare — whichever is larger, capped at 95% so survivors never lose their entire share); the
 *     SURVIVING panes' ratios shrink proportionally (their RELATIVE proportions among themselves are
 *     preserved) to make room. Always normalizes to sum 1; never throws.
 */
export function rederiveRatios(prevRatios: number[], sizes: SizeSeed[]): number[] {
  const prevCount = prevRatios.length
  const nextCount = sizes.length
  if (nextCount === 0) return []
  if (nextCount <= prevCount) return reconcileRatios(prevRatios, nextCount)
  if (prevCount === 0) return seedRatios(sizes)

  const addedSizes = sizes.slice(prevCount)
  const addedDeclaredSum = addedSizes.reduce((a: number, s) => a + (isDeclared(s) ? s : 0), 0)
  const addedUndeclaredCount = addedSizes.filter((s) => !isDeclared(s)).length
  const equalShareGuess = addedSizes.length / nextCount
  const reservedTotal = Math.min(0.95, Math.max(addedDeclaredSum, equalShareGuess))
  const survivorScale = 1 - reservedTotal
  const survivors = prevRatios.map((r) => r * survivorScale)
  const addedEqualShare = addedUndeclaredCount > 0 ? Math.max(0, reservedTotal - addedDeclaredSum) / addedUndeclaredCount : 0
  const added = addedSizes.map((s) => (isDeclared(s) ? s : addedEqualShare))
  return normalizeRatios([...survivors, ...added])
}
