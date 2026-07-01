import { describe, it, expect, beforeAll } from 'vitest'
import { UIElement } from '../dom/index.ts'
import { overlay, computePosition } from './overlay.ts'
import type { OverlayHandle, OverlayOptions } from './overlay.ts'

// overlay.ts — jsdom behaviour probes (overlay-controller LLD-C1..C4).
//
// jsdom reality: the native Popover API (`showPopover`/`hidePopover`, the `toggle` ToggleEvent) is
// absent in jsdom 29. We STUB it on `HTMLElement.prototype` with a minimal mirror of the platform
// contract — per-element open state, show/hide call counts, and the toggle event dispatch — before
// driving the controller's logic. The REAL top-layer / Escape / outside-click behaviour is the
// consuming control's cross-engine browser smoke (noted here; not a unit-test responsibility).
//
// Named probes:
//   overlay-popover-attr · overlay-open · overlay-close · overlay-toggle · overlay-double-open ·
//   overlay-light-dismiss · overlay-flip · overlay-gap · overlay-shift · overlay-focus-open ·
//   overlay-focus-noop · overlay-cleanup · overlay-auto-cleanup · overlay-data-placement

// ── Popover API stub (jsdom lacks it entirely) ────────────────────────────────────────────────

const popoverOpen = new WeakMap<HTMLElement, boolean>()
const popoverCalls = new WeakMap<HTMLElement, { show: number; hide: number }>()

function callsOf(el: HTMLElement): { show: number; hide: number } {
  let c = popoverCalls.get(el)
  if (!c) {
    c = { show: 0, hide: 0 }
    popoverCalls.set(el, c)
  }
  return c
}

function fireToggle(el: HTMLElement, newState: 'open' | 'closed'): void {
  const ev = new Event('toggle')
  Object.defineProperty(ev, 'newState', { value: newState })
  el.dispatchEvent(ev)
}

beforeAll(() => {
  const proto = HTMLElement.prototype as unknown as {
    showPopover?: () => void
    hidePopover?: () => void
  }
  if (typeof proto.showPopover === 'function') return // real engine — leave the platform alone

  proto.showPopover = function (this: HTMLElement): void {
    const c = callsOf(this)
    c.show++
    if (popoverOpen.get(this)) return // already open — no-op (platform parity: no event)
    popoverOpen.set(this, true)
    fireToggle(this, 'open')
  }

  proto.hidePopover = function (this: HTMLElement): void {
    const c = callsOf(this)
    c.hide++
    if (!popoverOpen.get(this)) return // already hidden — no-op (platform parity: no event)
    popoverOpen.set(this, false)
    fireToggle(this, 'closed')
  }
})

/** Simulate a platform-initiated light-dismiss (Escape / outside-click) without calling hidePopover. */
function simulateLightDismiss(popup: HTMLElement): void {
  popoverOpen.set(popup, false)
  fireToggle(popup, 'closed')
}

// ── Test host element ─────────────────────────────────────────────────────────────────────────

class OverlayEl extends UIElement {
  handle: OverlayHandle | null = null
  // Owned popup + anchor elements — consumers embed them in the DOM as needed per test.
  readonly popup: HTMLElement = document.createElement('div')
  readonly anchor: HTMLButtonElement = document.createElement('button')
  overlayOpts: Partial<Omit<OverlayOptions, 'popup' | 'anchor'>> = {}

  protected connected(): void {
    this.handle = overlay(this, { popup: this.popup, anchor: this.anchor, ...this.overlayOpts })
  }
}
customElements.define('ui-overlay-test', OverlayEl)

/** Mount the host (and optionally the popup + anchor) and return both host and cleanup helper. */
function makeHost(opts: Partial<Omit<OverlayOptions, 'popup' | 'anchor'>> = {}): {
  el: OverlayEl
  popup: HTMLElement
  anchor: HTMLButtonElement
  unmount: () => void
} {
  const el = new OverlayEl()
  el.overlayOpts = opts
  document.body.append(el, el.popup, el.anchor)
  return {
    el,
    popup: el.popup,
    anchor: el.anchor,
    unmount: () => { el.popup.remove(); el.anchor.remove(); el.remove() },
  }
}

// ── computePosition unit tests (overlay-flip · overlay-shift) ─────────────────────────────────

const rect = (x: number, y: number, w: number, h: number): DOMRect =>
  ({ left: x, top: y, right: x + w, bottom: y + h, width: w, height: h, x, y, toJSON: () => ({}) }) as DOMRect

