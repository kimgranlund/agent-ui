import { describe, it, expect } from 'vitest'

// n1f — ui-split cross-engine browser smoke (Chromium + WebKit; the geometry/drag TRUTH jsdom cannot
// compute — LLD-C7). Drive mechanism: the SPEC-R3 INSTRUMENT-BRIDGE — synthetic `dispatchEvent(new
// PointerEvent(...))` with `setPointerCapture` STUBBED to a no-op (the `slider.browser.test.ts` `stubCapture`
// precedent — a synthetic PointerEvent is not an active pointer; real capture throws NotFoundError). NOT
// real pointer capture anywhere in this file (the retired "real pointer capture" phrasing, SPEC-R3).

import '@agent-ui/components/foundation-styles.css' // tokens (--md-sys-color-*) + dimensions (--ui-focus-ring-*)
import './split.css'
import './split-pane.css'
import './split.ts'
import './split-pane.ts'
import type { UISplitElement } from './split.ts'
import type { UISplitPaneElement } from './split-pane.ts'

// ── helpers ──────────────────────────────────────────────────────────────────────────────────────────

function stubCapture(el: HTMLElement): void {
  el.setPointerCapture = (_id: number): void => {}
}

const ptr = (type: string, coord: number, axis: 'horizontal' | 'vertical' = 'horizontal', id = 1): PointerEvent =>
  new PointerEvent(type, {
    ...(axis === 'horizontal' ? { clientX: coord } : { clientY: coord }),
    pointerId: id,
    bubbles: true,
    cancelable: true,
  })

/** Mount a fixed-position, fixed-width/height ui-split with N panes for deterministic rect math (the
 *  slider.browser.test.ts `position:fixed` precedent). */
function mount(paneCount: number, opts: { axis?: 'horizontal' | 'vertical'; dir?: 'rtl'; size?: number } = {}): { el: UISplitElement; panes: UISplitPaneElement[] } {
  const el = document.createElement('ui-split') as UISplitElement
  const size = opts.size ?? 300
  el.style.position = 'fixed'
  el.style.left = '0px'
  el.style.top = '0px'
  if (opts.axis === 'vertical') {
    el.style.width = '200px'
    el.style.height = `${size}px`
    el.axis = 'vertical'
  } else {
    el.style.width = `${size}px`
    el.style.height = '200px'
  }
  if (opts.dir) el.setAttribute('dir', opts.dir)
  const panes: UISplitPaneElement[] = []
  for (let i = 0; i < paneCount; i++) {
    const pane = document.createElement('ui-split-pane') as UISplitPaneElement
    el.append(pane)
    panes.push(pane)
  }
  document.body.append(el)
  return { el, panes }
}

// ── AC1: whole-shape — N panes + N-1 separators, non-zero boxes, tile the container (±1px) ─────────

describe('ui-split browser smoke (AC1 — whole-shape, SPEC-R1 AC1)', () => {
  it('3 panes + 2 separators render with non-zero boxes and tile the horizontal container', () => {
    const { el, panes } = mount(3)
    const seps = el.querySelectorAll('[data-separator]')
    expect(panes).toHaveLength(3)
    expect(seps).toHaveLength(2)

    const hostRect = el.getBoundingClientRect()
    let occupied = 0
    for (const pane of panes) {
      const r = pane.getBoundingClientRect()
      expect(r.width, 'each pane must have non-zero width').toBeGreaterThan(0)
      expect(r.height).toBeGreaterThan(0)
      occupied += r.width
    }
    for (const sep of seps) {
      const r = (sep as HTMLElement).getBoundingClientRect()
      expect(r.width, 'each separator must have non-zero width').toBeGreaterThan(0)
      occupied += r.width
    }
    expect(occupied).toBeCloseTo(hostRect.width, 0) // ±1px — the whole shape tiles the container

    el.remove()
  })

  it('vertical axis: panes stack top-to-bottom, separators are horizontal dividers', () => {
    const { el, panes } = mount(2, { axis: 'vertical' })
    const sep = el.querySelector('[data-separator]') as HTMLElement
    expect(sep.getAttribute('aria-orientation')).toBe('vertical')
    const p0 = panes[0].getBoundingClientRect()
    const p1 = panes[1].getBoundingClientRect()
    expect(p1.top).toBeGreaterThanOrEqual(p0.bottom - 1) // p1 sits BELOW p0
    el.remove()
  })

  it('anti-vacuous: 2 panes render narrower than 1 pane sharing the same host width (real proportional layout)', () => {
    const { el: el1, panes: p1 } = mount(1, { size: 300 })
    const w1 = p1[0].getBoundingClientRect().width
    el1.remove()

    const { el: el2, panes: p2 } = mount(2, { size: 300 })
    const w2 = p2[0].getBoundingClientRect().width
    el2.remove()

    expect(w2).toBeLessThan(w1) // the negative control: a real flex-grow proportional split, not a fixed box
  })
})

