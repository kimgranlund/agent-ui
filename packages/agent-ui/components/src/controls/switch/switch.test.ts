import { describe, it, expect } from 'vitest'
import { UISwitchElement } from './switch.ts'
import {
  splitFrontmatter,
  parseDescriptor,
  validateComponentDescriptor,
  compareDescriptorToProps,
} from '../../descriptor/component-descriptor.ts'
// @ts-expect-error - node:fs is untyped without @types/node; vitest/node resolves it at runtime
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// S2 jsdom probes — ui-switch (indicator-element.lld.md LLD-C1..C4). Named probes:
//   switch-upgrades · switch-role-internals · switch-checked-round-trip · switch-form-value ·
//   switch-state-checked · switch-aria-checked · switch-toggle · switch-disabled-inert ·
//   switch-self-define · switch-zero-residue · switch-effects-residue
//
// jsdom stub — form-association surface (setFormValue/setValidity) is absent in jsdom.
// UIFormElement calls them synchronously on connect via scope-owned effects. Stub BEFORE connect
// (identical pattern to indicator-element.test.ts and form.test.ts).

class ProbeSwitch extends UISwitchElement {
  get probeInternals(): ElementInternals {
    return this.internals
  }
}
customElements.define('ui-switch-probe', ProbeSwitch)

/** Stub the form-association members absent in jsdom (setFormValue / setValidity) BEFORE connect. */
function stubFormAssoc(internals: ElementInternals): void {
  const i = internals as unknown as Record<string, unknown>
  if (typeof i['setFormValue'] !== 'function') {
    i['setFormValue'] = (): void => {}
    i['setValidity'] = (): void => {}
  }
}

/** Create a ProbeSwitch with stubbed form-association, ready to connect. */
function makeProbe(): ProbeSwitch {
  const el = new ProbeSwitch()
  stubFormAssoc(el.probeInternals) // stub BEFORE connect — effects fire on connectedCallback
  return el
}

const key = (el: Element, type: 'keydown' | 'keyup', k: string): void => {
  el.dispatchEvent(new KeyboardEvent(type, { key: k, bubbles: true, cancelable: true }))
}

