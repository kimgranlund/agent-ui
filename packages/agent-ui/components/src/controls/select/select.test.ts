import { describe, it, expect, beforeAll } from 'vitest'
import { whenFlushed } from '@agent-ui/components'
import { UISelectElement } from './select.ts'
import type { OverlayHandle } from '../../traits/overlay.ts'
import type { FormValue, ValidityResult, FieldLabelling } from '../../dom/index.ts'
import {
  splitFrontmatter,
  parseDescriptor,
  validateComponentDescriptor,
  compareDescriptorToProps,
  type ParsedAttribute,
} from '../../descriptor/component-descriptor.ts'
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// Wave-4 S4 jsdom probes — ui-select (decomp S4 · overlay-controller.lld.md LLD-C1..C4 · ADR-0043).
//
// jsdom reality: the native Popover API (`showPopover`/`hidePopover`, ToggleEvent) is absent in
// jsdom 29. We STUB it on `HTMLElement.prototype` (the sanctioned overlay-test pattern). The
// `ElementInternals` form-association surface (setFormValue / setValidity) is also absent — we
// stub it per-instance BEFORE connect (same pattern as checkbox.test.ts / text-field.test.ts).
// Form-value and validity are asserted via probe hooks that call the protected methods directly.
// The REAL top-layer / Escape / outside-click / form-round-trip / whole-shape behaviour is
// proven in select.browser.test.ts (Chromium + WebKit).
//
// Named probes:
//   select-upgrade · select-typed · select-define-guard · select-part-idempotent ·
//   select-trigger-attrs · select-open-effect · select-close-effect · select-open-noop ·
//   select-light-dismiss-sync · select-light-dismiss-events · select-programmatic-no-emit ·
//   select-aria-expanded · select-trigger-click (ADR-0101 erratum: mouse-click open must set the
//   `open` prop, not bypass it via a raw `handle.toggle()`; includes the ticket #28 click-open→
//   selection regression) · select-selection-click · select-selection-enter ·
//   select-value-two-way · select-label-reflects · select-placeholder ·
//   select-geometry (B2: anatomy structure + [size] attr + caret aria-hidden) ·
//   select-closed-arrow · select-disabled (B3: keyboard-inert + trigger-disabled) ·
//   select-form-value · select-form-validity · select-form-reset · select-c10-residue ·
//   select-c10-stacking · select-c10-cleanup · select-descriptor-schema ·
//   select-descriptor-bijection · select-descriptor-negative ·
//   select-aria-label-seam (ADR-0085: bare aria-labelledby concatenation · no aria-label ever ·
//   merge-not-clobber via setFieldLabelling · dissociation revert · aria-describedby wiring)

// ── Popover API stub (jsdom lacks it entirely — mirrors popover.test.ts setup) ─────────────────

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
    callsOf(this).show++
    if (popoverOpen.get(this)) return
    popoverOpen.set(this, true)
    fireToggle(this, 'open')
  }

  proto.hidePopover = function (this: HTMLElement): void {
    callsOf(this).hide++
    if (!popoverOpen.get(this)) return
    popoverOpen.set(this, false)
    fireToggle(this, 'closed')
  }
})

/** Simulate a platform light-dismiss (Escape / outside-click) without calling hidePopover. */
function simulateLightDismiss(panel: HTMLElement): void {
  popoverOpen.set(panel, false)
  fireToggle(panel, 'closed')
}

// ── Form-association stub (jsdom lacks setFormValue / setValidity) ────────────────────────────

/** Patch setFormValue/setValidity onto the reused internals so connect does not throw. */
function stubFormAssoc(internals: ElementInternals): void {
  const i = internals as unknown as Record<string, unknown>
  if (typeof i['setFormValue'] !== 'function') {
    i['setFormValue'] = (): void => {}
    i['setValidity'] = (): void => {}
  }
}

// ── Test probe subclass ───────────────────────────────────────────────────────────────────────

/**
 * Exposes the protected internals (for the form-association stub) and the overlay handle (for
 * C10 idempotent-cleanup probe), and the formValue/formValidity hooks (for direct assertion
 * without relying on the jsdom ElementInternals implementation).
 */
class ProbeSelect extends UISelectElement {
  get probeInternals(): ElementInternals {
    return this.internals
  }
  get overlayHandle(): OverlayHandle | null {
    return (this as unknown as { _overlayHandle: OverlayHandle | null })._overlayHandle
  }
  formValueProbe(): FormValue {
    return (this as unknown as { formValue(): FormValue }).formValue.call(this)
  }
  formValidityProbe(): ValidityResult {
    return (this as unknown as { formValidity(): ValidityResult }).formValidity.call(this)
  }
  formResetProbe(): void {
    ;(this as unknown as { formReset(): void }).formReset.call(this)
  }
}
customElements.define('ui-select-probe', ProbeSelect)

// ── Helpers ─────────────────────────────────────────────────────────────────────────────────

