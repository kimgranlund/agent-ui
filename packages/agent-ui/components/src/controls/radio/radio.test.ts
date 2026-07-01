// radio.test.ts — UIRadioElement jsdom probes (Wave 1 S3).
//
// Tests the radio LEAF specifically: role, basic indicator inheritance, and the grouped() hook behavior.
// Tests are organized by the leaf's scope (role; basic value/ARIA; group-guard; standalone toggle).
// The shared UIIndicatorElement probes (toggle, disabled, reconnect, etc.) live in indicator-element.test.ts;
// this file probes only the radio-specific additions.
//
// Named probes: radio-role · radio-form-value-unchecked · radio-form-value-checked · radio-aria-checked ·
// radio-grouped-guard-checked · radio-grouped-guard-unchecked · radio-standalone-toggle ·
// radio-reflects-checked · radio-connect-disconnect.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { UIRadioElement } from './radio.ts'
import { UIRadioGroupElement } from './radio-group.ts'
import { signal, inspect } from '../../reactive/index.ts'
import type { FormValue } from '../../dom/form.ts'
import {
  splitFrontmatter,
  parseDescriptor,
  validateComponentDescriptor,
  compareDescriptorToProps,
} from '../../descriptor/component-descriptor.ts'
// @ts-expect-error - node:fs is untyped without @types/node; vitest/node resolves it at runtime
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// ── jsdom stub — form-association surface (setFormValue/setValidity) absent in jsdom ──────────────

function stubFormAssoc(internals: ElementInternals): void {
  const i = internals as unknown as Record<string, unknown>
  if (typeof i['setFormValue'] !== 'function') {
    i['setFormValue'] = (): void => {}
    i['setValidity'] = (): void => {}
  }
}

// Sub-element that exposes the protected `internals` seam for ARIA assertions, and carries an
// inspectable signal co-subscribed to the scope-owned form effect (the C10 residue probe).
class ProbeRadio extends UIRadioElement {
  /** Inspectable probe signal; co-subscribed to the connection-scope form effect via formValue override. */
  readonly checkedSig = signal(false)
  get testInternals(): ElementInternals {
    return this.internals
  }
  /** Read checkedSig inside the reactive formValue so it subscribes to the scope-owned form effect. */
  protected override formValue(): FormValue {
    void this.checkedSig.value // subscribe checkedSig to whatever effect reads formValue
    return this.checked ? this.value : null
  }
}
if (!customElements.get('ui-radio-probe')) customElements.define('ui-radio-probe', ProbeRadio)

class ProbeGroup extends UIRadioGroupElement {
  get testInternals(): ElementInternals {
    return this.internals
  }
  get testFormValue(): string | null {
    return (this as unknown as { formValue(): string | null }).formValue.call(this) as string | null
  }
}
if (!customElements.get('ui-radio-group-probe')) customElements.define('ui-radio-group-probe', ProbeGroup)

function makeRadio(value = 'on'): ProbeRadio {
  const el = new ProbeRadio()
  el.value = value
  stubFormAssoc(el.testInternals)
  return el
}

function makeGroup(): ProbeGroup {
  const el = new ProbeGroup()
  stubFormAssoc(el.testInternals)
  return el
}

// ── key-event helper ─────────────────────────────────────────────────────────────────────────────

const key = (el: Element, type: 'keydown' | 'keyup', k: string): void => {
  el.dispatchEvent(new KeyboardEvent(type, { key: k, bubbles: true, cancelable: true }))
}

const click = (el: Element): void => {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
}

// ── LLD-C2: ARIA role ────────────────────────────────────────────────────────────────────────────

describe('UIRadioElement — role (LLD-C2)', () => {
  let radio: ProbeRadio

  beforeEach(() => {
    radio = makeRadio()
    document.body.append(radio)
  })
  afterEach(() => radio.remove())

  it('radio-role: internals.role is "radio"; no host role attribute (FACE)', () => {
    expect(radio.testInternals.role).toBe('radio')
    expect(radio.getAttribute('role')).toBeNull()
  })

  it('radio-aria-checked-false: ariaChecked="false" on connect (unchecked default)', () => {
    expect(radio.testInternals.ariaChecked).toBe('false')
  })

  it('radio-aria-checked-true: ariaChecked="true" after checked becomes true', async () => {
    radio.checked = true
    await radio.updateComplete
    expect(radio.testInternals.ariaChecked).toBe('true')
  })
})

// ── LLD-C1: form value ───────────────────────────────────────────────────────────────────────────

