import { describe, it, expect, beforeAll } from 'vitest'
import { whenFlushed } from '@agent-ui/components'
import { UIDrawerElement } from './drawer.ts'

// ADR-0188 s2 — UIDrawerElement jsdom behaviour probes. jsdom reality (verified — same as modal.test.ts): the
// native `<dialog>` modal surface is ABSENT — `showModal`/`close` are undefined, there is no `open` IDL
// accessor, and the `cancel`/`close` events never auto-fire. So we STUB the modal surface on
// `HTMLDialogElement.prototype` (the modal.test.ts sanctioned jsdom stub, re-applied per ADR-0125) with a
// minimal mirror of the platform contract — `open` getter/setter, `showModal()` → open, `close()` → close + a
// `close` event — and drive the platform `close`/`cancel` events DIRECTLY. The REAL top-layer / focus-trap /
// Escape / backdrop / docked-geometry behaviour is the cross-engine drawer.browser.test.ts; these pin the
// control's own logic: the open↔platform sync, the close-event state sync + emit, the persistent cancel gate,
// focus restore, the edge prop, and child-move idempotence across reconnect.

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

function makeDrawer(markup = '', attrs: Record<string, string> = {}): { el: UIDrawerElement; dialog: HTMLDialogElement } {
  const el = document.createElement('ui-drawer') as UIDrawerElement
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
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

describe('ui-drawer — upgrade + typed prop surface', () => {
  it('upgrades to the class with the surface axes + open/persistent/edge at their defaults', () => {
    const el = document.createElement('ui-drawer') as UIDrawerElement
    expect(el).toBeInstanceOf(UIDrawerElement)
    expect(el.elevation).toBe('0')
    expect(el.brightness).toBe('0')
    expect(el.open).toBe(false)
    expect(el.persistent).toBe(false) // default OFF
    expect(el.edge).toBe('end') // the default docked edge
  })

  it('typed: edge is the closed literal union + open/persistent are boolean (compile-time negative control)', () => {
    const fn = (): void => {
      const el = new UIDrawerElement()
      el.edge = 'end'
      el.edge = 'start'
      el.edge = 'bottom'
      // @ts-expect-error — 'top' is not an edge member (ADR-0188 cl.8 — deliberately fenced out)
      el.edge = 'top'
      // @ts-expect-error — open is boolean, not string
      el.open = 'yes'
    }
    expect(typeof fn).toBe('function') // never invoked; the type errors above are the assertion
  })

  it('self-defines ui-drawer, guarded against a double-define', () => {
    expect(customElements.get('ui-drawer')).toBe(UIDrawerElement)
    expect(() => {
      if (!customElements.get('ui-drawer')) customElements.define('ui-drawer', UIDrawerElement)
    }).not.toThrow()
  })

  it('an out-of-enum edge attribute falls back to the default (`end`, values[0])', () => {
    const el = document.createElement('ui-drawer') as UIDrawerElement
    el.setAttribute('edge', 'top') // not a member — the enum codec snaps to values[0]
    document.body.append(el)
    expect(el.edge).toBe('end')
    el.remove()
  })
})

// ── the dialog PART + host-no-role + render-void ────────────────

describe('ui-drawer — the control-owned dialog part', () => {
  it('creates a single <dialog data-part="dialog"> part; the HOST carries no role/aria attribute', () => {
    const { el, dialog } = makeDrawer()
    expect(dialog).not.toBeNull()
    expect(dialog.tagName.toLowerCase()).toBe('dialog')
    expect(dialog.getAttribute('data-part')).toBe('dialog')
    expect(el.hasAttribute('role')).toBe(false)
    for (const attr of Array.from(el.attributes)) expect(attr.name.startsWith('aria-')).toBe(false)
    el.remove()
  })

  it('render() stays VOID — the dialog is the host’s only child; created ONCE across reconnect', () => {
    const { el } = makeDrawer()
    expect(el.querySelectorAll('dialog')).toHaveLength(1)
    expect(el.children).toHaveLength(1) // only the dialog — render() committed nothing
    el.remove()
    document.body.append(el) // reconnect re-runs connected()
    expect(el.querySelectorAll('dialog')).toHaveLength(1) // not re-created (idempotent guard)
    expect(el.children).toHaveLength(1)
    el.remove()
  })

  it('moves the drawer’s children into the dialog part, idempotently across a SECOND reconnect', () => {
    const { el, dialog } = makeDrawer('<h2>Title</h2><p>Body</p>')
    expect(dialog.querySelector('h2')?.textContent).toBe('Title')
    expect(dialog.querySelector('p')?.textContent).toBe('Body')
    expect(el.children).toHaveLength(1) // the dialog is the host's only child (content moved in)

    el.remove()
    document.body.append(el) // reconnect #1
    el.remove()
    document.body.append(el) // reconnect #2 — the child-move idempotence probe (ADR-0188 n5 accept predicate)
    expect(el.querySelectorAll('dialog')).toHaveLength(1)
    expect(dialog.querySelector('h2')?.textContent).toBe('Title') // content survived, not dropped or duplicated
    expect(dialog.querySelectorAll('h2')).toHaveLength(1)
    el.remove()
  })

  it('forwards an author aria-label onto the dialog part and strips it off the host (host stays aria-clean)', () => {
    const el = document.createElement('ui-drawer') as UIDrawerElement
    el.setAttribute('aria-label', 'Manage agents')
    el.setAttribute('aria-labelledby', 'heading-id')
    document.body.append(el)
    const dialog = dialogOf(el)
    expect(dialog.getAttribute('aria-label')).toBe('Manage agents')
    expect(dialog.getAttribute('aria-labelledby')).toBe('heading-id')
    expect(el.hasAttribute('aria-label')).toBe(false) // moved off the host (ADR-0017 cl.5)
    expect(el.hasAttribute('aria-labelledby')).toBe(false)
    el.remove()
  })
})

// ── open drives showModal()/close() ────────────────────────────

describe('ui-drawer — open drives showModal()/close()', () => {
  it('open=true calls showModal() (enters the top layer); open=false calls close()', async () => {
    const { el, dialog } = makeDrawer()
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

  it('an open-on-connect drawer calls showModal() once on connect (the effect’s first run)', async () => {
    const el = document.createElement('ui-drawer') as UIDrawerElement
    el.open = true // set BEFORE connect (property-wins) → the effect opens on connect
    document.body.append(el)
    await whenFlushed()
    const dialog = dialogOf(el)
    expect(callsOf(dialog).showModal).toBe(1)
    expect(dialog.open).toBe(true)
    el.remove()
  })

  it('a redundant open write does not re-enter the top layer (idempotent showModal guard)', async () => {
    const { el, dialog } = makeDrawer()
    el.open = true
    await whenFlushed()
    expect(callsOf(dialog).showModal).toBe(1)
    el.open = true // no transition — already open
    await whenFlushed()
    expect(callsOf(dialog).showModal).toBe(1) // not re-shown (the `if (dialog.open) return` guard)
    el.remove()
  })
})

// ── platform close → state sync + close/toggle emit, ORDERING pinned ─

describe('ui-drawer — platform close syncs open=false and emits close THEN toggle, exactly once', () => {
  it('a USER/platform close flips open=false and emits close BEFORE toggle, exactly once each (the two-way bind)', async () => {
    const { el, dialog } = makeDrawer()
    el.open = true
    await whenFlushed()

    const order: string[] = []
    el.addEventListener('close', () => order.push('close'))
    el.addEventListener('toggle', () => order.push('toggle'))

    simulatePlatformClose(dialog) // Escape / backdrop / external close
    expect(el.open).toBe(false) // state synced down
    expect(order).toEqual(['close', 'toggle']) // close fires BEFORE toggle, exactly once each
    el.remove()
  })

  it('a PROGRAMMATIC close (open=false) calls close() but emits NOTHING (the agent already knows)', async () => {
    const { el, dialog } = makeDrawer()
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

// ── persistent gates the cancel (Escape) dismissal ──────────────

describe('ui-drawer — persistent gates the cancel (Escape) dismissal', () => {
  it('default (not persistent) lets the cancel through; persistent=true preventDefaults it', async () => {
    const { el, dialog } = makeDrawer()
    el.open = true
    await whenFlushed()

    // default (not persistent) → the platform cancel is NOT blocked (Escape would close)
    expect(fireCancel(dialog).defaultPrevented).toBe(false)

    // persistent=true → the control blocks the cancel (the dialog stays open; no close follows)
    el.persistent = true
    await whenFlushed()
    expect(fireCancel(dialog).defaultPrevented).toBe(true)
    el.remove()
  })

  it('persistent also ignores a rect-wise backdrop click', async () => {
    const { el, dialog } = makeDrawer('<p>Body</p>', { persistent: '' })
    el.open = true
    await whenFlushed()
    // jsdom getBoundingClientRect defaults to all-zero — a click at (10,10) always lands OUTSIDE that rect,
    // i.e. the backdrop branch. persistent should ignore it (no close() call).
    dialog.dispatchEvent(new MouseEvent('click', { clientX: 10, clientY: 10 }))
    expect(callsOf(dialog).close).toBe(0)
    el.remove()
  })
})

// ── focus restore to the EXACT opener ───────────────────────────

describe('ui-drawer — focus restore on close', () => {
  it('restores focus to the EXACT opener on close (NC: not document.body)', async () => {
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()
    expect(document.activeElement).toBe(opener)

    const { el, dialog } = makeDrawer()
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

// ── zero residue — abort-owned listeners ───────────────────────

describe('ui-drawer — zero residue across connect/disconnect', () => {
  it('the dialog close listener is abort-owned — it dies on disconnect and re-wires exactly once on reconnect', async () => {
    const { el, dialog } = makeDrawer()
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

// ── edge prop reflection ────────────────────────────────────────

describe('ui-drawer — edge reflects to the attribute (the docking selector’s own contract)', () => {
  it('each edge member round-trips through the attribute', () => {
    const el = document.createElement('ui-drawer') as UIDrawerElement
    document.body.append(el)
    for (const edge of ['end', 'start', 'bottom'] as const) {
      el.edge = edge
      expect(el.getAttribute('edge')).toBe(edge)
      expect(el.edge).toBe(edge)
    }
    el.remove()
  })
})
