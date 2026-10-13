import { describe, it, expect, afterEach } from 'vitest'
import { resolve, type Resolved } from './scale.mjs'
import './foundations.gen.css'
import './foundations-bridge.gen.css'

// ADR-0245 clause 9 and 10c, the 36-cell leg: each tier x scale x size cell is set on a real region, every
// derived token is read back through layout (`inline-size: var(<token>)`, skill section 6 step 4, never the
// raw custom-property text) and compared to scale.mjs resolve(), in Chromium and WebKit; Amendment 3 repeats
// every cell at each data-density (m moves the widget, card and layout levels only). The root leg proves
// the cut (the document is product at scale sm with no attribute), and the legacy leg the clause 10e opt-out:
// inside [data-foundations="legacy"] every derived token is undefined, so each fallback wins.

const TIERS = ['widget', 'product', 'content', 'brand'] as const
const STEPS = ['sm', 'md', 'lg'] as const
const DENSITIES = ['compact', 'spacious'] as const

/** token -> the scale.mjs quantity it must equal, in px. */
const EXPECTED: ReadonlyArray<readonly [string, (r: Resolved) => number]> = [
  ['n', (r) => r.n],
  ['m', (r) => r.m],
  ['c', (r) => r.c],
  ['height', (r) => r.h],
  ['inset', (r) => r.control.margin],
  ['radius', (r) => r.control.radius],
  ['icon-box', (r) => r.icon],
  ['glyph-box', (r) => r.glyph],
  ['glyph-stroke', (r) => Math.max(1.5, r.c / 2)],
  ['type-display', (r) => r.type.display],
  ['type-heading', (r) => r.type.heading],
  ['type-subhead', (r) => r.type.subhead],
  ['type-section-label', (r) => r.type.sectionLabel],
  ['type-title', (r) => r.type.title],
  ['type-body', (r) => r.type.body],
  ['type-control', (r) => r.type.control],
  ['type-field-label', (r) => r.type.fieldLabel],
  ['type-group-label', (r) => r.type.groupLabel],
  // the tokens keep the name `layout` (ADR-0140 names); the skill calls that level `page`
  ...([['group', 'group'], ['widget', 'widget'], ['card', 'card'], ['layout', 'page']] as const).flatMap(([token, level]) =>
    (['margin', 'gutter', 'radius'] as const).map((q) => [`${token}-${q}`, (r: Resolved) => r[level][q]] as const),
  ),
]
/** The unitless n and m read as a length through `* 1px`; every token falls back to 0.25px when undefined. */
const FALLBACK = 0.25
const UNITLESS = new Set(['n', 'm'])
const widthOf = (name: string): string =>
  UNITLESS.has(name) ? `calc(var(--md-sys-${name}, ${FALLBACK}) * 1px)` : `var(--md-sys-${name}, ${FALLBACK}px)`

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

  for (const density of DENSITIES) {
    for (const tier of TIERS) {
      it(`${tier} at data-density ${density}: every scale and size cell moves m and the container levels only`, () => {
        for (const scale of STEPS) {
          for (const size of STEPS) {
            const got = readTokens(
              `<div data-tier="${tier}" data-density="${density}"><div data-scale="${scale}"><div size="${size}" data-probe></div></div></div>`,
            )
            expect(labelled(got), `${tier} / ${scale} / ${size}`).toEqual(labelled(cell(resolve(tier, scale, size, density))))
          }
        }
      })
    }
  }

  it('the product sm/sm compact floor: m is 4, not n - a = 3, so a widget still out-margins a group', () => {
    const got = labelled(readTokens('<div data-tier="product" data-scale="sm" data-density="compact"><i size="sm" data-probe></i></div>'))
    expect(got).toEqual(labelled(cell(resolve('product', 'sm', 'sm', 'compact'))))
    expect(got['m']).toBe(4)
  })

  it('a nested tier inherits its ancestor scale and size (each axis inherits on its own)', () => {
    const got = readTokens(
      '<div data-tier="widget" data-scale="lg" data-size="sm"><div data-tier="brand"><i data-probe></i></div></div>',
    )
    expect(labelled(got)).toEqual(labelled(cell(resolve('brand', 'lg', 'sm'))))
  })

  it('a region with no data-scale or data-size inherits the root scale sm at size md', () => {
    expect(labelled(readTokens('<div data-tier="product" data-probe></div>'))).toEqual(
      labelled(cell(resolve('product', 'sm', 'md'))),
    )
  })
})

describe('foundations.gen.css: the cut and the legacy opt-out (ADR-0245 clause 10a, 10e)', () => {
  it('with no attribute at all the document reads the root register product / sm / md', () => {
    expect(labelled(readTokens('<div><span data-probe></span></div>'))).toEqual(labelled(cell(resolve('product', 'sm', 'md'))))
  })

  it('a bare data-scale or size outside any data-tier derives at the root tier', () => {
    expect(labelled(readTokens('<div data-scale="md"><div size="lg" data-probe></div></div>'))).toEqual(
      labelled(cell(resolve('product', 'md', 'lg'))),
    )
  })

  it('the retired [density] maps onto data-density: compact moves m one tier step down, never n', () => {
    const legacyAxis = 'density' // built, not spelled, so this proof is not itself a use of the retired axis
    const wrap = `<div ${legacyAxis}="compact"><span data-probe></span></div>`
    expect(labelled(readTokens(wrap))).toEqual(labelled(cell(resolve('product', 'sm', 'md', 'compact'))))
  })

  it('inside [data-foundations="legacy"] every derived token is undefined, so each fallback wins', () => {
    const legacy = readTokens('<div data-foundations="legacy"><div data-scale="lg" size="lg"><div data-size="sm" data-probe></div></div></div>')
    expect(legacy).toEqual(EXPECTED.map(() => FALLBACK))
  })
})
