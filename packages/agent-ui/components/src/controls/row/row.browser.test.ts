import { describe, it, expect } from 'vitest'

// s3 — ui-row cross-engine browser smoke (the geometry/responsiveness TRUTH jsdom cannot compute). Runs in
// BOTH Chromium and WebKit (vitest.browser.config.ts → playwright instances). It proves the three behaviours
// the static probes can only pin as CSS text: (1) align/justify CHANGE the computed flex props; (2) the gap
// responds to [density]; (3) the row REFLOWS by CONTAINER width — resized on the WRAPPER, not the viewport
// (the ADR-0016 cl.4 intrinsic-responsiveness proof) — and the reflow actually moves the children (anti-vacuous).
//
// CSS wiring: the component-styles barrel does not @import container.css / row.css until the integration slice
// (decomp s12), so this smoke injects them DIRECTLY (Vite resolves the relative .css + the foundation export,
// and injects each as a <style>). Order is load-bearing: the foundation (--md-sys-color-* roles + the --ui-space ladder +
// [density]) FIRST, then the shared surface seam (container-type: inline-size), then row.css, then the
// self-defining element module.
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

  it('gap → the --ui-space ladder responds to an ancestor [density] (the one density-bearing quantity)', () => {
    const { wrapper, row } = mount('600px')
    row.setAttribute('gap', 'md') // → var(--ui-space-md) = calc(12px * var(--ui-density))
    const base = Number.parseFloat(getComputedStyle(row).columnGap)
    expect(base).toBe(12) // density 1 → 12px (the ramp truly resolved — not a fallback)

    wrapper.setAttribute('density', 'spacious') // [density="spacious"] → --ui-density: 1.5 (inherits to the row)
    const spacious = Number.parseFloat(getComputedStyle(row).columnGap)
    expect(spacious).toBe(18) // 12 × 1.5 — density re-multiplied the gutter
    expect(spacious).toBeGreaterThan(base) // anti-vacuous: the gap actually grew

    wrapper.remove()
  })
})

describe('ui-row cross-engine smoke — container-query reflow (ADR-0016 cl.4) (s3)', () => {
  it('the row reflows to a COLUMN under a narrow CONTAINER width — resize the wrapper, not the viewport', () => {
    // 24rem threshold (= 384px @ 16px root): 600px ≥ → row, 300px < → column. Resizing only the WRAPPER proves
    // the responsiveness is container-driven (intrinsic), with no viewport/breakpoint prop in play.
    const { wrapper, row } = mount('600px')
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
})
