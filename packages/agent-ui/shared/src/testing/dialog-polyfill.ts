// @agent-ui/shared/testing/dialog-polyfill — the ONE sanctioned jsdom `<dialog>` modal-surface stub (GH #1006).
//
// jsdom reality (verified — node_modules/jsdom's HTMLDialogElement-impl.js is a BARE `class extends
// HTMLElement {}`): the native `<dialog>` modal surface is ABSENT — `showModal`/`close` are undefined, there
// is no `open` IDL accessor, and the `cancel`/`close` events never auto-fire. Every jsdom suite that drives a
// `ui-modal`/`ui-drawer`/`ui-command-modal` (or a page composing one) used to re-declare this stub inline;
// this module is that stub lifted once, so `open = true` actually reaches the DOM under jsdom while the REAL
// top-layer / focus-trap / Escape / backdrop behaviour stays proven in the `*.browser.test.ts` legs.
//
// Contract mirrored (minimal, platform-parity where it matters):
//   - `open` getter/setter backed by a per-instance WeakMap
//   - `showModal()` → open (and counts the call — see `dialogCallsOf`)
//   - `close()` → close + a `close` event; already-closed → a no-op, no event (platform parity)
//
// Idempotent + engine-safe: a REAL engine (the browser harness) already has `showModal`, so the install
// returns without touching the platform; a second install under jsdom is a no-op too (the first install
// made `showModal` a function). Test-only: this subpath is never imported by a shipping module.

/** Per-dialog call counters, for suites that pin HOW MANY times the platform surface was driven. */
export interface DialogCalls {
  showModal: number
  close: number
}

const dialogOpen = new WeakMap<HTMLDialogElement, boolean>()
const dialogCalls = new WeakMap<HTMLDialogElement, DialogCalls>()

/** The `showModal()`/`close()` call counts recorded for `dialog` by the installed stub (zeros before any call). */
export function dialogCallsOf(dialog: HTMLDialogElement): DialogCalls {
  let c = dialogCalls.get(dialog)
  if (!c) {
    c = { showModal: 0, close: 0 }
    dialogCalls.set(dialog, c)
  }
  return c
}

/**
 * Install the jsdom `<dialog>` modal-surface stub on `HTMLDialogElement.prototype`. Call from `beforeAll`
 * (or at module top before a page module boots). Returns `true` when the stub was installed, `false` when
 * the engine already carries a real `showModal` (browser harness, or a prior install) — the platform is
 * then left alone.
 */
export function installDialogPolyfill(): boolean {
  if (typeof HTMLDialogElement === 'undefined') return false
  const proto = HTMLDialogElement.prototype as unknown as { showModal?: () => void; close?: () => void }
  if (typeof proto.showModal === 'function') return false // a real engine (or already installed) — leave it alone
  Object.defineProperty(HTMLDialogElement.prototype, 'open', {
    configurable: true,
    get(this: HTMLDialogElement): boolean {
      return dialogOpen.get(this) ?? false
    },
    set(this: HTMLDialogElement, v: boolean): void {
      dialogOpen.set(this, Boolean(v))
    },
  })
  proto.showModal = function (this: HTMLDialogElement): void {
    dialogCallsOf(this).showModal++
    dialogOpen.set(this, true)
  }
  proto.close = function (this: HTMLDialogElement): void {
    dialogCallsOf(this).close++
    if (!(dialogOpen.get(this) ?? false)) return // already closed — a no-op, no event (platform parity)
    dialogOpen.set(this, false)
    this.dispatchEvent(new Event('close'))
  }
  return true
}
