import { describe, it, expect, beforeEach, afterEach } from 'vitest'

// s4 — the ui-column cross-engine smoke (the browser-truth harness; runs in BOTH Chromium and WebKit via
// vitest.browser.config.ts → playwright instances). jsdom computes no layout, so the REAL proofs live here:
// the flex mapping resolves to computed CSS, the gap responds to [density], and the column REFLOWS by its
// CONTAINER width (resize the wrapper, not the viewport) — anti-vacuous (the computed property actually changes).
//
// CSS wiring is SELF-CONTAINED (host-runs-at-boundary): column.css is not in the component-styles barrel until
// s12, so this test injects the foundation tokens, the shared surface/container-type seam, and column.css
// directly, then the self-defining module. Vite resolves the bare specifier + the relative sheets and injects them.
import '@agent-ui/components/foundation-styles.css' // the --c-* roles + the --ui-{space,density,…} ramp
import '../_surface/container.css' // the shared surface seam + `container-type: inline-size` on ui-column
import './column.css' // the column layout sheet (token block + @scope)
import './column.ts' // self-defines ui-column

let host: HTMLElement
beforeEach(() => {
  host = document.createElement('div')
  document.body.append(host)
})
afterEach(() => host.remove())

const column = (attrs: Record<string, string> = {}): HTMLElement => {
  const el = document.createElement('ui-column')
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
  el.innerHTML = '<div class="a">one</div><div class="b">two</div>'
  return el
}

describe('ui-column browser-truth harness (s4)', () => {
  it('mounts and resolves display:flex + flex-direction:column — the tag identity', () => {
    const el = column({ gap: 'md' })
    host.append(el)
    const cs = getComputedStyle(el)
    expect(cs.display).toBe('flex') // the foundation + column CSS resolved through Vite
    expect(cs.flexDirection).toBe('column') // the main axis is the block axis (ADR-0016 cl.2)
  })

  it('align/justify CHANGE the computed flex properties (the literal-union → CSS-keyword repoint)', () => {
    const el = column()
    host.append(el)
    // defaults map to flex-start
    expect(getComputedStyle(el).alignItems).toBe('flex-start')
    expect(getComputedStyle(el).justifyContent).toBe('flex-start')
    // a non-default keyword repoints the computed value (between → space-between)
    el.setAttribute('align', 'center')
    el.setAttribute('justify', 'between')
    expect(getComputedStyle(el).alignItems).toBe('center')
    expect(getComputedStyle(el).justifyContent).toBe('space-between')
  })

  it('gap responds to [density]: the --ui-space ladder re-multiplies on a subtree [density] (anti-vacuous)', () => {
    // a plain wrapper (NOT a query container) so flex-direction stays column and only the density changes.
    const wrap = document.createElement('div')
    host.append(wrap)
    const el = column({ gap: 'md' })
    wrap.append(el)

    const gapPx = (): number => Number.parseFloat(getComputedStyle(el).rowGap)
    const base = gapPx() // --ui-space-md @ density 1 = 12px
    expect(base).toBeGreaterThan(0)

    wrap.setAttribute('density', 'compact') // --ui-density → 0.5
    const compact = gapPx()
    expect(compact).toBeCloseTo(base / 2, 1) // the rhythm halved — gap rides --ui-density (geometry.md)

    wrap.setAttribute('density', 'spacious') // --ui-density → 1.5
    expect(gapPx()).toBeCloseTo(base * 1.5, 1) // and grows — density is the one quantity that moves the gap
  })

  it('REFLOWS by CONTAINER width: a wide query container spreads the column into a row (ADR-0016 cl.4)', () => {
    // the intrinsic-responsiveness proof: resize the WRAPPER (a query container), not the viewport. The column's
    // @container rule flips flex-direction column→row above 30rem — mirroring ui-row's narrow→column, axis flipped.
    const wrap = document.createElement('div')
    wrap.style.containerType = 'inline-size'
    host.append(wrap)
    const el = column({ gap: 'md' })
    wrap.append(el)

    // narrow (20rem < 30rem) — stays a column: the second child sits BELOW the first
    wrap.style.inlineSize = '20rem'
    expect(getComputedStyle(el).flexDirection).toBe('column')
    const a1 = el.querySelector('.a') as HTMLElement
    const b1 = el.querySelector('.b') as HTMLElement
    expect(b1.offsetTop).toBeGreaterThan(a1.offsetTop) // stacked vertically

    // wide (40rem ≥ 30rem) — the @container rule fires: flips to a row, the children sit SIDE BY SIDE
    wrap.style.inlineSize = '40rem'
    expect(getComputedStyle(el).flexDirection).toBe('row') // the computed property ACTUALLY changed (anti-vacuous)
    expect(b1.offsetLeft).toBeGreaterThan(a1.offsetLeft) // now laid out horizontally
    expect(b1.offsetTop).toBe(a1.offsetTop) // on the same row
  })
})
