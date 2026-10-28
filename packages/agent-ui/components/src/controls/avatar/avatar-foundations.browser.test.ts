import { describe, it, expect, afterEach } from 'vitest'
import '@agent-ui/components/foundation-styles.css'
import './avatar.css'
import './avatar.ts'
import '../icon/icon.css'
import '../icon/icon.ts'
import { resolve } from '../../../../../../scripts/lib/foundations-model.mjs'

// ui-avatar geometry under ADR-0245 (the dark launch): inside an opt-in [data-tier] region the control reads the
// derived tokens and measures against foundations-model.mjs resolve(); outside one it still measures today's values.

const mounted: HTMLElement[] = []
afterEach(() => mounted.splice(0).forEach((el) => el.remove()))

function mount(html: string, region = true): HTMLElement {
  const wrap = document.createElement('div')
  if (region) {
    wrap.setAttribute('data-tier', 'product')
    wrap.setAttribute('data-scale', 'sm')
  } else {
    wrap.setAttribute('data-foundations', 'legacy') // ADR-0245 cl.10e: the opt-out renders today's geometry
  }
  wrap.innerHTML = html
  document.body.append(wrap)
  mounted.push(wrap)
  return wrap
}


describe("ui-avatar geometry (ADR-0245 cl.3, Kim's step 0 ruling: 4n)", () => {
  for (const size of ['sm', 'md', 'lg'] as const) {
    it(`inside a region at size ${size}: a 4n square with a 2n person icon`, () => {
      const avatar = mount(`<ui-avatar size="${size}"></ui-avatar>`).querySelector('ui-avatar') as HTMLElement
      const r = resolve('product', 'sm', size)
      const box = avatar.getBoundingClientRect()
      expect([box.width, box.height]).toEqual([r.height, r.height])
      const icon = avatar.querySelector('ui-icon') as HTMLElement
      expect(icon.getBoundingClientRect().width).toBeCloseTo(r.iconBox, 1)
    })
  }

  it("under data-foundations=legacy: today's 24 / 28 / 36 control-height ladder and the 0.6 icon", () => {
    const wrap = mount('<ui-avatar size="sm"></ui-avatar><ui-avatar></ui-avatar><ui-avatar size="lg"></ui-avatar>', false)
    const widths = [...wrap.querySelectorAll('ui-avatar')].map((a) => a.getBoundingClientRect().width)
    expect(widths).toEqual([24, 28, 36])
    const icon = wrap.querySelectorAll('ui-avatar')[1].querySelector('ui-icon') as HTMLElement
    expect(icon.getBoundingClientRect().width).toBeCloseTo(28 * 0.6, 1)
  })
})
