import { describe, it, expect, afterEach } from 'vitest'
import { resolve, type Emitted } from '../../../../../scripts/lib/foundations-model.mjs'
import './tokens.css' // the colour roles: a control's border colour token, so its 1px border computes
import './foundations.gen.css'
import './foundations-bridge.gen.css'
import '../../../components/src/controls/glyph/glyph.css'
import '../../../components/src/controls/glyph/glyph.ts'
import '../../../components/src/controls/button/button.css'
import '../../../components/src/controls/button/button.ts'
import '../../../components/src/controls/text-field/text-field.css'
import '../../../components/src/controls/text-field/text-field.ts'

// ADR-0245 clause 9 and 10c, the 36-cell leg: each tier x scale x size cell is set on a real region, every
// derived token is read back through layout (`inline-size: var(<token>)`, skill section 6 step 4, never the
// raw custom-property text) and compared to the model's resolve() (scripts/lib/foundations-model.mjs, T-0374: the
// oracle each visible step moves; foundations.test.ts holds it to scale.mjs resolve() wherever the two still agree),
// in Chromium and WebKit; every cell repeats at each of the five data-density values (T-0374 step 4: q moves the
// control margin, so the control height, and m, so the widget, card and layout levels). The root leg proves the cut (the document is product at scale md with no attribute, Amendment 8), and
// the legacy leg the clause 10e opt-out: inside [data-foundations="legacy"] every derived token is undefined, so each
// fallback wins.

const TIERS = ['widget', 'product', 'content', 'brand'] as const
const STEPS = ['sm', 'md', 'lg'] as const
const DENSITIES = ['tight', 'compact', 'regular', 'spacious', 'loose'] as const

