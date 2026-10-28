import { describe, it, expect, afterEach } from 'vitest'
import '@agent-ui/components/foundation-styles.css'
import './icon.css'
import './icon.ts'
import { resolve } from '../../../../../../scripts/lib/foundations-model.mjs'

// ui-icon geometry under ADR-0245 (the dark launch): inside an opt-in [data-tier] region the control reads the
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


describe('ui-icon geometry (ADR-0245 cl.4: the 2n icon box)', () => {
  for (const size of ['sm', 'md', 'lg'] as const) {
    it(`inside a region at size ${size}: a standalone icon is 2n square`, () => {
      const icon = mount(`<span data-size="${size}"><ui-icon symbol="x"></ui-icon></span>`).querySelector(
        'ui-icon',
      ) as HTMLElement
      const r = resolve('product', 'sm', size)
      const box = icon.getBoundingClientRect()
      expect([box.width, box.height]).toEqual([r.iconBox, r.iconBox])
    })
  }

  it('outside a region (the plain page, Amendment 6): a standalone icon follows the text, 1em', () => {
    const wrap = document.createElement('div')
    wrap.innerHTML = '<span style="font-size: 20px"><ui-icon symbol="x"></ui-icon></span><ui-icon symbol="x" style="font-size: 1.5rem"></ui-icon>'
    document.body.append(wrap)
    mounted.push(wrap)
    const [ambient, explicit] = [...wrap.querySelectorAll('ui-icon')] as HTMLElement[]
    expect(wrap.closest('[data-tier]'), 'the plain page must not sit inside a region').toBeNull()
    expect([ambient!.getBoundingClientRect().width, ambient!.getBoundingClientRect().height]).toEqual([20, 20])
    expect(explicit!.getBoundingClientRect().width, 'an explicit font-size is honoured').toBe(24)
    // anti-vacuous: 20px is not the root icon box, so a 2n icon would fail the first expectation
    expect(resolve('product', 'sm', 'md').iconBox).not.toBe(20)
  })

  it('under data-foundations=legacy: the 1em cell, so the ambient font-size is the lever', () => {
    const icon = mount('<span style="font-size: 20px"><ui-icon symbol="x"></ui-icon></span>', false).querySelector(
      'ui-icon',
    ) as HTMLElement
    const box = icon.getBoundingClientRect()
    expect([box.width, box.height]).toEqual([20, 20])
  })
})
