import { describe, it, expect, afterEach } from 'vitest'
import { UINavRailElement } from './nav-rail.ts'
import { UINavRailItemElement } from './nav-rail-item.ts'

// nav-rail-geometry.browser.test.ts: the ADR-0245 dark-launch pair for ui-nav-rail (lane a07). Outside a
// `[data-tier]` region, under `data-foundations="legacy"` (clause 10e), the row reads today's ramp through the fallbacks (28px high, a 14px gap, an 18px
// icon cell); inside `data-tier="product" data-scale="md"` (n 8, the roomier product register) the same rule
// reads the derived tokens (height 4n = 32, icon cell 2n = 16, gap n = 8, tag type n+4 = 12). Expected
// numbers are scale.mjs resolve('product', 'md', 'md'); the 36-cell token proof lives in
// shared/src/tokens/foundations.browser.test.ts.
import { resolve } from '../../../../shared/src/tokens/scale.mjs'
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/all.css'
import './nav-rail.css'

const mounted: HTMLElement[] = []
afterEach(() => mounted.splice(0).forEach((el) => el.remove()))

/** A wide rail with one icon-bearing item, optionally inside a derived-foundations region. */
function mount(region: boolean): { activator: HTMLElement; icon: HTMLElement } {
  const wrapper = document.createElement('div')
  wrapper.style.inlineSize = '400px'
  if (region) {
    wrapper.setAttribute('data-tier', 'product')
    wrapper.setAttribute('data-scale', 'md')
  } else {
    wrapper.setAttribute('data-foundations', 'legacy') // ADR-0245 cl.10e: the opt-out renders today's geometry
  }
  const rail = new UINavRailElement()
  const item = new UINavRailItemElement()
  item.href = '#a'
  const icon = document.createElement('span')
  icon.setAttribute('slot', 'leading')
  icon.setAttribute('data-role', 'icon')
  item.append(icon, 'Alpha')
  rail.append(item)
  wrapper.append(rail)
  document.body.append(wrapper)
  mounted.push(wrapper)
  return { activator: item.querySelector('[data-part="activator"]') as HTMLElement, icon }
}

const px = (value: string): number => parseFloat(value)

describe('ui-nav-rail geometry across the data-tier dark launch', () => {
  it('reads today’s ramp under data-foundations=legacy (the clause 10e rollback)', async () => {
    const { activator, icon } = mount(false)
    await new Promise((r) => requestAnimationFrame(() => r(undefined)))
    expect(px(getComputedStyle(activator).blockSize)).toBe(28)
    expect(px(getComputedStyle(icon).inlineSize)).toBe(18)
    expect(px(getComputedStyle(activator).columnGap)).toBe(7)
    expect(px(getComputedStyle(activator).borderInlineStartWidth)).toBe(2)
  })

  it('reads the derived tokens inside product/md', async () => {
    const { activator, icon } = mount(true)
    await new Promise((r) => requestAnimationFrame(() => r(undefined)))
    const r = resolve('product', 'md', 'md')
    expect(px(getComputedStyle(activator).blockSize)).toBe(r.h)
    expect(px(getComputedStyle(icon).inlineSize)).toBe(r.icon)
    expect(px(getComputedStyle(activator).columnGap)).toBe(r.n)
    expect(px(getComputedStyle(activator).borderInlineStartWidth)).toBe(r.c) // c = round-up(n / 4)
  })
})
