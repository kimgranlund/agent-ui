import { describe, it, expect, afterEach } from 'vitest'
import '@agent-ui/shared/foundations.css'
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/all.css'
import '@agent-ui/components/all'
import { resolve } from '../../../../../../scripts/lib/foundations-model.mjs'

// ADR-0245 dark launch, lane a01: ui-rating geometry outside and inside a data-tier region. Outside, every derived
// token is undefined and each rule falls back to today's value (the expected px below, the default-page
// contract); inside the library root register (product / sm), the host reads the derived formulas of
// clause 3 at its own size, through layout (a real engine's computed px).

const mounted: HTMLElement[] = []
afterEach(() => mounted.splice(0).forEach((el) => el.remove()))

function mount(inRegion: boolean, size?: string): HTMLElement {
  const wrap = document.createElement('div')
  if (inRegion) {
    wrap.setAttribute('data-tier', 'product')
    wrap.setAttribute('data-scale', 'sm')
  } else {
    wrap.setAttribute('data-foundations', 'legacy') // ADR-0245 cl.10e: the opt-out renders today's geometry
  }
  wrap.innerHTML = `<ui-rating></ui-rating>`
  const control = wrap.querySelector('ui-rating') as HTMLElement
  if (size) control.setAttribute('size', size)
  document.body.append(wrap)
  mounted.push(wrap)
  return (control.querySelector('[data-part="stars"]') as HTMLElement | null) ?? control
}
const read = (el: HTMLElement, prop: string): number => parseFloat(getComputedStyle(el).getPropertyValue(prop))

describe('ui-rating foundations (ADR-0245 lane a01)', () => {
  it('under data-foundations="legacy" keeps today\'s geometry (the clause 10e rollback)', () => {
    const el = mount(false)
    expect(read(el, 'block-size'), 'box').toBeCloseTo(16, 1)
  })
  for (const size of ['sm', 'md', 'lg'] as const) {
    it(`inside product / sm at size ${size} reads the derived geometry`, () => {
      const r = resolve('product', 'sm', size)
      const el = mount(true, size)
      expect(read(el, 'block-size'), 'box').toBeCloseTo(r.iconBox, 1)
    })
  }
})

// T-0172: `[size]` steps the star box wherever the rating sits: at the page root (no tier region) and on an A2UI
// canvas (widget / md), the box is the icon box 2n at the rating's own size (ADR-0245: icon 2n inside a control
// or tier region), never the root's icon box inherited unchanged.
describe('ui-rating [size] steps the star box (T-0172)', () => {
  function starBox(region: Record<string, string>, size: string): number {
    const wrap = document.createElement('div')
    for (const [k, v] of Object.entries(region)) wrap.setAttribute(k, v)
    wrap.innerHTML = `<ui-rating max="5" value="3" size="${size}"></ui-rating>`
    document.body.append(wrap)
    mounted.push(wrap)
    return (wrap.querySelector('svg') as SVGElement).getBoundingClientRect().width
  }
  for (const [label, region, tier, scale] of [
    ['the page root', {}, 'product', 'md'],
    ['an A2UI canvas', { 'data-tier': 'widget', 'data-scale': 'md' }, 'widget', 'md'],
  ] as const) {
    it(`at ${label}, sm < md < lg and each equals the derived icon box`, () => {
      const boxes = (['sm', 'md', 'lg'] as const).map((size) => starBox(region, size))
      expect(boxes[0]).toBeLessThan(boxes[1]!)
      expect(boxes[1]).toBeLessThan(boxes[2]!)
      ;(['sm', 'md', 'lg'] as const).forEach((size, i) => expect(boxes[i], size).toBeCloseTo(resolve(tier, scale, size).iconBox, 1))
    })
  }
})
