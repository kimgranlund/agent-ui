import { describe, it, expect, beforeAll } from 'vitest'
import { installDialogPolyfill, dialogCallsOf } from './dialog-polyfill.ts'

// GH #1006 — the shared jsdom `<dialog>` stub's own contract: idempotent install, the `open` IDL mirror,
// `showModal()` → open, `close()` → close + one `close` event (already-closed → silent no-op), call counters.

describe('installDialogPolyfill — the shared jsdom <dialog> modal-surface stub', () => {
  let first: boolean
  beforeAll(() => {
    first = installDialogPolyfill()
  })

  it('installs once under jsdom and is a no-op on the second call (never double-defines)', () => {
    expect(first).toBe(true) // jsdom has no showModal — the stub landed
    expect(installDialogPolyfill()).toBe(false)
    expect(typeof HTMLDialogElement.prototype.showModal).toBe('function')
  })

  it('mirrors open/showModal/close and fires exactly one close event per real close', () => {
    const d = document.createElement('dialog')
    let closes = 0
    d.addEventListener('close', () => closes++)
    expect(d.open).toBe(false)
    d.showModal()
    expect(d.open).toBe(true)
    d.close()
    expect(d.open).toBe(false)
    d.close() // already closed — no second event (platform parity)
    expect(closes).toBe(1)
    expect(dialogCallsOf(d)).toEqual({ showModal: 1, close: 2 })
    d.open = true
    expect(d.open).toBe(true)
  })
})
