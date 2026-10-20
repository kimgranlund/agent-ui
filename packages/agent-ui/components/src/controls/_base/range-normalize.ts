// range-normalize.ts: the one home of the numeric clamp and snap law (range-element.lld.md LLD-C1, T-0196).
// UIRangeElement#normalize and ui-amount-picker both call it, so the Range class and the picker snap a value
// the same way. Pure: no DOM, no signals; the caller passes its own min, max and step.
//
// Layer: controls/_base/, imports nothing.

/** Decimal places in a number's shortest decimal form (0.1 is 1, 0.25 is 2, 5 is 0, 1e-7 is 7), capped at 20 for toFixed. */
export function decimalPlaces(n: number): number {
  const m = /^-?\d*(?:\.(\d+))?(?:e([+-]\d+))?$/i.exec(String(n))
  if (!m) return 0
  return Math.min(20, Math.max(0, (m[1]?.length ?? 0) - Number(m[2] ?? 0)))
}

/**
 * Normalise a raw value against min/max/step.
 * - min > max: zero-length range; pin to min.
 * - step <= 0: continuous; clamp only, no snap.
 * - step not dividing (max-min): the last reachable step is <= max (snap-down);
 *   max itself is always reachable exactly (the platform `<input type=range>` End rule).
 */
export function normalizeRangeValue(raw: number, min: number, max: number, step: number): number {
  if (min > max) return min
  const clamped = Math.max(min, Math.min(max, raw))
  if (step <= 0) return clamped
  // max is always reachable exactly: End goes to max, and clamping to max lands here too.
  if (clamped === max) return max
  const steps = Math.round((clamped - min) / step)
  // `min + steps * step` accumulates binary float error (6 * 0.1 = 0.6000000000000001), so the result
  // is rounded to the decimal places min and step carry: the value reads as the author wrote the step.
  const places = Math.max(decimalPlaces(min), decimalPlaces(step))
  const at = (n: number): number => Number((min + n * step).toFixed(places))
  const snapped = at(steps)
  // snap-down if snapped overshoots max
  return snapped > max ? at(steps - 1) : snapped
}
