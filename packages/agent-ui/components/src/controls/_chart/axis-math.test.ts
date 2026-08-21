import { describe, it, expect } from 'vitest'
import { niceStep, niceScale, valueToPercent, categoryPercentCenters, nowMarkerPercent, thinnedIndices, round2 } from './axis-math.ts'

// axis-math.test.ts — the pure-math unit suite for the shared ADR-0228 axis subsystem. No DOM, no
// browser (this module has none to test) — the bar-math.test.ts/line-chart-math.test.ts precedent.

describe('niceStep — 1/2/5 × 10ⁿ rounding', () => {
  it('rounds a raw step up to the nearest nice fraction, per decade', () => {
    expect(niceStep(0.9)).toBe(1)
    expect(niceStep(1.4)).toBe(2)
    expect(niceStep(3)).toBe(5)
    expect(niceStep(7)).toBe(10)
    expect(niceStep(14)).toBe(20)
    expect(niceStep(35)).toBe(50)
    expect(niceStep(70)).toBe(100)
  })

  it('degenerates non-finite/non-positive input to 1 (never throws, never 0/NaN/negative)', () => {
    expect(niceStep(0)).toBe(1)
    expect(niceStep(-5)).toBe(1)
    expect(niceStep(NaN)).toBe(1)
    expect(niceStep(Infinity)).toBe(1)
  })
})

describe('niceScale — the resolved zero-anchored domain', () => {
  it('spans zero by default, snapping to a nice step and inclusive tick set', () => {
    const s = niceScale(0, 23)
    expect(s.min).toBe(0)
    expect(s.step).toBeGreaterThan(0)
    expect(s.max).toBeGreaterThanOrEqual(23)
    expect(s.ticks[0]).toBe(s.min)
    expect(s.ticks[s.ticks.length - 1]).toBe(s.max)
    // every tick is step-spaced
    for (let i = 1; i < s.ticks.length; i++) expect(round2(s.ticks[i] - s.ticks[i - 1])).toBe(s.step)
  })

  it('honors explicit min/max pins over the auto-zero-inclusion default', () => {
    const s = niceScale(40, 90, { pinMin: 20, pinMax: 100 })
    expect(s.min).toBeLessThanOrEqual(20)
    expect(s.max).toBeGreaterThanOrEqual(100)
  })

  it('degenerate all-zero / single-point data still resolves a real, positive span (never divides by zero downstream)', () => {
    const s = niceScale(0, 0)
    expect(s.max).toBeGreaterThan(s.min)
    expect(s.step).toBeGreaterThan(0)
  })

  it('a target tick count of 5 stays in the right neighborhood for a round number', () => {
    const s = niceScale(0, 100)
    expect(s.ticks.length).toBeGreaterThanOrEqual(4)
    expect(s.ticks.length).toBeLessThanOrEqual(8)
  })
})

describe('valueToPercent — clamped percent within a domain', () => {
  it('maps the domain endpoints to 0/100 and the midpoint to 50', () => {
    expect(valueToPercent(0, 0, 100)).toBe(0)
    expect(valueToPercent(100, 0, 100)).toBe(100)
    expect(valueToPercent(50, 0, 100)).toBe(50)
  })

  it('clamps out-of-domain values rather than extrapolating', () => {
    expect(valueToPercent(-10, 0, 100)).toBe(0)
    expect(valueToPercent(110, 0, 100)).toBe(100)
  })

  it('a zero-span domain reads every value as 0 (no divide-by-zero)', () => {
    expect(valueToPercent(5, 10, 10)).toBe(0)
  })
})

describe('categoryPercentCenters — evenly-spaced band centers', () => {
  it('one category centers at 50%', () => {
    expect(categoryPercentCenters(1)).toEqual([50])
  })

  it('four categories center at the 12.5/37.5/62.5/87.5% band midpoints', () => {
    expect(categoryPercentCenters(4)).toEqual([12.5, 37.5, 62.5, 87.5])
  })

  it('n <= 0 is the empty set', () => {
    expect(categoryPercentCenters(0)).toEqual([])
    expect(categoryPercentCenters(-3)).toEqual([])
  })
})

describe('nowMarkerPercent — the actual/projected boundary', () => {
  it('sits at the boundary between the last actual and first projected category', () => {
    // 8 categories, last 2 projected → boundary at index 6 of 8 → 75%
    expect(nowMarkerPercent(8, 2)).toBe(75)
  })

  it('is null when there is no projected span', () => {
    expect(nowMarkerPercent(8, 0)).toBeNull()
  })

  it('is null when every category is projected (no actual/projected boundary exists)', () => {
    expect(nowMarkerPercent(8, 8)).toBeNull()
    expect(nowMarkerPercent(8, 10)).toBeNull()
  })

  it('is null for zero categories (nothing to boundary against)', () => {
    expect(nowMarkerPercent(0, 1)).toBeNull()
  })
})

describe('thinnedIndices — chip-collision density thinning (never shrink type, drop intermediates)', () => {
  it('keeps every index when the count already fits', () => {
    expect(thinnedIndices(5, 8)).toEqual([0, 1, 2, 3, 4])
  })

  it('thins to first/last plus an evenly-stepped subset when over budget', () => {
    const kept = thinnedIndices(12, 4)
    expect(kept.length).toBeLessThanOrEqual(4)
    expect(kept[0]).toBe(0)
    expect(kept[kept.length - 1]).toBe(11)
    // strictly ascending, no duplicates
    for (let i = 1; i < kept.length; i++) expect(kept[i]).toBeGreaterThan(kept[i - 1])
  })

  it('a single category never disappears', () => {
    expect(thinnedIndices(1, 4)).toEqual([0])
  })

  it('an empty axis thins to nothing', () => {
    expect(thinnedIndices(0, 4)).toEqual([])
  })

  it('max<=1 still keeps at least the first index', () => {
    expect(thinnedIndices(6, 1)).toEqual([0])
    expect(thinnedIndices(6, 0)).toEqual([0])
  })
})
