import { describe, it, expect } from 'vitest'
import { cleanData, barRows, barDataProp, type BarDatum } from './bar-math.ts'

// bar-math.test.ts — the pure-math unit probes (LLD-C4, chart-family.lld.md §3/§7/§8). DOM-free: every
// case in the LLD §7 failure-mode ledger + the SPEC-R6/R7 worked examples, as plain numbers.

describe('cleanData — input hardening (SPEC-R7)', () => {
  it('a non-array input (object, string, number, null, undefined) → []', () => {
    expect(cleanData(undefined)).toEqual([])
    expect(cleanData(null)).toEqual([])
    expect(cleanData('nope')).toEqual([])
    expect(cleanData(42)).toEqual([])
    expect(cleanData({ label: 'a', value: 1 })).toEqual([]) // an object, not wrapped in an array
  })

  it('[] → []', () => {
    expect(cleanData([])).toEqual([])
  })

  it('drops entries missing a string label or a finite numeric value — never coerces', () => {
    const input = [
      { label: 'ok', value: 1 },
      { label: 'ok2' }, // missing value
      { value: 2 }, // missing label
      { label: 'bad-value', value: 'x' }, // stringly value — dropped, never coerced
      { label: 42, value: 3 }, // non-string label
      { label: 'nan', value: Number.NaN },
      { label: 'inf', value: Number.POSITIVE_INFINITY },
      null,
      undefined,
      'string-entry',
      42,
      ['array-entry'],
      { label: 'ok3', value: 3 },
    ]
    expect(cleanData(input)).toEqual([
      { label: 'ok', value: 1 },
      { label: 'ok3', value: 3 },
    ])
  })

  it('duplicate labels both survive (positional, not keyed — SPEC-R7 row 7)', () => {
    const input: BarDatum[] = [
      { label: 'EMEA', value: 10 },
      { label: 'EMEA', value: 20 },
    ]
    expect(cleanData(input)).toEqual(input)
  })

  it('preserves order', () => {
    const input = [
      { label: 'c', value: 3 },
      { label: 'a', value: 1 },
      { label: 'b', value: 2 },
    ]
    expect(cleanData(input).map((d) => d.label)).toEqual(['c', 'a', 'b'])
  })
})

