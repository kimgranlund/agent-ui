// listbox-element.test.ts — UIListboxElement jsdom probes (ROV-C3).
//
// Tests through a minimal `ui-test-listbox` subclass (UIListboxElement has no abstract members).
// Options are light-DOM `<li role=option value=…>` children, matching the LLD contract.
// Form-association surface (setFormValue/setValidity) is stubbed before connect — identical to the
// pattern established in indicator-element.test.ts and range-element.test.ts.
//
// Named probes:
//   lb-role · lb-no-host-role
//   lb-roving-init · lb-roving-arrow-down · lb-roving-arrow-up · lb-roving-home-end
//   lb-select-click · lb-select-click-emits · lb-select-enter
//   lb-form-value-none · lb-form-value-single · lb-aria-selected
//   lb-multi-click · lb-multi-ctrl-click · lb-multi-enter-toggle · lb-form-value-multi
//   lb-required-empty · lb-required-filled
//   lb-reconnect

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { UIListboxElement } from './listbox-element.ts'
import type { FormValue, ValidityResult } from '../../dom/index.ts'

// ── minimal custom-element wrapper (UIListboxElement is a base; must be registered to connect) ───

class UITestListboxElement extends UIListboxElement {
  /** Expose the protected internals seam for ARIA + role assertions. */
  get testInternals(): ElementInternals {
    return this.internals
  }
}
customElements.define('ui-test-listbox', UITestListboxElement)

// ── jsdom stub: form-association surface (setFormValue/setValidity) is absent in jsdom ──────────

function stubFormAssoc(internals: ElementInternals): void {
  const i = internals as unknown as Record<string, unknown>
  if (typeof i['setFormValue'] !== 'function') {
    i['setFormValue'] = (): void => {}
    i['setValidity'] = (): void => {}
  }
}

// ── helpers ───────────────────────────────────────────────────────────────────────────────────────

function makeOption(value: string, label: string): HTMLElement {
  const li = document.createElement('li')
  li.setAttribute('role', 'option')
  li.setAttribute('value', value)
  li.textContent = label
  return li
}

/** Make a fresh test listbox with three options appended before connect. */
function make(multiple = false): UITestListboxElement {
  const el = new UITestListboxElement()
  stubFormAssoc(el.testInternals) // stub BEFORE connect — UIFormElement effects fire on connectedCallback
  if (multiple) el.multiple = true
  // Options appended before connect so rovingFocus initialises with the full set.
  el.append(makeOption('apple', 'Apple'), makeOption('banana', 'Banana'), makeOption('cherry', 'Cherry'))
  return el
}

type FormValueHook = { formValue(): FormValue }
type ValidityHook = { formValidity(): ValidityResult }

const formValue = (el: UIListboxElement): FormValue =>
  (el as unknown as FormValueHook).formValue.call(el)

const formValidity = (el: UIListboxElement): ValidityResult =>
  (el as unknown as ValidityHook).formValidity.call(el)

// ── LLD-C3: role ─────────────────────────────────────────────────────────────────────────────────

describe('UIListboxElement — LLD-C3 role', () => {
  let el: UITestListboxElement
  beforeEach(() => { el = make(); document.body.append(el) })
  afterEach(() => el.remove())

  it('lb-role: internals.role is "listbox"', () => {
    expect(el.testInternals.role).toBe('listbox')
  })

  it('lb-no-host-role: no role attribute on the host (FACE — ARIA via internals only)', () => {
    expect(el.getAttribute('role')).toBeNull()
  })
})

// ── LLD-C3: roving focus ─────────────────────────────────────────────────────────────────────────

describe('UIListboxElement — roving focus', () => {
  let el: UITestListboxElement
  let opts: HTMLElement[]

  beforeEach(() => {
    el = make()
    document.body.append(el)
    opts = [...el.querySelectorAll<HTMLElement>('[role=option]')]
  })
  afterEach(() => el.remove())

  it('lb-roving-init: first option gets tabindex=0 on connect; rest get -1', () => {
    expect(opts[0].tabIndex).toBe(0)
    expect(opts[1].tabIndex).toBe(-1)
    expect(opts[2].tabIndex).toBe(-1)
  })

  it('lb-roving-arrow-down: ArrowDown moves tabindex=0 + focus to the next option', () => {
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }))
    expect(document.activeElement).toBe(opts[1])
    expect(opts[1].tabIndex).toBe(0)
    expect(opts[0].tabIndex).toBe(-1)
  })

  it('lb-roving-arrow-up: ArrowUp from the first option wraps to the last (loop=true)', () => {
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }))
    expect(document.activeElement).toBe(opts[2])
    expect(opts[2].tabIndex).toBe(0)
    expect(opts[0].tabIndex).toBe(-1)
  })

  it('lb-roving-home-end: End moves to the last option; Home moves to the first', () => {
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }))
    expect(document.activeElement).toBe(opts[2])
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }))
    expect(document.activeElement).toBe(opts[0])
  })
})

// ── LLD-C3: selection — single mode ──────────────────────────────────────────────────────────────