// ── AC2/AC3: synthetic drag — resizes adjacent panes, input per move, one change on release ─────────

describe('ui-split browser smoke (AC2/AC3 — synthetic drag, SPEC-R3 AC1)', () => {
  it('pointerdown→move resizes the two adjacent panes; input fires per move, one change on release', async () => {
    const { el, panes } = mount(2, { size: 200 })
    const sep = el.querySelector('[data-separator]') as HTMLElement
    stubCapture(sep)

    const before0 = panes[0].getBoundingClientRect().width
    let inputCount = 0
    let changeCount = 0
    el.addEventListener('input', () => { inputCount++ })
    el.addEventListener('change', () => { changeCount++ })

    sep.dispatchEvent(ptr('pointerdown', 0))
    sep.dispatchEvent(ptr('pointermove', 40)) // +40px of a 200px track = +20%
    expect(inputCount).toBe(1)
    await el.updateComplete // the geometry write (--_pane-flex) rides the reactive effect, microtask-deferred
    const mid0 = panes[0].getBoundingClientRect().width
    expect(mid0).toBeGreaterThan(before0) // pane 0 grew

    sep.dispatchEvent(ptr('pointermove', 60))
    expect(inputCount).toBe(2)

    expect(changeCount).toBe(0) // no change until release
    sep.dispatchEvent(ptr('pointerup', 60))
    expect(changeCount).toBe(1) // exactly one change on release

    el.remove()
  })

  it('non-adjacent panes are untouched by a 3-pane drag on separator 0', async () => {
    const { el, panes } = mount(3, { size: 300 })
    const sep0 = el.querySelectorAll('[data-separator]')[0] as HTMLElement
    stubCapture(sep0)
    const before2 = panes[2].getBoundingClientRect().width

    sep0.dispatchEvent(ptr('pointerdown', 0))
    sep0.dispatchEvent(ptr('pointermove', 30))
    sep0.dispatchEvent(ptr('pointerup', 30))
    await el.updateComplete

    const after2 = panes[2].getBoundingClientRect().width
    expect(after2).toBeCloseTo(before2, 0) // pane 2 (non-adjacent to separator 0) is untouched

    el.remove()
  })
})

// ── capture-continuity: STRUCTURAL (SPEC-R3 AC2) ──────────────────────────────────────────────────

describe('ui-split browser smoke (capture-continuity, SPEC-R3 AC2)', () => {
  it('a pointermove dispatched AFTER pointerleave, before pointerup, STILL resizes', async () => {
    const { el, panes } = mount(2, { size: 200 })
    const sep = el.querySelector('[data-separator]') as HTMLElement
    stubCapture(sep)
    const before0 = panes[0].getBoundingClientRect().width

    sep.dispatchEvent(ptr('pointerdown', 0))
    sep.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true })) // must be a complete no-op
    sep.dispatchEvent(ptr('pointermove', 50)) // the assertion that bites if leave ended the drag
    sep.dispatchEvent(ptr('pointerup', 50))
    await el.updateComplete

    const after0 = panes[0].getBoundingClientRect().width
    expect(after0).toBeGreaterThan(before0) // the resize applied despite the intervening pointerleave

    el.remove()
  })
})

// ── RTL drag inversion (SPEC-R3 AC3) ──────────────────────────────────────────────────────────────

describe('ui-split browser smoke (RTL drag inversion, SPEC-R3 AC3)', () => {
  it('the SAME physical drag direction inverts pane-0 growth under dir=rtl vs ltr', async () => {
    const { el: ltrEl, panes: ltrPanes } = mount(2, { size: 200 })
    const ltrSep = ltrEl.querySelector('[data-separator]') as HTMLElement
    stubCapture(ltrSep)
    const ltrBefore = ltrPanes[0].getBoundingClientRect().width
    ltrSep.dispatchEvent(ptr('pointerdown', 0))
    ltrSep.dispatchEvent(ptr('pointermove', 40))
    ltrSep.dispatchEvent(ptr('pointerup', 40))
    await ltrEl.updateComplete
    const ltrGrew = ltrPanes[0].getBoundingClientRect().width > ltrBefore
    ltrEl.remove()

    const { el: rtlEl, panes: rtlPanes } = mount(2, { size: 200, dir: 'rtl' })
    const rtlSep = rtlEl.querySelector('[data-separator]') as HTMLElement
    stubCapture(rtlSep)
    const rtlBefore = rtlPanes[0].getBoundingClientRect().width
    rtlSep.dispatchEvent(ptr('pointerdown', 0))
    rtlSep.dispatchEvent(ptr('pointermove', 40))
    rtlSep.dispatchEvent(ptr('pointerup', 40))
    await rtlEl.updateComplete
    const rtlGrew = rtlPanes[0].getBoundingClientRect().width > rtlBefore
    rtlEl.remove()

    expect(rtlGrew).toBe(!ltrGrew) // inverted sense — the assertion that bites under an LTR-only mapping
  })
})