/** Stub DOMRects for the trigger/panel so the positioning math in overlay.ts does not fail. */
function stubRects(trigger: HTMLElement, panel: HTMLElement): void {
  trigger.getBoundingClientRect = () =>
    ({ left: 100, top: 100, right: 200, bottom: 140, width: 100, height: 40, x: 100, y: 100, toJSON: () => ({}) }) as DOMRect
  panel.getBoundingClientRect = () =>
    ({ left: 0, top: 0, right: 0, bottom: 0, width: 180, height: 120, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect
}

const STD_OPTIONS = `
  <div role="option" value="apple">Apple</div>
  <div role="option" value="banana">Banana</div>
  <div role="option" value="cherry">Cherry</div>
`

/**
 * Build and mount a ProbeSelect with standard options.
 * The form-association stub is applied BEFORE connect so UIFormElement's effects don't throw.
 */
function makeSelect(innerHTML = STD_OPTIONS): { el: ProbeSelect; trigger: HTMLElement; listbox: HTMLElement } {
  const el = new ProbeSelect()
  el.innerHTML = innerHTML
  stubFormAssoc(el.probeInternals) // stub BEFORE connect — form effects run on connectedCallback
  document.body.append(el)        // ← connect fires here; stub is already in place
  const trigger = el.querySelector<HTMLElement>('[data-part="trigger"]')!
  const listbox = el.querySelector<HTMLElement>('[data-part="listbox"]')!
  stubRects(trigger, listbox)
  return { el, trigger, listbox }
}

// ── Upgrade + typed prop surface ─────────────────────────────────────────────────────────────

describe('ui-select — upgrade + typed prop surface (select-upgrade)', () => {
  it('select-upgrade: upgrades to UISelectElement with default prop values (no connect needed)', () => {
    const el = document.createElement('ui-select') as UISelectElement
    expect(el).toBeInstanceOf(UISelectElement)
    expect(el.value).toBe('')
    expect(el.label).toBe('')
    expect(el.open).toBe(false)
    expect(el.placeholder).toBe('')
    expect(el.size).toBe('md')
    expect(el.name).toBe('')
    expect(el.disabled).toBe(false)
    expect(el.required).toBe(false)
  })

  it('select-typed: props have the correct types (compile-time NCs)', () => {
    const fn = (): void => {
      const el = new UISelectElement()
      el.value = 'apple'
      el.label = 'Scheme'
      el.open = true
      el.placeholder = 'Choose…'
      el.size = 'sm'
      el.size = 'lg'
      el.name = 'fruit'
      el.disabled = false
      el.required = true
      // @ts-expect-error — open is boolean, not string
      el.open = 'yes'
      // @ts-expect-error — disabled is boolean, not number
      el.disabled = 1
      // @ts-expect-error — size is a literal union (sm/md/lg), not a bare string
      el.size = 'xl'
    }
    expect(typeof fn).toBe('function') // never invoked — the @ts-expect-error lines are the assertion
  })

  it('select-define-guard: self-defines ui-select, guarded against a double-define', () => {
    expect(customElements.get('ui-select')).toBe(UISelectElement)
    expect(() => {
      if (!customElements.get('ui-select')) customElements.define('ui-select', UISelectElement)
    }).not.toThrow()
  })
})

// ── Control-created parts (idempotent) ──────────────────────────────────────────────────────

describe('ui-select — control-created parts (select-part-idempotent · select-trigger-attrs)', () => {
  it('select-part-idempotent: creates exactly ONE [data-part=listbox] and ONE [data-part=trigger] on connect', () => {
    const { el } = makeSelect()
    expect(el.querySelectorAll('[data-part="listbox"]')).toHaveLength(1)
    expect(el.querySelectorAll('[data-part="trigger"]')).toHaveLength(1)
    el.remove()
  })

  it('select-part-idempotent: [role=option] children are moved into the listbox panel at first connect', () => {
    const { el, listbox } = makeSelect()
    const options = listbox.querySelectorAll('[role=option]')
    expect(options).toHaveLength(3)
    expect(options[0].getAttribute('value')).toBe('apple')
    expect(options[2].getAttribute('value')).toBe('cherry')
    el.remove()
  })

  it('select-part-idempotent: the listbox and trigger are NOT re-created on disconnect + reconnect', () => {
    const { el } = makeSelect()
    const listboxBefore = el.querySelector('[data-part="listbox"]')
    const triggerBefore = el.querySelector('[data-part="trigger"]')
    el.remove()
    document.body.append(el)
    expect(el.querySelector('[data-part="listbox"]')).toBe(listboxBefore)
    expect(el.querySelector('[data-part="trigger"]')).toBe(triggerBefore)
    expect(el.querySelectorAll('[data-part="listbox"]')).toHaveLength(1)
    el.remove()
  })

  it('select-trigger-attrs: trigger has aria-haspopup="listbox" and aria-controls pointing to the listbox id', () => {
    const { el, trigger, listbox } = makeSelect()
    expect(trigger.getAttribute('aria-haspopup')).toBe('listbox')
    expect(listbox.id).toBeTruthy()
    expect(trigger.getAttribute('aria-controls')).toBe(listbox.id)
    el.remove()
  })

  it('select-trigger-attrs: trigger has type="button" to prevent form submission', () => {
    const { el, trigger } = makeSelect()
    expect(trigger.getAttribute('type')).toBe('button')
    el.remove()
  })

  it('select-trigger-attrs: listbox has role="listbox" (on the panel, not the host)', () => {
    const { el, listbox } = makeSelect()
    expect(listbox.getAttribute('role')).toBe('listbox')
    // Host must NOT carry a role attribute (logical wrapper, no ARIA role)
    expect(el.getAttribute('role')).toBeNull()
    el.remove()
  })

  it('select-trigger-attrs: listbox has popover="auto" (set by overlay controller)', () => {
    const { el, listbox } = makeSelect()
    expect(listbox.getAttribute('popover')).toBe('auto')
    el.remove()
  })

  it('select-trigger-attrs: listbox has tabindex="-1" for programmatic-focus fallback', () => {
    const { el, listbox } = makeSelect()
    expect(listbox.getAttribute('tabindex')).toBe('-1')
    el.remove()
  })
})

// ── Option groups (optgroup parity) ─────────────────────────────────────────────────────────

const GROUPED_OPTIONS = `
  <div role="group" label="Personal">
    <div role="option" value="free">Free</div>
    <div role="option" value="pro">Pro</div>
  </div>
  <div role="group" label="Business">
    <div role="option" value="team">Team</div>
    <div role="option" value="ent" aria-disabled="true">Enterprise</div>
  </div>
`

describe('ui-select — option groups (select-groups)', () => {
  it('select-groups: [role=group] containers move into the listbox with their nested options', () => {
    const { el, listbox } = makeSelect(GROUPED_OPTIONS)
    const groups = listbox.querySelectorAll<HTMLElement>(':scope > [role=group]')
    expect(groups.length).toBe(2)
    // all 4 options are reachable inside the panel (roving/selection query [role=option] nested)
    expect(listbox.querySelectorAll('[role=option]').length).toBe(4)
    el.remove()
  })

  it('select-groups: each group renders a NON-option header from its `label` (not focusable/selectable)', () => {
    const { el, listbox } = makeSelect(GROUPED_OPTIONS)
    const headers = listbox.querySelectorAll<HTMLElement>('[data-part="group-label"]')
    expect([...headers].map((h) => h.textContent)).toEqual(['Personal', 'Business'])
    // the header is NOT a [role=option] — rovingFocus/selectionCommit operate on options, so they skip it
    for (const h of headers) expect(h.getAttribute('role')).toBe(null)
    el.remove()
  })

  it('select-groups: the group is named for AT via aria-labelledby → its header; the `label` attr is consumed', () => {
    const { el, listbox } = makeSelect(GROUPED_OPTIONS)
    for (const group of listbox.querySelectorAll<HTMLElement>(':scope > [role=group]')) {
      const ref = group.getAttribute('aria-labelledby')
      expect(ref).toBeTruthy()
      const header = listbox.querySelector(`#${ref}`)
      expect(header?.getAttribute('data-part')).toBe('group-label')
      expect(group.hasAttribute('label')).toBe(false) // consumed → replaced by the visible header
    }
    el.remove()
  })

  it('select-groups: committing a grouped option sets the value + the trigger label (selection traverses groups)', async () => {
    const { el, listbox, trigger } = makeSelect(GROUPED_OPTIONS)
    el.open = true
    await whenFlushed()

    const team = listbox.querySelector<HTMLElement>('[value="team"]')!
    team.click()
    await whenFlushed()

    expect(el.value).toBe('team')
    expect(trigger.querySelector('[data-part="label"]')?.textContent).toBe('Team')
    el.remove()
  })
})

// ── Dynamic options (TKT-0026 — late-added Option/group adoption) ──────────────────────────────

describe('ui-select — dynamic options (select-dynamic-options)', () => {
  it('select-dynamic-options: an Option appended AFTER connect is adopted into the listbox panel', async () => {
    const { el, listbox } = makeSelect()
    const late = document.createElement('div')
    late.setAttribute('role', 'option')
    late.setAttribute('value', 'date')
    late.textContent = 'Date'
    el.append(late)
    await Promise.resolve() // MutationObserver callback is microtask-deferred
    await Promise.resolve()

    expect(late.parentElement).toBe(listbox)
    expect(listbox.querySelectorAll('[role=option]')).toHaveLength(4)
    el.remove()
  })

  it('select-dynamic-options: multiple late additions land in the panel in their authored (append) order', async () => {
    const { el, listbox } = makeSelect()
    for (const [value, label] of [['date', 'Date'], ['elderberry', 'Elderberry']] as const) {
      const opt = document.createElement('div')
      opt.setAttribute('role', 'option')
      opt.setAttribute('value', value)
      opt.textContent = label
      el.append(opt)
    }
    await Promise.resolve()
    await Promise.resolve()

    const values = [...listbox.querySelectorAll<HTMLElement>('[role=option]')].map((o) => o.getAttribute('value'))
    expect(values).toEqual(['apple', 'banana', 'cherry', 'date', 'elderberry'])
    el.remove()
  })

  it('select-dynamic-options: a late-added option becomes selectable — click commits value + trigger label', async () => {
    const { el, listbox, trigger } = makeSelect()
    const late = document.createElement('div')
    late.setAttribute('role', 'option')
    late.setAttribute('value', 'date')
    late.textContent = 'Date'
    el.append(late)
    await Promise.resolve()
    await Promise.resolve()

    listbox.querySelector<HTMLElement>('[value="date"]')!.click()
    await whenFlushed()

    expect(el.value).toBe('date')
    expect(trigger.querySelector('[data-part="label"]')?.textContent).toBe('Date')
    el.remove()
  })

  it('select-dynamic-options: a late [role=group] adopts with its nested options + renders a header', async () => {
    const { el, listbox } = makeSelect()
    const group = document.createElement('div')
    group.setAttribute('role', 'group')
    group.setAttribute('label', 'Berries')
    const opt = document.createElement('div')
    opt.setAttribute('role', 'option')
    opt.setAttribute('value', 'strawberry')
    opt.textContent = 'Strawberry'
    group.append(opt)
    el.append(group)
    await Promise.resolve()
    await Promise.resolve()

    expect(group.parentElement).toBe(listbox)
    expect(listbox.querySelectorAll('[role=option]')).toHaveLength(4)
    const header = listbox.querySelector('[data-part="group-label"]')
    expect(header?.textContent).toBe('Berries')
    expect(group.getAttribute('aria-labelledby')).toBe(header?.id)
    el.remove()
  })

  it('select-dynamic-options: removing an already-adopted option leaves the panel cleanly (no throw)', async () => {
    const { el, listbox } = makeSelect()
    const banana = listbox.querySelector<HTMLElement>('[value="banana"]')!
    expect(() => banana.remove()).not.toThrow()
    await Promise.resolve()
    await Promise.resolve()

    expect(listbox.querySelectorAll('[role=option]')).toHaveLength(2)
    expect(banana.isConnected).toBe(false)
    el.remove()
  })

  it('select-dynamic-options: adopting a late option never disturbs an existing committed selection', async () => {
    const { el, listbox, trigger } = makeSelect()
    el.value = 'banana'
    await whenFlushed()
    expect(trigger.querySelector('[data-part="label"]')?.textContent).toBe('Banana')

    const late = document.createElement('div')
    late.setAttribute('role', 'option')
    late.setAttribute('value', 'date')
    late.textContent = 'Date'
    el.append(late)
    await Promise.resolve()
    await Promise.resolve()

    expect(el.value).toBe('banana')
    expect(trigger.querySelector('[data-part="label"]')?.textContent).toBe('Banana')
    expect(listbox.querySelectorAll('[role=option]')).toHaveLength(4)
    el.remove()
  })

  it('select-dynamic-options: no double-move on reconnect — an already-adopted option is untouched', async () => {
    const { el, listbox } = makeSelect()
    const before = [...listbox.querySelectorAll('[role=option]')]

    el.remove()
    document.body.append(el)
    await Promise.resolve()
    await Promise.resolve()

    const newListbox = el.querySelector<HTMLElement>('[data-part="listbox"]')!
    expect(newListbox).toBe(listbox) // the panel itself persists across reconnect (idempotent parts)
    expect([...newListbox.querySelectorAll('[role=option]')]).toEqual(before) // same 3 nodes, same order
    expect(newListbox.querySelectorAll('[role=option]')).toHaveLength(3)
    el.remove()
  })

  it('select-dynamic-options: an option appended WHILE DISCONNECTED is adopted on the next reconnect', async () => {
    const { el, listbox } = makeSelect()
    el.remove() // no observer runs while disconnected

    const late = document.createElement('div')
    late.setAttribute('role', 'option')
    late.setAttribute('value', 'date')
    late.textContent = 'Date'
    el.append(late) // lands as a direct host child — no observer is armed to adopt it yet

    document.body.append(el) // reconnect: connected()'s explicit #syncOptions() call catches it
    await Promise.resolve()
    await Promise.resolve()

    expect(late.parentElement).toBe(listbox)
    expect(listbox.querySelectorAll('[role=option]')).toHaveLength(4)
    el.remove()
  })
})

// ── Two-way `open` — model→overlay ─────────────────────────────────────────────────────────

describe('ui-select — open prop → overlay handle (select-open-effect · select-close-effect · select-open-noop)', () => {
  it('select-open-effect: open=true → showPopover() called; open=false → hidePopover() called', async () => {
    const { el, listbox } = makeSelect()
    expect(callsOf(listbox).show).toBe(0)

    el.open = true
    await whenFlushed()
    expect(callsOf(listbox).show).toBe(1)
    expect(popoverOpen.get(listbox)).toBe(true)

    el.open = false
    await whenFlushed()
    expect(callsOf(listbox).hide).toBe(1)
    expect(popoverOpen.get(listbox)).toBe(false)
    el.remove()
  })

  it('select-open-noop: a redundant open=true write does not re-call showPopover (idempotent handle)', async () => {
    const { el, listbox } = makeSelect()
    el.open = true
    await whenFlushed()
    expect(callsOf(listbox).show).toBe(1)

    el.open = true // already open — handle.open() is a no-op
    await whenFlushed()
    expect(callsOf(listbox).show).toBe(1)
    el.remove()
  })
})

// ── Two-way `open` — overlay→model (light-dismiss) ─────────────────────────────────────────

describe('ui-select — overlay→model sync + events (select-light-dismiss-sync · select-light-dismiss-events)', () => {
  it('select-light-dismiss-sync: a platform light-dismiss flips open=false (two-way bind)', async () => {
    const { el, listbox } = makeSelect()
    el.open = true
    await whenFlushed()
    expect(el.open).toBe(true)

    simulateLightDismiss(listbox)
    expect(el.open).toBe(false)
    el.remove()
  })

  it('select-light-dismiss-events: a platform light-dismiss emits BOTH close and toggle from the host', async () => {
    const { el, listbox } = makeSelect()
    el.open = true
    await whenFlushed()

    let closes = 0
    let toggles = 0
    el.addEventListener('close', () => closes++)
    el.addEventListener('toggle', () => toggles++)

    simulateLightDismiss(listbox)
    expect(closes).toBe(1)
    expect(toggles).toBe(1)
    el.remove()
  })

  it('select-programmatic-no-emit: a programmatic close (open=false) DOES emit exactly one close+toggle pair (ADR-0101)', async () => {
    const { el, listbox } = makeSelect()
    el.open = true
    await whenFlushed()

    let closes = 0
    let toggles = 0
    el.addEventListener('close', () => closes++)
    el.addEventListener('toggle', () => toggles++)

    el.open = false
    await whenFlushed()
    expect(callsOf(listbox).hide).toBe(1)
    expect(closes).toBe(1) // the trait announces every real hide now, component-/model-driven included
    expect(toggles).toBe(1)
    el.remove()
  })
})

// ── aria-expanded sync ─────────────────────────────────────────────────────────────────────

describe('ui-select — aria-expanded stays in sync with open (select-aria-expanded)', () => {
  it('select-aria-expanded: trigger has aria-expanded="false" on connect', async () => {
    const { el, trigger } = makeSelect()
    await whenFlushed()
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    el.remove()
  })

  it('select-aria-expanded: aria-expanded flips to "true" when open, back to "false" when closed', async () => {
    const { el, trigger } = makeSelect()
    await whenFlushed()

    el.open = true
    await whenFlushed()
    expect(trigger.getAttribute('aria-expanded')).toBe('true')

    el.open = false
    await whenFlushed()
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    el.remove()
  })

  it('select-aria-expanded: light-dismiss resets aria-expanded to "false" via the subsequent effect re-run', async () => {
    const { el, trigger, listbox } = makeSelect()
    el.open = true
    await whenFlushed()
    expect(trigger.getAttribute('aria-expanded')).toBe('true')

    simulateLightDismiss(listbox) // open → false → schedules the effect
    await whenFlushed()           // effect runs: aria-expanded → 'false'
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    el.remove()
  })
})

// ── Selection via click ────────────────────────────────────────────────────────────────────

describe('ui-select — selection via click (select-selection-click · select-value-two-way)', () => {
  it('select-selection-click: clicking an option updates value + emits select + closes the panel', async () => {
    const { el, listbox } = makeSelect()
    el.open = true
    await whenFlushed()

    let selectCount = 0
    let lastDetail: unknown = null
    el.addEventListener('select', (e) => {
      selectCount++
      lastDetail = (e as CustomEvent).detail
    })

    const apple = listbox.querySelector<HTMLElement>('[value="apple"]')!
    apple.click()
    await whenFlushed()

    expect(selectCount).toBe(1)
    expect(lastDetail).toBe('apple')
    expect(el.value).toBe('apple')
    expect(el.open).toBe(false) // onSelect closes the panel
    el.remove()
  })

  it('select-value-two-way: setting value programmatically is reflected in the prop', async () => {
    const { el } = makeSelect()
    await whenFlushed()

    el.value = 'banana'
    expect(el.value).toBe('banana')
    el.remove()
  })
})

// ── Mouse-driven trigger open (the ADR-0101 erratum regression — the residual #28 defeat) ────────
//
// Every probe above opens via the PROGRAMMATIC prop (`el.open = true`), which never exercised the
// trigger's own click handler — the exact gap that let the mouse-click-open→handle.toggle() bypass
// ship undetected (3533 green tests, zero coverage of the primary mouse gesture).

describe('ui-select — mouse-click trigger open/close (select-trigger-click)', () => {
  it('select-trigger-click: clicking the trigger opens the panel and sets open===true', async () => {
    const { el, trigger, listbox } = makeSelect()
    expect(el.open).toBe(false)

    trigger.click()
    await whenFlushed()
    expect(el.open, 'a mouse-click open must set the reflected open prop').toBe(true)
    expect(callsOf(listbox).show).toBe(1)
    el.remove()
  })

  it('select-trigger-click: clicking the trigger again closes the panel — open===false, one close+toggle pair', async () => {
    const { el, trigger, listbox } = makeSelect()
    trigger.click()
    await whenFlushed()
    expect(el.open).toBe(true)

    let closes = 0
    let toggles = 0
    el.addEventListener('close', () => closes++)
    el.addEventListener('toggle', () => toggles++)

    trigger.click()
    await whenFlushed()
    expect(el.open, 'the second click must set open===false').toBe(false)
    expect(callsOf(listbox).hide).toBe(1)
    expect(closes).toBe(1)
    expect(toggles).toBe(1)
    el.remove()
  })

  it('select-trigger-click REGRESSION (ticket #28): click-open the trigger, then commit a selection — the panel must actually close', async () => {
    const { el, trigger, listbox } = makeSelect()

    // The exact reproduction: a MOUSE click opens the trigger (not the programmatic `el.open = true`
    // every other probe above uses) — before the fix, this left `el.open` stuck at `false` while the
    // panel was really open, so selectionCommit's later `this.open = false` was a same-value no-op.
    trigger.click()
    await whenFlushed()
    expect(el.open, 'precondition: mouse-open must set open===true').toBe(true)

    let closes = 0
    let toggles = 0
    el.addEventListener('close', () => closes++)
    el.addEventListener('toggle', () => toggles++)

    const apple = listbox.querySelector<HTMLElement>('[value="apple"]')!
    apple.click() // commit a selection (selectionCommit.onSelect sets this.open = false)
    await whenFlushed()

    expect(el.value).toBe('apple')
    expect(el.open, 'the panel must report closed after a post-mouse-open commit').toBe(false)
    expect(callsOf(listbox).hide, 'hidePopover() must actually fire — the bug: it never did').toBe(1)
    expect(closes, 'exactly one close event').toBe(1)
    expect(toggles, 'exactly one toggle event').toBe(1)
    el.remove()
  })
})

// ── Selection via keyboard (Enter on focused option) ─────────────────────────────────────

describe('ui-select — selection via Enter (select-selection-enter)', () => {
  it('select-selection-enter: Enter on a focused [role=option] commits the selection', async () => {
    const { el, listbox } = makeSelect()
    el.open = true
    await whenFlushed()

    let selectCount = 0
    el.addEventListener('select', () => selectCount++)

    // Simulate rovingFocus placing real DOM focus on an option in the listbox.
    const banana = listbox.querySelector<HTMLElement>('[value="banana"]')!
    banana.focus()

    // Dispatch a keydown Enter from the focused option (bubbles to the host).
    banana.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    await whenFlushed()

    expect(selectCount).toBe(1)
    expect(el.value).toBe('banana')
    expect(el.open).toBe(false)
    el.remove()
  })
})

// ── Trigger label reflects selected option ─────────────────────────────────────────────────

describe('ui-select — trigger label (select-label-reflects · select-placeholder)', () => {
  it('select-label-reflects: clicking an option updates the trigger label text', async () => {
    const { el, listbox } = makeSelect()
    el.open = true
    await whenFlushed()

    const cherry = listbox.querySelector<HTMLElement>('[value="cherry"]')!
    cherry.click()
    await whenFlushed()

    const label = el.querySelector<HTMLElement>('[data-part="label"]')!
    expect(label.textContent?.trim()).toBe('Cherry')
    el.remove()
  })

  it('select-label-reflects: setting value programmatically updates the trigger label', async () => {
    const { el } = makeSelect()
    await whenFlushed()

    el.value = 'banana'
    await whenFlushed()

    const label = el.querySelector<HTMLElement>('[data-part="label"]')!
    expect(label.textContent?.trim()).toBe('Banana')
    el.remove()
  })

  it('select-placeholder: the placeholder is shown on the trigger label when nothing is selected', async () => {
    const el = new ProbeSelect()
    el.innerHTML = '<div role="option" value="a">A</div>'
    el.placeholder = 'Pick one…'
    stubFormAssoc(el.probeInternals)
    document.body.append(el)
    await whenFlushed()

    const label = el.querySelector<HTMLElement>('[data-part="label"]')!
    expect(label.textContent).toBe('Pick one…')
    el.remove()
  })

  it('select-placeholder: label updates from placeholder to option text after selection', async () => {
    const el = new ProbeSelect()
    el.innerHTML = '<div role="option" value="opt1">Option 1</div>'
    el.placeholder = 'Choose…'
    stubFormAssoc(el.probeInternals)
    document.body.append(el)
    const listbox = el.querySelector<HTMLElement>('[data-part="listbox"]')!
    const trigger = el.querySelector<HTMLElement>('[data-part="trigger"]')!
    stubRects(trigger, listbox)
    await whenFlushed()

    expect(el.querySelector<HTMLElement>('[data-part="label"]')!.textContent).toBe('Choose…')

    el.value = 'opt1'
    await whenFlushed()
    expect(el.querySelector<HTMLElement>('[data-part="label"]')!.textContent?.trim()).toBe('Option 1')
    el.remove()
  })
})

// ── ADR-0085 — the trigger's accessible-name seam ────────────────────────────────────────────
//
// jsdom cannot compute an accessible name (no accname algorithm) — the read-back that the trigger's
// name really resolves to "label value" lives in select.browser.test.ts (both engines). These probes
// pin the DECLARED WIRING the browser proof depends on: the aria-labelledby id list, the aria-label
// absence guard (the value-erasure guard this ADR exists to prevent), the merge-not-clobber shape via
// a direct `setFieldLabelling` call (mirroring text-field's own jsdom-probe pattern — no live ui-field
// needed to exercise the seam), and the aria-describedby wiring.

describe('ui-select — the trigger accessible-name seam (select-aria-label-seam)', () => {
  it('select-aria-label-seam: no `label` set → no aria-labelledby on the trigger (back-compat, zero drift)', async () => {
    const { el, trigger } = makeSelect()
    await whenFlushed()
    expect(trigger.hasAttribute('aria-labelledby')).toBe(false)
    el.remove()
  })

  it('select-aria-label-seam: `label` set (bare, unfielded) → aria-labelledby = "<aria-label-span-id> <value-span-id>"', async () => {
    const { el, trigger } = makeSelect()
    el.label = 'Scheme'
    await whenFlushed()

    const ariaLabelSpan = el.querySelector<HTMLElement>('[data-part="aria-label"]')!
    const valueSpan = el.querySelector<HTMLElement>('[data-part="label"]')!
    expect(ariaLabelSpan.id).toBeTruthy()
    expect(valueSpan.id).toBeTruthy()
    expect(ariaLabelSpan.textContent).toBe('Scheme')
    expect(trigger.getAttribute('aria-labelledby')).toBe(`${ariaLabelSpan.id} ${valueSpan.id}`)
    el.remove()
  })

  it('select-aria-label-seam: clearing `label` back to \'\' removes aria-labelledby again', async () => {
    const { el, trigger } = makeSelect()
    el.label = 'Scheme'
    await whenFlushed()
    expect(trigger.hasAttribute('aria-labelledby')).toBe(true)

    el.label = ''
    await whenFlushed()
    expect(trigger.hasAttribute('aria-labelledby')).toBe(false)
    el.remove()
  })

  it('select-aria-label-seam: the value stays live in the id chain — selecting an option keeps the SAME aria-labelledby ids while the referenced text updates', async () => {
    const { el, trigger, listbox } = makeSelect()
    el.label = 'Scheme'
    await whenFlushed()
    const before = trigger.getAttribute('aria-labelledby')

    const apple = listbox.querySelector<HTMLElement>('[value="apple"]')!
    apple.click()
    await whenFlushed()

    expect(trigger.getAttribute('aria-labelledby')).toBe(before) // same two ids — no re-wiring needed
    expect(el.querySelector<HTMLElement>('[data-part="label"]')!.textContent?.trim()).toBe('Apple') // the referenced text moved
    el.remove()
  })

  it('select-aria-label-seam: the trigger NEVER carries aria-label (the value-erasure guard — a button has no distinct value AX property)', async () => {
    const { el, trigger } = makeSelect()
    el.label = 'Scheme'
    await whenFlushed()
    expect(trigger.hasAttribute('aria-label')).toBe(false)
    el.remove()
  })

  it('select-aria-label-seam: setFieldLabelling MERGES — aria-labelledby = "<field-label-id> <value-span-id>", never clobbering the value span', async () => {
    const { el, trigger } = makeSelect()
    el.label = 'Scheme' // a consumer-set bare label — must NOT survive into the merged (fielded) shape
    await whenFlushed()

    const fieldLabel = document.createElement('div')
    fieldLabel.id = 'field-label-42'
    const refs: FieldLabelling = { label: fieldLabel, description: null, error: null }
    el.setFieldLabelling(refs)
    await whenFlushed()

    const valueSpan = el.querySelector<HTMLElement>('[data-part="label"]')!
    expect(trigger.getAttribute('aria-labelledby')).toBe(`${fieldLabel.id} ${valueSpan.id}`)
    el.remove()
  })

  it('select-aria-label-seam: dissociation (setFieldLabelling(null)) reverts to the bare-mode state', async () => {
    const { el, trigger } = makeSelect()
    el.label = 'Scheme'
    await whenFlushed()
    const bareBefore = trigger.getAttribute('aria-labelledby')

    const fieldLabel = document.createElement('div')
    fieldLabel.id = 'field-label-43'
    el.setFieldLabelling({ label: fieldLabel, description: null, error: null })
    await whenFlushed()
    expect(trigger.getAttribute('aria-labelledby')).not.toBe(bareBefore) // merged shape while associated

    el.setFieldLabelling(null)
    await whenFlushed()
    expect(trigger.getAttribute('aria-labelledby')).toBe(bareBefore) // reverted to the SAME bare state
    el.remove()
  })

  it('select-aria-label-seam: aria-describedby wires from [description, error] refs while fielded, and clears on dissociation', async () => {
    const { el, trigger } = makeSelect()
    await whenFlushed()
    expect(trigger.hasAttribute('aria-describedby')).toBe(false) // no owner in bare mode (no internal message node)

    const description = document.createElement('div')
    description.id = 'field-desc-1'
    const error = document.createElement('div')
    error.id = 'field-error-1'
    el.setFieldLabelling({ label: null, description, error })
    await whenFlushed()
    expect(trigger.getAttribute('aria-describedby')).toBe(`${description.id} ${error.id}`)

    el.setFieldLabelling(null)
    await whenFlushed()
    expect(trigger.hasAttribute('aria-describedby')).toBe(false) // cleared — this control's exclusive owner in both directions
    el.remove()
  })
})

// ── Trigger geometry structure (B2: C6 geometry-law probes) ─────────────────────────────────────
//
// These probes assert the STRUCTURAL invariants of the Control-class trigger anatomy — things that
// can be verified in jsdom without a full CSS engine. The resolved-px geometry (height/font per
// [size], caret ≤ box in px) is proven in select.browser.test.ts (both engines). The §4.1 caret law
// (glyph = font, centred in the icon cell) is law-structural: the cell exists, is aria-hidden, and
// lives inside the trigger. The `padding-block: 0` CSS law and exact px are browser-proven (B4).

describe('ui-select — trigger geometry structure (select-geometry)', () => {
  it('select-geometry: trigger contains exactly ONE label span and ONE caret span (anatomy invariant)', () => {
    const { el, trigger } = makeSelect()
    const labels = trigger.querySelectorAll('[data-part="label"]')
    const carets = trigger.querySelectorAll('[data-part="caret"]')
    expect(labels).toHaveLength(1)
    expect(carets).toHaveLength(1)
    el.remove()
  })

  it('select-geometry: the caret span is aria-hidden (decorative glyph, not part of the accessible label)', () => {
    const { el, trigger } = makeSelect()
    const caret = trigger.querySelector('[data-part="caret"]')!
    expect(caret.getAttribute('aria-hidden')).toBe('true')
    el.remove()
  })

  it('select-geometry: label and caret are DIRECT children of the trigger (grid columns)', () => {
    const { el, trigger } = makeSelect()
    // The trigger is `display: inline-grid; grid-template-columns: 1fr auto` — the label and caret
    // must be direct children (not nested wrappers) to participate in the two-column grid.
    const label = trigger.querySelector('[data-part="label"]')!
    const caret = trigger.querySelector('[data-part="caret"]')!
    expect(label.parentElement).toBe(trigger)
    expect(caret.parentElement).toBe(trigger)
    el.remove()
  })

  it('select-geometry: size reflects JS-set values to the [size] host attribute (CSS hook) — T7 fix', () => {
    // size is a reactive, reflected prop (ADR-0081 T7 fix) driving the [size='sm'/'lg'] CSS
    // attribute selectors in select.css. In jsdom (no CSS resolution) we verify the reflect wire;
    // the resolved-px geometry (height/font/icon repoint) is proven in the browser smoke (B4).
    const { el } = makeSelect()
    expect(el.size).toBe('md')
    el.size = 'sm'
    expect(el.getAttribute('size')).toBe('sm')
    el.size = 'lg'
    expect(el.getAttribute('size')).toBe('lg')
    el.size = 'md'
    expect(el.getAttribute('size')).toBe('md')
    el.remove()
  })

  it('select-geometry: trigger has type="button" (structural Control-class invariant)', () => {
    const { el, trigger } = makeSelect()
    // The trigger is a <button> — `type="button"` prevents accidental form submission.
    expect(trigger.tagName.toLowerCase()).toBe('button')
    expect(trigger.getAttribute('type')).toBe('button')
    el.remove()
  })
})

// ── Closed-trigger Arrow key opens panel ─────────────────────────────────────────────────

describe('ui-select — closed-trigger keyboard (select-closed-arrow)', () => {
  it('select-closed-arrow: ArrowDown on the CLOSED trigger sets open=true', async () => {
    const { el, trigger } = makeSelect()
    await whenFlushed()
    expect(el.open).toBe(false)

    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }))
    await whenFlushed()
    expect(el.open).toBe(true)
    el.remove()
  })

  it('select-closed-arrow: ArrowUp on the CLOSED trigger sets open=true', async () => {
    const { el, trigger } = makeSelect()
    await whenFlushed()

    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }))
    await whenFlushed()
    expect(el.open).toBe(true)
    el.remove()
  })

  it('select-closed-arrow: Arrow on the OPEN trigger does NOT re-trigger open (guard: already open)', async () => {
    const { el, trigger, listbox } = makeSelect()
    el.open = true
    await whenFlushed()
    const showBefore = callsOf(listbox).show

    // The arrow-on-open-trigger guard: the handler checks `if (!this.open)` → skips when open
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }))
    await whenFlushed()
    // showPopover was NOT called again (still one from the initial open)
    expect(callsOf(listbox).show).toBe(showBefore)
    el.remove()
  })
})

