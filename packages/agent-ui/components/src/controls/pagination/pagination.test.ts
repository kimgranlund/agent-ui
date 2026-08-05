import { describe, it, expect, afterEach } from 'vitest'
import { UIPaginationElement } from './pagination.ts'
import type { UIButtonElement } from '../button/button.ts'

// pagination.test.ts — jsdom behaviour probes (ADR-0163 cl.6, SPEC-R3). jsdom is blind to painted geometry —
// pagination.browser.test.ts covers cross-engine truth. This file covers: prop typing/defaults, the honest
// empty state (pages < 2), the stamped anatomy (prev/next/page stops + ellipsis), aria-current on exactly
// one stop, disabled prev/next at the range ends, the commit/no-commit-on-active-click law, and NO host ARIA
// attribute (internals only).

class ProbePagination extends UIPaginationElement {
  get probeInternals(): ElementInternals {
    return this.internals
  }
}
customElements.define('ui-pagination-probe', ProbePagination)

const mounted: HTMLElement[] = []
function mount(el: HTMLElement): HTMLElement {
  document.body.append(el)
  mounted.push(el)
  return el
}
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

describe('UIPaginationElement — upgrade + typed props', () => {
  it('upgrades to the class; page defaults 1, pages defaults 0, label defaults empty', () => {
    const el = document.createElement('ui-pagination') as UIPaginationElement
    expect(el).toBeInstanceOf(UIPaginationElement)
    expect(el.page).toBe(1)
    expect(el.pages).toBe(0)
    expect(el.label).toBe('')
  })

  it('self-defines as ui-pagination, guarded against double-define', () => {
    expect(customElements.get('ui-pagination')).toBe(UIPaginationElement)
    expect(() => {
      if (!customElements.get('ui-pagination')) customElements.define('ui-pagination', UIPaginationElement)
    }).not.toThrow()
  })
})

describe('UIPaginationElement — the honest empty state (SPEC-R3)', () => {
  it('pages=0 (default) renders NOTHING', () => {
    const el = mount(new UIPaginationElement()) as UIPaginationElement
    expect(el.children).toHaveLength(0)
  })

  it('pages=1 ALSO renders nothing — "pages < 2"', () => {
    const el = new UIPaginationElement()
    el.pages = 1
    mount(el)
    expect(el.children).toHaveLength(0)
  })

  it('pages=2 renders real anatomy', async () => {
    const el = new UIPaginationElement()
    el.pages = 2
    mount(el)
    await el.updateComplete
    expect(el.children.length).toBeGreaterThan(0)
  })
})

describe('UIPaginationElement — stamped anatomy (SPEC-R3)', () => {
  it('composes real ui-button elements for prev/next/page stops', async () => {
    const el = new UIPaginationElement()
    el.pages = 5
    el.page = 3
    mount(el)
    await el.updateComplete
    const prev = el.querySelector('[data-part="prev"]')
    const next = el.querySelector('[data-part="next"]')
    const pages = el.querySelectorAll('[data-part="page"]')
    expect(prev?.tagName.toLowerCase()).toBe('ui-button')
    expect(next?.tagName.toLowerCase()).toBe('ui-button')
    expect(pages.length).toBeGreaterThan(0)
    for (const p of pages) expect(p.tagName.toLowerCase()).toBe('ui-button')
  })

  it('exactly ONE stop carries aria-current="page" — the current page', async () => {
    const el = new UIPaginationElement()
    el.pages = 10
    el.page = 5
    mount(el)
    await el.updateComplete
    const current = el.querySelectorAll('[aria-current="page"]')
    expect(current).toHaveLength(1)
    expect(current[0].textContent).toBe('5')
  })

  it('a gap collapses to a non-interactive, aria-hidden ellipsis marker', async () => {
    const el = new UIPaginationElement()
    el.pages = 20
    el.page = 1
    mount(el)
    await el.updateComplete
    const ellipsis = el.querySelectorAll('[data-part="ellipsis"]')
    expect(ellipsis.length).toBeGreaterThan(0)
    for (const e of ellipsis) {
      expect(e.getAttribute('aria-hidden')).toBe('true')
      expect(e.tagName.toLowerCase()).not.toBe('ui-button')
    }
  })

  it('prev is disabled at page 1; next is disabled at the last page', async () => {
    const el = new UIPaginationElement()
    el.pages = 5
    el.page = 1
    mount(el)
    await el.updateComplete
    expect((el.querySelector('[data-part="prev"]') as UIButtonElement).hasAttribute('disabled')).toBe(true)
    expect((el.querySelector('[data-part="next"]') as UIButtonElement).hasAttribute('disabled')).toBe(false)

    el.page = 5
    await el.updateComplete
    expect((el.querySelector('[data-part="prev"]') as UIButtonElement).hasAttribute('disabled')).toBe(false)
    expect((el.querySelector('[data-part="next"]') as UIButtonElement).hasAttribute('disabled')).toBe(true)
  })
})