describe('UISwitchElement (S2 jsdom probes)', () => {
  it('switch-upgrades: <ui-switch> upgrades to UISwitchElement; checked defaults false, value defaults "on"', () => {
    const el = makeProbe()
    document.body.append(el)
    expect(el).toBeInstanceOf(UISwitchElement)
    expect(el.checked).toBe(false)
    expect(el.value).toBe('on')
    expect(el.disabled).toBe(false)
    el.remove()
  })

  it('switch-role-internals: role is "switch" via internals; NO host role/aria-* attribute', () => {
    const el = makeProbe()
    document.body.append(el)
    expect(el.probeInternals.role).toBe('switch') // set via ElementInternals, never a host attr
    expect(el.getAttribute('role')).toBeNull()
    expect(el.hasAttribute('aria-checked')).toBe(false) // internals channel, not host attribute
    el.remove()
  })

  it('switch-checked-round-trip: checked reflects to/from attribute + JS prop', () => {
    const el = makeProbe()
    document.body.append(el)
    // JS set → reflects to attribute (reflect: true in indicatorProps)
    el.checked = true
    expect(el.hasAttribute('checked')).toBe(true)
    // attribute removal → JS prop false
    el.removeAttribute('checked')
    expect(el.checked).toBe(false)
    // attribute presence → JS prop true
    el.setAttribute('checked', '')
    expect(el.checked).toBe(true)
    el.remove()
  })

  it('switch-form-value: formValue() = value when checked, null when unchecked (checkbox semantics, LLD-C1)', () => {
    const el = makeProbe()
    document.body.append(el)
    // formValue() is protected; cast to reach it for the probe (same pattern as indicator-element.test.ts).
    const fv = (e: UISwitchElement): string | File | FormData | null =>
      (e as unknown as { formValue(): string | File | FormData | null }).formValue.call(e)

    expect(fv(el)).toBeNull() // unchecked → null (no form entry)
    el.checked = true
    expect(fv(el)).toBe('on') // checked + default value → 'on'
    el.value = 'enabled'
    expect(fv(el)).toBe('enabled') // checked + custom value
    el.checked = false
    expect(fv(el)).toBeNull() // unchecked again → null
    el.remove()
  })

  it('switch-state-checked: :state(checked) is set when checked=true, cleared when false (CustomStateSet)', () => {
    const el = makeProbe()
    document.body.append(el)
    const states = el.probeInternals.states
    if (!states) {
      // jsdom may not implement CustomStateSet; the browser smoke (switch.browser.test.ts) proves the state.
      // The checked-state effect in UIIndicatorElement still RUNS and sets ariaChecked (the jsdom-accessible proxy).
      el.remove()
      return
    }
    expect(states.has('checked')).toBe(false)
    el.checked = true
    expect(states.has('checked')).toBe(true)
    el.checked = false
    expect(states.has('checked')).toBe(false)
    el.remove()
  })

  it('switch-aria-checked: ariaChecked = "true" / "false" via internals (no "mixed" — switch is boolean only)', async () => {
    const el = makeProbe()
    document.body.append(el)
    await el.updateComplete
    // Unchecked → "false"
    expect(el.probeInternals.ariaChecked).toBe('false')

    el.checked = true
    await el.updateComplete
    expect(el.probeInternals.ariaChecked).toBe('true')

    el.checked = false
    await el.updateComplete
    expect(el.probeInternals.ariaChecked).toBe('false')

    // Switch is boolean only — never "mixed" (no indeterminate in the public API for ui-switch).
    expect(el.probeInternals.ariaChecked).not.toBe('mixed')
    el.remove()
  })

  it('switch-toggle: Space (keyup) toggles checked + emits change; Enter does NOT toggle (platform parity)', () => {
    const el = makeProbe()
    document.body.append(el)
    let changes = 0
    el.addEventListener('change', () => changes++)

    // Space (keydown + keyup) → pressActivation fires a click on keyup → UIIndicatorElement toggles
    key(el, 'keydown', ' ')
    key(el, 'keyup', ' ')
    expect(el.checked).toBe(true)
    expect(changes).toBe(1)

    // Space again → unchecked
    key(el, 'keydown', ' ')
    key(el, 'keyup', ' ')
    expect(el.checked).toBe(false)
    expect(changes).toBe(2)

    // Enter fires a click on keydown BUT UIIndicatorElement's Enter suppressor guards it — no toggle
    key(el, 'keydown', 'Enter')
    expect(el.checked).toBe(false) // unchanged
    expect(changes).toBe(2) // no additional change event

    // Direct click toggles
    el.click()
    expect(el.checked).toBe(true)
    expect(changes).toBe(3)
    el.remove()
  })

  it('switch-disabled-inert: disabled reflects to attribute; Space/click inert while disabled', async () => {
    const el = makeProbe()
    document.body.append(el)
    let changes = 0
    el.addEventListener('change', () => changes++)

    el.disabled = true
    expect(el.hasAttribute('disabled')).toBe(true) // reflects (reflect: true in formProps)

    // All activation paths must be inert while disabled
    key(el, 'keydown', ' ')
    key(el, 'keyup', ' ')
    key(el, 'keydown', 'Enter')
    el.click() // UIIndicatorElement click handler guards on effectiveDisabled()
    expect(el.checked).toBe(false) // never toggled
    expect(changes).toBe(0)

    // Re-enable → activation works again
    el.disabled = false
    await el.updateComplete
    el.click()
    expect(el.checked).toBe(true)
    expect(changes).toBe(1)
    el.remove()
  })

  it('switch-self-define: registered as ui-switch, guarded against double-define', () => {
    expect(customElements.get('ui-switch')).toBe(UISwitchElement)
    // The if-guard in switch.ts prevents the double-define throw
    expect(() => {
      if (!customElements.get('ui-switch')) customElements.define('ui-switch', UISwitchElement)
    }).not.toThrow()
  })
})

// ── descriptor trip-wire (contract↔props) ────────────────────────────────────────────────────────
//
// Two layers: (a) STRUCTURAL — validateComponentDescriptor reports ZERO failures.
//             (b) CONTRACT↔PROPS — compareDescriptorToProps finds ZERO drift with UISwitchElement.props.

const SW_DIR = `${process.cwd()}/packages/agent-ui/components/src/controls/switch`
const md = readFileSync(`${SW_DIR}/switch.md`, 'utf8') as string
const { fence } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)
// Attribute names in the order declared in switch.md frontmatter (used as anti-vacuous anchor).
const ATTR_NAMES = ['checked', 'value', 'size', 'name', 'disabled', 'required']

