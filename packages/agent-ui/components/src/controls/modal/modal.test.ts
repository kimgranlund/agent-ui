import { describe, it, expect, beforeAll } from 'vitest'
import { whenFlushed } from '@agent-ui/components'
import { UIModalElement } from './modal.ts'

// G9 s9 — UIModalElement jsdom behaviour probes (ADR-0017). jsdom reality (verified — node_modules/jsdom
// HTMLDialogElement-impl.js is a BARE `class extends HTMLElement {}`): the native `<dialog>` modal surface is
// ABSENT — `showModal`/`close` are undefined, there is no `open` IDL accessor, and the `cancel`/`close` events
// never auto-fire. So we STUB the modal surface on `HTMLDialogElement.prototype` (the decomp's sanctioned jsdom
// stub) with a minimal mirror of the platform contract — `open` getter/setter, `showModal()` → open, `close()`
// → close + a `close` event — and drive the platform `close`/`cancel` events DIRECTLY. The REAL top-layer /
// focus-trap / Escape / backdrop behaviour is the cross-engine modal.browser.test.ts; these pin the control's
// own logic: the open↔platform sync, the close-event state sync + emit, the dismissable cancel gate, and focus
// restore. The dialog PART is a queryable light-DOM child.

// ── the native-dialog stub (jsdom lacks the whole modal surface) ──────────────────────────────────────────

const dialogOpen = new WeakMap<HTMLDialogElement, boolean>()
const dialogCalls = new WeakMap<HTMLDialogElement, { showModal: number; close: number }>()

function callsOf(d: HTMLDialogElement): { showModal: number; close: number } {
  let c = dialogCalls.get(d)
  if (!c) {
    c = { showModal: 0, close: 0 }
    dialogCalls.set(d, c)
  }
  return c
}

beforeAll(() => {
  const proto = HTMLDialogElement.prototype as unknown as {
    showModal?: () => void
    close?: () => void
  }
  if (typeof proto.showModal === 'function') return // a real engine (browser harness) — leave the platform alone
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
    callsOf(this).showModal++
    dialogOpen.set(this, true)
  }
  proto.close = function (this: HTMLDialogElement): void {
    callsOf(this).close++
    if (!(dialogOpen.get(this) ?? false)) return // already closed — a no-op, no event (platform parity)
    dialogOpen.set(this, false)
    this.dispatchEvent(new Event('close'))
  }
})

// ── helpers ──────────────────────────────────────────────────────────────────────────────────────────────

const dialogOf = (el: Element): HTMLDialogElement => el.querySelector('[data-part="dialog"]') as HTMLDialogElement

function makeModal(markup = ''): { el: UIModalElement; dialog: HTMLDialogElement } {
  const el = document.createElement('ui-modal') as UIModalElement
  if (markup) el.innerHTML = markup
  document.body.append(el)
  return { el, dialog: dialogOf(el) }
}

/** Mirror a platform-initiated close (Escape/backdrop/external): the platform sets open=false, then fires close. */
function simulatePlatformClose(dialog: HTMLDialogElement): void {
  ;(dialog as unknown as { open: boolean }).open = false
  dialog.dispatchEvent(new Event('close'))
}

/** Mirror the platform `cancel` (Escape / light-dismiss request); returns the (cancelable) event. */
function fireCancel(dialog: HTMLDialogElement): Event {
  const ev = new Event('cancel', { cancelable: true })
  dialog.dispatchEvent(ev)
  return ev
}

// ── upgrade + the typed prop surface ──────────────────────────────────────────

describe('ui-modal — upgrade + typed prop surface', () => {
  it('upgrades to the class with the surface axes + open/dismissable at their defaults', () => {
    const el = document.createElement('ui-modal') as UIModalElement
    expect(el).toBeInstanceOf(UIModalElement)
    expect(el.elevation).toBe('0')
    expect(el.brightness).toBe('0')
    expect(el.open).toBe(false)
    expect(el.dismissable).toBe(true) // default ON
  })

  it('typed: elevation is the signed literal union + open/dismissable are boolean (compile-time negative control)', () => {
    const fn = (): void => {
      const el = new UIModalElement()
      el.elevation = '0'
      el.elevation = '3'
      el.elevation = '-3'
      // @ts-expect-error — 5 (a bare number) is not a surface-step member: proves the literal union, NOT number
      el.elevation = 5
      // @ts-expect-error — 'xl' is not a surface-step member
      el.elevation = 'xl'
      // @ts-expect-error — open is boolean, not string
      el.open = 'yes'
    }
    expect(typeof fn).toBe('function') // never invoked; the type errors above are the assertion
  })

  it('self-defines ui-modal, guarded against a double-define', () => {
    expect(customElements.get('ui-modal')).toBe(UIModalElement)
    expect(() => {
      if (!customElements.get('ui-modal')) customElements.define('ui-modal', UIModalElement)
    }).not.toThrow()
  })
})

