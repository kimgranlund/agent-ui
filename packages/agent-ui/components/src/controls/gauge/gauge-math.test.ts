import { describe, it, expect } from 'vitest'
import { cleanData, gaugeRows, gaugeDataProp, VIEWBOX_SIZE, OUTER_RADIUS, RING_STEP, type GaugeDatum } from './gauge-math.ts'

// gauge-math.test.ts — the pure-math unit probes (ADR-0229 cl.4). DOM-free: hardening (clamp-never-drop
// independent-percent semantics), the ring geometry (radius/circumference/dash-offset, outer→inner fill
// cycling), and the safe attribute codec, as plain numbers/strings.

describe('cleanData — input hardening (ADR-0229 cl.4)', () => {
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

  it('drops entries missing/empty label or a non-finite value; keeps every legal value UNCLAMPED (clamping is gaugeRows\' job)', () => {
    const input = [
      { label: 'ok', value: 72 },
      { label: '', value: 5 }, // empty label — dropped
      { label: 'neg', value: -20 }, // negative — KEPT (unlike ui-pie-chart's drop), not yet clamped here
      { label: 'over', value: 140 }, // over 100 — KEPT, not yet clamped here
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
      { label: 'zero', value: 0 }, // zero is legal
    ]
    expect(cleanData(input)).toEqual([
      { label: 'ok', value: 72 },
      { label: 'neg', value: -20 },
      { label: 'over', value: 140 },
      { label: 'zero', value: 0 },
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
    const input: GaugeDatum[] = [
      { label: 'CPU', value: 10 },
      { label: 'CPU', value: 20 },
    ]
    expect(cleanData(input)).toEqual(input)
  })
})

describe('gaugeRows — the independent-percent ring geometry (ADR-0229 cl.4)', () => {
  it('empty input → rings: []', () => {
    expect(gaugeRows([])).toEqual({ rings: [] })
  })

  it('a value in [0,100] renders unchanged as clampedValue', () => {
    const g = gaugeRows([{ label: 'CPU', value: 72 }])
    expect(g.rings[0].clampedValue).toBe(72)
    expect(g.rings[0].percentText).toBe('72%')
  })

  it('a negative value clamps to 0 — kept, never dropped (the documented divergence from ui-pie-chart)', () => {
    const g = gaugeRows([{ label: 'neg', value: -20 }])
    expect(g.rings).toHaveLength(1)
    expect(g.rings[0].clampedValue).toBe(0)
    expect(g.rings[0].percentText).toBe('0%')
  })

  it('a value over 100 clamps to 100 — kept, never dropped', () => {
    const g = gaugeRows([{ label: 'over', value: 140 }])
    expect(g.rings).toHaveLength(1)
    expect(g.rings[0].clampedValue).toBe(100)
    expect(g.rings[0].percentText).toBe('100%')
  })

  it('rings are OUTER→INNER in data order: the first datum gets the LARGEST radius', () => {
    const g = gaugeRows([
      { label: 'CPU', value: 72 },
      { label: 'Memory', value: 54 },
      { label: 'Disk', value: 31 },
    ])
    expect(g.rings.map((r) => r.index)).toEqual([0, 1, 2])
    expect(g.rings[0].radius).toBeGreaterThan(g.rings[1].radius)
    expect(g.rings[1].radius).toBeGreaterThan(g.rings[2].radius)
    expect(g.rings[0].radius).toBe(OUTER_RADIUS)
    expect(g.rings[1].radius).toBe(OUTER_RADIUS - RING_STEP)
  })

  it('radius never goes to 0/negative — floored at 1 for a large ring count', () => {
    const data: GaugeDatum[] = Array.from({ length: 20 }, (_, i) => ({ label: `r${i}`, value: 50 }))
    const g = gaugeRows(data)
    for (const ring of g.rings) {
      expect(ring.radius).toBeGreaterThanOrEqual(1)
      expect(Number.isFinite(ring.radius)).toBe(true)
    }
  })

  it('circumference = 2πr and dashOffset = circumference * (1 - clampedValue/100)', () => {
    const g = gaugeRows([{ label: 'half', value: 50 }])
    const ring = g.rings[0]
    const expectedCircumference = Math.round(2 * Math.PI * ring.radius * 100) / 100
    expect(ring.circumference).toBeCloseTo(expectedCircumference, 2)
    expect(ring.dashOffset).toBeCloseTo(ring.circumference * 0.5, 1)
  })

  it('value=0 → dashOffset === circumference (nothing revealed); value=100 → dashOffset === 0 (fully revealed)', () => {
    const empty = gaugeRows([{ label: 'empty', value: 0 }]).rings[0]
    expect(empty.dashOffset).toBeCloseTo(empty.circumference, 2)
    const full = gaugeRows([{ label: 'full', value: 100 }]).rings[0]
    expect(full.dashOffset).toBeCloseTo(0, 2)
  })

  it('the fill token cycles past 6 rings (7th ring reuses tokenIndex 1)', () => {
    const data: GaugeDatum[] = Array.from({ length: 7 }, (_, i) => ({ label: `r${i}`, value: 50 }))
    const g = gaugeRows(data)
    expect(g.rings.map((r) => r.tokenIndex)).toEqual([1, 2, 3, 4, 5, 6, 1])
  })

  it('percents are Intl percent-formatted, 0 decimals default', () => {
    const g = gaugeRows([{ label: 'third', value: 100 / 3 }])
    const expected = new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 0 }).format(100 / 3 / 100)
    expect(g.rings[0].percentText).toBe(expected)
  })
})

describe('gaugeDataProp — the safe attribute codec', () => {
  it('from(null) (attribute absent/removed) → [] — never null', () => {
    expect(gaugeDataProp.type.from(null)).toEqual([])
  })

  it('malformed JSON never throws — falls back to []', () => {
    expect(() => gaugeDataProp.type.from('{not json')).not.toThrow()
    expect(gaugeDataProp.type.from('{not json')).toEqual([])
  })

  it('a non-array JSON value → []', () => {
    expect(gaugeDataProp.type.from('{"label":"a","value":1}')).toEqual([])
    expect(gaugeDataProp.type.from('42')).toEqual([])
  })

  it('well-formed JSON round-trips through cleanData (garbage entries dropped, out-of-range VALUES kept unclamped)', () => {
    const json = JSON.stringify([
      { label: 'a', value: 1 },
      { label: 'bad-value', value: 'x' },
      { label: 'over', value: 140 },
    ])
    expect(gaugeDataProp.type.from(json)).toEqual([
      { label: 'a', value: 1 },
      { label: 'over', value: 140 },
    ])
  })

  it('to() serializes via JSON.stringify (the documented attribute form)', () => {
    const data: GaugeDatum[] = [{ label: 'a', value: 1 }]
    expect(gaugeDataProp.type.to(data)).toBe(JSON.stringify(data))
  })

  it('default is []', () => {
    expect(gaugeDataProp.default).toEqual([])
  })
})

describe('VIEWBOX_SIZE/OUTER_RADIUS/RING_STEP — the normalized geometry constants', () => {
  it('are positive, and the outer radius leaves real room inside the viewBox', () => {
    expect(VIEWBOX_SIZE).toBeGreaterThan(0)
    expect(OUTER_RADIUS).toBeGreaterThan(0)
    expect(OUTER_RADIUS).toBeLessThan(VIEWBOX_SIZE / 2)
    expect(RING_STEP).toBeGreaterThan(0)
  })
})
