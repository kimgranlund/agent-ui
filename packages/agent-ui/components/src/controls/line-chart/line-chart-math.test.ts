import { describe, it, expect } from 'vitest'
import {
  cleanSeries,
  lineChartGeometry,
  lineChartSummary,
  lineChartValuesProp,
  PLOT_TOP,
  PLOT_HEIGHT,
  PLOT_BOTTOM,
  VIEWBOX_WIDTH,
  VIEWBOX_HEIGHT,
} from './line-chart-math.ts'

// line-chart-math.test.ts — ADR-0205 pure math unit probes (jsdom-free; plain functions over numbers/strings).
// Covers: normal series, empty series (must not throw), all-above-zero (baseline = value floor, not the
// zero-line), a series spanning zero (baseline = zero-line), and single-value series.

describe('cleanSeries (hardening — mirrors sparkline SPEC-R3)', () => {
  it('a non-array input becomes []', () => {
    expect(cleanSeries(null)).toEqual([])
    expect(cleanSeries(undefined)).toEqual([])
    expect(cleanSeries('not an array')).toEqual([])
  })

  it('keeps only finite numbers — drops null/NaN/Infinity/strings/booleans, order preserved', () => {
    expect(
      cleanSeries([1, null, 2, 'x', Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 3, true, undefined]),
    ).toEqual([1, 2, 3])
  })
})

describe('lineChartGeometry — empty series must not throw (mirrors sparklineGeometry g===null)', () => {
  it('null for an empty series', () => {
    expect(lineChartGeometry([])).toBeNull()
    expect(() => lineChartGeometry([])).not.toThrow()
  })
})

describe('lineChartGeometry — a normal multi-point series', () => {
  it('[3,5,4,8,7]: ordinal x-spacing + min/max-normalized y, rounded to 2 decimals', () => {
    const g = lineChartGeometry([3, 5, 4, 8, 7])
    expect(g).not.toBeNull()
    expect(g?.count).toBe(5)
    expect(g?.min).toBe(3)
    expect(g?.max).toBe(8)
    expect(g?.points).toBe('0,125 75,85 150,105 225,25 300,45')
  })

  it('minText/maxText are Intl.NumberFormat default-locale strings', () => {
    const g = lineChartGeometry([1200, 3400, 2000])
    expect(g?.minText).toBe('1,200')
    expect(g?.maxText).toBe('3,400')
  })

  it('area closes the polyline back to the BASELINE (not the geometric bottom edge)', () => {
    const g = lineChartGeometry([3, 5, 4, 8, 7])
    expect(g?.area).toBe(`${g?.points} ${VIEWBOX_WIDTH},${g?.baselineY} 0,${g?.baselineY}`)
  })
})

describe('lineChartGeometry — a series entirely ABOVE zero: baseline = the value FLOOR, not the zero-line', () => {
  it('[10,20,15]: baseline lands at min (the floor), which is the plot BOTTOM — never mid-chart at "zero"', () => {
    const g = lineChartGeometry([10, 20, 15])
    expect(g).not.toBeNull()
    expect(g?.min).toBe(10)
    expect(g?.max).toBe(20)
    // the floor (min=10) maps to the bottom of the plot area — PLOT_TOP + PLOT_HEIGHT (never 0's own y).
    expect(g?.baselineY).toBe(PLOT_TOP + PLOT_HEIGHT)
    expect(g?.baselineY).toBe(PLOT_BOTTOM)
  })

  it('an all-NEGATIVE series (max < 0) also floors at its own min, not zero', () => {
    const g = lineChartGeometry([-30, -10, -20])
    expect(g?.min).toBe(-30)
    expect(g?.max).toBe(-10)
    expect(g?.baselineY).toBe(PLOT_BOTTOM) // the floor (-30, the min) is always the plot bottom
  })
})

describe('lineChartGeometry — a series SPANNING zero: baseline = the zero-line', () => {
  it('[-10,0,10]: baseline sits at value 0, which lands MID-plot, not at either edge', () => {
    const g = lineChartGeometry([-10, 0, 10])
    expect(g).not.toBeNull()
    expect(g?.min).toBe(-10)
    expect(g?.max).toBe(10)
    expect(g?.baselineY).toBe(PLOT_TOP + PLOT_HEIGHT / 2) // 75 — the zero-line, mid-chart
    expect(g?.baselineY).not.toBe(PLOT_BOTTOM)
    expect(g?.baselineY).not.toBe(PLOT_TOP)
  })

  it('a series whose min is exactly 0 (spans zero at its own floor)', () => {
    const g = lineChartGeometry([0, 5, 10])
    expect(g?.baselineY).toBe(PLOT_BOTTOM) // baseline value (0) coincides with min here — same coordinate either way
  })
})