// ── the dialog PART + host-no-role + render-void (modal-dialog) ────────────────

describe('ui-modal — the control-owned dialog part', () => {
  it('creates a single <dialog data-part="dialog"> part; the HOST carries no role/aria attribute', () => {
    const { el, dialog } = makeModal()
    expect(dialog).not.toBeNull()
    expect(dialog.tagName.toLowerCase()).toBe('dialog')
    expect(dialog.getAttribute('data-part')).toBe('dialog')
    // host-no-role: the dialog carries its own ARIA — the HOST carries neither role nor aria-*
    expect(el.hasAttribute('role')).toBe(false)
    for (const attr of Array.from(el.attributes)) expect(attr.name.startsWith('aria-')).toBe(false)
    el.remove()
  })

  it('render() stays VOID — the dialog is the host’s only child; created ONCE across reconnect', () => {
    const { el } = makeModal()
    expect(el.querySelectorAll('dialog')).toHaveLength(1)
    expect(el.children).toHaveLength(1) // only the dialog — render() committed nothing
    el.remove()
    document.body.append(el) // reconnect re-runs connected()
    expect(el.querySelectorAll('dialog')).toHaveLength(1) // not re-created (idempotent guard)
    expect(el.children).toHaveLength(1)
    el.remove()
  })

  it('moves the modal’s children into the dialog part', () => {
    const { el, dialog } = makeModal('<h2>Title</h2><p>Body</p>')
    expect(dialog.querySelector('h2')?.textContent).toBe('Title')
    expect(dialog.querySelector('p')?.textContent).toBe('Body')
    expect(el.children).toHaveLength(1) // the dialog is the host's only child (content moved in)
    el.remove()
  })

  it('forwards an author aria-label onto the dialog part and strips it off the host (host stays aria-clean)', () => {
    const el = document.createElement('ui-modal') as UIModalElement
    el.setAttribute('aria-label', 'Settings')
    el.setAttribute('aria-labelledby', 'heading-id')
    document.body.append(el)
    const dialog = dialogOf(el)
    expect(dialog.getAttribute('aria-label')).toBe('Settings')
    expect(dialog.getAttribute('aria-labelledby')).toBe('heading-id')
    expect(el.hasAttribute('aria-label')).toBe(false) // moved off the host (ADR-0017 cl.5)
    expect(el.hasAttribute('aria-labelledby')).toBe(false)
    el.remove()
  })
})

// ── open drives showModal()/close() (modal-dialog) ────────────────────────────

describe('ui-modal — open drives showModal()/close()', () => {
  it('open=true calls showModal() (enters the top layer); open=false calls close()', async () => {
    const { el, dialog } = makeModal()
    expect(callsOf(dialog).showModal).toBe(0) // closed by default → no showModal on connect

    el.open = true
    await whenFlushed()
    expect(callsOf(dialog).showModal).toBe(1) // the scope-owned effect showed it
    expect(dialog.open).toBe(true)

    el.open = false
    await whenFlushed()
    expect(callsOf(dialog).close).toBe(1) // and closed it
    expect(dialog.open).toBe(false)
    el.remove()
  })

  it('an open-on-connect modal calls showModal() once on connect (the effect’s first run)', async () => {
    const el = document.createElement('ui-modal') as UIModalElement
    el.open = true // set BEFORE connect (property-wins) → the effect opens on connect
    document.body.append(el)
    await whenFlushed()
    const dialog = dialogOf(el)
    expect(callsOf(dialog).showModal).toBe(1)
    expect(dialog.open).toBe(true)
    el.remove()
  })

  it('a redundant open write does not re-enter the top layer (idempotent showModal guard)', async () => {
    const { el, dialog } = makeModal()
    el.open = true
    await whenFlushed()
    expect(callsOf(dialog).showModal).toBe(1)
    el.open = true // no transition — already open
    await whenFlushed()
    expect(callsOf(dialog).showModal).toBe(1) // not re-shown (the `if (dialog.open) return` guard)
    el.remove()
  })
})