// ── Disabled state (B3: C7 keyboard-inert + trigger-disabled gate) ───────────────────────────
//
// A disabled select MUST NOT open via keyboard or click. The trigger button's `disabled` attribute
// is set by a scope-owned effect in connected() that tracks effectiveDisabled() reactively.
// This keeps the trigger pointer-inert and keyboard-inert through the HTML disabled mechanism.

describe('ui-select — disabled state (select-disabled)', () => {
  it('select-disabled: ArrowDown on a disabled select does NOT open the panel', async () => {
    const { el, trigger } = makeSelect()
    el.disabled = true
    await whenFlushed()

    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }))
    await whenFlushed()

    expect(el.open, 'disabled select must not open on ArrowDown').toBe(false)
    el.remove()
  })

  it('select-disabled: ArrowUp on a disabled select does NOT open the panel', async () => {
    const { el, trigger } = makeSelect()
    el.disabled = true
    await whenFlushed()

    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }))
    await whenFlushed()

    expect(el.open, 'disabled select must not open on ArrowUp').toBe(false)
    el.remove()
  })

  it('select-disabled: click on a disabled select does NOT toggle the panel', async () => {
    const { el, trigger } = makeSelect()
    el.disabled = true
    await whenFlushed()

    trigger.click()
    await whenFlushed()

    expect(el.open, 'disabled select must not open on click').toBe(false)
    el.remove()
  })

  it('select-disabled: the trigger button has the `disabled` attribute when the select is disabled', async () => {
    const { el, trigger } = makeSelect()
    expect(trigger.hasAttribute('disabled'), 'trigger should NOT be disabled initially').toBe(false)

    el.disabled = true
    await whenFlushed()
    expect(trigger.hasAttribute('disabled'), 'trigger should have [disabled] when select is disabled').toBe(true)

    el.disabled = false
    await whenFlushed()
    expect(trigger.hasAttribute('disabled'), 'trigger should lose [disabled] when select is re-enabled').toBe(false)
    el.remove()
  })

  it('select-disabled: a disabled select still reports its value (disabled ≠ no value)', () => {
    const { el } = makeSelect()
    el.value = 'cherry'
    el.disabled = true
    // formValue() is unaffected by disabled — only submission exclusion is platform behaviour
    expect(el.formValueProbe()).toBe('cherry')
    el.remove()
  })
})

