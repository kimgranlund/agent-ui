import { describe, it, expect, afterEach } from 'vitest'

// ADR-0245 clause 10c, the per-control geometry pin for the Wave 1 lane a05 (containers): each container's
// radius, padding and, for the two controls in the lane (form-popover, disclosure), height and slot are read
// back from a real engine twice, inside the opt-in root register (data-tier="product" data-scale="sm", the
// library root: n 5 / 6 / 7 at sm / md / lg) and on a plain page. Inside, the numbers are the ADR's second
// derivation written out by hand (card level margin 3n, gutter 2n, radius 3n; widget 2n, n, 2n; group n + c;
// control height 4n, inset n), never read from scale.mjs; outside, they are today's values (the dark launch
// leaves every default page byte-identical). Runs in Chromium and WebKit.
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/shared/foundations.css'
import '../_surface/container.css'
import '../_surface/container-box.css' // the box-model layer the dialog regions read
import './card.css'
import './card.ts'
import '../modal/modal.css'
import '../modal/modal.ts'
import '../drawer/drawer.css'
import '../drawer/drawer.ts'
import '../popover/popover.css'
import '../popover/popover.ts'
import '../tooltip/tooltip.css'
import '../tooltip/tooltip.ts'
import '../toast/toast.css'
import '../toast/toast.ts'
import '../form-popover/form-popover.css'
import '../form-popover/form-popover.ts'
import '../disclosure/disclosure.css'
import '../disclosure/disclosure.ts'
import '../command-modal/command-modal.css'
import '../command-modal/command-modal.ts'

const px = (v: string): number => Number.parseFloat(v)
const REGION = 'data-tier="product" data-scale="sm"'

const mounted: HTMLElement[] = []
afterEach(() => mounted.splice(0).forEach((el) => el.remove()))

/** Mount `markup` inside the opt-in root register (`inside`) or on a plain page, and return the wrapper. */
function mount(markup: string, inside: boolean): HTMLElement {
  const wrap = document.createElement('div')
  if (inside) wrap.innerHTML = `<div ${REGION}>${markup}</div>`
  else wrap.innerHTML = `<div data-foundations="legacy">${markup}</div>` // ADR-0245 cl.10e: the opt-out renders today's geometry
  document.body.append(wrap)
  mounted.push(wrap)
  return wrap
}

const cs = (el: Element): CSSStyleDeclaration => getComputedStyle(el)
const one = (root: ParentNode, sel: string): HTMLElement => {
  const el = root.querySelector(sel)
  if (!el) throw new Error(`no ${sel}`)
  return el as HTMLElement
}

describe('card family: card level (margin 3n, gutter 2n, radius 3n) inside; today outside', () => {
  const card = `<ui-card><ui-card-header>Title</ui-card-header><ui-card-content>Body</ui-card-content></ui-card>`

  it('inside the root register (md n 6): radius 18, region margin 6, region padding 12 on both axes (T-0121: the card margin 3n all round), region radius 12', () => {
    const w = mount(card, true)
    expect(px(cs(one(w, 'ui-card')).borderTopLeftRadius)).toBe(18)
    const header = one(w, 'ui-card-header')
    expect(px(cs(header).marginLeft)).toBe(6)
    expect(px(cs(header).paddingLeft)).toBe(12)
    expect(px(cs(header).paddingTop)).toBe(12) // margin n + pad 2n = 3n to the ink on the block axis too
    expect(px(cs(header).borderTopLeftRadius)).toBe(12)
  })

  it('a data-size region moves the whole chain: sm n 5 reads radius 15, lg n 7 reads radius 21', () => {
    for (const [size, radius, margin] of [['sm', 15, 5], ['lg', 21, 7]] as const) {
      const w = mount(`<div data-size="${size}">${card}</div>`, true)
      expect(px(cs(one(w, 'ui-card')).borderTopLeftRadius), size).toBe(radius)
      expect(px(cs(one(w, 'ui-card-header')).marginLeft), size).toBe(margin)
    }
  })

  it('outside any region: radius 12, region margin 6, padding 12 / 6, nested inner radius floor 4', () => {
    const w = mount(card, false)
    expect(px(cs(one(w, 'ui-card')).borderTopLeftRadius)).toBe(12)
    const header = one(w, 'ui-card-header')
    expect(px(cs(header).marginLeft)).toBe(6)
    expect(px(cs(header).paddingLeft)).toBe(12)
    expect(px(cs(header).paddingTop)).toBe(6)
    expect(px(cs(header).borderTopLeftRadius)).toBe(4)
  })
})

