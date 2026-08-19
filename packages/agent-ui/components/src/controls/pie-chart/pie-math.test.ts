import { describe, it, expect } from 'vitest'
import { cleanData, pieRows, fullRingPath, slicePath, pieDataProp, VIEWBOX_SIZE, type PieDatum } from './pie-math.ts'

// pie-math.test.ts — the pure-math unit probes (ADR-0219). DOM-free: hardening, the part-of-whole
// geometry (percent + sweep + fill-token cycling), and the safe attribute codec, as plain numbers/strings.

describe('cleanData — input hardening (ADR-0219 cl.2)', () => {
  it('a non-array input (object, string, number, null, undefined) → []', () => {
    expect(cleanData(undefined)).toEqual([])
    expect(cleanData(null)).toEqual([])
    expect(cleanData('nope')).toEqual([])
    expect(cleanData(42)).toEqual([])
    expect(cleanData({ label: 'a', value: 1 })).toEqual([])
  })

  it('[] → []', () => {
    expect(cleanData([])).toEqual([])
  })

  it('drops non-finite values, NEGATIVE values, and empty labels — never coerces or clamps', () => {
    const input = [
      { label: 'ok', value: 1 },
      { label: '', value: 5 }, // empty label — dropped (unlike ui-bar-chart, which allows it)
      { label: 'neg', value: -3 }, // negative — dropped, NOT clamped to 0
      { label: 'nan', value: Number.NaN },
      { label: 'inf', value: Number.POSITIVE_INFINITY },
      { label: 'ok2' }, // missing value
      { value: 2 }, // missing label
      { label: 'bad-value', value: 'x' }, // stringly value — dropped, never coerced
      { label: 42, value: 3 }, // non-string label
      null,
      undefined,
      'string-entry',
      42,
      ['array-entry'],
      { label: 'ok3', value: 0 }, // zero is legal (finite, non-negative)
    ]
    expect(cleanData(input)).toEqual([
      { label: 'ok', value: 1 },
      { label: 'ok3', value: 0 },
    ])
  })

  it('preserves order — no sorting, no folding', () => {
    const input = [
      { label: 'c', value: 3 },
      { label: 'a', value: 1 },
      { label: 'b', value: 2 },
    ]
    expect(cleanData(input).map((d) => d.label)).toEqual(['c', 'a', 'b'])
  })

  it('duplicate labels both survive (positional, not keyed)', () => {
    const input: PieDatum[] = [
      { label: 'EMEA', value: 10 },
      { label: 'EMEA', value: 20 },
    ]
    expect(cleanData(input)).toEqual(input)
  })
})

describe('fullRingPath — the empty-track / single-100%-slice compound path', () => {
  it('donut (innerR > 0): TWO subpaths (outer circle + inner circle), evenodd-drawable', () => {
    const d = fullRingPath(50, 50, 48, 26)
    expect(d.match(/M /g)?.length).toBe(2) // two independent closed subpaths
    expect(d).toContain('Z')
  })

  it('pie (innerR <= 0): ONE subpath (no hole)', () => {
    const d = fullRingPath(50, 50, 48, 0)
    expect(d.match(/M /g)?.length).toBe(1)
  })
})

describe('slicePath — the per-slice wedge', () => {
  it('a zero-or-negative sweep draws nothing', () => {
    expect(slicePath(50, 50, 48, 0, 10, 10)).toBe('')
    expect(slicePath(50, 50, 48, 0, 10, 5)).toBe('')
  })

  it('a sweep at/past 360° delegates to fullRingPath (the single-100%-slice case)', () => {
    expect(slicePath(50, 50, 48, 26, 0, 360)).toBe(fullRingPath(50, 50, 48, 26))
  })

  it('a pie sector (innerR<=0) starts its path at the CENTER (a true sector, not an annulus segment)', () => {
    const d = slicePath(50, 50, 48, 0, 0, 90)
    expect(d.startsWith('M 50 50')).toBe(true)
  })

  it('a donut segment (innerR>0) starts at the OUTER radius, never the center', () => {
    const d = slicePath(50, 50, 48, 26, 0, 90)
    expect(d.startsWith('M 50 50')).toBe(false)
  })

  it('large-arc flag flips at the 180° boundary', () => {
    const small = slicePath(50, 50, 48, 0, 0, 90) // 90° sweep
    const large = slicePath(50, 50, 48, 0, 0, 270) // 270° sweep
    expect(small).toMatch(/A 48 48 0 0 1/)
    expect(large).toMatch(/A 48 48 0 1 1/)
  })
})