// ── Form seams (via probe hooks — jsdom ElementInternals lacks setFormValue/setValidity) ────

describe('ui-select — form seams (select-form-value · select-form-validity · select-form-reset)', () => {
  it('select-form-value: formValue() returns null when nothing is selected (value="")', () => {
    const { el } = makeSelect()
    expect(el.value).toBe('')
    expect(el.formValueProbe()).toBeNull()
    el.remove()
  })

  it('select-form-value: formValue() returns the selected key when value is set', async () => {
    const { el } = makeSelect()
    el.value = 'banana'
    expect(el.formValueProbe()).toBe('banana')
    el.remove()
  })

  it('select-form-validity: formValidity() → valueMissing when required + nothing selected', () => {
    const { el } = makeSelect()
    el.required = true
    const result = el.formValidityProbe()
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.flags.valueMissing).toBe(true)
    }
    el.remove()
  })

  it('select-form-validity: formValidity() → valid when required + a value is set', () => {
    const { el } = makeSelect()
    el.required = true
    el.value = 'apple'
    const result = el.formValidityProbe()
    expect(result.valid).toBe(true)
    el.remove()
  })

  it('select-form-validity: formValidity() → valid when NOT required + nothing selected', () => {
    const { el } = makeSelect()
    expect(el.required).toBe(false)
    const result = el.formValidityProbe()
    expect(result.valid).toBe(true)
    el.remove()
  })

  it('select-form-reset: formReset() restores value to "" (the unselected state)', async () => {
    const { el } = makeSelect()
    el.value = 'cherry'
    expect(el.value).toBe('cherry')

    el.formResetProbe() // calls the protected formReset() hook
    expect(el.value).toBe('')
    expect(el.formValueProbe()).toBeNull()
    el.remove()
  })
})

