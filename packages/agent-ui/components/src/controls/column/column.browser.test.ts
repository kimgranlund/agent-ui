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
    // ADR-0030: the default align is now `stretch` (not `start`) — children fill the column width.
    expect(getComputedStyle(el).alignItems).toBe('stretch')
    // ADR-0039: justify default is `start` (box-alignment); computed returns 'start', not 'flex-start'
    // — writing-mode-relative and flex-flow-relative are equivalent in LTR/standard orientation (rendered identically)
    expect(getComputedStyle(el).justifyContent).toBe('start')
    // a non-default keyword repoints the computed value (between → space-between)
    el.setAttribute('align', 'center')
    el.setAttribute('justify', 'between')
    expect(getComputedStyle(el).alignItems).toBe('center')
    expect(getComputedStyle(el).justifyContent).toBe('space-between')
    // align='start' repoints to box-alignment `start` (ADR-0039); computed returns 'start', not 'flex-start'
    el.setAttribute('align', 'start')
    expect(getComputedStyle(el).alignItems).toBe('start')
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

  it('ADR-0030 fill-width: a width-LESS child FILLS the column width by default; align="start" shrink-wraps', () => {
    // The visual DoD for ADR-0030. A card with no explicit width (only content: "X") should fill the column
    // because align-items:stretch (the new default) sizes children on their cross axis to the container.
    // NEGATIVE: align='start' → box-alignment start (ADR-0039) — the child shrink-wraps to its content width.
    // Rendered result is UNCHANGED from flex-start in standard LTR orientation (writing-mode-relative ≡ flex-flow-relative here).
    const wrap = document.createElement('div')
    wrap.style.inlineSize = '300px' // a fixed-width column so we can measure children against it
    wrap.style.display = 'block'
    host.append(wrap)

    const col = column() // no align attr → default (stretch, ADR-0030)
    const child = document.createElement('div')
    child.textContent = 'X' // minimal content — intrinsic width much less than 300px
    col.innerHTML = '' // clear the default children from column()
    col.append(child)
    wrap.append(col)
    col.style.inlineSize = '100%' // span the wrapper

    // default → stretch: the child width should equal the column width
    const colW = col.getBoundingClientRect().width
    const childW = child.getBoundingClientRect().width
    expect(childW).toBeCloseTo(colW, 1) // child fills the column (anti-vacuous: colW > 0)
    expect(colW).toBeGreaterThan(100) // the column actually has width

    // NEGATIVE control: align='start' → child shrink-wraps to intrinsic width
    col.setAttribute('align', 'start')
    const childWShrunk = child.getBoundingClientRect().width
    expect(childWShrunk).toBeLessThan(colW) // shrink-wrapped: narrower than the column
  })

  it('ADR-0039 no-op proof — AC1: align=start/end and justify=end render at the expected edge in all reachable states', () => {
    // In a flex column (main axis = block, cross axis = inline/LTR), box-alignment `start`/`end` are
    // equivalent to `flex-start`/`flex-end` in every reachable state — there is no wrap-reverse or
    // direction-reversal (see AC2). Use a plain wrapper (no containerType ancestor) so flex-direction
    // stays column — the @container row-flip requires an ancestor query container (ADR-0016 cl.4).
    const wrap = document.createElement('div')
    wrap.style.display = 'block'
    host.append(wrap)

    // ── Cross-axis (align-items): inline / LTR ──
    // One child explicitly constrained to 60px wide inside a 200px column → alignment is observable.
    const colA = document.createElement('ui-column')
    colA.setAttribute('align', 'start')
    colA.style.inlineSize = '200px'
    const childA = document.createElement('div')
    childA.style.inlineSize = '60px'
    colA.append(childA)
    wrap.append(colA)

    const colALeft = colA.getBoundingClientRect().left
    const startLeft = childA.getBoundingClientRect().left - colALeft
    expect(startLeft, 'align=start: child not at the inline-start edge (0)').toBeCloseTo(0, 1)

    colA.setAttribute('align', 'end')
    const endLeft = childA.getBoundingClientRect().left - colALeft
    const colAW = colA.getBoundingClientRect().width
    const childAW = childA.getBoundingClientRect().width
    expect(endLeft, 'align=end: child not at the inline-end edge (colW − childW)').toBeCloseTo(colAW - childAW, 1)
    // anti-vacuous: start < end (both are real, distinct positions in the 200px column)
    expect(startLeft, 'start and end positions are equal (cross-axis alignment has no effect)').toBeLessThan(endLeft)

    // ── Main-axis (justify-content): block ──
    // Column 200px tall with a single 40px child → justify=end positions it at the bottom.
    const colJ = document.createElement('ui-column')
    colJ.style.blockSize = '200px'
    colJ.style.inlineSize = '200px'
    const childJ = document.createElement('div')
    childJ.style.blockSize = '40px'
    colJ.append(childJ)
    wrap.append(colJ)

    const colJTop = colJ.getBoundingClientRect().top
    const topStart = childJ.getBoundingClientRect().top - colJTop
    expect(topStart, 'justify default (start): child not at the block-start edge (0)').toBeCloseTo(0, 1)

    colJ.setAttribute('justify', 'end')
    const topEnd = childJ.getBoundingClientRect().top - colJTop
    const colJH = colJ.getBoundingClientRect().height
    const childJH = childJ.getBoundingClientRect().height
    expect(topEnd, 'justify=end: child not at the block-end edge (colH − childH)').toBeCloseTo(colJH - childJH, 1)
    // anti-vacuous: start < end (real distinct positions in the 200px block)
    expect(topStart, 'start and end positions are equal (justify has no effect)').toBeLessThan(topEnd)
  })

  it('ADR-0039 no-op proof — AC2: wrap is only nowrap|wrap; wrap-reverse is unreachable (start/end ≡ flex-start/flex-end in every reachable state)', () => {
    // The `wrap` attribute maps to `flex-wrap: wrap` (boolean presence, column.css:35/91) only.
    // `flex-direction` is the tag identity, not a prop (ADR-0016 cl.2) — no direction-reversal is
    // exposed. Since wrap-reverse and direction-reversal are both unreachable, `start`/`end` and
    // `flex-start`/`flex-end` are equivalent in every reachable state — the ADR-0039 normalization
    // is a provable render no-op across the full reachable state space.
    const el = column()
    host.append(el)
    expect(getComputedStyle(el).flexWrap, 'default: flex-wrap is not nowrap').toBe('nowrap')
    expect(getComputedStyle(el).flexWrap, 'default: wrap-reverse is reachable (it should not be)').not.toBe('wrap-reverse')
    el.setAttribute('wrap', '')
    expect(getComputedStyle(el).flexWrap, '[wrap]: flex-wrap is not wrap').toBe('wrap')
    expect(getComputedStyle(el).flexWrap, '[wrap]: wrap-reverse is reachable (it should not be)').not.toBe('wrap-reverse')
    // anti-vacuous: the two reachable states are distinct (so neither check is vacuously true)
    el.removeAttribute('wrap')
    expect(getComputedStyle(el).flexWrap, 'removing [wrap] should restore nowrap').not.toBe('wrap')
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
