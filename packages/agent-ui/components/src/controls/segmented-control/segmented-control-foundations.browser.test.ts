import { describe, it, expect, afterEach } from 'vitest'
import { resolve } from '../../../../shared/src/tokens/scale.mjs'
import '@agent-ui/shared/foundations.css'
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/all.css'
import '@agent-ui/components/all'

// ADR-0245 dark launch, lane a01: ui-segmented-control geometry outside and inside a data-tier region. Outside, every derived
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
  wrap.innerHTML = `<ui-segmented-control><ui-segment value="a">A</ui-segment><ui-segment value="b">B</ui-segment></ui-segmented-control>`
  const control = wrap.querySelector('ui-segmented-control') as HTMLElement
  if (size) control.setAttribute('size', size)
  document.body.append(wrap)
  mounted.push(wrap)
  return control
}
const read = (el: HTMLElement, prop: string, pseudo?: string): number => parseFloat(getComputedStyle(el, pseudo).getPropertyValue(prop))

describe('ui-segmented-control foundations (ADR-0245 lane a01)', () => {
  it('under data-foundations="legacy" keeps today\'s geometry (the clause 10e rollback)', () => {
    const el = mount(false)
    expect(read(el, 'padding-inline-start'), 'padding').toBeCloseTo(0, 1)
    expect(read(el, 'column-gap'), 'gap').toBeCloseTo(0, 1)
    expect(read(el, 'border-top-left-radius', '::after'), 'track radius').toBeCloseTo(12, 1)
    expect(read(el, 'border-top-left-radius', '::before'), 'thumb radius').toBeCloseTo(11, 1)
  })
  for (const size of ['sm', 'md', 'lg'] as const) {
    it(`inside product / sm at size ${size} reads the derived geometry`, () => {
      const r = resolve('product', 'sm', size)
      const el = mount(true, size)
      expect(read(el, 'padding-inline-start'), 'padding').toBeCloseTo(r.c, 1)
      expect(read(el, 'column-gap'), 'gap').toBeCloseTo(r.c, 1)
      // ADR-0245 Amendment 6: a pill track (h/2 of the 4n segment plus c padding on each side) with a concentric 2n thumb
      const trackHeight = el.getBoundingClientRect().height
      expect(trackHeight, 'track height').toBeCloseTo(r.h + 2 * r.c, 1)
      expect(read(el, 'border-top-left-radius', '::after'), 'track radius').toBeCloseTo(trackHeight / 2, 1)
      expect(read(el, 'border-top-left-radius', '::before'), 'thumb radius').toBeCloseTo(2 * r.n, 1)
    })
  }
})
