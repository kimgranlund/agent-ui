import { describe, it, expect } from 'vitest'

// n1f — ui-split cross-engine browser smoke (Chromium + WebKit; the geometry/drag TRUTH jsdom cannot
// compute — LLD-C7). Drive mechanism: the SPEC-R3 INSTRUMENT-BRIDGE — synthetic `dispatchEvent(new
// PointerEvent(...))` with `setPointerCapture` STUBBED to a no-op (the `slider.browser.test.ts` `stubCapture`
// precedent — a synthetic PointerEvent is not an active pointer; real capture throws NotFoundError). NOT
// real pointer capture anywhere in this file (the retired "real pointer capture" phrasing, SPEC-R3).

import '@agent-ui/components/foundation-styles.css' // tokens (--md-sys-color-*) + dimensions (--md-sys-state-focus-ring-*)
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

// ── TKT-0015 pt.1: 1:1 pointer tracking — no compounding across sequential live moves ────────────────
//
// Regression pin for the Kim-filed "the split-pane ANIMATES during drag" bug. Root cause (pinned via a
// pure-math repro against constrain.ts's `redistribute`, then fixed in split.ts): `pane-resize.ts`'s
// `deltaRatio` is measured SINCE THE PRESS POINT (an absolute offset from drag start, re-derived fresh on
// every pointermove — NOT an increment since the last move). The pre-fix `#applyPointerDelta` applied that
// press-relative delta against the LIVE, already-mutated ratio vector on every move, double-counting every
// prior move's contribution — e.g. press at x=0 on a 200px track, move to x=40 (correct: ratio 0.5→0.7),
// then move to x=60 (delta since press = 0.3): the BUGGY result was ratio 0.7+0.3=1.0 (a 0.2 overshoot,
// exactly the double-counted move-1 delta) instead of the correct baseline 0.5+0.3=0.8. The fix snapshots
// the ratios ONCE at the drag's first live move (`#dragBaseline`) and applies every subsequent since-press
// delta against THAT fixed baseline — this test would fail against the pre-fix compounding math.

describe('ui-split browser smoke (TKT-0015 pt.1 — 1:1 tracking, no compounding across N moves)', () => {
  it('three sequential pointermoves each resolve against the DRAG-START ratios, not the live/cumulative ones', async () => {
    const { el, panes } = mount(2, { size: 200 }) // 200px track (199px of pane extent — 1px divider), ratio 0.5/0.5
    // Zero out the default pane-min floor (--ui-split-pane-min: 4rem) so the bounds clamp never interferes —
    // this test is about the DELTA MATH, not the clamp (SPEC-R2 AC2 clamp already has its own coverage above).
    panes[0].min = '0px'
    panes[1].min = '0px'
    await el.updateComplete
    const trackExtent = 199 // 200px host − the 1px divider (the ONLY space `flex: ratio 0 0%` distributes)
    const expectedWidth = (ratio: number): number => ratio * trackExtent

    const sep = el.querySelector('[data-separator]') as HTMLElement
    stubCapture(sep)

    sep.dispatchEvent(ptr('pointerdown', 0))

    sep.dispatchEvent(ptr('pointermove', 40)) // delta since press = 40/200 = 0.2 → ratio 0.5+0.2 = 0.7
    await el.updateComplete
    expect(panes[0].getBoundingClientRect().width, 'move 1 (x=40): expected ratio 0.7').toBeCloseTo(expectedWidth(0.7), 0)

    sep.dispatchEvent(ptr('pointermove', 60)) // delta since press = 60/200 = 0.3 → ratio 0.5+0.3 = 0.8
    await el.updateComplete
    // The assertion that bites under the pre-fix compounding math: it would resolve to ratio 1.0 (the full
    // track) — move-1's 0.2 double-counted on top of move-2's own 0.3 fully consumes the track.
    expect(panes[0].getBoundingClientRect().width, 'move 2 (x=60): expected ratio 0.8 — NOT ratio 1.0 (the compounding overshoot)').toBeCloseTo(expectedWidth(0.8), 0)

    sep.dispatchEvent(ptr('pointermove', 90)) // delta since press = 90/200 = 0.45 → ratio 0.5+0.45 = 0.95
    await el.updateComplete
    expect(panes[0].getBoundingClientRect().width, 'move 3 (x=90): expected ratio 0.95').toBeCloseTo(expectedWidth(0.95), 0)

    sep.dispatchEvent(ptr('pointerup', 90))
    el.remove()
  })

  it('a single large move and N small moves covering the same net distance land at the SAME final ratio', async () => {
    const { el: elA, panes: panesA } = mount(2, { size: 200 })
    const sepA = elA.querySelector('[data-separator]') as HTMLElement
    stubCapture(sepA)
    sepA.dispatchEvent(ptr('pointerdown', 0))
    sepA.dispatchEvent(ptr('pointermove', 80)) // one big move straight to +40%
    await elA.updateComplete
    const wA = panesA[0].getBoundingClientRect().width
    sepA.dispatchEvent(ptr('pointerup', 80))
    elA.remove()

    const { el: elB, panes: panesB } = mount(2, { size: 200 })
    const sepB = elB.querySelector('[data-separator]') as HTMLElement
    stubCapture(sepB)
    sepB.dispatchEvent(ptr('pointerdown', 0))
    for (const x of [10, 20, 30, 40, 50, 60, 70, 80]) sepB.dispatchEvent(ptr('pointermove', x)) // 8 small steps, same net distance
    await elB.updateComplete
    const wB = panesB[0].getBoundingClientRect().width
    sepB.dispatchEvent(ptr('pointerup', 80))
    elB.remove()

    // The assertion that bites under the compounding bug: many small steps would overshoot far past wA.
    expect(wB, `8-step drag (${wB}px) must match the single-move result (${wA}px) — no compounding from move count`).toBeCloseTo(wA, 0)
  })
})