describe('modal and drawer: card level', () => {
  it('modal dialog radius is 18 inside, 12 outside', () => {
    const inside = mount(`<ui-modal><p>x</p></ui-modal>`, true)
    expect(px(cs(one(inside, '[data-part="dialog"]')).borderTopLeftRadius)).toBe(18)
    const outside = mount(`<ui-modal><p>x</p></ui-modal>`, false)
    expect(px(cs(one(outside, '[data-part="dialog"]')).borderTopLeftRadius)).toBe(12)
  })

  it('modal regions get margin n + pad 2n inside (6 + 12) and 6 + 12 outside', () => {
    const markup = `<ui-modal><header>H</header><main>M</main></ui-modal>`
    const inside = one(mount(markup, true), 'header')
    expect(px(cs(inside).marginLeft)).toBe(6)
    expect(px(cs(inside).paddingLeft)).toBe(12)
    const outside = one(mount(markup, false), 'header')
    expect(px(cs(outside).marginLeft)).toBe(6)
    expect(px(cs(outside).paddingLeft)).toBe(12)
  })

  it('drawer dialog exposed-corner radius is 18 inside, 12 outside', () => {
    const inside = mount(`<ui-drawer><p>x</p></ui-drawer>`, true)
    expect(px(cs(one(inside, '[data-part="dialog"]')).borderTopLeftRadius)).toBe(18)
    const outside = mount(`<ui-drawer><p>x</p></ui-drawer>`, false)
    expect(px(cs(one(outside, '[data-part="dialog"]')).borderTopLeftRadius)).toBe(12)
  })
})

describe('popover, tooltip, toast: widget and group levels', () => {
  it('popover panel: widget level, radius and padding 12 inside; 12 and 12 outside', () => {
    const inside = one(mount(`<ui-popover><p>x</p></ui-popover>`, true), '[data-part="panel"]')
    expect(px(cs(inside).borderTopLeftRadius)).toBe(12)
    expect(px(cs(inside).paddingLeft)).toBe(12)
    const outside = one(mount(`<ui-popover><p>x</p></ui-popover>`, false), '[data-part="panel"]')
    expect(px(cs(outside).borderTopLeftRadius)).toBe(12)
    expect(px(cs(outside).paddingLeft)).toBe(12)
  })

  it('tooltip panel: group level (n + c = 8) inside; 12 and 8 outside', () => {
    const inside = one(mount(`<ui-tooltip><button>Anchor</button>Tip</ui-tooltip>`, true), '[data-part="panel"]')
    expect(px(cs(inside).borderTopLeftRadius)).toBe(8)
    expect(px(cs(inside).paddingLeft)).toBe(8)
    const outside = one(mount(`<ui-tooltip><button>Anchor</button>Tip</ui-tooltip>`, false), '[data-part="panel"]')
    expect(px(cs(outside).borderTopLeftRadius)).toBe(12)
    expect(px(cs(outside).paddingLeft)).toBe(8)
  })

  it('toast: widget level, radius 12, padding 12 inline and 6 block inside; 12, 12 and 8 outside', () => {
    const inside = one(mount(`<ui-toast>Saved</ui-toast>`, true), 'ui-toast')
    expect(px(cs(inside).borderTopLeftRadius)).toBe(12)
    expect(px(cs(inside).paddingLeft)).toBe(12)
    expect(px(cs(inside).paddingTop)).toBe(6)
    const outside = one(mount(`<ui-toast>Saved</ui-toast>`, false), 'ui-toast')
    expect(px(cs(outside).borderTopLeftRadius)).toBe(12)
    expect(px(cs(outside).paddingLeft)).toBe(12)
    expect(px(cs(outside).paddingTop)).toBe(8)
  })
})