describe('computePosition — flip/shift math', () => {
  it('overlay-flip: bottom-start flips to top-start when there is not enough space below', () => {
    // Anchor near the bottom of a 600px viewport; 200px popup can't fit below (60px) but fits above.
    const anchor = rect(100, 500, 120, 40) // bottom=540; space below = 600-540 = 60
    const popup = rect(0, 0, 150, 200) // height 200 > 60

    const { top, left, placement } = computePosition('bottom-start', anchor, popup, 800, 600)
    expect(placement).toBe('top-start')
    expect(top).toBe(500 - 200) // anchorRect.top - popupH
    expect(left).toBe(100) // anchorRect.left (start alignment)
  })

  it('overlay-gap: the gap offsets the panel from the anchor AND counts toward flip collision', () => {
    const anchor = rect(100, 100, 120, 40) // bottom = 140
    const popup = rect(0, 0, 150, 200)
    // bottom placement: the panel edge sits `gap` px below the anchor's bottom edge.
    const placed = computePosition('bottom-start', anchor, popup, 800, 600, 8)
    expect(placed.placement).toBe('bottom-start')
    expect(placed.top).toBe(140 + 8) // anchor.bottom + gap

    // The gap counts toward the flip collision: an anchor where the panel fits below WITHOUT the gap
    // but NOT with it flips to the side that has room (viewport-collision-aware placement).
    const tight = rect(100, 350, 120, 40) // bottom = 390; space below = 600 - 390 = 210; space above = 350
    expect(computePosition('bottom-start', tight, popup, 800, 600, 0).placement).toBe('bottom-start') // 210 ≥ 200
    expect(computePosition('bottom-start', tight, popup, 800, 600, 20).placement).toBe('top-start') // 210 < 220 → flip
  })

  it('overlay-flip: top-end flips to bottom-end when there is not enough space above', () => {
    // Anchor near the top of the viewport; 200px popup cannot fit above (80px) but fits below.
    const anchor = rect(200, 80, 100, 40) // top=80; space above = 80
    const popup = rect(0, 0, 100, 200) // height 200 > 80

    const { placement, top } = computePosition('top-end', anchor, popup, 800, 600)
    expect(placement).toBe('bottom-end')
    expect(top).toBe(80 + 40) // anchorRect.bottom
  })

  it('overlay-flip: right-start flips to left-start when there is not enough space on the right', () => {
    // Anchor near the right edge; 200px popup cannot fit right but fits left.
    const anchor = rect(700, 200, 80, 40) // right=780; space right = 800-780 = 20
    const popup = rect(0, 0, 200, 100) // width 200 > 20

    const { placement, left } = computePosition('right-start', anchor, popup, 800, 600)
    expect(placement).toBe('left-start')
    expect(left).toBe(700 - 200) // anchorRect.left - popupW
  })

  it('overlay-shift: clamps popup to the viewport right edge when computed left overflows', () => {
    // Anchor near the right edge; preferred bottom-start would place popup out of viewport.
    const anchor = rect(750, 100, 80, 40) // left=750; popup W=200 → 750+200=950 > 800
    const popup = rect(0, 0, 200, 100)
    // Enough space below (400px > 100px) so no flip.
    const { left, placement } = computePosition('bottom-start', anchor, popup, 800, 600)
    expect(placement).toBe('bottom-start')
    expect(left).toBe(800 - 200) // clamped to vw - popupW
  })

  it('overlay-shift: clamps popup to viewport top when computed top would go negative', () => {
    // Anchor near the very top; top-start computed top = 10 - 200 = -190 → clamped to 0.
    const anchor = rect(100, 10, 80, 40) // top=10; popup H=200 → 10-200=-190
    const popup = rect(0, 0, 80, 200)
    // Space above = 10 < 200; space below = 600 - 50 = 550 > 200 — should flip to bottom.
    // Verify the flip, not the shift.
    const { placement, top } = computePosition('top-start', anchor, popup, 800, 600)
    expect(placement).toBe('bottom-start')
    expect(top).toBe(50) // anchorRect.bottom = 10 + 40 = 50
  })

  it('overlay-shift: no flip needed, but bottom overflows — clamps top via shift', () => {
    // Popup that's too tall but not quite flip-worthy (both sides insufficient).
    // Space above = 100; space below = 600-340 = 260; popup H = 400 → fits below more than above.
    // Flip rule: spaceFor[side] < needed AND spaceFor[FLIP] >= needed — here neither side has 400.
    // No flip. Then top = anchorRect.bottom = 340; shift: min(340, 600-400) = min(340,200) = 200.
    const anchor = rect(100, 100, 80, 240) // bottom=340; space below=260
    const popup = rect(0, 0, 80, 400) // height=400 — bigger than both sides
    const { placement, top } = computePosition('bottom-start', anchor, popup, 800, 600)
    expect(placement).toBe('bottom-start') // no flip
    expect(top).toBe(200) // clamped: Math.min(340, 600-400) = 200
  })
})

