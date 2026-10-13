import { describe, it, expect, afterEach } from 'vitest'
import { resolve } from '../../../../shared/src/tokens/scale.mjs'
import '@agent-ui/shared/foundations.css'
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/all.css'
import '@agent-ui/components/all'

// ADR-0245 dark launch, lane a01: ui-button geometry outside and inside a data-tier region. Outside, every derived
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
  wrap.innerHTML = `<ui-button>Go</ui-button>`
  const control = wrap.querySelector('ui-button') as HTMLElement
  if (size) control.setAttribute('size', size)
  document.body.append(wrap)
  mounted.push(wrap)
  return control
}
const read = (el: HTMLElement, prop: string): number => parseFloat(getComputedStyle(el).getPropertyValue(prop))

describe('ui-button foundations (ADR-0245 lane a01)', () => {
  it('under data-foundations="legacy" keeps today\'s geometry (the clause 10e rollback)', () => {
    const el = mount(false)
    expect(read(el, 'block-size'), 'height').toBeCloseTo(28, 1)
    expect(read(el, 'padding-inline-start'), 'padding').toBeCloseTo(14, 1)
    expect(read(el, 'border-top-left-radius'), 'radius').toBeCloseTo(14, 1)
  })
  for (const size of ['sm', 'md', 'lg'] as const) {
    it(`inside product / sm at size ${size} reads the derived geometry`, () => {
      const r = resolve('product', 'sm', size)
      const el = mount(true, size)
      expect(read(el, 'block-size'), 'height').toBeCloseTo(r.h, 1)
      // the control rule (ADR-0245 Amendment 4): the host pads the box margin n and the label part carries the
      // label inset n - c, so the text edge is 2n - c
      expect(read(el, 'padding-inline-start'), 'box margin').toBeCloseTo(r.control.margin, 1)
      expect(read(el.querySelector('[data-part="label"]') as HTMLElement, 'padding-inline-start'), 'label inset').toBeCloseTo(r.labelMargin, 1)
      expect(r.control.margin + r.labelMargin, 'text edge').toBe(2 * r.n - r.c)
      expect(read(el, 'border-top-left-radius'), 'radius').toBeCloseTo(r.h / 2, 1)
    })
  }
})
