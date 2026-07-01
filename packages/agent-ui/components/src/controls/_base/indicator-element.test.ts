// indicator-element.test.ts — UIIndicatorElement jsdom probes (IND-C1..C5).
//
// Tests through a minimal leaf subclass `ui-test-indicator` (static role='checkbox') — the real leaves
// (ui-checkbox · ui-switch · ui-radio) are later waves. The form-association surface (setFormValue /
// setValidity) is absent in jsdom and is stubbed before connect (identical to form.test.ts). ariaChecked
// is available via ARIAMixin on ElementInternals. CustomStateSet is absent in jsdom; state assertions are
// gated with a capability check (browser smoke covers it).
//
// NOTE: `indeterminate` is NOT tested here — it is checkbox-specific tri-state and lives on UICheckboxElement.
// The base owns only `checked`, `value`, `size`, and the binary ariaChecked ("true"/"false") state machine.
//
// Named probes: ind-checked-default · ind-size-default · ind-form-value · ind-role · ind-aria-checked ·
// ind-aria-states · ind-space-toggles · ind-enter-no-toggle · ind-click-toggles · ind-disabled-inert ·
// ind-tabindex · ind-reflect-checked · ind-reconnect.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { UIIndicatorElement } from './indicator-element.ts'

// ── minimal test subclass — the real leaves (checkbox/switch/radio) are later waves ──────────────

class UITestIndicatorElement extends UIIndicatorElement {
  static role = 'checkbox'
  /** Expose the protected internals seam for ARIA + role + state assertions. */
  get testInternals(): ElementInternals {
    return this.internals
  }
}
customElements.define('ui-test-indicator', UITestIndicatorElement)

// ── jsdom stub — form-association surface (setFormValue/setValidity) is absent in jsdom ──────────

function stubFormAssoc(internals: ElementInternals): void {
  // The form-association members (`setFormValue`, `setValidity`) are not implemented in jsdom.
  // The UIFormElement base calls them synchronously on connect via scope-owned effects.
  // Stub them once (before connect) so the effects do not throw.
  const i = internals as unknown as Record<string, unknown>
  if (typeof i['setFormValue'] !== 'function') {
    i['setFormValue'] = (): void => {}
    i['setValidity'] = (): void => {}
  }
}

function make(): UITestIndicatorElement {
  const el = new UITestIndicatorElement()
  stubFormAssoc(el.testInternals) // stub BEFORE connect — effects run on connectedCallback
  return el
}

// ── key-event helper ─────────────────────────────────────────────────────────────────────────────

const key = (el: Element, type: 'keydown' | 'keyup', k: string): KeyboardEvent => {
  const event = new KeyboardEvent(type, { key: k, bubbles: true, cancelable: true })
  el.dispatchEvent(event)
  return event
}

// ── LLD-C1: value ────────────────────────────────────────────────────────────────────────────────

describe('UIIndicatorElement — IND-C1 (value)', () => {
  let el: UITestIndicatorElement

  beforeEach(() => {
    el = make()
    document.body.append(el)
  })
  afterEach(() => el.remove())

  it('ind-checked-default: checked defaults false, value defaults "on"', () => {
    expect(el.checked).toBe(false)
    expect(el.value).toBe('on')
  })

  it('ind-size-default: size defaults "md" (the widget-box size axis, LLD-C4 / ADR-0041)', () => {
    expect(el.size).toBe('md')
  })

  it('ind-form-value-unchecked: formValue() returns null when unchecked', () => {
    // formValue() is protected; cast to reach it for the probe.
    const fv = (el as unknown as { formValue(): string | null }).formValue
    expect(fv.call(el)).toBeNull()
  })

  it('ind-form-value-checked: formValue() returns this.value when checked', () => {
    el.checked = true
    const fv = (el as unknown as { formValue(): string | null }).formValue
    expect(fv.call(el)).toBe('on')
  })

  it('ind-form-value-custom-value: formValue() uses the current value prop', () => {
    el.value = 'yes'
    el.checked = true
    const fv = (el as unknown as { formValue(): string | null }).formValue
    expect(fv.call(el)).toBe('yes')
  })

  it('ind-reflect-checked: JS-set checked reflects to/from the attribute (boolean presence)', () => {
    el.checked = true
    expect(el.getAttribute('checked')).toBe('') // boolean prop → empty-string presence
    el.checked = false
    expect(el.getAttribute('checked')).toBeNull()
  })

  it('ind-attribute-roundtrip: checked attribute round-trips back to the prop', () => {
    el.setAttribute('checked', '')
    expect(el.checked).toBe(true)
    el.removeAttribute('checked')
    expect(el.checked).toBe(false)
  })
})

// ── LLD-C2: ARIA + state machine ─────────────────────────────────────────────────────────────────