// ── Controller integration probes ─────────────────────────────────────────────────────────────

describe('overlay — popover attribute (overlay-popover-attr)', () => {
  it('auto=true (default) sets popover="auto" on the popup part', () => {
    const { popup, unmount } = makeHost()
    expect(popup.getAttribute('popover')).toBe('auto')
    unmount()
  })

  it('auto=false sets popover="manual" on the popup part', () => {
    const { popup, unmount } = makeHost({ auto: false })
    expect(popup.getAttribute('popover')).toBe('manual')
    unmount()
  })
})

describe('overlay — open/close/toggle drive showPopover/hidePopover (overlay-open · overlay-close · overlay-toggle)', () => {
  it('overlay-open: open() calls showPopover() and sets the popup state', () => {
    const { el, popup, unmount } = makeHost()
    expect(callsOf(popup).show).toBe(0)

    el.handle!.open()
    expect(callsOf(popup).show).toBe(1)
    expect(popoverOpen.get(popup)).toBe(true)
    unmount()
  })

  it('overlay-close: close() calls hidePopover() and clears the popup state', () => {
    const { el, popup, unmount } = makeHost()
    el.handle!.open()
    expect(popoverOpen.get(popup)).toBe(true)

    el.handle!.close()
    expect(callsOf(popup).hide).toBe(1)
    expect(popoverOpen.get(popup)).toBe(false)
    unmount()
  })

  it('overlay-toggle: toggle() opens when closed and closes when open', () => {
    const { el, popup, unmount } = makeHost()
    el.handle!.toggle()
    expect(popoverOpen.get(popup)).toBe(true)

    el.handle!.toggle()
    expect(popoverOpen.get(popup)).toBe(false)
    unmount()
  })
})

describe('overlay — idempotency (overlay-double-open)', () => {
  it('overlay-double-open: calling open() twice only shows the popup once (idempotent)', () => {
    const { el, popup, unmount } = makeHost()
    el.handle!.open()
    el.handle!.open() // second call is a no-op
    expect(callsOf(popup).show).toBe(1)
    unmount()
  })

  it('double close() is also idempotent — hidePopover() called only once', () => {
    const { el, popup, unmount } = makeHost()
    el.handle!.open()
    el.handle!.close()
    el.handle!.close() // already closed — no-op
    expect(callsOf(popup).hide).toBe(1)
    unmount()
  })
})

describe('overlay — light-dismiss (overlay-light-dismiss)', () => {
  it('overlay-light-dismiss: toggle event with newState=closed → emits close + toggle from the host', () => {
    const { el, popup, unmount } = makeHost()
    el.handle!.open()

    let closes = 0
    let toggles = 0
    el.addEventListener('close', () => closes++)
    el.addEventListener('toggle', () => toggles++)

    simulateLightDismiss(popup) // Escape / outside-click (platform-driven close)
    expect(closes).toBe(1) // the family close event
    expect(toggles).toBe(1) // the value:{event:'toggle'} two-way signal (ADR-0019)
    unmount()
  })

  it('a programmatic close() does NOT emit close/toggle (the agent already knows)', () => {
    const { el, popup, unmount } = makeHost()
    el.handle!.open()

    let closes = 0
    let toggles = 0
    el.addEventListener('close', () => closes++)
    el.addEventListener('toggle', () => toggles++)

    el.handle!.close() // programmatic — not a platform-initiated dismiss
    expect(callsOf(popup).hide).toBe(1) // popup WAS hidden
    expect(closes).toBe(0) // no redundant emit
    expect(toggles).toBe(0)
    unmount()
  })

  it('light-dismiss after close() is a no-op — the toggle handler sees isOpen=false and skips', () => {
    const { el, popup, unmount } = makeHost()
    el.handle!.open()
    el.handle!.close() // sets isOpen=false

    let closes = 0
    el.addEventListener('close', () => closes++)

    simulateLightDismiss(popup) // arrives after we already closed — should be silent
    expect(closes).toBe(0)
    unmount()
  })
})