describe('pieRows — the part-of-whole geometry (ADR-0219 cl.2/cl.3/cl.4)', () => {
  it('empty input → slices: [], total: 0, but trackPathD is always computable', () => {
    const g = pieRows([], 'donut')
    expect(g.slices).toEqual([])
    expect(g.total).toBe(0)
    expect(g.trackPathD.length).toBeGreaterThan(0)
  })

  it('an all-zero rendered set (every value exactly 0) → slices: [], no key rows (cl.2)', () => {
    const g = pieRows(
      [
        { label: 'a', value: 0 },
        { label: 'b', value: 0 },
      ],
      'donut',
    )
    expect(g.slices).toEqual([])
    expect(g.total).toBe(0)
  })

  it('exactly one valid datum → one slice at 100%, the fullRingPath shape', () => {
    const g = pieRows([{ label: 'solo', value: 42 }], 'donut')
    expect(g.slices).toHaveLength(1)
    expect(g.slices[0].percentText).toBe('100%')
    expect(g.slices[0].pathD).toBe(fullRingPath(50, 50, 48, 26))
    expect(g.slices[0].index).toBe(0)
    expect(g.slices[0].tokenIndex).toBe(1)
  })

  it('two equal-value slices split 50/50, in data order, with distinct token indices', () => {
    const g = pieRows(
      [
        { label: 'a', value: 10 },
        { label: 'b', value: 10 },
      ],
      'pie',
    )
    expect(g.total).toBe(20)
    expect(g.slices.map((s) => s.percentText)).toEqual(['50%', '50%'])
    expect(g.slices.map((s) => s.index)).toEqual([0, 1])
    expect(g.slices.map((s) => s.tokenIndex)).toEqual([1, 2])
    for (const s of g.slices) expect(s.pathD.length).toBeGreaterThan(0)
  })

  it('a mixed set with a zero-value entry: the zero entry still gets a row (0%), a zero-length path', () => {
    const g = pieRows(
      [
        { label: 'big', value: 10 },
        { label: 'empty', value: 0 },
      ],
      'donut',
    )
    expect(g.total).toBe(10)
    expect(g.slices).toHaveLength(2)
    expect(g.slices[0].percentText).toBe('100%')
    expect(g.slices[1].percentText).toBe('0%')
    expect(g.slices[1].pathD).toBe('') // zero sweep — slicePath draws nothing
  })

  it('the fill token cycles past 6 slices (7th slice reuses tokenIndex 1)', () => {
    const data: PieDatum[] = Array.from({ length: 7 }, (_, i) => ({ label: `s${i}`, value: 1 }))
    const g = pieRows(data, 'donut')
    expect(g.slices.map((s) => s.tokenIndex)).toEqual([1, 2, 3, 4, 5, 6, 1])
  })

  it('percents are Intl percent-formatted, 0 decimals default (e.g. a 1/3 split rounds to whole percent)', () => {
    const g = pieRows(
      [
        { label: 'a', value: 1 },
        { label: 'b', value: 1 },
        { label: 'c', value: 1 },
      ],
      'donut',
    )
    const expected = new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 0 }).format(1 / 3)
    expect(g.slices[0].percentText).toBe(expected)
  })

  it('donut vs pie: the SAME data produces a hole (two-subpath track) for donut and none for pie', () => {
    const donut = pieRows([], 'donut')
    const pie = pieRows([], 'pie')
    expect(donut.trackPathD.match(/M /g)?.length).toBe(2)
    expect(pie.trackPathD.match(/M /g)?.length).toBe(1)
  })
})

describe('pieDataProp — the safe attribute codec', () => {
  it('from(null) (attribute absent/removed) → [] — never null', () => {
    expect(pieDataProp.type.from(null)).toEqual([])
  })

  it('malformed JSON never throws — falls back to []', () => {
    expect(() => pieDataProp.type.from('{not json')).not.toThrow()
    expect(pieDataProp.type.from('{not json')).toEqual([])
  })

  it('a non-array JSON value → []', () => {
    expect(pieDataProp.type.from('{"label":"a","value":1}')).toEqual([])
    expect(pieDataProp.type.from('42')).toEqual([])
  })

  it('well-formed JSON round-trips through cleanData (garbage/negative entries dropped)', () => {
    const json = JSON.stringify([
      { label: 'a', value: 1 },
      { label: 'neg', value: -1 },
      { label: 'b', value: 2 },
    ])
    expect(pieDataProp.type.from(json)).toEqual([
      { label: 'a', value: 1 },
      { label: 'b', value: 2 },
    ])
  })

  it('to() serializes via JSON.stringify (the documented attribute form)', () => {
    const data: PieDatum[] = [{ label: 'a', value: 1 }]
    expect(pieDataProp.type.to(data)).toBe(JSON.stringify(data))
  })

  it('default is []', () => {
    expect(pieDataProp.default).toEqual([])
  })
})

describe('VIEWBOX_SIZE — the normalized square viewBox', () => {
  it('is a positive square side length', () => {
    expect(VIEWBOX_SIZE).toBeGreaterThan(0)
  })
})
