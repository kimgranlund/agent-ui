import { describe, it, expect, afterEach } from 'vitest'
import { resolve } from '../../../../shared/src/tokens/scale.mjs'
import './tabs.ts'
import './tab.ts'
import './tab-panel.ts'
import '@agent-ui/components/foundation-styles.css'
import '../_surface/container.css'
import '../_surface/container-box.css'
import '../menu/menu.css'
import './tabs.css'

// ui-tabs geometry (ADR-0245 clause 3, delta row "tabs tab height"): inside an opt-in region a tab row is the 4n
// control height at the region's own n (28 at the root md); outside one it is today's lg ramp step (36), so the
// dark launch leaves every default page where it was.

const mounted: HTMLElement[] = []
afterEach(() => mounted.splice(0).forEach((el) => el.remove()))

const TABS = `<ui-tabs><ui-tab>One</ui-tab><ui-tab>Two</ui-tab><ui-tab-panel>P1</ui-tab-panel><ui-tab-panel>P2</ui-tab-panel></ui-tabs>`

function mount(html: string): { tab: HTMLElement } {
  const wrap = document.createElement('div')
  wrap.innerHTML = html
  document.body.append(wrap)
  mounted.push(wrap)
  return { tab: wrap.querySelector('ui-tab') as HTMLElement }
}

describe('ui-tabs geometry inside an opt-in region', () => {
  for (const scale of ['sm', 'md'] as const) {
    it(`product / ${scale}: the tab row is 4n`, () => {
      const { tab } = mount(`<div data-tier="product" data-scale="${scale}">${TABS}</div>`)
      const r = resolve('product', scale, 'md')
      expect(tab.getBoundingClientRect().height).toBe(r.h)
    })
  }
})

describe('ui-tabs geometry outside any region (the dark launch)', () => {
  it('the tab row stays at the lg ramp step (36)', () => {
    const { tab } = mount(TABS)
    expect(tab.getBoundingClientRect().height).toBe(36)
  })
})