describe('overlay — positioning sets data-placement (overlay-data-placement)', () => {
  it('overlay-data-placement: open() writes data-placement to the popup from the resolved placement', () => {
    const { el, popup, anchor, unmount } = makeHost()

    // Give the anchor a real rect and plenty of viewport space so no flip/shift occurs.
    anchor.getBoundingClientRect = () => rect(100, 100, 80, 40)
    popup.getBoundingClientRect = () => rect(0, 0, 150, 200)
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1200 })
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 900 })

    el.handle!.open()
    expect(popup.getAttribute('data-placement')).toBe('bottom-start')
    unmount()
  })
})

describe('overlay — focus policy (overlay-focus-open · overlay-focus-noop)', () => {
  it('overlay-focus-open: open() moves focus into the first focusable child; close() restores to anchor', () => {
    const { el, popup, anchor, unmount } = makeHost({ focusOnOpen: true })

    // Give anchor a real rect so position() doesn't throw in jsdom.
    anchor.getBoundingClientRect = () => rect(50, 50, 80, 40)
    popup.getBoundingClientRect = () => rect(0, 0, 100, 150)

    const btn = document.createElement('button')
    btn.textContent = 'Action'
    popup.appendChild(btn)

    anchor.focus()
    expect(document.activeElement).toBe(anchor)

    el.handle!.open()
    expect(document.activeElement).toBe(btn) // focus moved into popup

    el.handle!.close()
    expect(document.activeElement).toBe(anchor) // restored to anchor
    unmount()
  })

  it('overlay-focus-noop: focusOnOpen=false → no focus movement on open or close', () => {
    const { el, popup, anchor, unmount } = makeHost({ focusOnOpen: false })

    anchor.getBoundingClientRect = () => rect(50, 50, 80, 40)
    popup.getBoundingClientRect = () => rect(0, 0, 100, 150)

    const btn = document.createElement('button')
    popup.appendChild(btn)

    anchor.focus()
    expect(document.activeElement).toBe(anchor)

    el.handle!.open()
    expect(document.activeElement).toBe(anchor) // unchanged — no focus move

    el.handle!.close()
    expect(document.activeElement).toBe(anchor) // still unchanged
    unmount()
  })
})

describe('overlay — cleanup and auto-cleanup (overlay-cleanup · overlay-auto-cleanup)', () => {
  it('overlay-cleanup: cleanup() hides the popup and makes subsequent open/close no-ops', () => {
    const { el, popup, unmount } = makeHost()
    el.handle!.open()
    expect(popoverOpen.get(popup)).toBe(true)

    el.handle!.cleanup()
    expect(popoverOpen.get(popup)).toBe(false) // closed by cleanup
    expect(callsOf(popup).hide).toBe(1)

    el.handle!.open() // cleaned — no-op
    expect(callsOf(popup).show).toBe(1) // still only the original open
    unmount()
  })

  it('cleanup() is idempotent — safe to call multiple times', () => {
    const { el, popup, unmount } = makeHost()
    el.handle!.open()
    el.handle!.cleanup()
    el.handle!.cleanup() // second call must not throw or re-hide
    expect(callsOf(popup).hide).toBe(1)
    unmount()
  })

  it('overlay-auto-cleanup: disconnecting the host calls cleanup() and removes toggle listener', () => {
    const { el, popup } = makeHost()
    el.handle!.open()
    expect(popoverOpen.get(popup)).toBe(true)

    // Disconnect → scope.dispose() → effect disposer (cleanup) fires.
    el.remove()
    expect(popoverOpen.get(popup)).toBe(false) // cleanup() closed the popup

    // After disconnect, the toggle listener is gone (host.listen rides the abort signal).
    // Firing a close toggle now should NOT emit close/toggle from the (disconnected) host.
    let closes = 0
    el.addEventListener('close', () => closes++)
    simulateLightDismiss(popup) // listener is dead — should not fire
    expect(closes).toBe(0)

    el.popup.remove()
    el.anchor.remove()
  })

  it('the toggle listener does not re-fire after cleanup (zero residue)', () => {
    const { el, popup, unmount } = makeHost()
    el.handle!.open()
    el.handle!.cleanup()

    let closes = 0
    el.addEventListener('close', () => closes++)
    simulateLightDismiss(popup) // cleaned guard prevents emission
    expect(closes).toBe(0)
    unmount()
  })
})

// Note: cross-engine browser smoke (real top layer / Escape / outside-click / focus ring) is the
// consuming control's (ui-select / ui-menu / etc.) DoD — not this unit-test layer.
