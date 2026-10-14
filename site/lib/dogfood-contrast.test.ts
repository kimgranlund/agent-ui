import { describe, it, expect } from 'vitest'
import { parseCss, over, flatten, contrast, inkContrast, splitTopLevel, flatLayers, CANVAS_LIGHT } from './dogfood-contrast.ts'

// dogfood-contrast.test.ts: the compositing helper's math against hand-worked values (T-0144).

const rgb = (r: number, g: number, b: number, a = 1) => ({ r: r / 255, g: g / 255, b: b / 255, a })
const close = (x: number, y: number, digits = 3): void => expect(x).toBeCloseTo(y, digits)

describe('parseCss reads the computed colour forms both engines return', () => {
  it('rgb() and rgba(), comma and space syntax, percentages and transparent', () => {
    expect(parseCss('rgb(255, 0, 0)')).toEqual({ r: 1, g: 0, b: 0, a: 1 })
    expect(parseCss('rgba(0, 0, 0, 0.5)')).toEqual({ r: 0, g: 0, b: 0, a: 0.5 })
    expect(parseCss('rgb(0 0 255 / 25%)')).toEqual({ r: 0, g: 0, b: 1, a: 0.25 })
    expect(parseCss('transparent')?.a).toBe(0)
  })
  it('hex and oklch() through the ContrastPair parser; an unknown form is null', () => {
    expect(parseCss('#ffffff')).toEqual({ r: 1, g: 1, b: 1, a: 1 })
    const white = parseCss('oklch(1 0 0)')!
    close(white.r, 1)
    close(white.g, 1)
    expect(parseCss('oklch(0.5 0 0 / 0.4)')?.a).toBeCloseTo(0.4)
    expect(parseCss('color-mix(in srgb, red, blue)')).toBeNull()
  })
})

describe('over and flatten composite in gamma-encoded sRGB', () => {
  it('half black over white is mid grey (127.5 in each channel)', () => {
    const grey = over(rgb(0, 0, 0, 0.5), CANVAS_LIGHT)
    close(grey.r * 255, 127.5)
    expect(grey.a).toBe(1)
  })
  it('two translucent layers stack before the base: alpha 0.5 over alpha 0.5 is alpha 0.75', () => {
    const pair = over(rgb(0, 0, 0, 0.5), rgb(255, 0, 0, 0.5))
    close(pair.a, 0.75)
    close(pair.r, 1 / 3) // red's share: 0.5 * 0.5 / 0.75
    const flat = flatten([rgb(0, 0, 0, 0.5), rgb(255, 0, 0, 0.5)], CANVAS_LIGHT)
    expect(flat.a).toBe(1)
    close(flat.r * 255, 127.5) // red over white is (255, 127.5, 127.5); black at half over it halves each channel
    close(flat.g * 255, 63.75)
  })
  it('an opaque top layer hides everything below it', () => {
    expect(flatten([rgb(10, 20, 30), rgb(0, 0, 0, 0.5)])).toEqual(rgb(10, 20, 30))
  })
})

describe('contrast is the WCAG 2.x ratio', () => {
  it('black on white is 21, a colour on itself is 1, and #767676 on white clears 4.5', () => {
    close(contrast(rgb(0, 0, 0), rgb(255, 255, 255)), 21, 2)
    close(contrast(rgb(90, 90, 90), rgb(90, 90, 90)), 1)
    expect(contrast(rgb(118, 118, 118), rgb(255, 255, 255))).toBeGreaterThan(4.5)
    expect(contrast(rgb(119, 119, 119), rgb(255, 255, 255))).toBeLessThan(4.5)
  })
  it('a translucent ink reads lower than its opaque twin on the same fill', () => {
    const fill = rgb(255, 255, 255)
    expect(inkContrast(rgb(0, 0, 0, 0.38), fill)).toBeLessThan(inkContrast(rgb(0, 0, 0), fill))
    close(inkContrast(rgb(0, 0, 0, 0), fill), 1)
  })
})

describe('flatLayers reads a background-image as colour layers', () => {
  it('none is no layer; a flat gradient is its colour; a real image or a two-stop gradient is unresolvable', () => {
    expect(flatLayers('none')).toEqual([])
    expect(flatLayers('linear-gradient(rgb(1, 2, 3), rgb(1, 2, 3))')).toEqual(['rgb(1, 2, 3)'])
    expect(flatLayers('linear-gradient(rgb(1, 2, 3), rgb(1, 2, 3)), none'), 'ui-avatar: the shorthand list ends in an imageless layer').toEqual(['rgb(1, 2, 3)'])
    expect(flatLayers('linear-gradient(to right, oklch(0.5 0 0) 0%, oklch(0.5 0 0) 100%)')).toEqual(['oklch(0.5 0 0)'])
    expect(flatLayers('linear-gradient(red, blue)')).toBeNull()
    expect(flatLayers('url("a.png")')).toBeNull()
    expect(flatLayers('linear-gradient(red, red), url("a.png")')).toBeNull()
  })
  it('splitTopLevel keeps commas inside parentheses', () => {
    expect(splitTopLevel('linear-gradient(rgb(1, 2, 3), red), url(x)')).toEqual(['linear-gradient(rgb(1, 2, 3), red)', 'url(x)'])
  })
})