// ── TKT-0015 pt.2: selection suspended during an active drag (:state(dragging)) ───────────────────────

describe('ui-split browser smoke (TKT-0015 pt.2 — selection suspended during an active drag)', () => {
  it('user-select is suspended host-wide (incl. pane content) only WHILE a drag is active', async () => {
    const { el, panes } = mount(2, { size: 200 })
    const sep = el.querySelector('[data-separator]') as HTMLElement
    stubCapture(sep)

    // WebKit exposes the computed value only under the prefixed CSSOM name (button.browser.test.ts precedent
    // — unprefixed `userSelect` reads empty there); read both and prefer whichever is populated.
    const userSelectOf = (target: Element): string => {
      const cs = getComputedStyle(target)
      return cs.userSelect || cs.webkitUserSelect
    }

    expect(el.matches(':state(dragging)'), 'dragging must not be armed before any interaction').toBe(false)
    expect(userSelectOf(panes[0]), 'selection must be enabled at idle').not.toBe('none')

    sep.dispatchEvent(ptr('pointerdown', 0))
    sep.dispatchEvent(ptr('pointermove', 40))
    await el.updateComplete

    expect(el.matches(':state(dragging)'), ':state(dragging) was not armed on the first live move').toBe(true)
    expect(userSelectOf(el), 'the HOST must suspend selection while dragging').toBe('none')
    expect(userSelectOf(panes[0]), 'PANE CONTENT (not just the separator) must suspend selection while dragging').toBe('none')

    sep.dispatchEvent(ptr('pointerup', 40))
    await el.updateComplete

    expect(el.matches(':state(dragging)'), 'dragging must clear on release').toBe(false)
    expect(userSelectOf(panes[0]), 'selection must be restored after release').not.toBe('none')

    el.remove()
  })

  it('a mid-drag pane-count mutation (abortDrag, SPEC-R2 AC6) also clears :state(dragging) — the silent-abort path', async () => {
    const { el, panes } = mount(2, { size: 200 })
    const sep = el.querySelector('[data-separator]') as HTMLElement
    stubCapture(sep)
    // WebKit exposes the computed value only under the prefixed CSSOM name (button.browser.test.ts precedent
    // — unprefixed `userSelect` reads empty there); read both and prefer whichever is populated.
    const userSelectOf = (target: Element): string => {
      const cs = getComputedStyle(target)
      return cs.userSelect || cs.webkitUserSelect
    }

    sep.dispatchEvent(ptr('pointerdown', 0))
    sep.dispatchEvent(ptr('pointermove', 40))
    await el.updateComplete
    expect(el.matches(':state(dragging)')).toBe(true)

    const { UISplitPaneElement } = await import('./split-pane.ts')
    el.append(new UISplitPaneElement()) // mid-drag mutation — abortDrag() fires, silently (no commit event)
    await el.updateComplete

    // The assertion that bites if abortDrag's silent path leaves the state stuck armed indefinitely.
    expect(el.matches(':state(dragging)'), 'abortDrag must clear :state(dragging) even though it emits no commit').toBe(false)
    expect(userSelectOf(panes[0]), 'selection must be restored after an aborted drag').not.toBe('none')

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

// ── TKT-0045: an outer pane's `min`/`max` must not leak into an independent NESTED ui-split ─────────
// `--_pane-min`/`--_pane-max` are unregistered custom properties, which inherit by default. Before the
// fix, an unset `pane.min`/`.max` was cleared via `style.setProperty(name, '')`, which per the CSSOM spec
// REMOVES the declaration rather than setting it empty — leaving nothing to block inheritance, so a
// nested ui-split's own (unset-min) pane would pick up an ANCESTOR ui-split-pane's real `--_pane-min`
// value straight through, even though the two splits have no relationship to each other (discovered
// live: ui-agent-admin's settings pane set a real `min`, and ui-settings' internally-composed
// ui-master-detail — a wholly separate ui-split further down that pane's own content — inherited it,
// forcing its own drill-in pane far wider than its actual container).
describe('ui-split browser smoke (TKT-0045 — an outer pane min does not leak into a nested ui-split)', () => {
  it('a nested ui-split pane with no explicit min stays at the generic floor, not an ancestor pane\'s min', async () => {
    const { el: outer, panes: outerPanes } = mount(1, { size: 400 })
    outerPanes[0].min = '300px' // a large, deliberately-distinct outer floor

    const inner = document.createElement('ui-split') as UISplitElement
    inner.style.width = '100%'
    const innerPane = document.createElement('ui-split-pane') as UISplitPaneElement // no .min set
    inner.append(innerPane)
    outerPanes[0].append(inner)

    await outer.updateComplete
    await inner.updateComplete

    const innerMinWidth = Number.parseFloat(getComputedStyle(innerPane).minWidth)
    // The generic --ui-split-pane-min default (4rem) — NOT the outer pane's leaked 300px.
    expect(innerMinWidth).toBeLessThan(100)
    expect(innerPane.style.getPropertyValue('--_pane-min')).toBe('initial')

    outer.remove()
  })
})
