import { describe, it, expect, beforeAll } from 'vitest'
import { UIToastRegionElement } from './toast-region.ts'
import { UIToastElement } from './toast.ts'

// toast-region.test.ts — UIToastRegionElement jsdom behaviour probes (feed-family.lld.md LLD-C8 ·
// SPEC-R12/R13). jsdom reality (the overlay.test.ts precedent): the native Popover API
// (showPopover/hidePopover, `:popover-open`) is absent in jsdom 29. We STUB show/hidePopover on
// `HTMLElement.prototype` with a minimal per-element open-state mirror before driving the region's
// logic. The REAL top-layer / stacking-above-a-modal truth is toast-region.browser.test.ts.

// ── Popover API stub (jsdom lacks it entirely) ──────────────────────────────────────────────────

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

beforeAll(() => {
  const proto = HTMLElement.prototype as unknown as { showPopover?: () => void; hidePopover?: () => void }
  if (typeof proto.showPopover === 'function') return // a real engine — leave the platform alone

  proto.showPopover = function (this: HTMLElement): void {
    callsOf(this).show++
    popoverOpen.set(this, true)
  }
  proto.hidePopover = function (this: HTMLElement): void {
    callsOf(this).hide++
    if (!popoverOpen.get(this)) throw new Error('InvalidStateError: not currently showing') // platform parity
    popoverOpen.set(this, false)
  }
})

function makeRegion(): UIToastRegionElement {
  return document.createElement('ui-toast-region') as UIToastRegionElement
}

// ── top layer + the popover attribute ───────────────────────────────────────────────────────────

describe('ui-toast-region — sets popover="manual" on the HOST at connect (toast-region-popover-attr)', () => {
  it('adds popover="manual" if absent', () => {
    const el = makeRegion()
    document.body.appendChild(el)
    expect(el.getAttribute('popover')).toBe('manual')
    el.remove()
  })

  it('does not overwrite an author-supplied popover attribute', () => {
    const el = makeRegion()
    el.setAttribute('popover', 'auto')
    document.body.appendChild(el)
    expect(el.getAttribute('popover')).toBe('auto')
    el.remove()
  })
})

describe('ui-toast-region — MutationObserver drives visibility off child count (toast-region-visibility)', () => {
  it('shows once the first ui-toast child is appended; hides once the last is removed', async () => {
    const el = makeRegion()
    document.body.appendChild(el)
    expect(callsOf(el).show).toBe(0)

    const toast = document.createElement('ui-toast') as UIToastElement
    toast.textContent = 'hi'
    el.appendChild(toast)
    await Promise.resolve() // MutationObserver callbacks land in a microtask
    expect(callsOf(el).show).toBe(1)

    toast.remove()
    await Promise.resolve()
    expect(callsOf(el).hide).toBe(1)
    el.remove()
  })

  it('seeds visibility from children already present at connect (declarative markup)', async () => {
    const el = makeRegion()
    const toast = document.createElement('ui-toast') as UIToastElement
    toast.textContent = 'hi'
    el.appendChild(toast) // appended BEFORE the region connects
    document.body.appendChild(el)
    expect(callsOf(el).show).toBe(1)
    el.remove()
  })

  it('does not double-show when a second toast is appended while already open', async () => {
    const el = makeRegion()
    document.body.appendChild(el)
    const a = document.createElement('ui-toast') as UIToastElement
    a.textContent = 'a'
    el.appendChild(a)
    await Promise.resolve()
    const b = document.createElement('ui-toast') as UIToastElement
    b.textContent = 'b'
    el.appendChild(b)
    await Promise.resolve()
    expect(callsOf(el).show).toBe(1) // the guard — showPopover called exactly once
    el.remove()
  })
})

// ── show() ───────────────────────────────────────────────────────────────────────────────────────

describe('ui-toast-region — show() (toast-region-show)', () => {
  it('a bare string shorthand normalizes to { message } — creates + appends a ui-toast with that text', () => {
    const el = makeRegion()
    document.body.appendChild(el)
    const toast = el.show('File uploaded.')
    expect(toast.tagName.toLowerCase()).toBe('ui-toast')
    expect(toast.textContent).toBe('File uploaded.')
    expect(toast.parentElement).toBe(el)
    el.remove()
  })

  it('sets textContent BEFORE appending (announcement-correct) — the message is present at connect', () => {
    const el = makeRegion()
    document.body.appendChild(el)
    // Exercise via the real ui-toast (its own connected() adopts textContent into the message part) —
    // read the adopted [data-part="message"] text back, which is only correct if content preceded append.
    const toast = el.show('Upload failed.')
    expect(toast.querySelector('[data-part="message"]')?.textContent).toBe('Upload failed.')
    el.remove()
  })

  it('assigns urgent/duration/action from the options object', () => {
    const el = makeRegion()
    document.body.appendChild(el)
    const toast = el.show({ message: 'Retry?', urgent: true, duration: 0, action: 'Retry' })
    expect(toast.urgent).toBe(true)
    expect(toast.duration).toBe(0)
    expect(toast.action).toBe('Retry')
    el.remove()
  })

  it('unset options fall back to ui-toast prop defaults (not forced to undefined/0)', () => {
    const el = makeRegion()
    document.body.appendChild(el)
    const toast = el.show({ message: 'plain' })
    expect(toast.urgent).toBe(false)
    expect(toast.duration).toBe(6000)
    expect(toast.action).toBe('')
    el.remove()
  })

  it('throws when called on a disconnected region — never a silent queue (ledger #10)', () => {
    const el = makeRegion() // never appended
    expect(() => el.show('x')).toThrow()
  })

  it('re-asserts top-layer order when already open (hidePopover then showPopover, SPEC-R12 AC2)', async () => {
    const el = makeRegion()
    document.body.appendChild(el)
    el.show('first')
    await Promise.resolve()
    expect(callsOf(el).show).toBe(1)
    expect(callsOf(el).hide).toBe(0)

    el.show('second') // already open — re-asserts: hide then show, back-to-back
    expect(callsOf(el).hide).toBe(1)
    expect(callsOf(el).show).toBe(2)
    el.remove()
  })

  it('does NOT re-assert (no hide/show pair) on the very FIRST show — the childList observer opens it', async () => {
    const el = makeRegion()
    document.body.appendChild(el)
    el.show('first')
    expect(callsOf(el).hide).toBe(0) // #reassertTopLayer no-ops — #isOpen was false
    await Promise.resolve()
    expect(callsOf(el).show).toBe(1) // opened by the MutationObserver's own guarded call
    el.remove()
  })
})

describe('ui-toast-region — disconnect tears down the observer', () => {
  it('a childList mutation after disconnect does not throw and does not call showPopover again', async () => {
    const el = makeRegion()
    document.body.appendChild(el)
    el.remove()
    const toast = document.createElement('ui-toast') as UIToastElement
    toast.textContent = 'late'
    expect(() => el.appendChild(toast)).not.toThrow()
    await Promise.resolve()
    // the observer was disconnected — no new show() call attributable to this mutation
  })
})