// ── C10 zero-residue ────────────────────────────────────────────────────────────────────────

describe('ui-select — C10 zero-residue (select-c10-residue · select-c10-stacking · select-c10-cleanup)', () => {
  it('select-c10-residue: after disconnect, a light-dismiss does NOT emit close/toggle (toggle listener removed)', async () => {
    const { el, listbox } = makeSelect()
    el.open = true
    await whenFlushed()

    let closes = 0
    el.addEventListener('close', () => closes++)

    el.remove() // disconnect → scope.dispose() → AC aborts → toggle listener dead

    simulateLightDismiss(listbox) // listener is dead — should not propagate
    expect(closes).toBe(0)
  })

  it('select-c10-stacking: reconnect does not stack listeners — close fires exactly ONCE per dismiss', async () => {
    const { el, listbox } = makeSelect()
    el.open = true
    await whenFlushed()

    let closes = 0
    el.addEventListener('close', () => closes++)

    simulateLightDismiss(listbox) // first dismiss while connected → 1 close
    expect(closes).toBe(1)

    // Re-open + reconnect cycle
    el.open = true
    await whenFlushed()
    el.remove()
    document.body.append(el)
    const newListbox = el.querySelector<HTMLElement>('[data-part="listbox"]')!
    const newTrigger = el.querySelector<HTMLElement>('[data-part="trigger"]')!
    stubRects(newTrigger, newListbox)

    el.open = true
    await whenFlushed()
    simulateLightDismiss(newListbox)
    expect(closes).toBe(2) // exactly ONE new listener — not doubled
    el.remove()
  })

  it('select-c10-cleanup: cleanup() is idempotent — safe to call multiple times without throwing', () => {
    const { el } = makeSelect()
    const probe = el
    expect(() => {
      probe.overlayHandle?.cleanup()
      probe.overlayHandle?.cleanup() // second call: `cleaned` is true — no throw
    }).not.toThrow()
    el.remove()
  })

  it('select-c10-cleanup: cleanup() on an open select closes the listbox and makes subsequent open() a no-op', async () => {
    const { el, listbox } = makeSelect()
    el.open = true
    await whenFlushed()
    expect(popoverOpen.get(listbox)).toBe(true)

    el.overlayHandle?.cleanup()
    expect(popoverOpen.get(listbox)).toBe(false)

    el.overlayHandle?.open() // `cleaned` guard → no-op
    expect(callsOf(listbox).show).toBe(1) // still only the original open
    el.remove()
  })
})

