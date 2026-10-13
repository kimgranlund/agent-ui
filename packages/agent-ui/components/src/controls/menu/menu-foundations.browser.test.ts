import { describe, it, expect, afterEach } from 'vitest'
import { resolve } from '../../../../shared/src/tokens/scale.mjs'
import '@agent-ui/components/foundation-styles.css'
import '../_surface/container-box.css'
import './menu.css'
import './menu.ts'
import type { UIMenuElement } from './menu.ts'

// ui-menu geometry (ADR-0245 clauses 3 and 6, delta rows "menu item row", "listbox padding", "listbox panel
// radius"): inside an opt-in region an item row is 4n tall, sits c from the panel edge and the panel radius is
// the group radius n + c; outside one every value is today's (a 22px row at the default font, a 6px inset, the
// 12px corner), so the dark launch leaves default pages where they were.

const mounted: HTMLElement[] = []
afterEach(() => {
  for (const m of mounted.splice(0)) {
    for (const panel of m.querySelectorAll<HTMLElement>('[data-part="panel"]')) {
      try {
        panel.hidePopover()
      } catch {
        /* already hidden */
      }
    }
    m.remove()
  }
})

const MENU = `<ui-menu><button>Open</button><div data-value="a">Alpha</div><div data-value="b">Beta</div></ui-menu>`

async function open(html: string): Promise<{ item: HTMLElement; panel: HTMLElement }> {
  const wrap = document.createElement('div')
  wrap.innerHTML = html
  document.body.append(wrap)
  mounted.push(wrap)
  const menu = wrap.querySelector('ui-menu') as UIMenuElement
  menu.open = true
  await menu.updateComplete
  return {
    item: menu.querySelector('[role="menuitem"]') as HTMLElement,
    panel: menu.querySelector('[data-part="panel"]') as HTMLElement,
  }
}

const radius = (el: HTMLElement): number => Number.parseFloat(getComputedStyle(el).borderTopLeftRadius)
const margin = (el: HTMLElement): number => Number.parseFloat(getComputedStyle(el).marginTop)

describe('ui-menu geometry inside an opt-in region', () => {
  for (const scale of ['sm', 'md'] as const) {
    it(`product / ${scale}: row 4n, inset c, item radius n, panel radius n + c`, async () => {
      const { item, panel } = await open(`<div data-tier="product" data-scale="${scale}">${MENU}</div>`)
      const r = resolve('product', scale, 'md')
      expect(item.getBoundingClientRect().height).toBe(r.h)
      expect(margin(item)).toBe(r.c)
      expect(radius(item)).toBe(r.control.radius)
      expect(radius(panel)).toBe(r.group.radius)
    })
  }
})

describe('ui-menu geometry under data-foundations=legacy (the clause 10e rollback)', () => {
  it('the row is font + 2 x pad, the inset 6px and the panel corner 12px', async () => {
    const { item, panel } = await open(`<div data-foundations="legacy">${MENU}</div>`)
    const font = Number.parseFloat(getComputedStyle(item).fontSize)
    expect(item.getBoundingClientRect().height).toBe(font + 2 * 4)
    expect(margin(item)).toBe(6)
    expect(radius(panel)).toBe(12)
  })
})
