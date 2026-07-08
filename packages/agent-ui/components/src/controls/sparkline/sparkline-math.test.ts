import { describe, it, expect } from 'vitest'
import { cleanSeries, sparklineGeometry, sparklineSummary, sparklineValuesProp } from './sparkline-math.ts'

// sparkline-math.test.ts — LLD-C1 math unit probes (jsdom-free; pure functions over numbers/strings).
// Covers chart-family.lld.md §7's per-case ledger rows 1/2/3/5 as they apply to the sparkline, plus the
// SPEC-R4 exact wordings (AC3) and the Intl grouping leg (AC4).

describe('cleanSeries (SPEC-R3 hardening)', () => {
  it('a non-array input becomes []', () => {
    expect(cleanSeries(null)).toEqual([])
    expect(cleanSeries(undefined)).toEqual([])
    expect(cleanSeries('not an array')).toEqual([])
    expect(cleanSeries({ length: 3 })).toEqual([])
  })

  it('keeps only finite numbers — drops null/NaN/Infinity/strings/booleans, order preserved', () => {
    expect(cleanSeries([1, null, 2, 'x', Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 3, true, undefined])).toEqual([1, 2, 3])
  })

  it('an all-valid array passes through unchanged', () => {
    expect(cleanSeries([3, 5, 4, 8, 7])).toEqual([3, 5, 4, 8, 7])
  })
})

describe('sparklineGeometry — degenerate + normal cases (§7 rows 3/5)', () => {
  it('null for an empty series', () => {
    expect(sparklineGeometry([])).toBeNull()
  })

  it('n=1 duplicates the single coordinate ("50,{y} 50,{y}") — a dot, not a line', () => {
    const g = sparklineGeometry([7])
    expect(g).not.toBeNull()
    expect(g?.count).toBe(1)
    expect(g?.points).toBe('50,50 50,50') // a single point has no span → y snaps to vertical center too
    expect(g?.area).toBeNull() // area is built only for n >= 2
    expect(g?.first).toBe(7)
    expect(g?.last).toBe(7)
    expect(g?.min).toBe(7)
    expect(g?.max).toBe(7)
  })

  it('all-equal values (n>=2) render a flat horizontal line at vertical center (y=50 throughout)', () => {
    const g = sparklineGeometry([4, 4, 4, 4])
    expect(g).not.toBeNull()
    const ys = (g?.points ?? '').split(' ').map((p) => Number(p.split(',')[1]))
    expect(ys.every((y) => y === 50)).toBe(true)
    expect(g?.min).toBe(4)
    expect(g?.max).toBe(4)
  })

  it('negative values normalize within [min, max] with no special-casing', () => {
    const g = sparklineGeometry([-10, 0, 10])
    expect(g).not.toBeNull()
    expect(g?.min).toBe(-10)
    expect(g?.max).toBe(10)
    // first point (index 0, value -10, the min) sits at y=100 (bottom, since y grows DOWN and min → max span)
    const first = (g?.points ?? '').split(' ')[0]
    expect(first).toBe('0,100')
    // last point (index 2, value 10, the max) sits at y=0 (top)
    const last = (g?.points ?? '').split(' ').at(-1)
    expect(last).toBe('100,0')
  })

  it('ordinal spacing by index: x(i) = (i/(n-1))*100 for n>=2', () => {
    const g = sparklineGeometry([1, 2, 3, 4, 5]) // n=5 → x = 0,25,50,75,100
    const xs = (g?.points ?? '').split(' ').map((p) => Number(p.split(',')[0]))
    expect(xs).toEqual([0, 25, 50, 75, 100])
  })

  it('area = points + the closed-bottom-edge suffix, only when n>=2', () => {
    const g = sparklineGeometry([3, 5])
    expect(g?.area).toBe(`${g?.points} 100,100 0,100`)
  })

  it('coordinates round to 2 decimals (stable strings)', () => {
    const g = sparklineGeometry([1, 2, 3]) // x(1) = 1/2*100 = 50 exactly; verifies no float-tail churn
    expect(g?.points).toBe('0,100 50,50 100,0')
  })
})

describe('sparklineSummary — the exact SPEC-R4 wordings (AC3) + Intl grouping (AC4)', () => {
  it('n=0 / null → "no data"', () => {
    expect(sparklineSummary('', null)).toBe('no data')
    expect(sparklineSummary('', sparklineGeometry([]))).toBe('no data')
  })

  it('n=1 → "1 point, value {v}"', () => {
    expect(sparklineSummary('', sparklineGeometry([42]))).toBe('1 point, value 42')
  })

  it('n>=2 → "{n} points, starts {first}, ends {last}, low {min}, high {max}"', () => {
    expect(sparklineSummary('', sparklineGeometry([3, 5, 4, 8, 7]))).toBe('5 points, starts 3, ends 7, low 3, high 8')
  })

  it('all-equal (n>=2): first/last/min/max all equal the shared value', () => {
    expect(sparklineSummary('', sparklineGeometry([4, 4, 4]))).toBe('3 points, starts 4, ends 4, low 4, high 4')
  })

  it('a non-empty label prefixes as "{label}: {summary}"', () => {
    expect(sparklineSummary('Revenue trend', sparklineGeometry([3, 5, 4, 8, 7]))).toBe(
      'Revenue trend: 5 points, starts 3, ends 7, low 3, high 8',
    )
    expect(sparklineSummary('Empty series', null)).toBe('Empty series: no data')
  })

  it('AC4 — Intl.NumberFormat grouping is observable (en-US default-locale test environment)', () => {
    expect(sparklineSummary('', sparklineGeometry([1200, 3400]))).toBe(
      '2 points, starts 1,200, ends 3,400, low 1,200, high 3,400',
    )
  })
})

describe('sparklineValuesProp — the safe JSON codec (SPEC-R3 rows 1/2, §7 rows 1/2)', () => {
  it('from(null) = [] (attribute absent/removed), never null (dom/props.ts jsonType\'s forbidden mapping)', () => {
    expect(sparklineValuesProp.type.from(null)).toEqual([])
  })

  it('malformed JSON never throws — falls back to []', () => {
    expect(() => sparklineValuesProp.type.from('{not json')).not.toThrow()
    expect(sparklineValuesProp.type.from('{not json')).toEqual([])
    expect(sparklineValuesProp.type.from('')).toEqual([])
  })

  it('a well-formed JSON array round-trips, hardened by cleanSeries', () => {
    expect(sparklineValuesProp.type.from('[3,5,4,8,7]')).toEqual([3, 5, 4, 8, 7])
    expect(sparklineValuesProp.type.from('[1, null, 2, "x", NaN]'.replace('NaN', 'null'))).toEqual([1, 2])
  })

  it('a non-array JSON value (e.g. an object or a bare number) becomes [] via cleanSeries', () => {
    expect(sparklineValuesProp.type.from('{"a":1}')).toEqual([])
    expect(sparklineValuesProp.type.from('42')).toEqual([])
  })

  it('to() serializes via JSON.stringify; default is []', () => {
    expect(sparklineValuesProp.type.to([3, 5])).toBe('[3,5]')
    expect(sparklineValuesProp.default).toEqual([])
  })
})