describe('form-popover and disclosure: 4n control height, n inset, radius n, 2n slot, max(8, 2n - 2c) glyph', () => {
  const STEPS = [
    ['sm', 20, 5, 10, 8], // the glyph floor holds sm at 8 (ADR-0245 Amendment 7)
    ['md', 24, 6, 12, 8],
    ['lg', 28, 7, 14, 10],
  ] as const

  for (const [size, height, n, slot, glyph] of STEPS) {
    it(`form-popover size=${size} inside: height ${height}, radius ${n}, label edge ${n}, caret slot ${slot}, glyph ${glyph}`, () => {
      const w = mount(`<ui-form-popover size="${size}" label="Pick"><p>x</p></ui-form-popover>`, true)
      const trigger = one(w, '[data-part="trigger"]')
      expect(px(cs(trigger).height)).toBe(height)
      expect(px(cs(trigger).borderTopLeftRadius)).toBe(n)
      expect(px(cs(trigger).paddingLeft)).toBe(n)
      const caret = one(w, '[data-part="caret"]')
      expect(px(cs(caret).width)).toBe(slot)
      expect(px(cs(one(caret, 'svg')).width)).toBe(glyph)
    })

    it(`disclosure size=${size} inside: summary height ${height}, edge ${n}, chevron slot ${slot}, glyph ${glyph}`, () => {
      const w = mount(`<ui-disclosure size="${size}" summary="More"><p>x</p></ui-disclosure>`, true)
      const summary = one(w, '[data-part="summary"]')
      expect(px(cs(summary).height)).toBe(height)
      expect(px(cs(summary).paddingLeft)).toBe(n)
      expect(px(cs(one(w, '[data-part="chevron"]')).width)).toBe(slot)
      expect(px(cs(one(w, '[data-part="chevron"] svg')).width)).toBe(glyph)
    })
  }

  it('form-popover panel is widget level inside (radius 12), today outside (12); trigger today outside (28, radius 12, edge 14)', () => {
    const inside = mount(`<ui-form-popover label="Pick"><p>x</p></ui-form-popover>`, true)
    expect(px(cs(one(inside, '[data-part="panel"]')).borderTopLeftRadius)).toBe(12)
    const outside = mount(`<ui-form-popover label="Pick"><p>x</p></ui-form-popover>`, false)
    expect(px(cs(one(outside, '[data-part="panel"]')).borderTopLeftRadius)).toBe(12)
    const trigger = one(outside, '[data-part="trigger"]')
    expect(px(cs(trigger).height)).toBe(28)
    expect(px(cs(trigger).borderTopLeftRadius)).toBe(12)
    expect(px(cs(trigger).paddingLeft)).toBe(14)
  })

  it('disclosure outside a region keeps today: summary 28, edge 14, chevron slot 14 (the font), glyph 10.5 (ui-glyph legacy 0.75em box, T-0149)', () => {
    const w = mount(`<ui-disclosure summary="More"><p>x</p></ui-disclosure>`, false)
    expect(px(cs(one(w, '[data-part="summary"]')).height)).toBe(28)
    expect(px(cs(one(w, '[data-part="summary"]')).paddingLeft)).toBe(14)
    expect(px(cs(one(w, '[data-part="chevron"]')).width)).toBe(14)
    expect(px(cs(one(w, '[data-part="chevron"] svg')).width)).toBe(10.5) // a ui-glyph caret since T-0149: 0.75em of the slot, never the text size
  })
})

describe('command-modal: card level shell, 4n search row', () => {
  it('search row is 24 tall with edge 6 inside; 28 and 14 outside', () => {
    const markup = `<ui-command-modal><div role="option" value="a">A</div></ui-command-modal>`
    const inside = one(mount(markup, true), '[data-part="search"]')
    expect(px(cs(inside).minHeight)).toBe(24)
    expect(px(cs(inside).paddingLeft)).toBe(6)
    const outside = one(mount(markup, false), '[data-part="search"]')
    expect(px(cs(outside).minHeight)).toBe(28)
    expect(px(cs(outside).paddingLeft)).toBe(14)
  })
})