// ── Descriptor trip-wire ─────────────────────────────────────────────────────────────────────

const SELECT_DIR = `${process.cwd()}/packages/agent-ui/components/src/controls/select`
const md = readFileSync(`${SELECT_DIR}/select.md`, 'utf8') as string
const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)

// `extends: UIFormElement` is not yet in BASE_CLASSES (the integration slice s12 adds it). Tolerate
// exactly that ONE pending structural failure (same tolerance as modal/popover descriptor probes).

const ATTR_NAMES = ['name', 'disabled', 'required', 'value', 'label', 'open', 'placeholder', 'size']

describe('select.md descriptor — frontmatter parses + schema-valid (select-descriptor-schema)', () => {
  it('select-descriptor-schema: has a leading frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body.trim().length).toBeGreaterThan(0)
    expect(body).toContain('# ui-select')
  })

  it('select-descriptor-schema: carries the ADR-0004 / plan §10 descriptor field set', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing field: ${field}`).toBe(true)
  })

  it('select-descriptor-schema: tag=ui-select, tier=pattern, extends=UIFormElement, formAssociated=true', () => {
    expect(/^tag:\s*ui-select\s*$/m.test(fence)).toBe(true)
    expect(/^tier:\s*pattern\b/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIFormElement\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*true/.test(fence)).toBe(true)
  })

  it('select-descriptor-schema: records the bindable `value` (reflected string) + select/toggle/close events', () => {
    const value = parsed.attributes.find((a) => a.name === 'value')
    expect(value?.type).toBe('string')
    expect(value?.reflect).toBe(true)
    const events = (parsed.sequences.get('events') ?? []).map((i) => i.get('name'))
    expect(events).toContain('select')
    expect(events).toContain('toggle')
    expect(events).toContain('close')
  })

  it('select-descriptor-schema: validates with zero structural failures beyond the s12-pending BAD_EXTENDS for UIFormElement', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES) // anti-vacuous anchor
    const failures = validateComponentDescriptor(parsed)
    const pendingBaseClass = failures.filter((f) => f.code === 'BAD_EXTENDS' && f.path === 'extends')
    const otherFailures = failures.filter((f) => !(f.code === 'BAD_EXTENDS' && f.path === 'extends'))
    expect(otherFailures).toEqual([])
    expect(pendingBaseClass.length).toBeLessThanOrEqual(1)
  })
})

describe('select.md descriptor — contract↔props trip-wire (select-descriptor-bijection · select-descriptor-negative)', () => {
  it('select-descriptor-bijection: attributes[] is a faithful bijection with UISelectElement.props (0 drift)', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES) // anti-vacuous anchor
    expect(compareDescriptorToProps(parsed.attributes, UISelectElement.props)).toEqual([])
  })

  it('select-descriptor-negative: a drifted reflect FAILS the trip-wire', () => {
    const flipReflect: ParsedAttribute[] = parsed.attributes.map((a) =>
      a.name === 'value' ? { ...a, reflect: false } : { ...a },
    )
    expect(compareDescriptorToProps(flipReflect, UISelectElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_REFLECT', path: 'attributes.value.reflect' }),
    )
  })

  it('select-descriptor-negative: a removed attribute FAILS the trip-wire (bijection both ways)', () => {
    const dropOpen: ParsedAttribute[] = parsed.attributes.filter((a) => a.name !== 'open')
    expect(compareDescriptorToProps(dropOpen, UISelectElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_MISSING', path: 'attributes.open' }),
    )
  })

  it('select-descriptor-negative: an added attribute FAILS the trip-wire (extra in descriptor)', () => {
    const addBogus: ParsedAttribute[] = [
      ...parsed.attributes,
      { name: 'bogus', type: 'string', default: '', reflect: false },
    ]
    expect(compareDescriptorToProps(addBogus, UISelectElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_EXTRA', path: 'attributes.bogus' }),
    )
  })
})

// ── TKT-0027: listbox max-block-size is a public dial, default min(50vh, 12 option rows) ──────
// Token-chain proof (jsdom — the calc() itself is exercised for real in select.browser.test.ts,
// the 12-fit/13-scroll + 50vh-clamp cross-engine legs): the :where() token block declares the
// default expression (reusing --ui-select-height directly — the row-height law makes an option
// row == the trigger height exactly, no separate item-block token needed); the @scope listbox
// rule consumes the public dial (no hardcoded 40vh anywhere in the file).
const selectCss = readFileSync(`${SELECT_DIR}/select.css`, 'utf8') as string

describe('select.css — TKT-0027 listbox max-block-size dial (select-max-block-size-token-chain)', () => {
  it('select-max-block-size-token-chain: the 40vh magic number is gone from the property value', () => {
    expect(selectCss).not.toMatch(/max-block-size:\s*40vh/)
  })

  it('select-max-block-size-token-chain: --ui-select-listbox-max-block-size defaults to min(50vh, 12 option rows + 13 insets + the 2px border compensation)', () => {
    expect(selectCss).toMatch(
      /--ui-select-listbox-max-block-size:\s*min\(50vh,\s*calc\(12 \* var\(--ui-select-height\) \+ 13 \* var\(--ui-select-listbox-padding\) \+ 2px\)\)/,
    )
  })

  it('select-max-block-size-token-chain: the listbox rule consumes the public dial, not a literal', () => {
    const stylesBlock = selectCss.slice(selectCss.indexOf('@scope (ui-select)'))
    expect(stylesBlock).toMatch(/max-block-size:\s*var\(--ui-select-listbox-max-block-size\)/)
  })

  it('select-max-block-size-token-chain: the option row already sets line-height: 1 (the row-height law holds unchanged)', () => {
    const optionRule = (selectCss.match(/:scope > \[data-part='listbox'\] \[role='option'\]\s*\{[^}]*\}/) ?? [''])[0]
    expect(optionRule).toMatch(/line-height:\s*1;/)
  })
})