describe('lineChartGeometry — degenerate n>=2 case: all-equal values', () => {
  it('[4,4,4,4]: a flat horizontal line at plot vertical-center; baseline coincides with the line', () => {
    const g = lineChartGeometry([4, 4, 4, 4])
    expect(g).not.toBeNull()
    const ys = (g?.points ?? '').split(' ').map((p) => Number(p.split(',')[1]))
    const mid = PLOT_TOP + PLOT_HEIGHT / 2
    expect(ys.every((y) => y === mid)).toBe(true)
    expect(g?.baselineY).toBe(mid) // span===0 ⇒ the degenerate branch places the baseline at the same y
  })
})

describe('lineChartGeometry — single-value series (n=1) must not throw', () => {
  it('a single positive value renders a dot at horizontal/vertical center; baseline coincides with it', () => {
    const g = lineChartGeometry([7])
    expect(g).not.toBeNull()
    expect(g?.count).toBe(1)
    expect(g?.min).toBe(7)
    expect(g?.max).toBe(7)
    const mid = PLOT_TOP + PLOT_HEIGHT / 2
    expect(g?.points).toBe(`${VIEWBOX_WIDTH / 2},${mid} ${VIEWBOX_WIDTH / 2},${mid}`)
    expect(g?.area).toBeNull() // area is built only for n >= 2 (the sparkline precedent)
    expect(g?.baselineY).toBe(mid)
  })

  it('a single zero value does not throw and stays well-formed', () => {
    expect(() => lineChartGeometry([0])).not.toThrow()
    const g = lineChartGeometry([0])
    expect(g?.count).toBe(1)
    expect(g?.min).toBe(0)
    expect(g?.max).toBe(0)
  })

  it('a single NEGATIVE value does not throw and stays well-formed', () => {
    const g = lineChartGeometry([-42])
    expect(g).not.toBeNull()
    expect(g?.count).toBe(1)
    expect(g?.min).toBe(-42)
  })
})

describe('lineChartSummary — ADR-0205 cl.6 exact wordings (label + min/max + point count)', () => {
  it('n=0 / null → "no data"', () => {
    expect(lineChartSummary('', null)).toBe('no data')
    expect(lineChartSummary('', lineChartGeometry([]))).toBe('no data')
  })

  it('n=1 → "1 point, value {v}"', () => {
    expect(lineChartSummary('', lineChartGeometry([42]))).toBe('1 point, value 42')
  })

  it('n>=2 → "{n} points, low {min}, high {max}"', () => {
    expect(lineChartSummary('', lineChartGeometry([3, 5, 4, 8, 7]))).toBe('5 points, low 3, high 8')
  })

  it('a non-empty label prefixes as "{label}: {summary}"', () => {
    expect(lineChartSummary('Latency, p50', lineChartGeometry([3, 5, 4, 8, 7]))).toBe(
      'Latency, p50: 5 points, low 3, high 8',
    )
    expect(lineChartSummary('Empty series', null)).toBe('Empty series: no data')
  })

  it('Intl.NumberFormat grouping is observable (en-US default-locale test environment)', () => {
    expect(lineChartSummary('', lineChartGeometry([1200, 3400]))).toBe('2 points, low 1,200, high 3,400')
  })
})

describe('lineChartValuesProp — the safe JSON codec (mirrors sparklineValuesProp)', () => {
  it('from(null) = [] (attribute absent/removed), never null', () => {
    expect(lineChartValuesProp.type.from(null)).toEqual([])
  })

  it('malformed JSON never throws — falls back to []', () => {
    expect(() => lineChartValuesProp.type.from('{not json')).not.toThrow()
    expect(lineChartValuesProp.type.from('{not json')).toEqual([])
    expect(lineChartValuesProp.type.from('')).toEqual([])
  })

  it('a well-formed JSON array round-trips, hardened by cleanSeries', () => {
    expect(lineChartValuesProp.type.from('[3,5,4,8,7]')).toEqual([3, 5, 4, 8, 7])
    expect(lineChartValuesProp.type.from('[1, null, 2, "x"]')).toEqual([1, 2])
  })

  it('a non-array JSON value (e.g. an object or a bare number) becomes [] via cleanSeries', () => {
    expect(lineChartValuesProp.type.from('{"a":1}')).toEqual([])
    expect(lineChartValuesProp.type.from('42')).toEqual([])
  })

  it('to() serializes via JSON.stringify; default is []', () => {
    expect(lineChartValuesProp.type.to([3, 5])).toBe('[3,5]')
    expect(lineChartValuesProp.default).toEqual([])
  })
})

describe('viewBox constants — a real chart tile, not a decorative square', () => {
  it('the viewBox is wider than tall (unlike sparkline\'s 100x100)', () => {
    expect(VIEWBOX_WIDTH).toBeGreaterThan(VIEWBOX_HEIGHT)
  })

  it('the plot area sits inside vertical margin on both sides (room reserved for the label rows)', () => {
    expect(PLOT_TOP).toBeGreaterThan(0)
    expect(PLOT_TOP + PLOT_HEIGHT).toBeLessThan(VIEWBOX_HEIGHT)
  })
})