/** token -> the model quantity it must equal, in px. */
const EXPECTED: ReadonlyArray<readonly [string, (r: Emitted) => number]> = [
  ['n', (r) => r.n],
  ['m', (r) => r.m],
  ['c', (r) => r.c],
  ['control-margin', (r) => r.controlMargin], // T-0374 step 4: (q - 2)n/4, n/2 at regular
  ['height', (r) => r.height], // 3n + 2 control margin: 3n at tight to 5n at loose
  ['inset', (r) => r.inset],
  ['label-inset', (r) => r.labelInset], // the control rule (Amendment 4): gutter c + label inset = margin n
  ['radius', (r) => r.radius],
  // the pill (Amendment 5): a single-line control is h/2 = 2n; the chip pill is h/2 of the 2n + 2c chip, n + c; the
  // checkbox box keeps the skill's ceil(n/2)
  ['control-radius', (r) => r.controlRadius],
  ['checkbox-radius', (r) => r.checkboxRadius],
  ['icon-box', (r) => r.iconBox],
  ['glyph-box', (r) => r.glyphBox], // T-0374: n + 6
  ['glyph-slot', (r) => r.glyphSlot], // T-0374: the square 3n wrapper the glyph box centres in
  ['glyph-stroke', (r) => r.glyphStroke],
  ['type-display', (r) => r.type.display],
  ['type-heading', (r) => r.type.heading],
  ['type-subhead', (r) => r.type.subhead],
  ['type-section-kicker', (r) => r.type.sectionKicker],
  ['type-title', (r) => r.type.title],
  ['type-body', (r) => r.type.body],
  ['type-control', (r) => r.type.control],
  ['type-field-label', (r) => r.type.fieldLabel], // T-0374 step 2: the skill's 10 + 1 per step
  ['type-small-control', (r) => r.type.smallControl], // T-0374 step 2: the skill's small control role, 9 + 1 per step
  ['type-group-kicker', (r) => r.type.groupKicker],
  // T-0373: the old label names, aliases of the kickers in foundations.gen.css on every cell, undefined in the legacy opt-out
  ['type-section-label', (r) => r.type.sectionKicker],
  ['type-group-label', (r) => r.type.groupKicker],
  // the tokens keep the ADR-0140 level names (the skill calls the layout level `page`)
  ...(['chip', 'group', 'widget', 'card', 'layout'] as const).flatMap((level) =>
    (['margin', 'gutter', 'radius'] as const).map((q) => [`${level}-${q}`, (r: Emitted) => r[level][q]] as const),
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

const cell = (r: Emitted): number[] => EXPECTED.map(([, f]) => f(r))
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
      it(`${tier} at data-density ${density}: every scale and size cell moves the control height, the control margin, m and the container levels`, () => {
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

  it('glyph box is n plus 6 in its 3n slot on every cell', async () => {
    // T-0374 (Kim's 2026-10-19 ruling): the skill's square 3n glyph wrapper with the n + 6 artwork centred. The two
    // tokens read back through layout, and a bare ui-glyph in the cell measures the slot and the mark.
    let cells = 0
    for (const tier of TIERS) for (const scale of STEPS) for (const size of STEPS) {
      const at = `${tier} / ${scale} / ${size}`
      const r = resolve(tier, scale, size)
      const got = labelled(readTokens(`<div data-tier="${tier}" data-scale="${scale}"><div data-size="${size}" data-probe></div></div>`))
      expect([got['glyph-box'], got['glyph-slot']], at).toEqual([r.n + 6, 3 * r.n])
      const wrap = document.createElement('div')
      wrap.innerHTML = `<div data-tier="${tier}" data-scale="${scale}"><div data-size="${size}"><ui-glyph symbol="check"></ui-glyph></div></div>`
      document.body.append(wrap)
      mounted.push(wrap)
      const host = wrap.querySelector('ui-glyph') as HTMLElement & { updateComplete: Promise<unknown> }
      await host.updateComplete
      const box = host.getBoundingClientRect()
      const svg = (host.querySelector('svg') as SVGSVGElement).getBoundingClientRect()
      expect([box.width, box.height], `${at}: the 3n slot`).toEqual([3 * r.n, 3 * r.n])
      expect([svg.width, svg.height], `${at}: the n + 6 mark`).toEqual([r.n + 6, r.n + 6])
      cells++
    }
    expect(cells).toBe(36)
  })

  it('field label 10 and the small control role', () => {
    // T-0374 step 2: the field label is the skill's n + 5 (10 at n 5) and the small control role its n + 4, both on
    // the 9px floor. At the root register (n 8) they read back 13 and 12; on every cell they equal the model.
    let cells = 0
    for (const tier of TIERS) for (const scale of STEPS) for (const size of STEPS) {
      const r = resolve(tier, scale, size)
      const got = labelled(readTokens(`<div data-tier="${tier}" data-scale="${scale}"><div data-size="${size}" data-probe></div></div>`))
      const pair = [got['type-field-label'], got['type-small-control']]
      expect(pair, `${tier} / ${scale} / ${size}`).toEqual([r.type.fieldLabel, r.type.smallControl])
      if (tier === 'product' && scale === 'md' && size === 'md') expect(pair).toEqual([13, 12])
      cells++
    }
    expect(cells).toBe(36)
  })

  it('the product sm/sm tight floor: m is 4, not nq/4 = 2.5, so a widget still out-margins a group', () => {
    const got = labelled(readTokens('<div data-tier="product" data-scale="sm" data-density="tight"><i size="sm" data-probe></i></div>'))
    expect(got).toEqual(labelled(cell(resolve('product', 'sm', 'sm', 'tight'))))
    expect(got['m']).toBe(4)
  })

  it('a fractional cell keeps a whole sub-pixel border: ui-button and ui-text-field at widget sm/md at each data-density', async () => {
    // Kim's 2026-10-19 ruling: fractional px ship. At n 5 the height is 15, 17.5, 20, 22.5 and 25 px from tight to
    // loose; the 1px border stays whole and the control's box equals the model height.
    let cells = 0
    for (const density of DENSITIES) {
      const r = resolve('widget', 'sm', 'md', density)
      for (const tag of ['ui-button', 'ui-text-field']) {
        const wrap = document.createElement('div')
        wrap.innerHTML = `<div data-tier="widget" data-scale="sm" data-density="${density}"><${tag}>Go</${tag}></div>`
        document.body.append(wrap)
        mounted.push(wrap)
        const host = wrap.querySelector(tag) as HTMLElement & { updateComplete?: Promise<unknown> }
        await host.updateComplete
        const at = `${tag} widget sm/md ${density}`
        const border = parseFloat(getComputedStyle(host).borderTopWidth)
        expect(Number.isInteger(border) && border >= 1, `${at}: border-top-width ${border}`).toBe(true)
        expect(Math.abs(host.getBoundingClientRect().height - r.height), `${at}: height ${host.getBoundingClientRect().height} vs ${r.height}`).toBeLessThanOrEqual(0.05)
        cells++
      }
    }
    expect(resolve('widget', 'sm', 'md', 'compact').height, 'anti-vacuous: a fractional cell').toBe(17.5)
    expect(cells).toBe(10)
  })

  it('a nested tier inherits its ancestor scale and size (each axis inherits on its own)', () => {
    const got = readTokens(
      '<div data-tier="widget" data-scale="lg" data-size="sm"><div data-tier="brand"><i data-probe></i></div></div>',
    )
    expect(labelled(got)).toEqual(labelled(cell(resolve('brand', 'lg', 'sm'))))
  })

  it('a region with no data-scale or data-size inherits the root scale md at size md', () => {
    expect(labelled(readTokens('<div data-tier="product" data-probe></div>'))).toEqual(
      labelled(cell(resolve('product', 'md', 'md'))),
    )
  })
})

describe('foundations.gen.css: the cut and the legacy opt-out (ADR-0245 clause 10a, 10e)', () => {
  it('with no attribute at all the document reads the root register product / md / md', () => {
    expect(labelled(readTokens('<div><span data-probe></span></div>'))).toEqual(labelled(cell(resolve('product', 'md', 'md'))))
  })

  it('a bare data-scale or size outside any data-tier derives at the root tier', () => {
    expect(labelled(readTokens('<div data-scale="sm"><div size="lg" data-probe></div></div>'))).toEqual(
      labelled(cell(resolve('product', 'sm', 'lg'))),
    )
  })

  it('T-0169: a retired [density] attribute no longer moves anything; the root register holds', () => {
    const legacyAxis = 'density' // built, not spelled, so this proof is not itself a use of the retired axis
    const wrap = `<div ${legacyAxis}="compact"><span data-probe></span></div>`
    expect(labelled(readTokens(wrap))).toEqual(labelled(cell(resolve('product', 'md', 'md'))))
  })

  it('inside [data-foundations="legacy"] every derived token is undefined, so each fallback wins', () => {
    const legacy = readTokens('<div data-foundations="legacy"><div data-scale="lg" size="lg"><div data-size="sm" data-probe></div></div></div>')
    expect(legacy).toEqual(EXPECTED.map(() => FALLBACK))
  })
})
