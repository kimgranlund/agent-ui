import { describe, it, expect } from 'vitest'
import { cleanData, cleanSeries, columnChartGeometry, columnChartSummary } from './column-math.ts'

describe('cleanData — ADR-0229 cl.2 row hardening', () => {
  it('non-array input is []', () => {
    expect(cleanData(null)).toEqual([])
    expect(cleanData(undefined)).toEqual([])
    expect(cleanData('nope')).toEqual([])
    expect(cleanData({})).toEqual([])
  })

  it('keeps a well-formed row', () => {
    expect(cleanData([{ label: 'Jan', values: [3, 5] }])).toEqual([{ label: 'Jan', values: [3, 5] }])
  })

  it('drops a row with a missing/empty/non-string label', () => {
    expect(cleanData([{ values: [1] }])).toEqual([])
    expect(cleanData([{ label: '', values: [1] }])).toEqual([])
    expect(cleanData([{ label: 42, values: [1] }])).toEqual([])
  })

  it('drops the WHOLE row when any value is negative or non-finite (stack semantics)', () => {
    expect(cleanData([{ label: 'a', values: [1, -2] }])).toEqual([])
    expect(cleanData([{ label: 'a', values: [1, NaN] }])).toEqual([])
    expect(cleanData([{ label: 'a', values: [1, Infinity] }])).toEqual([])
    expect(cleanData([{ label: 'a', values: ['1', 2] }])).toEqual([])
  })

  it('drops a row with a non-array values field', () => {
    expect(cleanData([{ label: 'a', values: 5 }])).toEqual([])
    expect(cleanData([{ label: 'a' }])).toEqual([])
  })

  it('keeps zero-valued rows (all-zero is legal, not dropped)', () => {
    expect(cleanData([{ label: 'a', values: [0, 0] }])).toEqual([{ label: 'a', values: [0, 0] }])
  })

  it('order is preserved; duplicate labels both survive (positional, not keyed)', () => {
    const input = [{ label: 'a', values: [1] }, { label: 'a', values: [2] }]
    expect(cleanData(input)).toEqual(input)
  })

  it('malformed entries in an array are skipped individually, valid siblings survive', () => {
    const input = [{ label: 'ok', values: [1] }, null, 'nope', { label: 'bad', values: [-1] }, { label: 'ok2', values: [2] }]
    expect(cleanData(input)).toEqual([{ label: 'ok', values: [1] }, { label: 'ok2', values: [2] }])
  })
})

describe('cleanSeries — series-name hardening', () => {
  it('non-array is []', () => {
    expect(cleanSeries(null)).toEqual([])
    expect(cleanSeries('x')).toEqual([])
  })
  it('keeps only string entries', () => {
    expect(cleanSeries(['Actual', 'Plan', 3, null])).toEqual(['Actual', 'Plan'])
  })
})