describe('UIListboxElement — selection (single mode)', () => {
  let el: UITestListboxElement
  let opts: HTMLElement[]

  beforeEach(() => {
    el = make()
    document.body.append(el)
    opts = [...el.querySelectorAll<HTMLElement>('[role=option]')]
  })
  afterEach(() => el.remove())

  it('lb-form-value-none: formValue() is null before any selection', () => {
    expect(formValue(el)).toBeNull()
  })

  it('lb-select-click: clicking an option updates formValue() to that option\'s value', () => {
    opts[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(formValue(el)).toBe('apple')
  })

  it('lb-select-click-emits: click emits a `select` CustomEvent', () => {
    let count = 0
    el.addEventListener('select', () => count++)
    opts[1].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(count).toBe(1)
  })

  it('lb-form-value-single: formValue() returns the latest-clicked option\'s value', () => {
    opts[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(formValue(el)).toBe('apple')
    opts[2].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(formValue(el)).toBe('cherry')
  })

  it('lb-select-enter: Enter on the currently focused option commits its value', () => {
    opts[1].focus()
    let count = 0
    el.addEventListener('select', () => count++)
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    expect(count).toBe(1)
    expect(formValue(el)).toBe('banana')
  })

  it('lb-aria-selected: aria-selected reflects on committed item; others get "false"', () => {
    opts[1].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(opts[0].getAttribute('aria-selected')).toBe('false')
    expect(opts[1].getAttribute('aria-selected')).toBe('true')
    expect(opts[2].getAttribute('aria-selected')).toBe('false')
  })
})

// ── LLD-C3: selection — multi mode ───────────────────────────────────────────────────────────────

describe('UIListboxElement — selection (multi mode)', () => {
  let el: UITestListboxElement
  let opts: HTMLElement[]

  beforeEach(() => {
    el = make(true) // multiple=true
    document.body.append(el)
    opts = [...el.querySelectorAll<HTMLElement>('[role=option]')]
  })
  afterEach(() => el.remove())

  it('lb-multi-click: plain click replaces the selection with the clicked item', () => {
    opts[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(opts[0].getAttribute('aria-selected')).toBe('true')
    opts[1].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(opts[0].getAttribute('aria-selected')).toBe('false')
    expect(opts[1].getAttribute('aria-selected')).toBe('true')
  })

  it('lb-multi-ctrl-click: Ctrl+click toggles the clicked item without disturbing the anchor', () => {
    opts[0].dispatchEvent(new MouseEvent('click', { bubbles: true })) // anchor = apple
    opts[1].dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true })) // add banana
    expect(opts[0].getAttribute('aria-selected')).toBe('true')
    expect(opts[1].getAttribute('aria-selected')).toBe('true')
    expect(opts[2].getAttribute('aria-selected')).toBe('false')
  })

  it('lb-multi-enter-toggle: Enter toggles the focused option in/out of the selection Set', () => {
    // Select apple first to seed the Set.
    opts[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    // Focus banana and Enter-toggle it in.
    opts[1].focus()
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    expect(opts[0].getAttribute('aria-selected')).toBe('true')  // apple still in
    expect(opts[1].getAttribute('aria-selected')).toBe('true')  // banana toggled in
    // Enter-toggle banana out.
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    expect(opts[0].getAttribute('aria-selected')).toBe('true')  // apple still in
    expect(opts[1].getAttribute('aria-selected')).toBe('false') // banana toggled out
  })

  it('lb-form-value-multi: formValue() returns newline-joined selected keys', () => {
    opts[0].dispatchEvent(new MouseEvent('click', { bubbles: true })) // apple
    opts[1].dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true })) // + banana
    expect(formValue(el)).toBe('apple\nbanana')
  })

  it('lb-form-value-multi-none: formValue() is null when the multi selection is empty', () => {
    expect(formValue(el)).toBeNull()
  })
})

// ── LLD-C3: required + valueMissing ──────────────────────────────────────────────────────────────

describe('UIListboxElement — required + valueMissing', () => {
  let el: UITestListboxElement
  let opts: HTMLElement[]

  beforeEach(() => {
    el = make()
    el.required = true
    document.body.append(el)
    opts = [...el.querySelectorAll<HTMLElement>('[role=option]')]
  })
  afterEach(() => el.remove())

  it('lb-required-empty: required + nothing selected → formValidity() reports valueMissing', () => {
    const result = formValidity(el)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.flags.valueMissing).toBe(true)
  })

  it('lb-required-filled: required + selection present → formValidity() is valid', () => {
    opts[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(formValidity(el).valid).toBe(true)
  })

  it('lb-required-not-set: not required + no selection → formValidity() is valid', () => {
    el.required = false
    expect(formValidity(el).valid).toBe(true)
  })
})

// ── reconnect — zero residue ──────────────────────────────────────────────────────────────────────

describe('UIListboxElement — reconnect (zero residue)', () => {
  it('lb-reconnect: disconnect removes listeners; reconnect re-arms exactly once', () => {
    const el = make()
    document.body.append(el)
    const opts = [...el.querySelectorAll<HTMLElement>('[role=option]')]

    let selectCount = 0
    el.addEventListener('select', () => selectCount++)

    opts[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(selectCount).toBe(1) // selection listener active while connected

    el.remove() // disconnect → AbortController aborts → click listener removed from host
    opts[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(selectCount).toBe(1) // no increment — listener is gone

    document.body.append(el) // reconnect → connected() re-runs → fresh single set of listeners
    opts[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(selectCount).toBe(2) // exactly one new trigger — not a stacked double

    el.remove()
  })

  it('lb-reconnect-role: internals.role is re-applied on reconnect', () => {
    const el = make()
    document.body.append(el)
    expect(el.testInternals.role).toBe('listbox')
    el.remove()
    document.body.append(el)
    expect(el.testInternals.role).toBe('listbox')
    el.remove()
  })
})
