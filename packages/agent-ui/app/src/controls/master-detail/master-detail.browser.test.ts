import { describe, it, expect, afterEach } from 'vitest'

// n2a — the CROSS-ENGINE ui-master-detail smoke (LLD-C10, SPEC-R7). jsdom cannot resolve CSS Grid/flex
// layout or `@container` — this file is where the wide side-by-side / narrow drill-in geometry becomes
// TRUE, in BOTH Chromium and WebKit (the app-shell.browser.test.ts precedent). CSS wiring: the foundation
// first, then `component-styles.css` (the family barrel — @agent-ui/components has NO standalone per-control
// CSS export, only the aggregate barrel; this is what actually carries ui-split/ui-split-pane's shipped CSS
// to a consumer OUTSIDE the components package, the site `_page.ts` precedent), then this element's own CSS.
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
import './master-detail-pane.css'
import './master-detail.css'
import './master-detail.ts'
import './master-detail-pane.ts'
import type { UIMasterDetailElement } from './master-detail.ts'

const mounted: HTMLElement[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

/** A resizable WRAPPER establishing its OWN query container — master-detail reflows against the wrapper
 *  (its nearest ancestor container), never against itself or the viewport (the row.browser.test.ts /
 *  app-shell.browser.test.ts "resize the wrapper" precedent). */
function mountMasterDetail(width = '900px'): { wrapper: HTMLElement; el: HTMLElement } {
  const wrapper = document.createElement('div')
  wrapper.style.containerType = 'inline-size'
  wrapper.style.width = width
  wrapper.style.height = '400px'
  const el = document.createElement('ui-master-detail')
  const list = document.createElement('ui-master-detail-pane')
  list.setAttribute('pane', 'list')
  list.textContent = 'The list'
  const detail = document.createElement('ui-master-detail-pane')
  detail.setAttribute('pane', 'detail')
  detail.textContent = 'The detail'
  el.append(list, detail)
  wrapper.append(el)
  document.body.append(wrapper)
  mounted.push(wrapper)
  return { wrapper, el }
}

describe('ui-master-detail cross-engine smoke — wide (SPEC-R7 AC1)', () => {
  it('list and detail show SIDE BY SIDE via the composed ui-split — two non-zero, non-overlapping boxes', () => {
    const { wrapper, el } = mountMasterDetail('900px')
    const list = el.querySelector('[data-role="list"]') as HTMLElement
    const detail = el.querySelector('[data-role="detail"]') as HTMLElement
    expect(getComputedStyle(list).display).not.toBe('none')
    expect(getComputedStyle(detail).display).not.toBe('none')
    const listRect = list.getBoundingClientRect()
    const detailRect = detail.getBoundingClientRect()
    expect(listRect.width).toBeGreaterThan(0)
    expect(detailRect.width).toBeGreaterThan(0)
    expect(listRect.right).toBeLessThanOrEqual(detailRect.left + 0.5) // side by side, list first
    // anti-vacuous: a real separator exists between them (inherited from ui-split, 0 bespoke split code)
    expect(el.querySelector('[data-separator]')).not.toBeNull()
    wrapper.remove()
  })

  it('the "back" affordance is invisible wide, regardless of view', () => {
    const { wrapper, el } = mountMasterDetail('900px')
    ;(el as UIMasterDetailElement).selected = 'x'
    const back = el.querySelector('[data-part="back"]') as HTMLElement
    expect(getComputedStyle(back).display).toBe('none')
    wrapper.remove()
  })
})

describe('ui-master-detail cross-engine smoke — narrow drill-in (SPEC-R7 AC1)', () => {
  it('no selection narrow ⇒ only the list shows; the separator hides; the visible pane fills the width', () => {
    const { wrapper, el } = mountMasterDetail('900px')
    wrapper.style.width = '300px' // narrow the CONTAINER (< 40rem), not the viewport
    const list = el.querySelector('[data-role="list"]') as HTMLElement
    const detail = el.querySelector('[data-role="detail"]') as HTMLElement
    expect(getComputedStyle(list).display).not.toBe('none')
    expect(getComputedStyle(detail).display).toBe('none')
    expect(getComputedStyle(el.querySelector('[data-separator]') as HTMLElement).display).toBe('none')
    const listRect = list.getBoundingClientRect()
    const elRect = el.getBoundingClientRect()
    expect(listRect.width).toBeCloseTo(elRect.width, 0) // fills the full (narrow) width
    wrapper.remove()
  })

  it('a selection narrow ⇒ drills into detail: list hides, detail (+ back) show, fills the width', async () => {
    const { wrapper, el } = mountMasterDetail('900px')
    wrapper.style.width = '300px'
    ;(el as UIMasterDetailElement).selected = 'item-7'
    await (el as UIMasterDetailElement).updateComplete
    const list = el.querySelector('[data-role="list"]') as HTMLElement
    const detail = el.querySelector('[data-role="detail"]') as HTMLElement
    const back = el.querySelector('[data-part="back"]') as HTMLElement
    expect(getComputedStyle(list).display).toBe('none')
    expect(getComputedStyle(detail).display).not.toBe('none')
    expect(getComputedStyle(back).display).not.toBe('none')
    const detailRect = detail.getBoundingClientRect()
    const elRect = el.getBoundingClientRect()
    expect(detailRect.width).toBeCloseTo(elRect.width, 0)
    wrapper.remove()
  })

  it('clicking back narrow returns to the list view WITHOUT clearing the selection — real click, real layout', async () => {
    const { wrapper, el } = mountMasterDetail('900px')
    wrapper.style.width = '300px'
    const md = el as UIMasterDetailElement
    md.selected = 'item-4'
    await md.updateComplete
    const back = el.querySelector('[data-part="back"]') as HTMLButtonElement
    back.click()
    await md.updateComplete // the #view signal write's effect re-run is microtask-batched

    const list = el.querySelector('[data-role="list"]') as HTMLElement
    const detail = el.querySelector('[data-role="detail"]') as HTMLElement
    expect(getComputedStyle(list).display, 'back did not return to the list view').not.toBe('none')
    expect(getComputedStyle(detail).display).toBe('none')
    expect(md.selected).toBe('item-4') // untouched
    wrapper.remove()
  })

  it('a WIDE container never drills in (negative control) — both panes stay visible at the same width repeatedly checked', () => {
    const { wrapper, el } = mountMasterDetail('900px')
    const list = el.querySelector('[data-role="list"]') as HTMLElement
    expect(getComputedStyle(list).display).not.toBe('none')
    wrapper.style.width = '900px' // no-op resize — still wide
    expect(getComputedStyle(list).display).not.toBe('none') // the assertion above must NOT vacuously always pass
    const detail = el.querySelector('[data-role="detail"]') as HTMLElement
    expect(getComputedStyle(detail).display).not.toBe('none')
    wrapper.remove()
  })
})

describe('ui-master-detail relocation reconnect, cross-engine (component-reviewer MAJOR follow-up)', () => {
  // The reconnect contract: `connected()` fires on EVERY connect, and `#compose` must be a no-op after the
  // first — recomposing on a reconnect finds `#panes()` empty (the panes already live inside the FIRST
  // composed split) and appends a SECOND, empty ui-split beside the real one (the MEASURED defect this
  // suite exists for, originally reproduced by the reviewer via exactly this re-parent).
  //
  // VEHICLE (ADR-0156 clause 4): this leg used to ride `<ui-app-shell isolated>`'s shadow relocation
  // (ADR-0082) as its relocating host. That capability retires with the deprecated component, so the
  // harness now drives the SAME lifecycle sequence directly: a single `append` onto a new parent is an
  // atomic remove+insert — disconnectedCallback then connectedCallback fire on the moved element with its
  // own children untouched, exactly the sequence `shadow.append(...this.children)` produced. The jsdom
  // twin (master-detail.test.ts) simulates this re-parent; THIS leg keeps it true in real engines' native
  // custom-elements lifecycle, both Chromium and WebKit.
  it('a master-detail RELOCATED to a new parent after its first connect composes EXACTLY ONCE — no duplicate ui-split from the reconnect', () => {
    const md = document.createElement('ui-master-detail')
    const list = document.createElement('ui-master-detail-pane')
    list.setAttribute('pane', 'list')
    list.textContent = 'List'
    const detail = document.createElement('ui-master-detail-pane')
    detail.setAttribute('pane', 'detail')
    detail.textContent = 'Detail'
    md.append(list, detail)

    const host = document.createElement('div')
    document.body.append(md, host) // first connect — `#compose` relocates the panes into the ONE ui-split
    try {
      expect(md.querySelectorAll('ui-split'), 'sanity: the first connect must compose the one split').toHaveLength(1)

      host.append(md) // RELOCATION: implicit remove + insert — disconnected then connected, children untouched

      expect(md.isConnected && md.parentElement === host, 'the master-detail did not relocate at all — harness broken').toBe(true)
      expect(md.querySelectorAll('ui-split'), 'a second, empty ui-split survived the relocation reconnect').toHaveLength(1)
      expect(md.querySelectorAll('[data-part="back"]')).toHaveLength(1)
      expect(md.querySelector('[data-role="list"]')?.textContent).toContain('List')
      expect(md.querySelector('[data-role="detail"]')?.textContent).toContain('Detail')
    } finally {
      host.remove()
      md.remove()
    }
  })
})
