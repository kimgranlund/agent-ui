// contrast.test.ts: the ContrastPair's pure rating (ADR-0244 cl.3, T-0090). Known pairs pin the WCAG 2.x math,
// the truncation pins "never rounded up", and the verdicts are decided on the unrounded ratio.

import { describe, it, expect } from 'vitest'
import { CONTRAST_FLOORS, parseColor, rateContrast, truncateRatio } from './contrast.ts'

/** The rating's display and its pass set, or the Unrated reason. */
function summary(fg: string, bg: string): { display: string; passes: string[] } | string {
  const r = rateContrast(fg, bg)
  return r.rated ? { display: r.display, passes: r.verdicts.filter((v) => v.pass).map((v) => v.id) } : r.reason
}

describe('ContrastPair rating: known pairs', () => {
  it('#000000 on #ffffff reads 21.00 and passes all three floors', () => {
    expect(summary('#000000', '#ffffff')).toEqual({ display: '21.00', passes: ['aa-body', 'aa-large', 'aaa-body'] })
  })

  it('the ratio is symmetric and the three-digit hex form reads the same', () => {
    expect(summary('#fff', '#000')).toEqual(summary('#000000', '#ffffff'))
  })

  it('#777777 on #ffffff reads 4.47 (4.478 unrounded, so truncated, not 4.48), fails AA body and passes AA large', () => {
    const r = rateContrast('#777777', '#ffffff')
    expect(r.rated && r.ratio).toBeCloseTo(4.478, 3)
    expect(summary('#777777', '#ffffff')).toEqual({ display: '4.47', passes: ['aa-large'] })
  })

  it('the approved mockup pairs read their drawn figures', () => {
    expect(summary('#0b3d2e', '#e8f5ee')).toEqual({ display: '10.88', passes: ['aa-body', 'aa-large', 'aaa-body'] })
    expect(summary('#3b5bdb', '#eef2ff')).toEqual({ display: '5.06', passes: ['aa-body', 'aa-large'] })
    expect(summary('#6b6b6b', '#ffffff')).toEqual({ display: '5.32', passes: ['aa-body', 'aa-large'] })
  })
})

describe('ContrastPair rating: truncation and the unrounded verdict', () => {
  it('a pair just under 4.5 (4.4997) displays 4.49, never 4.50, and fails AA body', () => {
    const r = rateContrast('#946894', '#ffffff')
    expect(r.rated).toBe(true)
    if (!r.rated) return
    expect(r.ratio).toBeLessThan(4.5)
    expect(r.ratio.toFixed(2)).toBe('4.50') // rounding would have shown the floor as met
    expect(r.display).toBe('4.49')
    expect(r.verdicts.find((v) => v.id === 'aa-body')!.pass).toBe(false)
  })

  it('truncateRatio floors to hundredths and pads', () => {
    expect(truncateRatio(4.4999)).toBe('4.49')
    expect(truncateRatio(3)).toBe('3.00')
    expect(truncateRatio(10.8801)).toBe('10.88')
    expect(truncateRatio(21)).toBe('21.00')
  })

  it('the floors are AA body 4.5, AA large 3 and AAA body 7, in that order', () => {
    expect(CONTRAST_FLOORS.map((f) => [f.label, f.floor])).toEqual([
      ['AA body', 4.5],
      ['AA large', 3],
      ['AAA body', 7],
    ])
  })
})

describe('ContrastPair rating: oklch() and translucency', () => {
  it('an oklch() pair: black on white reads 21.00, and a blue reads 7.57 in either channel spelling', () => {
    expect(summary('oklch(0 0 0)', 'oklch(1 0 0)')).toEqual({ display: '21.00', passes: ['aa-body', 'aa-large', 'aaa-body'] })
    expect(summary('oklch(0.45 0.12 264)', '#ffffff')).toEqual({ display: '7.57', passes: ['aa-body', 'aa-large', 'aaa-body'] })
    expect(summary('oklch(45% 0.12 264deg)', 'oklch(100% 0 0)')).toEqual(summary('oklch(0.45 0.12 264)', '#ffffff'))
  })

  it('an oklch() alpha parses as a number or a percentage', () => {
    expect(parseColor('oklch(0.5 0.1 200 / 0.25)')!.a).toBe(0.25)
    expect(parseColor('oklch(0.5 0.1 200 / 25%)')!.a).toBe(0.25)
    expect(parseColor('oklch(0.5 0.1 200)')!.a).toBe(1)
  })

  it('a translucent foreground is composited over the background first: #00000080 on white rates as #7f7f7f on white', () => {
    const r = rateContrast('#00000080', '#ffffff')
    const opaque = rateContrast('#7f7f7f', '#ffffff')
    expect(r.rated && opaque.rated).toBe(true)
    if (!r.rated || !opaque.rated) return
    expect(r.ratio).toBeCloseTo(opaque.ratio, 10)
    expect(r.display).toBe('4.00')
    expect(summary('#000000', '#ffffff')).toEqual({ display: '21.00', passes: ['aa-body', 'aa-large', 'aaa-body'] }) // alpha moved it
    expect(summary('oklch(0 0 0 / 0.5)', '#ffffff')).toEqual({ display: '3.97', passes: ['aa-large'] })
  })

  it('Unrated: a translucent background has no single ratio', () => {
    expect(summary('#000000', '#ffffff80')).toBe('translucent-background')
    expect(summary('#000000', 'oklch(1 0 0 / 0.5)')).toBe('translucent-background')
  })

  it('Unrated: a value that does not parse (another syntax, a typo, empty)', () => {
    for (const bad of ['banana', 'rgb(0, 0, 0)', '#12345', '#ggg', '', 'oklch(0.5 0.1)']) {
      expect(summary(bad, '#ffffff'), bad).toBe('unparseable')
      expect(summary('#000000', bad), bad).toBe('unparseable')
    }
  })
})
