import { describe, it, expect } from 'vitest'
import { resolve } from '../../../../shared/src/tokens/scale.mjs'

// s3 — ui-row cross-engine browser smoke (the geometry/responsiveness TRUTH jsdom cannot compute). Runs in
// BOTH Chromium and WebKit (vitest.browser.config.ts → playwright instances). It proves the three behaviours
// the static probes can only pin as CSS text: (1) align/justify CHANGE the computed flex props; (2) the gap
// responds to [density]; (3) the row REFLOWS by CONTAINER width — resized on the WRAPPER, not the viewport
// (the ADR-0016 cl.4 intrinsic-responsiveness proof) — and the reflow actually moves the children (anti-vacuous).
//
// CSS wiring: the retired component-styles CSS barrel (ADR-0233) does not @import container.css / row.css until the integration slice
// (decomp s12), so this smoke injects them DIRECTLY (Vite resolves the relative .css + the foundation export,
// and injects each as a <style>). Order is load-bearing: the foundation (--md-sys-color-* roles + the --md-sys-space ladder +
// [density]) FIRST, then the shared surface seam (elevation/brightness — NOT a container-type establishment,
// ADR-0100: the row is never a query container itself), then row.css, then the self-defining element module.
// The query container each `@container` rule resolves against is the test's OWN wrapper (below), not row/
// container.css — the ADR-0100 boundary law realized in miniature.
import '@agent-ui/components/foundation-styles.css'
import '../_surface/container.css'
import './row.css'
import './row.ts'

/** A query-container wrapper at a fixed width — the row reflows on THIS (its nearest ancestor container), the
 *  "resize the wrapper, not the viewport" proof. Returns the wrapper + the mounted ui-row + its two children. */
const mount = (width: string): { wrapper: HTMLElement; row: HTMLElement } => {
  const wrapper = document.createElement('div')
  wrapper.style.containerType = 'inline-size' // establish the query container the ui-row resolves @container against
  wrapper.style.width = width
  const row = document.createElement('ui-row')
  row.innerHTML = '<div>a</div><div>b</div>' // the flex items
  wrapper.append(row)
  document.body.append(wrapper)
  return { wrapper, row }
}

describe('ui-row cross-engine smoke — flex grammar maps to computed props (s3)', () => {
  it('align → align-items and justify → justify-content CHANGE the computed flex props', () => {
    const { wrapper, row } = mount('600px') // wide → stays a row
    const before = getComputedStyle(row).alignItems

    row.setAttribute('align', 'center')
    expect(getComputedStyle(row).alignItems).toBe('center')
    expect(getComputedStyle(row).alignItems).not.toBe(before === 'center' ? 'start' : before) // anti-vacuous: it moved

    row.setAttribute('align', 'stretch')
    expect(getComputedStyle(row).alignItems).toBe('stretch')

    row.setAttribute('justify', 'between')
    expect(getComputedStyle(row).justifyContent).toBe('space-between') // between → space-between (the one keyword crossing)

    row.setAttribute('justify', 'center')
    expect(getComputedStyle(row).justifyContent).toBe('center')

    wrapper.remove()
  })

  it('gap → the --md-sys-space alias moves with an ancestor data-scale (one n, ADR-0245 cl.6)', () => {
    const { wrapper, row } = mount('600px')
    row.setAttribute('gap', 'md') // → var(--md-sys-space-md) = the group margin n + c
    const base = Number.parseFloat(getComputedStyle(row).columnGap)
    expect(base).toBe(resolve('product', 'sm', 'md').group.margin) // the root register: 9

    wrapper.setAttribute('data-scale', 'md') // the roomier register (inherits to the row)
    const roomy = Number.parseFloat(getComputedStyle(row).columnGap)
    expect(roomy).toBe(resolve('product', 'md', 'md').group.margin) // 12
    expect(roomy).toBeGreaterThan(base) // anti-vacuous: the gap actually grew

    wrapper.remove()
  })
})

describe('ui-row: the align attribute never leaks a text-align (T-0143)', () => {
  // Chromium maps a bare `align` attribute to a presentational `text-align` (the legacy HTML hint), which every
  // child then inherits, so a row's stacked title and meta centred and zig-zagged down a list. ui-row's `align` is
  // its cross-axis flex grammar only; the row resets the hint to the inherited value.
  for (const align of ['center', 'end', 'start', 'stretch', 'baseline']) {
    it(`a child of ui-row[align=${align}] keeps the inherited text-align`, () => {
      const wrapper = document.createElement('div')
      wrapper.style.textAlign = 'start'
      wrapper.innerHTML = `<ui-row align="${align}"><div><span>title</span></div></ui-row>`
      document.body.append(wrapper)
      const row = wrapper.querySelector('ui-row') as HTMLElement
      expect(getComputedStyle(row).textAlign, 'the row itself').toBe('start')
      expect(getComputedStyle(row.querySelector('div') as HTMLElement).textAlign, 'its child').toBe('start')
      wrapper.remove()
    })
  }
})

describe('ui-row cross-engine smoke — container-query reflow (ADR-0016 cl.4, gated by reflow — ADR-0096) (s3)', () => {
  it('the DEFAULT row (reflow="auto") reflows to a COLUMN under a narrow CONTAINER width — resize the wrapper, not the viewport', () => {
    // 24rem threshold (= 384px @ 16px root): 600px ≥ → row, 300px < → column. Resizing only the WRAPPER proves
    // the responsiveness is container-driven (intrinsic), with no viewport/breakpoint prop in play. reflow
    // defaults to 'auto' (row.ts) so this is the UNCHANGED preserved behavior (ADR-0096 cl.2).
    const { wrapper, row } = mount('600px')
    expect(row.getAttribute('reflow')).toBeNull() // default not reflected as an attribute (ADR-0005)
    expect(getComputedStyle(row).flexDirection).toBe('row') // wide container → row identity holds
    const wideSecondTop = (row.children[1] as HTMLElement).getBoundingClientRect().top

    wrapper.style.width = '300px' // narrow the CONTAINER (not the viewport)
    expect(getComputedStyle(row).flexDirection).toBe('column') // @container reflow flipped the axis
    const narrowSecondTop = (row.children[1] as HTMLElement).getBoundingClientRect().top

    // anti-vacuous: the px LAYOUT actually changed — the second child dropped BELOW the first (stacked), not
    // beside it. A vacuous (computed-only) pass would miss a reflow that did not relayout the children.
    expect(narrowSecondTop).toBeGreaterThan(wideSecondTop)

    wrapper.remove()
  })

  it('reflow="locked" PINS the row horizontal even under a narrow container (ADR-0096 cl.2/3 — the residual-risk leg)', () => {
    const { wrapper, row } = mount('300px') // narrow — below the 24rem threshold
    row.setAttribute('reflow', 'locked')
    expect(getComputedStyle(row).flexDirection).toBe('row') // pinned — the @container rule no longer matches
    const a = row.children[0] as HTMLElement
    const b = row.children[1] as HTMLElement
    expect(b.getBoundingClientRect().top).toBe(a.getBoundingClientRect().top) // same row, not stacked
    expect(b.getBoundingClientRect().left).toBeGreaterThan(a.getBoundingClientRect().left) // side by side

    wrapper.remove()
  })
})
