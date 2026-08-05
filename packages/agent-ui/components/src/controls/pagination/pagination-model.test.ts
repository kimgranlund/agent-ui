import { describe, it, expect } from 'vitest'
import { computePageWindow, ELLIPSIS } from './pagination-model.ts'

describe('computePageWindow — the fixed page-window algorithm (ADR-0163 cl.6, SPEC-R3)', () => {
  it('pages <= 0 (incl. negative/non-finite) → [] — the honest empty state', () => {
    expect(computePageWindow(1, 0)).toEqual([])
    expect(computePageWindow(1, -3)).toEqual([])
    expect(computePageWindow(1, Number.NaN)).toEqual([])
  })

  it('pages === 1 → [1]', () => {
    expect(computePageWindow(1, 1)).toEqual([1])
  })

  it('pages === 2 → [1, 2], no ellipsis (dense, no gap)', () => {
    expect(computePageWindow(1, 2)).toEqual([1, 2])
    expect(computePageWindow(2, 2)).toEqual([1, 2])
  })

  it('a dense range (no gap greater than one) never inserts an ellipsis', () => {
    expect(computePageWindow(3, 5)).toEqual([1, 2, 3, 4, 5])
  })

  it('page 1 of 10 — one ellipsis, the tail gap', () => {
    expect(computePageWindow(1, 10)).toEqual([1, 2, ELLIPSIS, 10])
  })

  it('page 5 of 10 (mid-range) — TWO ellipses, one each side', () => {
    expect(computePageWindow(5, 10)).toEqual([1, ELLIPSIS, 4, 5, 6, ELLIPSIS, 10])
  })

  it('page 10 of 10 (last page) — one ellipsis, the head gap', () => {
    expect(computePageWindow(10, 10)).toEqual([1, ELLIPSIS, 9, 10])
  })

  it('never more than one ellipsis per gap, regardless of gap size', () => {
    const items = computePageWindow(1, 1000)
    const ellipses = items.filter((i) => i === ELLIPSIS)
    expect(ellipses).toHaveLength(1)
  })

  it('an out-of-range page (too high) clamps to the last page before windowing', () => {
    expect(computePageWindow(999, 5)).toEqual([1, ELLIPSIS, 4, 5])
  })

  it('an out-of-range page (zero/negative/NaN) clamps to page 1 before windowing', () => {
    expect(computePageWindow(0, 10)).toEqual(computePageWindow(1, 10))
    expect(computePageWindow(-5, 10)).toEqual(computePageWindow(1, 10))
    expect(computePageWindow(Number.NaN, 10)).toEqual(computePageWindow(1, 10))
  })

  it('a non-integer page truncates before windowing', () => {
    expect(computePageWindow(5.9, 10)).toEqual(computePageWindow(5, 10))
  })

  it('every item is a number in [1, pages] or the ELLIPSIS marker — never out of range', () => {
    for (const pages of [3, 7, 25, 100]) {
      for (let page = 1; page <= pages; page++) {
        const items = computePageWindow(page, pages)
        for (const item of items) {
          if (item !== ELLIPSIS) {
            expect(item).toBeGreaterThanOrEqual(1)
            expect(item).toBeLessThanOrEqual(pages)
          }
        }
        // strictly ascending page numbers (ellipsis aside) — anti-vacuous shape check
        const numbers = items.filter((i): i is number => i !== ELLIPSIS)
        for (let i = 1; i < numbers.length; i++) expect(numbers[i]).toBeGreaterThan(numbers[i - 1])
      }
    }
  })
})
