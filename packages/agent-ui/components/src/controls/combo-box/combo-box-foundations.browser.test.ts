import { describe, it, expect, afterEach } from 'vitest'
import { resolve } from '../../../../shared/src/tokens/scale.mjs'
import '@agent-ui/shared/foundations.css'
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/all.css'
import '@agent-ui/components/all'

// ADR-0245 dark launch, lane a01: ui-combo-box geometry outside and inside a data-tier region. Outside, every derived
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
  }
  wrap.innerHTML = `<ui-combo-box></ui-combo-box>`
  const control = wrap.querySelector('ui-combo-box') as HTMLElement
  if (size) control.setAttribute('size', size)
  document.body.append(wrap)
  mounted.push(wrap)
  return (control.querySelector('[data-part="editor"]') as HTMLElement | null) ?? control
}
const read = (el: HTMLElement, prop: string): number => parseFloat(getComputedStyle(el).getPropertyValue(prop))

describe('ui-combo-box foundations (ADR-0245 lane a01)', () => {
  it('outside a data-tier region keeps today\'s geometry (the default-page contract)', () => {
    const el = mount(false)
    expect(read(el, 'padding-inline-start'), 'padding').toBeCloseTo(14, 1)
    expect(read(el, 'border-top-left-radius'), 'radius').toBeCloseTo(12, 1)
  })
  for (const size of ['sm', 'md', 'lg'] as const) {
    it(`inside product / sm at size ${size} reads the derived geometry`, () => {
      const r = resolve('product', 'sm', size)
      const el = mount(true, size)
      expect(read(el, 'padding-inline-start'), 'padding').toBeCloseTo(r.n, 1)
      expect(read(el, 'border-top-left-radius'), 'radius').toBeCloseTo(r.radius, 1)
    })
  }
})