describe('UIRadioElement — form value (LLD-C1)', () => {
  let radio: ProbeRadio

  beforeEach(() => {
    radio = makeRadio()
    document.body.append(radio)
  })
  afterEach(() => radio.remove())

  it('radio-form-value-unchecked: formValue() returns null when unchecked', () => {
    const fv = (radio as unknown as { formValue(): string | null }).formValue
    expect(fv.call(radio)).toBeNull()
  })

  it('radio-form-value-checked: formValue() returns this.value when checked', () => {
    radio.value = 'option-a'
    radio.checked = true
    const fv = (radio as unknown as { formValue(): string | null }).formValue
    expect(fv.call(radio)).toBe('option-a')
  })

  it('radio-reflects-checked: checked reflects to/from the attribute (boolean presence)', () => {
    expect(radio.getAttribute('checked')).toBeNull()
    radio.checked = true
    expect(radio.getAttribute('checked')).toBe('')
    radio.checked = false
    expect(radio.getAttribute('checked')).toBeNull()
  })
})

// ── LLD-C5: standalone toggle (no group parent) ──────────────────────────────────────────────────

describe('UIRadioElement — standalone toggle (no group parent)', () => {
  let radio: ProbeRadio

  beforeEach(() => {
    radio = makeRadio()
    document.body.append(radio)
  })
  afterEach(() => radio.remove())

  it('radio-standalone-toggle: click toggles unchecked → checked (no group, acts like checkbox)', () => {
    expect(radio.checked).toBe(false)
    click(radio)
    expect(radio.checked).toBe(true)
  })

  it('radio-standalone-toggle-back: click again unchecks (standalone: full checkbox semantics)', () => {
    click(radio)
    expect(radio.checked).toBe(true)
    click(radio)
    expect(radio.checked).toBe(false)
  })

  it('radio-standalone-space: Space keyup toggles unchecked → checked', () => {
    key(radio, 'keydown', ' ')
    key(radio, 'keyup', ' ')
    expect(radio.checked).toBe(true)
  })

  it('radio-standalone-enter-no-toggle: Enter does NOT toggle (platform parity)', () => {
    key(radio, 'keydown', 'Enter')
    expect(radio.checked).toBe(false)
  })
})

// ── LLD-C5: grouped() guard (inside a ui-radio-group) ───────────────────────────────────────────

describe('UIRadioElement — grouped() guard (inside ui-radio-group)', () => {
  let group: ProbeGroup
  let radio: ProbeRadio

  beforeEach(() => {
    group = makeGroup()
    radio = makeRadio('a')
    group.append(radio)
    document.body.append(group)
  })
  afterEach(() => group.remove())

  it('radio-grouped-guard-unchecked: clicking unchecked radio inside group checks it', () => {
    expect(radio.checked).toBe(false)
    click(radio)
    expect(radio.checked).toBe(true)
  })

  it('radio-grouped-guard-checked: clicking already-checked radio does NOT uncheck it (guard fires)', () => {
    radio.checked = true
    click(radio)
    // The capture-phase guard stops the base toggle from running, so checked stays true.
    expect(radio.checked).toBe(true)
  })

  it('radio-grouped-space-unchecked: Space on unchecked radio checks it', () => {
    key(radio, 'keydown', ' ')
    key(radio, 'keyup', ' ')
    expect(radio.checked).toBe(true)
  })

  it('radio-grouped-space-checked: Space on already-checked radio has no effect (guard)', () => {
    radio.checked = true
    key(radio, 'keydown', ' ')
    key(radio, 'keyup', ' ')
    expect(radio.checked).toBe(true)
  })
})

// ── connect / disconnect zero-residue ────────────────────────────────────────────────────────────

describe('UIRadioElement — connect/disconnect zero-residue', () => {
  it('radio-connect-disconnect: after disconnect, listeners are removed; reconnect re-arms once', () => {
    const radio = makeRadio()
    document.body.append(radio)

    click(radio)
    expect(radio.checked).toBe(true) // connected — listeners live

    radio.remove()
    radio.checked = false
    click(radio)
    expect(radio.checked).toBe(false) // disconnected — listeners gone

    document.body.append(radio) // reconnect
    click(radio)
    expect(radio.checked).toBe(true) // exactly one toggle, not doubled

    radio.remove()
  })
})

// ── C10 — inspect(sig).subscribers === 0 post-disconnect (zero residue, signal proof) ───────────