describe('barRows — the zero-baseline diverging math (SPEC-R6/R7, LLD-C4 §3)', () => {
  it('empty input → []', () => {
    expect(barRows([])).toEqual([])
  })

  it('exactly one positive datum → one full-length row (it is the max)', () => {
    const rows = barRows([{ label: 'a', value: 42 }])
    expect(rows).toHaveLength(1)
    expect(rows[0].startPct).toBeCloseTo(0)
    expect(rows[0].lengthPct).toBeCloseTo(100)
    expect(rows[0].text).toBe('42')
  })

  it('exactly one negative datum → one full-length row (spans the full track either way)', () => {
    const rows = barRows([{ label: 'a', value: -42 }])
    expect(rows[0].startPct).toBeCloseTo(0)
    expect(rows[0].lengthPct).toBeCloseTo(100)
    expect(rows[0].text).toBe('-42')
  })

  it('the 4:2:1 proportion leg (SPEC-R6 AC1): [40, 20, 10] all-positive → lengths in exact 4:2:1 ratio, all start at 0', () => {
    const rows = barRows([
      { label: 'a', value: 40 },
      { label: 'b', value: 20 },
      { label: 'c', value: 10 },
    ])
    for (const r of rows) expect(r.startPct).toBeCloseTo(0) // all-positive: lo=0, every bar measures from the inline-start edge
    expect(rows[0].lengthPct).toBeCloseTo(100) // the max spans the full track
    expect(rows[1].lengthPct).toBeCloseTo(50)
    expect(rows[2].lengthPct).toBeCloseTo(25)
    // the ratio itself, independent of the absolute span
    expect(rows[0].lengthPct / rows[2].lengthPct).toBeCloseTo(4)
    expect(rows[1].lengthPct / rows[2].lengthPct).toBeCloseTo(2)
  })

  it('all-equal positive values → every bar full length (equality visible at a glance)', () => {
    const rows = barRows([
      { label: 'a', value: 5 },
      { label: 'b', value: 5 },
      { label: 'c', value: 5 },
    ])
    for (const r of rows) {
      expect(r.startPct).toBeCloseTo(0)
      expect(r.lengthPct).toBeCloseTo(100)
    }
  })

  it('all-zero values → every bar zero-length; printed 0s carry the reading', () => {
    const rows = barRows([
      { label: 'a', value: 0 },
      { label: 'b', value: 0 },
    ])
    for (const r of rows) {
      expect(r.startPct).toBe(0)
      expect(r.lengthPct).toBe(0)
      expect(r.text).toBe('0')
    }
  })

  it('the shared-zero divergence leg (SPEC-R6 AC2): [-20, 10, 30] — every bar shares one zeroPct=40, -20 extends to inline-start of it', () => {
    const rows = barRows([
      { label: 'neg', value: -20 },
      { label: 'small-pos', value: 10 },
      { label: 'big-pos', value: 30 },
    ])
    // lo = min(0,-20,10,30) = -20; hi = max(0,-20,10,30) = 30; span = 50; zeroPct = 20/50*100 = 40
    const [neg, small, big] = rows
    expect(neg.lengthPct).toBeCloseTo(40) // |−20|/50*100
    expect(neg.startPct).toBeCloseTo(0) // zeroPct(40) - lengthPct(40) — extends to the inline-start side of the zero point
    expect(small.startPct).toBeCloseTo(40) // v>=0 → starts AT the shared zero point
    expect(small.lengthPct).toBeCloseTo(20) // 10/50*100
    expect(big.startPct).toBeCloseTo(40)
    expect(big.lengthPct).toBeCloseTo(60) // 30/50*100
    expect(neg.text).toBe('-20')
    expect(small.text).toBe('10')
    expect(big.text).toBe('30')
    // every row shares the exact same zero point (start + length recombine to it for the non-negative rows,
    // and the negative row's start+length lands exactly there too)
    expect(neg.startPct + neg.lengthPct).toBeCloseTo(small.startPct)
    expect(small.startPct).toBeCloseTo(big.startPct)
  })

  it('the ALL-NEGATIVE degenerate row (LLD §7 row 5 / SPEC-R7): zero point sits at the track inline-end; longest = most negative', () => {
    const rows = barRows([
      { label: 'a', value: -10 },
      { label: 'b', value: -30 },
      { label: 'c', value: -5 },
    ])
    // lo = min(0,-10,-30,-5) = -30; hi = max(0,-10,-30,-5) = 0; span = 30; zeroPct = 30/30*100 = 100
    const [a, b, c] = rows
    expect(a.startPct + a.lengthPct).toBeCloseTo(100) // every bar's far edge sits AT the shared zero point (the track's inline-end)
    expect(b.startPct + b.lengthPct).toBeCloseTo(100)
    expect(c.startPct + c.lengthPct).toBeCloseTo(100)
    expect(b.lengthPct).toBeCloseTo(100) // the most-negative value (-30) spans the full track
    expect(b.startPct).toBeCloseTo(0)
    expect(a.lengthPct).toBeCloseTo((10 / 30) * 100)
    expect(c.lengthPct).toBeCloseTo((5 / 30) * 100)
    expect(b.lengthPct).toBeGreaterThan(a.lengthPct) // longest = most negative
    expect(a.lengthPct).toBeGreaterThan(c.lengthPct)
  })

  it('locale-formatted printed values (Intl.NumberFormat) — grouping is observable, not merely asserted', () => {
    const rows = barRows([{ label: 'big', value: 12345 }])
    expect(rows[0].text).toBe(new Intl.NumberFormat().format(12345))
  })
})

describe('barDataProp — the safe attribute codec (SPEC-R7 row 1/2)', () => {
  it('from(null) (attribute absent/removed) → [] — never null', () => {
    expect(barDataProp.type.from(null)).toEqual([])
  })

  it('malformed JSON never throws — falls back to []', () => {
    expect(() => barDataProp.type.from('{not json')).not.toThrow()
    expect(barDataProp.type.from('{not json')).toEqual([])
  })

  it('a non-array JSON value (e.g. an object or number) → []', () => {
    expect(barDataProp.type.from('{"label":"a","value":1}')).toEqual([])
    expect(barDataProp.type.from('42')).toEqual([])
  })

  it('well-formed JSON round-trips through cleanData (garbage entries dropped)', () => {
    const json = JSON.stringify([{ label: 'a', value: 1 }, { label: 'bad', value: 'x' }, { label: 'b', value: 2 }])
    expect(barDataProp.type.from(json)).toEqual([
      { label: 'a', value: 1 },
      { label: 'b', value: 2 },
    ])
  })

  it('to() serializes via JSON.stringify (the documented attribute form)', () => {
    const data: BarDatum[] = [{ label: 'a', value: 1 }]
    expect(barDataProp.type.to(data)).toBe(JSON.stringify(data))
  })

  it('default is []', () => {
    expect(barDataProp.default).toEqual([])
  })
})
