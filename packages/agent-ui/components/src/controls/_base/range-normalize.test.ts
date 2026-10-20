import { describe, it, expect } from 'vitest'
import { decimalPlaces, normalizeRangeValue } from './range-normalize.ts'

// The shared clamp and snap law (LLD-C1, T-0196): UIRangeElement#normalize and ui-amount-picker both call it.

describe('decimalPlaces', () => {
  it('counts the shortest decimal form, exponents included', () => {
    expect(decimalPlaces(5)).toBe(0)
    expect(decimalPlaces(0.1)).toBe(1)
    expect(decimalPlaces(0.25)).toBe(2)
    expect(decimalPlaces(1e-7)).toBe(7)
    expect(decimalPlaces(-2.5)).toBe(1)
  })
})

describe('normalizeRangeValue', () => {
  it('min > max pins to min (a zero-length range)', () => {
    expect(normalizeRangeValue(50, 10, 5, 1)).toBe(10)
    expect(normalizeRangeValue(-3, 10, 5, 1)).toBe(10)
  })

  it('step <= 0 clamps only, never snaps', () => {
    expect(normalizeRangeValue(3.37, 0, 10, 0)).toBe(3.37)
    expect(normalizeRangeValue(3.37, 0, 10, -1)).toBe(3.37)
    expect(normalizeRangeValue(12, 0, 10, 0)).toBe(10)
    expect(normalizeRangeValue(-1, 0, 10, 0)).toBe(0)
  })

  it('snaps to the nearest step from min', () => {
    expect(normalizeRangeValue(7, 0, 100, 5)).toBe(5)
    expect(normalizeRangeValue(8, 0, 100, 5)).toBe(10)
    expect(normalizeRangeValue(4, 1, 20, 3)).toBe(4)
  })

  it('snaps down when the nearest step would overshoot max', () => {
    // steps from 0 by 3: 0, 3, 6, 9; 9.9 rounds to 12 which overshoots 10, so it snaps down to 9.
    expect(normalizeRangeValue(9.9, 0, 10, 3)).toBe(9)
  })

  it('max is always reachable exactly, even off the step grid', () => {
    expect(normalizeRangeValue(10, 0, 10, 3)).toBe(10)
    expect(normalizeRangeValue(99, 0, 10, 3)).toBe(10)
  })

  it('rounds away binary float error to the places min and step carry (6 * 0.1)', () => {
    expect(normalizeRangeValue(0.6, 0, 1, 0.1)).toBe(0.6)
    expect(normalizeRangeValue(0.61, 0, 1, 0.1)).toBe(0.6)
    expect(normalizeRangeValue(0.35, 0.05, 1, 0.1)).toBe(0.35)
  })
})
