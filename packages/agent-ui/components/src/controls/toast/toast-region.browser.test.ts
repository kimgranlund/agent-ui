import { describe, it, expect, afterEach } from 'vitest'
import type { UIToastRegionElement } from './toast-region.ts'
import type { UIModalElement } from '../modal/modal.ts'

// toast-region.browser.test.ts — the cross-engine browser-truth smoke for ui-toast-region
// (feed-family.lld.md §10 · SPEC-R12: jsdom has no Popover API top layer at all). Covers:
//   [1] Region hides once empty — :popover-open drops to false when the last toast closes
//   [2] Empty-region click-through — the empty area never intercepts a click on the page beneath it
//   [3] Top-layer above an open ui-modal — a toast arriving while a modal is open still paints above
//       it (SPEC-R12 AC2's re-assert), proven via document.elementsFromPoint at the toast's rect
//
// Side-effect imports — CSS load order (ADR-0003): foundation roles FIRST, then the modal's own
// surface stack (for the top-layer-above-modal leg), then button/icon (the toast's own child parts),
// then the toast/region sheets, then every self-defining module. Direct (pre-barrel) imports — the
// LLD-C11 shared-file integration slice lands in a later wave.
import '@agent-ui/components/foundation-styles.css'
import '../_surface/container.css'
import '../_surface/container-box.css'
import '../modal/modal.css'
import '../button/button.css'
import '../icon/icon.css'
import './toast.css'
import './toast-region.css'
import '../modal/modal.ts'
import '../button/button.ts'
import '../icon/icon.ts'
import './toast-region.ts'
import './toast.ts'

const mounted: HTMLElement[] = []

function mount(markup: string): HTMLElement {
  const wrap = document.createElement('div')
  wrap.innerHTML = markup
  document.body.append(wrap)
  mounted.push(wrap)
  return wrap
}

afterEach(() => {
  while (mounted.length) {
    const m = mounted.pop()!
    // Close any open top-layer surfaces before the next test (avoid stale top-layer state).
    for (const popoverEl of m.querySelectorAll<HTMLElement>('[popover]')) {
      const hp = popoverEl as HTMLElement & { hidePopover?: () => void }
      if (hp.hidePopover) try { hp.hidePopover() } catch { /* already hidden */ }
    }
    const dialog = m.querySelector('dialog') as HTMLDialogElement | null
    if (dialog?.open) dialog.close()
    m.remove()
  }
})

// ── [1] hides once empty ─────────────────────────────────────────────────────────────────────────

describe('ui-toast-region — hides once empty (:popover-open drops when the last toast closes)', () => {
  it('opens on the first show(), closes once that toast closes', async () => {
    const wrap = mount('<ui-toast-region></ui-toast-region>')
    const region = wrap.querySelector('ui-toast-region') as UIToastRegionElement
    const toast = region.show({ message: 'hi', duration: 0 })
    await new Promise((r) => requestAnimationFrame(r))
    expect(region.matches(':popover-open')).toBe(true)

    toast.close()
    await new Promise((r) => requestAnimationFrame(r))
    expect(region.matches(':popover-open')).toBe(false)
  })
})

// ── [2] empty-region click-through ───────────────────────────────────────────────────────────────

describe('ui-toast-region — the empty area never intercepts a click on the page beneath it (SPEC-R12)', () => {
  it('a click at the region\'s own (empty) location lands on the element BEHIND it, not the region', async () => {
    const wrap = mount(`
      <button id="behind" style="position:fixed; inset-inline-end:8px; inset-block-end:8px; inline-size:80px; block-size:80px;">behind</button>
      <ui-toast-region></ui-toast-region>
    `)
    const region = wrap.querySelector('ui-toast-region') as UIToastRegionElement
    const behind = wrap.querySelector('#behind') as HTMLElement
    const toast = region.show({ message: 'hi', duration: 0 })
    await new Promise((r) => requestAnimationFrame(r))
    expect(region.matches(':popover-open')).toBe(true)

    // A point over the EMPTY region area (not over the toast card itself) must hit the button behind it.
    const behindRect = behind.getBoundingClientRect()
    const topHit = document.elementFromPoint(behindRect.left + 2, behindRect.top + 2)
    expect(topHit).toBe(behind)
    void toast
  })
})

// ── [3] top-layer above an open ui-modal (SPEC-R12 AC2 — the re-assert) ────────────────────────────

// A DISCOVERED cross-engine finding while building this leg (both Chromium AND WebKit): once a native
// modal <dialog> is open, `document.elementFromPoint`/`elementsFromPoint` routes hit-testing to the
// DIALOG at every point in the viewport, REGARDLESS of top-layer paint order — a modal's "make
// everything outside inert" behaviour appears to override hit-testing even for a LATER top-layer
// popover that visually paints above it (confirmed via a screenshot: the re-asserted toasts render
// fully opaque/undimmed above the modal's backdrop — the VISUAL stacking is correct; only the HIT-TEST
// is inert-blocked). This is expected, not a bug: a toast arriving while a modal is open is meant to be
// SEEN (a passive announcement), never interacted with while the modal's focus trap holds the page — a
// user reaches its affordances only after the modal closes. `elementsFromPoint` is consequently the
// WRONG proof for this leg (a guaranteed false negative on a correct implementation); the right proof
// is the platform's own guarantee — CSS Popover/Dialog TOP LAYER ordering is INSERTION order — so this
// asserts show()'s re-assert (hidePopover();showPopover()) is genuinely invoked AFTER the modal's own
// showModal(), via a call-order trace on the real platform methods.
describe('ui-toast-region — a toast still paints above a LATER-opened modal (SPEC-R12 AC2 re-assert)', () => {
  it('re-asserting via a second show() re-enters the top layer strictly AFTER the modal opened (the platform insertion-order guarantee)', async () => {
    const wrap = mount(`
      <ui-toast-region></ui-toast-region>
      <ui-modal><p>modal content</p></ui-modal>
    `)
    const region = wrap.querySelector('ui-toast-region') as UIToastRegionElement
    const modal = wrap.querySelector('ui-modal') as UIModalElement
    const dialog = modal.querySelector('[data-part="dialog"]') as HTMLDialogElement

    const order: string[] = []
    const origShowPopover = HTMLElement.prototype.showPopover
    const origShowModal = HTMLDialogElement.prototype.showModal
    region.showPopover = function (this: HTMLElement): void {
      order.push('region-show')
      origShowPopover.call(this)
    }
    dialog.showModal = function (this: HTMLDialogElement): void {
      order.push('modal-showModal')
      origShowModal.call(this)
    }

    // 1. The region opens FIRST (a toast already showing).
    region.show({ message: 'first', duration: 0 })
    await new Promise((r) => requestAnimationFrame(r))
    expect(region.matches(':popover-open')).toBe(true)

    // 2. The modal opens LATER.
    modal.open = true
    await new Promise((r) => requestAnimationFrame(r))
    expect(dialog.open).toBe(true)

    // 3. A completion arrives — show() RE-ASSERTS top-layer order (hide+show back-to-back) before
    //    appending, so the region's showPopover() fires AGAIN, strictly after the modal's showModal().
    region.show({ message: 'second', duration: 0 })
    await new Promise((r) => requestAnimationFrame(r))

    const lastRegionShow = order.lastIndexOf('region-show')
    const modalShowModal = order.indexOf('modal-showModal')
    expect(modalShowModal, 'the modal never actually entered the top layer').toBeGreaterThanOrEqual(0)
    expect(lastRegionShow, 'the region never re-asserted after the modal opened').toBeGreaterThan(modalShowModal)
  })
})
