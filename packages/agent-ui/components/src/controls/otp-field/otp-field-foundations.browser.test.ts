import { describe, it, expect, afterEach } from 'vitest'
import { resolve } from '../../../../shared/src/tokens/scale.mjs'
import { resolve as model } from '../../../../../../scripts/lib/foundations-model.mjs' // the radii at the balanced preset (T-0374 step 6)
import '@agent-ui/shared/foundations.css'
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/all.css'
import '@agent-ui/components/all'

// ADR-0245 dark launch, lane a01: ui-otp-field geometry outside and inside a data-tier region. Outside, every derived
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
  wrap.innerHTML = `<ui-otp-field></ui-otp-field>`
  const control = wrap.querySelector('ui-otp-field') as HTMLElement
  if (size) control.setAttribute('size', size)
  document.body.append(wrap)
  mounted.push(wrap)
  return (control.querySelector('[data-part="cell"]') as HTMLElement | null) ?? control
}
const read = (el: HTMLElement, prop: string): number => parseFloat(getComputedStyle(el).getPropertyValue(prop))

describe('ui-otp-field foundations (ADR-0245 lane a01)', () => {
  it('under data-foundations="legacy" keeps today\'s geometry (the clause 10e rollback)', () => {
    const el = mount(false)
    expect(read(el, 'block-size'), 'height').toBeCloseTo(28, 1)
    expect(read(el, 'border-top-left-radius'), 'radius').toBeCloseTo(12, 1)
  })
  for (const size of ['sm', 'md', 'lg'] as const) {
    it(`inside product / sm at size ${size} reads the derived geometry`, () => {
      const r = resolve('product', 'sm', size)
      const el = mount(true, size)
      expect(read(el, 'block-size'), 'height').toBeCloseTo(r.h, 1)
      expect(read(el, 'border-top-left-radius'), 'radius').toBeCloseTo(model('product', 'sm', size).radius, 1) // the round square at the surface radius A x n (ADR-0245 Amendment 6, T-0374 step 6)
      expect(r.n, 'anti-vacuous: a round square is not the h/2 pill').toBeLessThan(r.h / 2)
    })
  }
})
