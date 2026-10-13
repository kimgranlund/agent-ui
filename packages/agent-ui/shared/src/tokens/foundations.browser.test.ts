import { describe, it, expect, afterEach } from 'vitest'
import { resolve, type Resolved } from './scale.mjs'
import './foundations.gen.css'

// ADR-0245 clause 9 and 10c, the 36-cell leg: each tier x scale x size cell is set on a real region, every
// derived token is read back through layout (`inline-size: var(<token>)`, skill section 6 step 4, never the
// raw custom-property text) and compared to scale.mjs resolve(), in Chromium and WebKit. The leak leg proves
// the dark launch: outside a [data-tier] region every token is undefined, so its fallback wins.

const TIERS = ['widget', 'product', 'content', 'brand'] as const
const STEPS = ['sm', 'md', 'lg'] as const

/** token -> the scale.mjs quantity it must equal, in px. */
const EXPECTED: ReadonlyArray<readonly [string, (r: Resolved) => number]> = [
  ['n', (r) => r.n],
  ['c', (r) => r.c],
  ['height', (r) => r.h],
  ['inset', (r) => r.inset],
  ['radius', (r) => r.radius],
  ['icon-box', (r) => r.icon],
  ['glyph-box', (r) => r.glyph],
  ['glyph-stroke', (r) => Math.max(1.5, r.c / 2)],
  ['type-display', (r) => r.type.display],
  ['type-heading', (r) => r.type.heading],
  ['type-subhead', (r) => r.type.subhead],
  ['type-section-kicker', (r) => r.type.sectionKicker],
  ['type-title', (r) => r.type.title],
  ['type-body', (r) => r.type.body],
  ['type-control', (r) => r.type.control],
  ['type-field-label', (r) => r.type.fieldLabel],
  ['type-group-kicker', (r) => r.type.groupKicker],
  ...(['group', 'widget', 'card', 'layout'] as const).flatMap((level) =>
    (['margin', 'gutter', 'radius'] as const).map((q) => [`${level}-${q}`, (r: Resolved) => r[level][q]] as const),
  ),
]
/** The unitless n reads as a length through `* 1px`; every token falls back to 0.25px when undefined. */
const FALLBACK = 0.25
const widthOf = (name: string): string =>
  name === 'n' ? `calc(var(--md-sys-n, ${FALLBACK}) * 1px)` : `var(--md-sys-${name}, ${FALLBACK}px)`

const mounted: HTMLElement[] = []
afterEach(() => mounted.splice(0).forEach((el) => el.remove()))

/** Mount `html`, then read every EXPECTED token on the element marked `data-probe` as a used width. */
function readTokens(html: string): number[] {
  const wrap = document.createElement('div')
  wrap.innerHTML = html
  document.body.append(wrap)
  mounted.push(wrap)
  const probe = wrap.querySelector('[data-probe]') as HTMLElement
  return EXPECTED.map(([name]) => {
    const bar = document.createElement('div')
    bar.style.cssText = `position: absolute; block-size: 1px; inline-size: ${widthOf(name)};`
    probe.append(bar)
    return parseFloat(getComputedStyle(bar).width)
  })
}

const cell = (r: Resolved): number[] => EXPECTED.map(([, f]) => f(r))
const labelled = (values: number[]): Record<string, number> =>
  Object.fromEntries(EXPECTED.map(([name], i) => [name, values[i] as number]))

describe('foundations.gen.css: the 36 cells compute what resolve() gives (ADR-0245 clause 9)', () => {
  for (const tier of TIERS) {
    for (const scale of STEPS) {
      for (const size of STEPS) {
        it(`${tier} / ${scale} / ${size}`, () => {
          // size through data-size on a nested element, and through a control-style [size] attribute.
          const viaData = readTokens(
            `<div data-tier="${tier}" data-scale="${scale}"><div data-size="${size}"><span data-probe></span></div></div>`,
          )
          const viaSize = readTokens(
            `<div data-tier="${tier}"><div data-scale="${scale}"><div size="${size}" data-probe></div></div></div>`,
          )
          const want = labelled(cell(resolve(tier, scale, size)))
          expect(labelled(viaData)).toEqual(want)
          expect(labelled(viaSize)).toEqual(want)
        })
      }
    }
  }

  it('a nested tier inherits its ancestor scale and size (each axis inherits on its own)', () => {
    const got = readTokens(
      '<div data-tier="widget" data-scale="lg" data-size="sm"><div data-tier="brand"><i data-probe></i></div></div>',
    )
    expect(labelled(got)).toEqual(labelled(cell(resolve('brand', 'lg', 'sm'))))
  })

  it('a region with no data-scale or data-size reads md / md', () => {
    expect(labelled(readTokens('<div data-tier="product" data-probe></div>'))).toEqual(
      labelled(cell(resolve('product', 'md', 'md'))),
    )
  })
})

describe('foundations.gen.css: the dark launch does not leak (ADR-0245 clause 10a)', () => {
  it('outside any [data-tier] region every token is undefined, so each fallback wins', () => {
    const outside = readTokens('<div data-scale="lg" size="lg"><div data-size="sm" data-probe></div></div>')
    expect(outside).toEqual(EXPECTED.map(() => FALLBACK))
  })
})
