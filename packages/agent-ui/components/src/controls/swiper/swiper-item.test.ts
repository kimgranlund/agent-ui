import { describe, it, expect } from 'vitest'
import { UISwiperItemElement } from './swiper-item.ts'

// swiper-item.test.ts — n5 jsdom probes (swiper-family.lld.md LLD-C4 · SPEC-R9). Under proof: the class
// resolves + self-defines, `value` defaults/reflects, `labelAs` sets role/roledescription/label via
// internals, and connect() applies NO self-driven ARIA (the coordinator alone owns labelling).

class ProbeItem extends UISwiperItemElement {
  get ii(): ElementInternals {
    return this.internals
  }
}
customElements.define('ui-swiper-item-probe', ProbeItem)

function make(): ProbeItem {
  return new ProbeItem()
}

describe('UISwiperItemElement — upgrade + typed props', () => {
  it('upgrades to the class; self-defines as ui-swiper-item', () => {
    const el = document.createElement('ui-swiper-item') as UISwiperItemElement
    expect(el).toBeInstanceOf(UISwiperItemElement)
    expect(customElements.get('ui-swiper-item')).toBe(UISwiperItemElement)
  })

  it('`value` defaults to \'\' and reflects', () => {
    const el = make()
    document.body.append(el)
    expect(el.value).toBe('')
    el.value = 'intro'
    expect(el.getAttribute('value')).toBe('intro')
    el.remove()
  })
})

describe('UISwiperItemElement — no self-driven ARIA on connect', () => {
  it('carries no role/aria-* on connect — the coordinator alone applies labelAs', () => {
    const el = make()
    document.body.append(el)
    expect(el.ii.role).toBeNull()
    expect(el.getAttribute('role')).toBeNull()
    for (const attr of Array.from(el.attributes)) expect(attr.name.startsWith('aria-')).toBe(false)
    el.remove()
  })
})

describe('UISwiperItemElement — labelAs (the coordinator seam)', () => {
  it('sets role=group, aria-roledescription=slide, and aria-label to the supplied position string', () => {
    const el = make()
    document.body.append(el)
    el.labelAs('2 of 5')
    expect(el.ii.role).toBe('group')
    expect(el.ii.ariaRoleDescription).toBe('slide')
    expect(el.ii.ariaLabel).toBe('2 of 5')
    // still no host attribute — every fact rides internals
    expect(el.getAttribute('role')).toBeNull()
    el.remove()
  })

  it('is idempotent — re-calling with a new position updates the label (a real/clone-count shift)', () => {
    const el = make()
    document.body.append(el)
    el.labelAs('1 of 3')
    el.labelAs('1 of 4')
    expect(el.ii.ariaLabel).toBe('1 of 4')
    el.remove()
  })
})
