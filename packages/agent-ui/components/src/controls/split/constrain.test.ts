import { describe, it, expect } from 'vitest'
import { redistribute, normalizeRatios, reconcileRatios, seedRatios, rederiveRatios } from './constrain.ts'
import type { Bounds } from './constrain.ts'

// n1c — the pure two-neighbor constraint solver (LLD-C3, SPEC-R2). DOM-free: every assertion here is exact
// arithmetic, no element/CSS involved (the value-codec / bar-math.ts precedent).

const UNBOUNDED = (n: number): Bounds[] => Array.from({ length: n }, () => [0, 1])

describe('redistribute — two-neighbor local redistribution (SPEC-R2 AC1)', () => {
  it('grows pane i and shrinks pane i+1 by the same delta; leaves other panes untouched', () => {
    const ratios = [1 / 3, 1 / 3, 1 / 3]
    const next = redistribute(ratios, 0, 0.1, UNBOUNDED(3))
    expect(next[0]).toBeCloseTo(1 / 3 + 0.1, 10)
    expect(next[1]).toBeCloseTo(1 / 3 - 0.1, 10)
    expect(next[2]).toBeCloseTo(1 / 3, 10) // untouched — the "two-neighbor" law
  })

  it('the worked example: 3 equal panes, separator 0 dragged +10% ⇒ 43.3% / 23.3% / 33.3%', () => {
    const next = redistribute([1 / 3, 1 / 3, 1 / 3], 0, 0.1, UNBOUNDED(3))
    expect(next[0]).toBeCloseTo(0.4333333333, 6)
    expect(next[1]).toBeCloseTo(0.2333333333, 6)
    expect(next[2]).toBeCloseTo(0.3333333333, 6)
  })

  it('sum is invariant after ANY resize (±ε) — the load-bearing post-condition', () => {
    const cases: Array<[number[], number, number]> = [
      [[0.5, 0.5], 0, 0.2],
      [[0.5, 0.5], 0, -0.9],
      [[0.2, 0.3, 0.5], 1, 0.15],
      [[0.25, 0.25, 0.25, 0.25], 2, -0.4],
    ]
    for (const [ratios, sep, delta] of cases) {
      const sumBefore = ratios.reduce((a, b) => a + b, 0)
      const next = redistribute(ratios, sep, delta, UNBOUNDED(ratios.length))
      const sumAfter = next.reduce((a, b) => a + b, 0)
      expect(sumAfter, `sum drifted for ${JSON.stringify(ratios)} sep=${sep} delta=${delta}`).toBeCloseTo(sumBefore, 10)
    }
  })

  it('every ratio stays within its bounds after resize', () => {
    const bounds: Bounds[] = [[0.1, 0.6], [0.1, 0.6], [0.1, 0.6]]
    const next = redistribute([1 / 3, 1 / 3, 1 / 3], 0, 5, bounds) // an absurd delta — must still clamp
    expect(next[0]).toBeGreaterThanOrEqual(bounds[0][0] - 1e-9)
    expect(next[0]).toBeLessThanOrEqual(bounds[0][1] + 1e-9)
    expect(next[1]).toBeGreaterThanOrEqual(bounds[1][0] - 1e-9)
    expect(next[1]).toBeLessThanOrEqual(bounds[1][1] + 1e-9)
  })
})

describe('redistribute — clamp at min (SPEC-R2 AC2 + its biting negative control)', () => {
  it('clamps pane j at its min and stops pane i from growing further; pane 2 (non-adjacent) is untouched', () => {
    const ratios = [0.3, 0.1, 0.6] // pane 1 already AT its min (0.1)
    const bounds: Bounds[] = [[0, 1], [0.1, 1], [0, 1]]
    const next = redistribute(ratios, 0, 0.5, bounds) // drag hard — pane 1 cannot shrink below 0.1
    expect(next[1]).toBeCloseTo(0.1, 10) // clamps AT min — never below
    expect(next[0]).toBeCloseTo(0.3, 10) // pane 0 could not grow either — the delta was fully absorbed by pane 1's floor
    expect(next[2]).toBeCloseTo(0.6, 10) // non-adjacent pane 2 — completely untouched
  })

  it('negative control: an UNCLAMPED (buggy) solver would push pane j below its min — this one never does', () => {
    const bounds: Bounds[] = [[0, 1], [0.1, 1]]
    const next = redistribute([0.3, 0.1], 0, 0.5, bounds)
    expect(next[1]).toBeGreaterThanOrEqual(0.1 - 1e-9) // the assertion that BITES if the clamp is dropped
  })
})

describe('redistribute — degenerate / out-of-range inputs never throw', () => {
  it('a single pane (no separator index in range) returns the ratios unchanged', () => {
    expect(redistribute([1], 0, 0.5, UNBOUNDED(1))).toEqual([1])
  })

  it('zero panes returns an empty vector unchanged', () => {
    expect(redistribute([], 0, 0.5, [])).toEqual([])
  })

  it('a stale / out-of-range sepIndex is a no-op (never throws)', () => {
    expect(() => redistribute([0.5, 0.5], 5, 0.1, UNBOUNDED(2))).not.toThrow()
    expect(redistribute([0.5, 0.5], 5, 0.1, UNBOUNDED(2))).toEqual([0.5, 0.5])
    expect(() => redistribute([0.5, 0.5], -1, 0.1, UNBOUNDED(2))).not.toThrow()
  })

  it('contradictory bounds (min > max) clamp to a single pinned point at min — never throws', () => {
    const bounds: Bounds[] = [[0.6, 0.4], [0, 1]] // pane 0's min > max ⇒ its window collapses to exactly [0.6, 0.6]
    expect(() => redistribute([0.5, 0.5], 0, 0.3, bounds)).not.toThrow()
    const next = redistribute([0.5, 0.5], 0, 0.3, bounds)
    expect(next[0]).toBeCloseTo(0.6, 10) // moves TO the single pinned point (from 0.5) — never past it
    const overshoot = redistribute([0.5, 0.5], 0, 5, bounds) // an absurd delta — still clamps at the same point
    expect(overshoot[0]).toBeCloseTo(0.6, 10)
  })
})