describe('columnChartGeometry — stacking + scale + category math', () => {
  it('null for an empty rendered set', () => {
    expect(columnChartGeometry([], [], 0)).toBeNull()
  })

  it('single-series (no series meta): one segment per column, stacked from zero', () => {
    const rows = cleanData([{ label: 'Jan', values: [10] }, { label: 'Feb', values: [20] }])
    const g = columnChartGeometry(rows, [], 0)!
    expect(g.series).toEqual(['Series 1'])
    expect(g.rows).toHaveLength(2)
    for (const row of g.rows) expect(row.segments).toHaveLength(1)
    expect(g.rows[1].total).toBeGreaterThan(g.rows[0].total)
  })

  it('multi-series: segments stack in series order, lengths proportional to value/scale.max', () => {
    const rows = cleanData([{ label: 'Jan', values: [10, 20] }])
    const g = columnChartGeometry(rows, ['A', 'B'], 0)!
    const [seg0, seg1] = g.rows[0].segments
    expect(seg0.startPct).toBe(0)
    expect(seg1.startPct).toBeCloseTo(seg0.startPct + seg0.lengthPct, 5)
    expect(g.rows[0].total).toBe(30)
  })

  it('ragged rows pad with trailing zeros to the resolved series count (never thrown)', () => {
    const rows = cleanData([{ label: 'Jan', values: [10, 5] }, { label: 'Feb', values: [3] }])
    const g = columnChartGeometry(rows, ['A', 'B'], 0)!
    expect(g.rows[1].values).toEqual([3, 0])
    expect(g.rows[1].segments).toHaveLength(2)
    expect(g.rows[1].segments[1].value).toBe(0)
    expect(g.rows[1].segments[1].lengthPct).toBe(0)
  })

  it('a category-count-only fallback derives the series count from the WIDEST surviving row', () => {
    const rows = cleanData([{ label: 'a', values: [1] }, { label: 'b', values: [1, 2, 3] }])
    const g = columnChartGeometry(rows, [], 0)!
    expect(g.series).toHaveLength(3)
    expect(g.rows[0].values).toHaveLength(3)
  })

  it('an all-zero rendered set still resolves a real positive scale (no divide-by-zero) with zero-length segments', () => {
    const rows = cleanData([{ label: 'a', values: [0] }, { label: 'b', values: [0] }])
    const g = columnChartGeometry(rows, [], 0)!
    expect(g.scale.max).toBeGreaterThan(0)
    for (const row of g.rows) for (const seg of row.segments) expect(seg.lengthPct).toBe(0)
  })

  it('marks the trailing N rows projected exactly (ADR-0228 cl.4)', () => {
    const rows = cleanData([{ label: 'a', values: [1] }, { label: 'b', values: [1] }, { label: 'c', values: [1] }])
    const g = columnChartGeometry(rows, [], 1)!
    expect(g.rows.map((r) => r.projected)).toEqual([false, false, true])
  })

  it('projectedCount is clamped: negative → 0, over-count → all projected, non-integer truncates', () => {
    const rows = cleanData([{ label: 'a', values: [1] }, { label: 'b', values: [1] }])
    expect(columnChartGeometry(rows, [], -5)!.rows.map((r) => r.projected)).toEqual([false, false])
    expect(columnChartGeometry(rows, [], 99)!.rows.map((r) => r.projected)).toEqual([true, true])
    expect(columnChartGeometry(rows, [], 1.9)!.rows.map((r) => r.projected)).toEqual([false, true])
  })

  it('nowPct is null with no projected span, and set to the actual/projected boundary otherwise', () => {
    const rows = cleanData(Array.from({ length: 4 }, (_, i) => ({ label: `c${i}`, values: [1] })))
    expect(columnChartGeometry(rows, [], 0)!.nowPct).toBeNull()
    expect(columnChartGeometry(rows, [], 1)!.nowPct).toBe(75)
  })

  it('categoryChipIndices thins a wide axis but always keeps first/last', () => {
    const rows = cleanData(Array.from({ length: 20 }, (_, i) => ({ label: `d${i}`, values: [1] })))
    const g = columnChartGeometry(rows, [], 0, 5, 6)!
    expect(g.categoryChipIndices.length).toBeLessThanOrEqual(6)
    expect(g.categoryChipIndices[0]).toBe(0)
    expect(g.categoryChipIndices[g.categoryChipIndices.length - 1]).toBe(19)
  })

  it('gridTicks are nice-number values with 0 at pct 0 and the top tick at pct 100', () => {
    const rows = cleanData([{ label: 'a', values: [23] }])
    const g = columnChartGeometry(rows, [], 0)!
    expect(g.gridTicks[0].value).toBe(g.scale.min)
    expect(g.gridTicks[0].pct).toBe(0)
    expect(g.gridTicks[g.gridTicks.length - 1].pct).toBe(100)
  })
})

describe('columnChartSummary — the generated, never-null ARIA summary (ADR-0229 cl.5)', () => {
  it('is "no data" for a null geometry, prefixed by a non-empty label', () => {
    expect(columnChartSummary('', null, null)).toBe('no data')
    expect(columnChartSummary('Revenue', null, null)).toBe('Revenue: no data')
  })

  it('reports category/series counts + PER-SERIES totals (printed label + number, ADR-0229 cl.2/cl.5) + low/high category-total extents', () => {
    const rows = cleanData([{ label: 'Jan', values: [10] }, { label: 'Feb', values: [30] }])
    const g = columnChartGeometry(rows, [], 0)!
    expect(columnChartSummary('', g, null)).toBe('2 categories, 1 series: Series 1 40; low 10, high 30')
  })

  it('names EVERY series with its own printed total (the identity carrier a fill-only rendering lacks)', () => {
    const rows = cleanData([{ label: 'Jan', values: [10, 5] }, { label: 'Feb', values: [30, 3] }])
    const g = columnChartGeometry(rows, ['Product', 'Services'], 0)!
    expect(columnChartSummary('', g, null)).toBe('2 categories, 2 series: Product 40, Services 8; low 15, high 33')
  })

  it('singular "category" for exactly one row', () => {
    const rows = cleanData([{ label: 'Jan', values: [10] }])
    const g = columnChartGeometry(rows, [], 0)!
    expect(columnChartSummary('', g, null)).toBe('1 category, 1 series: Series 1 10; low 10, high 10')
  })

  it('repeats the highlighted row fact for AT parity (the callout text lives in the img subtree too)', () => {
    const rows = cleanData([{ label: 'Jan', values: [10] }, { label: 'Feb', values: [30] }])
    const g = columnChartGeometry(rows, [], 0)!
    expect(columnChartSummary('', g, 1)).toBe('2 categories, 1 series: Series 1 40; low 10, high 30; highlighted Feb 30')
  })

  it('an out-of-range highlight index is silently ignored (never throws)', () => {
    const rows = cleanData([{ label: 'Jan', values: [10] }])
    const g = columnChartGeometry(rows, [], 0)!
    expect(columnChartSummary('', g, 99)).toBe('1 category, 1 series: Series 1 10; low 10, high 10')
    expect(columnChartSummary('', g, -1)).toBe('1 category, 1 series: Series 1 10; low 10, high 10')
  })
})