describe('UIPaginationElement — commit (SPEC-R3, the fleet commit law)', () => {
  it('clicking a page stop writes `page` and emits `change` with {page}', async () => {
    const el = new UIPaginationElement()
    el.pages = 5
    el.page = 3
    mount(el)
    await el.updateComplete
    let detail: unknown = null
    el.addEventListener('change', (e) => {
      detail = (e as CustomEvent).detail
    })
    const stop1 = [...el.querySelectorAll('[data-part="page"]')].find((b) => b.textContent === '1') as HTMLElement
    stop1.dispatchEvent(new Event('click', { bubbles: true }))
    expect(el.page).toBe(1)
    expect(detail).toEqual({ page: 1 })
  })

  it('clicking "next" commits page+1', async () => {
    const el = new UIPaginationElement()
    el.pages = 5
    el.page = 2
    mount(el)
    await el.updateComplete
    el.querySelector('[data-part="next"]')?.dispatchEvent(new Event('click', { bubbles: true }))
    expect(el.page).toBe(3)
  })

  it('clicking "prev" commits page-1', async () => {
    const el = new UIPaginationElement()
    el.pages = 5
    el.page = 3
    mount(el)
    await el.updateComplete
    el.querySelector('[data-part="prev"]')?.dispatchEvent(new Event('click', { bubbles: true }))
    expect(el.page).toBe(2)
  })

  it('a programmatic `page` write never emits `change`', async () => {
    const el = new UIPaginationElement()
    el.pages = 5
    mount(el)
    await el.updateComplete
    let fired = false
    el.addEventListener('change', () => {
      fired = true
    })
    el.page = 4
    await el.updateComplete
    expect(fired).toBe(false)
  })

  it('clicking the already-active page is a no-op — no write, no emit', async () => {
    const el = new UIPaginationElement()
    el.pages = 5
    el.page = 3
    mount(el)
    await el.updateComplete
    let fired = false
    el.addEventListener('change', () => {
      fired = true
    })
    const active = el.querySelector('[aria-current="page"]') as HTMLElement
    active.dispatchEvent(new Event('click', { bubbles: true }))
    expect(el.page).toBe(3)
    expect(fired).toBe(false)
  })
})

describe('UIPaginationElement — ARIA via internals only (never a host attribute)', () => {
  it('role=navigation lives on internals; the host carries no role/aria-label attribute', () => {
    const el = mount(new ProbePagination()) as ProbePagination
    el.label = 'Search results'
    el.pages = 3
    expect(el.probeInternals.role).toBe('navigation')
    expect(el.getAttribute('role')).toBeNull()
    expect(el.hasAttribute('aria-label')).toBe(false)
  })

  it('an empty label clears internals.ariaLabel', async () => {
    const el = mount(new ProbePagination()) as ProbePagination
    el.label = 'x'
    await el.updateComplete
    expect(el.probeInternals.ariaLabel).toBe('x')
    el.label = ''
    await el.updateComplete
    expect(el.probeInternals.ariaLabel).toBeNull()
  })
})

describe('UIPaginationElement — zero residue across connect/disconnect', () => {
  it('effects die on disconnect; reconnect re-installs exactly once', async () => {
    const el = mount(new UIPaginationElement()) as UIPaginationElement
    el.pages = 5
    el.page = 1
    await el.updateComplete
    expect(el.querySelectorAll('[data-part="page"]').length).toBeGreaterThan(0)

    el.remove()
    el.page = 2
    await el.updateComplete

    document.body.append(el)
    await el.updateComplete
    expect(el.querySelectorAll('[aria-current="page"]')).toHaveLength(1)
    expect(el.querySelector('[aria-current="page"]')?.textContent).toBe('2')
    el.remove()
  })
})