// ── platform close → state sync + close/toggle emit (modal-escape / modal-open) ─

describe('ui-modal — platform close syncs open=false and emits close + toggle', () => {
  it('a USER/platform close flips open=false and emits BOTH close and toggle (the two-way bind)', async () => {
    const { el, dialog } = makeModal()
    el.open = true
    await whenFlushed()

    let closes = 0
    let toggles = 0
    el.addEventListener('close', () => closes++)
    el.addEventListener('toggle', () => toggles++)

    simulatePlatformClose(dialog) // Escape / backdrop / external close
    expect(el.open).toBe(false) // state synced down
    expect(closes).toBe(1) // the family close event
    expect(toggles).toBe(1) // the value:{event:'toggle'} two-way signal (ADR-0019)
    el.remove()
  })

  it('a PROGRAMMATIC close (open=false) calls close() but emits NOTHING (the agent already knows)', async () => {
    const { el, dialog } = makeModal()
    el.open = true
    await whenFlushed()

    let closes = 0
    let toggles = 0
    el.addEventListener('close', () => closes++)
    el.addEventListener('toggle', () => toggles++)

    el.open = false // the agent drives the close
    await whenFlushed()
    expect(callsOf(dialog).close).toBe(1) // the dialog WAS closed
    expect(dialog.open).toBe(false)
    expect(closes).toBe(0) // …but no redundant emit — the prop was already false when `close` fired
    expect(toggles).toBe(0)
    el.remove()
  })
})

// ── dismissable gates the cancel (Escape) dismissal (modal-escape) ─────────────

describe('ui-modal — dismissable gates the cancel (Escape) dismissal', () => {
  it('dismissable (default) lets the cancel through; dismissable=false preventDefaults it', async () => {
    const { el, dialog } = makeModal()
    el.open = true
    await whenFlushed()

    // default dismissable → the platform cancel is NOT blocked (Escape would close)
    expect(fireCancel(dialog).defaultPrevented).toBe(false)

    // dismissable=false → the control blocks the cancel (the dialog stays open; no close follows)
    el.dismissable = false
    await whenFlushed()
    expect(fireCancel(dialog).defaultPrevented).toBe(true)
    el.remove()
  })
})

// ── focus restore to the EXACT opener (modal-focus-restore + NC) ───────────────

describe('ui-modal — focus restore on close', () => {
  it('restores focus to the EXACT opener on close (NC: not document.body)', async () => {
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()
    expect(document.activeElement).toBe(opener)

    const { el, dialog } = makeModal()
    el.open = true
    await whenFlushed() // the effect records the opener (= document.activeElement) before showModal

    // move focus elsewhere so the restore is non-vacuous (it must actively move focus BACK to the opener)
    const elsewhere = document.createElement('button')
    document.body.append(elsewhere)
    elsewhere.focus()
    expect(document.activeElement).toBe(elsewhere)

    simulatePlatformClose(dialog) // close → restore
    expect(document.activeElement).toBe(opener) // the EXACT opener (NC: not body, not `elsewhere`)

    opener.remove()
    elsewhere.remove()
    el.remove()
  })
})

// ── zero residue — abort-owned listeners (modal-probes) ───────────────────────

describe('ui-modal — zero residue across connect/disconnect', () => {
  it('the dialog close listener is abort-owned — it dies on disconnect and re-wires exactly once on reconnect', async () => {
    const { el, dialog } = makeModal()
    el.open = true
    await whenFlushed()

    let closes = 0
    el.addEventListener('close', () => closes++)

    simulatePlatformClose(dialog) // connected → handled (open=false + close emitted)
    expect(el.open).toBe(false)
    expect(closes).toBe(1)

    el.remove() // disconnect → ac.abort() removes the dialog listeners
    dialog.dispatchEvent(new Event('close')) // the listener is GONE
    expect(closes).toBe(1) // unchanged — the handler did not run

    document.body.append(el) // reconnect → connected() re-wires on a fresh AbortController + re-runs the effect
    el.open = true
    await whenFlushed()
    simulatePlatformClose(dialog)
    expect(el.open).toBe(false)
    expect(closes).toBe(2) // exactly ONE re-wired listener — not a leaked old one stacked atop it
    el.remove()
  })
})
