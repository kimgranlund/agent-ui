import { describe, it, expect, afterEach } from 'vitest'
import { resolve } from '../../../../shared/src/tokens/scale.mjs'
import '@agent-ui/components/foundation-styles.css'
import './icon.css'
import './icon.ts'

// ui-icon geometry under ADR-0245 (the dark launch): inside an opt-in [data-tier] region the control reads the
// derived tokens and measures against scale.mjs resolve(); outside one it still measures today's values.

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


describe('ui-icon geometry (ADR-0245 cl.4: the 2n icon box)', () => {
  for (const size of ['sm', 'md', 'lg'] as const) {
    it(`inside a region at size ${size}: a standalone icon is 2n square`, () => {
      const icon = mount(`<span data-size="${size}"><ui-icon symbol="x"></ui-icon></span>`).querySelector(
        'ui-icon',
      ) as HTMLElement
      const r = resolve('product', 'sm', size)
      const box = icon.getBoundingClientRect()
      expect([box.width, box.height]).toEqual([r.icon, r.icon])
    })
  }

  it('under data-foundations=legacy: the 1em cell, so the ambient font-size is the lever', () => {
    const icon = mount('<span style="font-size: 20px"><ui-icon symbol="x"></ui-icon></span>', false).querySelector(
      'ui-icon',
    ) as HTMLElement
    const box = icon.getBoundingClientRect()
    expect([box.width, box.height]).toEqual([20, 20])
  })
})