describe('UIIndicatorElement — IND-C2 (ARIA + state machine)', () => {
  let el: UITestIndicatorElement

  beforeEach(() => {
    el = make()
    document.body.append(el)
  })
  afterEach(() => el.remove())

  it('ind-role: internals.role matches static role; no host role attribute', () => {
    expect(el.testInternals.role).toBe('checkbox')
    expect(el.getAttribute('role')).toBeNull() // FACE: ARIA via internals only
  })

  it('ind-aria-checked-false: ariaChecked="false" on connect (unchecked)', () => {
    // The state effect runs synchronously on first connect.
    expect(el.testInternals.ariaChecked).toBe('false')
  })

  it('ind-aria-checked-true: ariaChecked="true" when checked flips true', async () => {
    el.checked = true
    await el.updateComplete // effects are microtask-batched
    expect(el.testInternals.ariaChecked).toBe('true')
  })

  it('ind-aria-checked-false-restore: ariaChecked="false" when checked flips back to false', async () => {
    el.checked = true
    await el.updateComplete
    el.checked = false
    await el.updateComplete
    expect(el.testInternals.ariaChecked).toBe('false')
  })

  it('ind-aria-states-checked: :state(checked) present when checked, absent otherwise', async () => {
    // CustomStateSet is absent in jsdom — capability-gated; browser smoke covers the real assertion.
    el.checked = true
    await el.updateComplete
    expect(el.testInternals.ariaChecked).toBe('true') // ariaChecked is the jsdom-accessible proxy
    if (el.testInternals.states) {
      expect(el.testInternals.states.has('checked')).toBe(true)
      // NOTE: 'indeterminate' state is not managed at the base level (checkbox-only); the base
      // only manages 'checked'. No assertion on 'indeterminate' here.
    }

    el.checked = false
    await el.updateComplete
    if (el.testInternals.states) {
      expect(el.testInternals.states.has('checked')).toBe(false)
    }
  })
})

// ── LLD-C3: toggle ────────────────────────────────────────────────────────────────────────────────

describe('UIIndicatorElement — IND-C3 (toggle)', () => {
  let el: UITestIndicatorElement

  beforeEach(() => {
    el = make()
    document.body.append(el)
  })
  afterEach(() => el.remove())

  it('ind-space-toggles: Space keyup toggles checked (Space keydown does NOT, parity with pressActivation)', () => {
    expect(el.checked).toBe(false)
    key(el, 'keydown', ' ') // preventDefaults scroll, does NOT activate yet
    expect(el.checked).toBe(false)
    key(el, 'keyup', ' ') // activates on keyup → host.click() → toggle
    expect(el.checked).toBe(true)
  })

  it('ind-enter-no-toggle: Enter keydown does NOT toggle checked (platform checkbox parity)', () => {
    expect(el.checked).toBe(false)
    key(el, 'keydown', 'Enter') // pressActivation fires host.click() — suppressed by the guard
    expect(el.checked).toBe(false)
  })

  it('ind-click-toggles: mouse click toggles checked from false → true → false', () => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(el.checked).toBe(true)
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(el.checked).toBe(false)
  })

  it('ind-click-emits: click emits input + change on the same tick', () => {
    let inputCount = 0
    let changeCount = 0
    el.addEventListener('input', () => inputCount++)
    el.addEventListener('change', () => changeCount++)

    el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(inputCount).toBe(1)
    expect(changeCount).toBe(1)
  })

  it('ind-space-emits: Space keyup also emits input + change', () => {
    let inputCount = 0
    let changeCount = 0
    el.addEventListener('input', () => inputCount++)
    el.addEventListener('change', () => changeCount++)

    key(el, 'keydown', ' ')
    key(el, 'keyup', ' ')
    expect(inputCount).toBe(1)
    expect(changeCount).toBe(1)
  })

  it('ind-disabled-inert-click: disabled element does not toggle on click', () => {
    el.disabled = true
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(el.checked).toBe(false)
  })

  it('ind-disabled-inert-space: disabled element does not toggle on Space', () => {
    el.disabled = true
    key(el, 'keydown', ' ')
    key(el, 'keyup', ' ') // pressActivation sees disabled() → no host.click()
    expect(el.checked).toBe(false)
  })

  it('ind-tabindex-enabled: enabled indicator is keyboard-focusable (tabindex=0)', () => {
    expect(el.getAttribute('tabindex')).toBe('0')
  })

  it('ind-tabindex-disabled: disabled indicator leaves the tab order (no tabindex attribute)', async () => {
    el.disabled = true
    await el.updateComplete // tabbable effect is reactive → microtask flush
    expect(el.hasAttribute('tabindex')).toBe(false)
  })
})

// ── reconnect — zero residue ──────────────────────────────────────────────────────────────────────

describe('UIIndicatorElement — reconnect (zero residue)', () => {
  it('ind-reconnect-toggle: after disconnect listeners are gone; reconnect re-arms exactly once', () => {
    const el = make()
    document.body.append(el)

    key(el, 'keydown', ' ')
    key(el, 'keyup', ' ')
    expect(el.checked).toBe(true) // live while connected

    el.remove() // disconnect → abort → listeners removed
    el.checked = false // reset
    key(el, 'keydown', ' ')
    key(el, 'keyup', ' ')
    expect(el.checked).toBe(false) // listeners gone — no toggle

    document.body.append(el) // reconnect → connected() re-runs → single fresh set
    key(el, 'keydown', ' ')
    key(el, 'keyup', ' ')
    expect(el.checked).toBe(true) // exactly one toggle — not a stacked double

    el.remove()
  })

  it('ind-reconnect-aria: state effect re-runs on reconnect with current checked value', async () => {
    const el = make()
    el.checked = true
    document.body.append(el)
    expect(el.testInternals.ariaChecked).toBe('true') // initial sync run

    el.remove()
    document.body.append(el) // reconnect → effect reinstalls + runs synchronously
    expect(el.testInternals.ariaChecked).toBe('true') // re-applied from current signal value
    el.remove()
  })
})