describe('UIRadioElement — C10 signal zero-residue (inspect)', () => {
  it('radio-c10-inspect: checked-state signal has 0 subscribers after disconnect, re-subscribes once on reconnect', () => {
    const radio = makeRadio()
    // Before connect: the form effect is not installed → no subscriber on the probe signal.
    expect(inspect(radio.checkedSig).subscribers).toBe(0)

    document.body.append(radio)
    // After connect: the scope-owned form effect reads formValue() → co-subscribes checkedSig.
    expect(inspect(radio.checkedSig).subscribers).toBeGreaterThanOrEqual(1)

    radio.remove()
    // After disconnect: scope.dispose() tears every form/control effect → 0 subscribers.
    expect(inspect(radio.checkedSig).subscribers).toBe(0)

    document.body.append(radio) // reconnect
    // Re-subscribed exactly once — not stacked from the old scope.
    expect(inspect(radio.checkedSig).subscribers).toBe(1)
    radio.remove()
  })
})

// ── descriptor trip-wire (contract↔props) ────────────────────────────────────────────────────────
//
// Two layers: (a) STRUCTURAL — validateComponentDescriptor reports ZERO failures.
//             (b) CONTRACT↔PROPS — compareDescriptorToProps finds ZERO drift with UIRadioElement.props.

const RADIO_DIR = `${process.cwd()}/packages/agent-ui/components/src/controls/radio`
const radioMd = readFileSync(`${RADIO_DIR}/radio.md`, 'utf8') as string
const { fence: radioFence } = splitFrontmatter(radioMd)
const radioParsed = parseDescriptor(radioFence)
// Attribute names in the order declared in radio.md frontmatter (anti-vacuous anchor).
const RADIO_ATTR_NAMES = ['checked', 'value', 'size', 'name', 'disabled', 'required']

describe('radio.md descriptor — structural validity (s10 part a)', () => {
  it('carries the ADR-0004 / plan §10 descriptor field set as top-level keys', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(radioParsed.topLevelKeys.has(field), `missing descriptor field: ${field}`).toBe(true)
  })

  it('tag=ui-radio, extends=UIIndicatorElement, tier=indicator, face.formAssociated=true', () => {
    expect(/^tag:\s*ui-radio\s*$/m.test(radioFence)).toBe(true)
    expect(/^extends:\s*UIIndicatorElement\b/m.test(radioFence)).toBe(true)
    expect(/^tier:\s*indicator\b/m.test(radioFence)).toBe(true)
    expect(/formAssociated:\s*true/.test(radioFence)).toBe(true)
  })

  it('validateComponentDescriptor reports ZERO structural failures (schema-valid)', () => {
    // anti-vacuous: all 6 attributes parse before the schema is consulted
    expect(radioParsed.attributes.map((a) => a.name)).toEqual(RADIO_ATTR_NAMES)
    expect(validateComponentDescriptor(radioParsed)).toEqual([])
  })
})

describe('radio.md descriptor — contract↔props trip-wire (s10 part b)', () => {
  it('attributes[] is a faithful bijection with UIRadioElement.props (0 drift)', () => {
    // anti-vacuous: all 6 attribute names parse before the trip-wire is consulted
    expect(radioParsed.attributes.map((a) => a.name)).toEqual(RADIO_ATTR_NAMES)
    expect(compareDescriptorToProps(radioParsed.attributes, UIRadioElement.props)).toEqual([])
  })

  it('a drifted attribute FAILS the trip-wire (negative control — reflect + default)', () => {
    const flipReflect = radioParsed.attributes.map((a) => (a.name === 'size' ? { ...a, reflect: false } : { ...a }))
    expect(compareDescriptorToProps(flipReflect, UIRadioElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_REFLECT', path: 'attributes.size.reflect' }),
    )
    const flipDefault = radioParsed.attributes.map((a) => (a.name === 'value' ? { ...a, default: 'off' } : { ...a }))
    expect(compareDescriptorToProps(flipDefault, UIRadioElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_DEFAULT', path: 'attributes.value.default' }),
    )
  })

  it('a removed or added attribute FAILS the trip-wire (negative control — bijection both ways)', () => {
    const dropChecked = radioParsed.attributes.filter((a) => a.name !== 'checked')
    expect(compareDescriptorToProps(dropChecked, UIRadioElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_MISSING', path: 'attributes.checked' }),
    )
    const addBogus = [...radioParsed.attributes, { name: 'bogus', type: 'string', default: '', reflect: false }]
    expect(compareDescriptorToProps(addBogus, UIRadioElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_EXTRA', path: 'attributes.bogus' }),
    )
  })
})