describe('switch.md descriptor — structural validity (s10 part a)', () => {
  it('carries the ADR-0004 / plan §10 descriptor field set as top-level keys', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing descriptor field: ${field}`).toBe(true)
  })

  it('tag=ui-switch, extends=UIIndicatorElement, tier=indicator, face.formAssociated=true', () => {
    expect(/^tag:\s*ui-switch\s*$/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIIndicatorElement\b/m.test(fence)).toBe(true)
    expect(/^tier:\s*indicator\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*true/.test(fence)).toBe(true)
  })

  it('validateComponentDescriptor reports ZERO structural failures (schema-valid)', () => {
    // anti-vacuous: all 6 attributes parse before the schema is consulted
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })
})

describe('switch.md descriptor — contract↔props trip-wire (s10 part b)', () => {
  it('attributes[] is a faithful bijection with UISwitchElement.props (0 drift)', () => {
    // anti-vacuous: all 6 attribute names parse before the trip-wire is consulted
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(compareDescriptorToProps(parsed.attributes, UISwitchElement.props)).toEqual([])
  })

  it('a drifted attribute FAILS the trip-wire (negative control — reflect + default)', () => {
    const flipReflect = parsed.attributes.map((a) => (a.name === 'size' ? { ...a, reflect: false } : { ...a }))
    expect(compareDescriptorToProps(flipReflect, UISwitchElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_REFLECT', path: 'attributes.size.reflect' }),
    )
    const flipDefault = parsed.attributes.map((a) => (a.name === 'value' ? { ...a, default: 'off' } : { ...a }))
    expect(compareDescriptorToProps(flipDefault, UISwitchElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_DEFAULT', path: 'attributes.value.default' }),
    )
  })

  it('a removed or added attribute FAILS the trip-wire (negative control — bijection both ways)', () => {
    const dropChecked = parsed.attributes.filter((a) => a.name !== 'checked')
    expect(compareDescriptorToProps(dropChecked, UISwitchElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_MISSING', path: 'attributes.checked' }),
    )
    const addBogus = [...parsed.attributes, { name: 'bogus', type: 'string', default: '', reflect: false }]
    expect(compareDescriptorToProps(addBogus, UISwitchElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_EXTRA', path: 'attributes.bogus' }),
    )
  })
})

describe('UISwitchElement — zero residue across connect/disconnect (C10)', () => {
  it('switch-zero-residue: disconnect removes listeners; reconnect re-wires exactly one set', () => {
    const el = makeProbe()
    let changes = 0
    el.addEventListener('change', () => changes++)

    // Connect → wires are live
    document.body.append(el)
    key(el, 'keydown', ' ')
    key(el, 'keyup', ' ')
    expect(el.checked).toBe(true)
    expect(changes).toBe(1)

    // Disconnect → connection AbortController aborts → all abort-owned listeners removed
    el.remove()
    // A click on the disconnected element dispatches but UIIndicatorElement's click handler was
    // registered via this.listen() (AbortSignal-owned) and has been removed on disconnect.
    el.click()
    expect(changes).toBe(1) // no new change — the click listener is gone

    // Reconnect → exactly ONE fresh connection scope re-wires the listeners
    document.body.append(el)
    key(el, 'keydown', ' ')
    key(el, 'keyup', ' ')
    expect(changes).toBe(2) // exactly ONE more — not stacked old + new
    el.remove()
  })

  it('switch-effects-residue: tabbable + ariaChecked effects die on disconnect, re-install once on reconnect', async () => {
    const el = makeProbe()
    document.body.append(el)
    await el.updateComplete
    expect(el.getAttribute('tabindex')).toBe('0') // tabbable effect installed (enabled → tab-reachable)

    // Disable while connected → tabbable removes tabindex, ariaDisabled set
    el.disabled = true
    await el.updateComplete
    expect(el.hasAttribute('tabindex')).toBe(false) // tabbable effect ran
    expect(el.probeInternals.ariaDisabled).toBe('true') // ariaDisabled effect ran

    // Disconnect → connection scope disposes → both effects die with it
    el.remove()
    el.disabled = false // mutate signal while disconnected
    await el.updateComplete // give any leaked effect a chance to flush

    // A leaked tabbable effect would re-add tabindex → assert it does NOT
    expect(el.hasAttribute('tabindex')).toBe(false)
    // A leaked ariaDisabled effect would clear it → assert it does NOT
    expect(el.probeInternals.ariaDisabled).toBe('true')

    // Reconnect → exactly one fresh pair re-installs
    document.body.append(el)
    expect(el.getAttribute('tabindex')).toBe('0') // re-enabled, tabindex restored
    expect(el.probeInternals.ariaDisabled).toBeNull() // re-enabled → omitted
    el.remove()
  })
})