// ── clamp at min (SPEC-R2 AC2, biting NC) ─────────────────────────────────────────────────────────

describe('ui-split browser smoke (clamp at min, SPEC-R2 AC2)', () => {
  it('a pane with a real CSS min never shrinks below it, even under a hard drag', async () => {
    const { el, panes } = mount(2, { size: 200 })
    panes[1].min = '150px' // the trailing pane floors at 150px of a 200px track
    await el.updateComplete // let the --_pane-min geometry seam apply BEFORE dragging
    const sep = el.querySelector('[data-separator]') as HTMLElement
    stubCapture(sep)

    sep.dispatchEvent(ptr('pointerdown', 0))
    sep.dispatchEvent(ptr('pointermove', 190)) // drag hard toward the far edge — pane 1 would go to ~5px unclamped
    sep.dispatchEvent(ptr('pointerup', 190))
    await el.updateComplete

    const w1 = panes[1].getBoundingClientRect().width
    expect(w1).toBeGreaterThanOrEqual(148) // clamped at ~150px (±rounding) — the assertion that bites if the clamp is dropped

    el.remove()
  })
})

// ── touch-target ≥ 24px (SPEC-R5 AC1, biting NC) ──────────────────────────────────────────────────

describe('ui-split browser smoke (touch-target ≥ 24px, SPEC-R5 AC1)', () => {
  it('the separator hit-slop resolves to ≥24px even though the visible divider is 1px', () => {
    const { el } = mount(2)
    const sep = el.querySelector('[data-separator]') as HTMLElement
    const visible = Number.parseFloat(getComputedStyle(sep).width)
    expect(visible).toBeLessThanOrEqual(4) // the visible divider is thin (--ui-split-divider: 1px)

    const slop = getComputedStyle(sep, '::before')
    const slopWidth = Number.parseFloat(slop.width)
    expect(slopWidth, 'the hit-slop must resolve to >= 24px').toBeGreaterThanOrEqual(24)

    el.remove()
  })
})

// ── forced-colors annotation (SPEC-R5 AC2) ────────────────────────────────────────────────────────
// NOTE: headless Playwright does not emulate forced-colors:active by default (the slider.browser.test.ts
// precedent) — this proves the element renders without error under the CSS that declares the mapping.

describe('ui-split browser smoke (forced-colors annotation, SPEC-R5 AC2)', () => {
  it('element connects and the separator computes a non-zero box (forced-colors declared in split.css)', () => {
    const { el } = mount(2)
    const sep = el.querySelector('[data-separator]') as HTMLElement
    const cs = getComputedStyle(sep)
    expect(Number.parseFloat(cs.height)).toBeGreaterThan(0)
    el.remove()
  })
})

// ── keyboard Arrow/Home/End (SPEC-R4) ─────────────────────────────────────────────────────────────

describe('ui-split browser smoke (keyboard resize, SPEC-R4)', () => {
  it('ArrowRight grows the leading pane; aria-valuenow updates', async () => {
    const { el, panes } = mount(2, { size: 200 })
    const sep = el.querySelector('[data-separator]') as HTMLElement
    const before = panes[0].getBoundingClientRect().width
    const beforeNow = Number(sep.getAttribute('aria-valuenow'))

    sep.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }))
    await el.updateComplete

    const after = panes[0].getBoundingClientRect().width
    expect(after).toBeGreaterThan(before)
    expect(Number(sep.getAttribute('aria-valuenow'))).toBeGreaterThan(beforeNow)
    el.remove()
  })

  it('Home/End snap the leading pane to the pair bounds', async () => {
    const { el, panes } = mount(2, { size: 200 })
    const sep = el.querySelector('[data-separator]') as HTMLElement
    const before = panes[0].getBoundingClientRect().width // ~99.5px (2 equal panes of a 200px track)

    // End drives pane 0 to its MAXIMUM within the pair — clamped by pane 1's own min floor (the default
    // --ui-split-pane-min: 4rem = 64px, since neither pane sets an explicit `min` here), NOT the track's
    // full extent: max ≈ 200 − divider(1px) − pane1's 64px floor ≈ 135px.
    sep.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }))
    await el.updateComplete
    const afterEnd = panes[0].getBoundingClientRect().width
    expect(afterEnd).toBeGreaterThan(before) // grew from the equal split
    expect(afterEnd).toBeLessThan(150) // clamped well short of the track's full 200px (pane 1's floor bites)

    // Home drives pane 0 back to its own MINIMUM within the pair (the same default floor, on pane 0 itself).
    sep.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }))
    await el.updateComplete
    const afterHome = panes[0].getBoundingClientRect().width
    expect(afterHome).toBeLessThan(afterEnd)
    expect(afterHome).toBeLessThan(before) // shrank below the equal split too

    el.remove()
  })
})