describe('normalizeRatios', () => {
  it('scales a vector to sum 1', () => {
    expect(normalizeRatios([1, 1, 2])).toEqual([0.25, 0.25, 0.5])
  })
  it('a zero-sum vector falls back to an equal split (never divides by zero)', () => {
    expect(normalizeRatios([0, 0, 0])).toEqual([1 / 3, 1 / 3, 1 / 3])
  })
  it('a negative-sum / non-finite vector falls back to an equal split', () => {
    expect(normalizeRatios([-1, -1])).toEqual([0.5, 0.5])
    expect(normalizeRatios([Infinity, 1])).toEqual([0.5, 0.5])
  })
  it('empty stays empty', () => {
    expect(normalizeRatios([])).toEqual([])
  })
})

describe('reconcileRatios — sizes length mismatch (SPEC-R2 AC4) never throws', () => {
  it('truncates extra entries and renormalizes', () => {
    const next = reconcileRatios([0.5, 0.3, 0.2], 2)
    expect(next.length).toBe(2)
    expect(next.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10)
    expect(next[0]).toBeCloseTo(0.5 / 0.8, 10) // proportional to the survivors' original share
  })
  it('equal-fills missing entries then renormalizes', () => {
    const next = reconcileRatios([0.5], 3)
    expect(next.length).toBe(3)
    expect(next.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10)
  })
  it('count <= 0 returns an empty vector, never throws', () => {
    expect(reconcileRatios([0.5, 0.5], 0)).toEqual([])
    expect(() => reconcileRatios([], -1)).not.toThrow()
  })
  it('all-zero reconciled vector falls back to equal split (not a NaN propagation)', () => {
    expect(reconcileRatios([], 4)).toEqual([0.25, 0.25, 0.25, 0.25])
  })
})

describe('seedRatios — the connect-time seed (SPEC-R2 §2)', () => {
  it('no pane declares a size — equal split', () => {
    expect(seedRatios([undefined, undefined, undefined])).toEqual([1 / 3, 1 / 3, 1 / 3])
  })
  it('every pane declares a size — normalized proportionally', () => {
    expect(seedRatios([1, 3])).toEqual([0.25, 0.75])
  })
  it('a mix: declared panes keep their seed, undeclared equally split the remainder', () => {
    const next = seedRatios([0.6, undefined, undefined])
    expect(next[0]).toBeCloseTo(0.6, 10)
    expect(next[1]).toBeCloseTo(0.2, 10)
    expect(next[2]).toBeCloseTo(0.2, 10)
    expect(next.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10)
  })
  it('an over-declared sum (> 1) still normalizes to a valid vector, never throws', () => {
    const next = seedRatios([0.8, 0.8])
    expect(() => next).not.toThrow()
    expect(next.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10)
  })
  it('a non-positive / non-finite declared size is treated as undeclared', () => {
    expect(seedRatios([0, -1, NaN, undefined])).toEqual([0.25, 0.25, 0.25, 0.25])
  })
  it('empty input returns an empty vector', () => {
    expect(seedRatios([])).toEqual([])
  })
})

describe('rederiveRatios — dynamic panes (SPEC-R2 AC5) never throws, always sums to 1', () => {
  it('shrink: a removed pane\'s share is absorbed by the survivors', () => {
    const next = rederiveRatios([0.5, 0.3, 0.2], [undefined, undefined])
    expect(next.length).toBe(2)
    expect(next.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10)
  })
  it('growth: an added pane (no declared size) takes an equal share carved from the survivors', () => {
    const prev = [0.5, 0.5]
    const next = rederiveRatios(prev, [undefined, undefined, undefined])
    expect(next.length).toBe(3)
    expect(next.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10)
    // survivors shrank (made room) but kept EQUAL relative proportion to each other
    expect(next[0]).toBeCloseTo(next[1], 10)
    expect(next[0]).toBeLessThan(prev[0]) // anti-vacuous: the survivors' share actually shrank
  })
  it('growth: an added pane WITH a declared size seeds from it', () => {
    const next = rederiveRatios([0.5, 0.5], [undefined, undefined, 0.5])
    expect(next.length).toBe(3)
    expect(next[2]).toBeCloseTo(0.5, 6) // the declared seed dominates (normalized to sum 1, but it's the largest share)
    expect(next.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10)
  })
  it('from zero panes: a pure seed', () => {
    expect(rederiveRatios([], [1, 1])).toEqual([0.5, 0.5])
  })
  it('to zero panes: empty', () => {
    expect(rederiveRatios([0.5, 0.5], [])).toEqual([])
  })
  it('never throws across a matrix of shrink/grow/degenerate transitions', () => {
    const matrix: Array<[number[], number]> = [
      [[1], 0], [[], 1], [[0.5, 0.5], 5], [[0.2, 0.2, 0.2, 0.2, 0.2], 1], [[1], 1],
    ]
    for (const [prev, nextCount] of matrix) {
      expect(() => rederiveRatios(prev, Array.from({ length: nextCount }, () => undefined))).not.toThrow()
      const next = rederiveRatios(prev, Array.from({ length: nextCount }, () => undefined))
      if (nextCount > 0) expect(next.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10)
    }
  })
})
