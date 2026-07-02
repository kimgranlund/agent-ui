// radio-group.test.ts — UIRadioGroupElement jsdom probes (Wave 1 S3).
//
// The S3 probes (per decomp): group exclusivity (selecting one clears siblings) · roving (Arrow/Home/End
// move selection+focus) · group formValue() · valueMissing (required, none selected) · Space/click commit.
// Also: ARIA role + roving tabindex setup · disabled + required round-trips · reconnect zero-residue.
//
// Named probes: group-role · group-exclusivity · group-form-value · group-value-missing ·
// group-roving-arrow-down · group-roving-arrow-up · group-roving-home · group-roving-end ·
// group-click-commit · group-space-commit · group-disabled-propagates · group-required-valid ·
// group-reconnect.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { UIRadioGroupElement } from './radio-group.ts'
import { UIRadioElement } from './radio.ts'
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

// ── jsdom stub — form-association surface absent in jsdom ─────────────────────────────────────────

function stubFormAssoc(internals: ElementInternals): void {
  const i = internals as unknown as Record<string, unknown>
  if (typeof i['setFormValue'] !== 'function') {
    i['setFormValue'] = (): void => {}
    i['setValidity'] = (): void => {}
  }
}

// Probe subclasses that expose the protected internals + form hook seams, plus an inspectable
// signal co-subscribed to the scope-owned form effect (the C10 residue probe).
class ProbeGroup extends UIRadioGroupElement {
  /** Inspectable probe signal; co-subscribed to the connection-scope form effect via formValue override. */
  readonly selectedSig = signal<string | null>(null)
  get testInternals(): ElementInternals {
    return this.internals
  }
  /** Override formValue to co-subscribe selectedSig — enables inspect(group.selectedSig).subscribers proof. */
  protected override formValue(): FormValue {
    void this.selectedSig.value // subscribe selectedSig to whatever effect reads formValue
    return super.formValue()   // delegate to the real implementation (reads #selectedValue)
  }
  /** Expose the protected formValue() result for direct assertion in tests. */
  get testFormValue(): string | null {
    return (this as unknown as { formValue(): string | null }).formValue.call(this) as string | null
  }
  /** Expose the protected formValidity() for direct assertion. */
  get testFormValidity(): { valid: boolean; flags?: { valueMissing?: boolean }; message?: string } {
    return (this as unknown as { formValidity(): { valid: boolean } }).formValidity.call(this) as {
      valid: boolean
      flags?: { valueMissing?: boolean }
      message?: string
    }
  }
}
if (!customElements.get('ui-radio-group-test')) customElements.define('ui-radio-group-test', ProbeGroup)

class ProbeRadio extends UIRadioElement {
  get testInternals(): ElementInternals {
    return this.internals
  }
}
if (!customElements.get('ui-radio-test')) customElements.define('ui-radio-test', ProbeRadio)

// ── factory helpers ───────────────────────────────────────────────────────────────────────────────

function makeGroup(required = false): ProbeGroup {
  const el = new ProbeGroup()
  if (required) el.required = true
  stubFormAssoc(el.testInternals)
  return el
}

function makeRadio(value: string, label = ''): ProbeRadio {
  const el = new ProbeRadio()
  el.value = value
  if (label) el.textContent = label
  stubFormAssoc(el.testInternals)
  return el
}

/** Build a group with N radios; each radio has value = `r${i+1}`. Returns [group, r1, r2, ...]. */
function buildGroup(n: number, required = false): [ProbeGroup, ...ProbeRadio[]] {
  const group = makeGroup(required)
  const radios = Array.from({ length: n }, (_, i) => makeRadio(`r${i + 1}`, `Option ${i + 1}`))
  for (const r of radios) group.append(r)
  document.body.append(group)
  return [group, ...radios] as [ProbeGroup, ...ProbeRadio[]]
}

// ── key + click helpers ───────────────────────────────────────────────────────────────────────────

const key = (el: Element, k: string): void => {
  el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }))
}

const click = (el: Element): void => {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
}

const spaceOn = (el: Element): void => {
  el.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }))
  el.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true, cancelable: true }))
}

// ── ARIA + tabindex setup ─────────────────────────────────────────────────────────────────────────

describe('UIRadioGroupElement — ARIA + tabindex setup', () => {
  let group: ProbeGroup
  let radios: ProbeRadio[]

  beforeEach(() => {
    const result = buildGroup(3)
    group = result[0]
    radios = result.slice(1) as ProbeRadio[]
  })
  afterEach(() => group.remove())

  it('group-role: internals.role is "radiogroup"; no host role attribute (FACE)', () => {
    expect(group.testInternals.role).toBe('radiogroup')
    expect(group.getAttribute('role')).toBeNull()
  })

  it('group-tabindex-init: rovingFocus seeds tabindex=0 on first radio; others get -1', () => {
    // No radio is checked → initialIndex falls back to 0 (first radio).
    expect(radios[0]!.tabIndex).toBe(0)
    expect(radios[1]!.tabIndex).toBe(-1)
    expect(radios[2]!.tabIndex).toBe(-1)
  })
})

// ── S3 probe: group exclusivity ───────────────────────────────────────────────────────────────────

describe('UIRadioGroupElement — group exclusivity', () => {
  let group: ProbeGroup
  let radios: ProbeRadio[]

  beforeEach(() => {
    const result = buildGroup(3)
    group = result[0]
    radios = result.slice(1) as ProbeRadio[]
  })
  afterEach(() => group.remove())

  it('group-exclusivity-click: clicking radio[1] checks it; radio[0] + radio[2] are cleared', () => {
    click(radios[1]!)
    expect(radios[0]!.checked).toBe(false)
    expect(radios[1]!.checked).toBe(true)
    expect(radios[2]!.checked).toBe(false)
  })

  it('group-exclusivity-switch: clicking radio[0] then radio[2] shifts selection; radio[0] clears', () => {
    click(radios[0]!)
    expect(radios[0]!.checked).toBe(true)
    click(radios[2]!)
    expect(radios[0]!.checked).toBe(false)
    expect(radios[1]!.checked).toBe(false)
    expect(radios[2]!.checked).toBe(true)
  })

  it('group-exclusivity-at-most-one: after any click exactly one radio is checked', () => {
    click(radios[0]!)
    click(radios[1]!)
    click(radios[2]!)
    const checkedCount = radios.filter((r) => r.checked).length
    expect(checkedCount).toBe(1)
    expect(radios[2]!.checked).toBe(true)
  })
})

// ── S3 probe: group formValue() ───────────────────────────────────────────────────────────────────

describe('UIRadioGroupElement — group formValue()', () => {
  let group: ProbeGroup
  let radios: ProbeRadio[]

  beforeEach(() => {
    const result = buildGroup(3)
    group = result[0]
    radios = result.slice(1) as ProbeRadio[]
  })
  afterEach(() => group.remove())

  it('group-form-value-initial: formValue() is null when no radio is checked', () => {
    expect(group.testFormValue).toBeNull()
  })

  it('group-form-value-click: formValue() returns the checked radio value after click', () => {
    click(radios[1]!)
    expect(group.testFormValue).toBe('r2')
  })

  it('group-form-value-switch: formValue() tracks the latest selection', () => {
    click(radios[0]!)
    expect(group.testFormValue).toBe('r1')
    click(radios[2]!)
    expect(group.testFormValue).toBe('r3')
  })
})

// ── S3 probe: valueMissing (required, none selected) ─────────────────────────────────────────────

describe('UIRadioGroupElement — valueMissing (required)', () => {
  afterEach(() => document.body.querySelectorAll('ui-radio-group-test').forEach((el) => el.remove()))

  it('group-value-missing-required: formValidity() returns valueMissing when required + no selection', () => {
    const result = buildGroup(3, true)
    const group = result[0]
    const validity = group.testFormValidity
    expect(validity.valid).toBe(false)
    expect(validity.flags?.valueMissing).toBe(true)
    expect(validity.message).toBe('Please select one of these options.')
    group.remove()
  })

  it('group-required-valid-after-select: formValidity() is valid after a radio is selected', () => {
    const result = buildGroup(3, true)
    const group = result[0]
    const radios = result.slice(1) as ProbeRadio[]
    click(radios[0]!)
    const validity = group.testFormValidity
    expect(validity.valid).toBe(true)
    group.remove()
  })

  it('group-value-missing-not-required: non-required group is always valid when empty', () => {
    const result = buildGroup(3, false)
    const group = result[0]
    const validity = group.testFormValidity
    expect(validity.valid).toBe(true)
    group.remove()
  })

  it('group-required-reflects: required attribute reflects to/from the prop', () => {
    const result = buildGroup(3, true)
    const group = result[0]
    expect(group.required).toBe(true)
    expect(group.hasAttribute('required')).toBe(true)
    group.remove()
  })
})

// ── S3 probe: click commit ────────────────────────────────────────────────────────────────────────

describe('UIRadioGroupElement — click commit', () => {
  let group: ProbeGroup
  let radios: ProbeRadio[]
  afterEach(() => group?.remove())

  beforeEach(() => {
    const result = buildGroup(3)
    group = result[0]
    radios = result.slice(1) as ProbeRadio[]
  })

  it('group-click-commit: clicking radio emits change on the GROUP (not just the radio)', () => {
    let groupChanges = 0
    group.addEventListener('change', () => groupChanges++)

    click(radios[1]!)
    // The individual radio's change event is consumed; the group re-emits its own.
    expect(groupChanges).toBe(1)
  })

  it('group-click-no-refire: clicking already-checked radio does NOT emit group change', () => {
    click(radios[0]!) // check radio[0]
    let groupChanges = 0
    group.addEventListener('change', () => groupChanges++)

    click(radios[0]!) // click again — guard suppresses base toggle, no change emitted
    expect(groupChanges).toBe(0)
  })
})

// ── S3 probe: Space commit ────────────────────────────────────────────────────────────────────────

describe('UIRadioGroupElement — Space commit', () => {
  let group: ProbeGroup
  let radios: ProbeRadio[]
  afterEach(() => group?.remove())

  beforeEach(() => {
    const result = buildGroup(3)
    group = result[0]
    radios = result.slice(1) as ProbeRadio[]
  })

  it('group-space-commit: Space on an unchecked radio checks it and emits group change', () => {
    let groupChanges = 0
    group.addEventListener('change', () => groupChanges++)

    spaceOn(radios[1]!)
    expect(radios[1]!.checked).toBe(true)
    expect(groupChanges).toBe(1)
  })

  it('group-space-exclusivity: Space on radio[1] clears radio[0] if previously checked', () => {
    click(radios[0]!) // check radio[0]
    spaceOn(radios[1]!) // Space on radio[1]
    expect(radios[0]!.checked).toBe(false)
    expect(radios[1]!.checked).toBe(true)
  })
})

// ── S3 probe: roving (Arrow/Home/End move selection+focus) ────────────────────────────────────────

describe('UIRadioGroupElement — roving (Arrow/Home/End)', () => {
  let group: ProbeGroup
  let radios: ProbeRadio[]
  afterEach(() => group?.remove())

  beforeEach(() => {
    const result = buildGroup(3)
    group = result[0]
    radios = result.slice(1) as ProbeRadio[]
  })

  it('group-roving-arrow-down: ArrowDown moves focus + selection to the next radio', () => {
    // Initial: no selection, roving cursor at index 0 (first). ArrowDown → index 1.
    key(group, 'ArrowDown')
    expect(radios[1]!.checked).toBe(true)
    expect(radios[0]!.checked).toBe(false)
    // tabindex=0 should now be on radio[1]
    expect(radios[1]!.tabIndex).toBe(0)
    expect(radios[0]!.tabIndex).toBe(-1)
  })

  it('group-roving-arrow-up: ArrowUp moves focus + selection to the previous radio (wraps)', () => {
    // Roving cursor at index 0 (initial). ArrowUp → wraps to index 2 (last).
    key(group, 'ArrowUp')
    expect(radios[2]!.checked).toBe(true)
    expect(radios[0]!.checked).toBe(false)
    expect(radios[2]!.tabIndex).toBe(0)
  })

  it('group-roving-home: Home moves focus + selection to the first radio', () => {
    // Select radio[2] first, then Home → back to radio[0].
    click(radios[2]!)
    key(group, 'Home')
    expect(radios[0]!.checked).toBe(true)
    expect(radios[2]!.checked).toBe(false)
    expect(radios[0]!.tabIndex).toBe(0)
  })

  it('group-roving-end: End moves focus + selection to the last radio', () => {
    // Initial cursor at 0. End → radio[2].
    key(group, 'End')
    expect(radios[2]!.checked).toBe(true)
    expect(radios[0]!.checked).toBe(false)
    expect(radios[2]!.tabIndex).toBe(0)
  })

  it('group-roving-wrap-down: ArrowDown from last radio wraps to first', () => {
    click(radios[2]!) // check last radio
    key(group, 'ArrowDown') // wrap
    expect(radios[0]!.checked).toBe(true)
    expect(radios[2]!.checked).toBe(false)
  })

  it('group-roving-form-value: form value updates on Arrow navigation', () => {
    key(group, 'ArrowDown') // 0 → 1
    expect(group.testFormValue).toBe('r2')
    key(group, 'ArrowDown') // 1 → 2
    expect(group.testFormValue).toBe('r3')
  })
})

// ── reconnect zero-residue ────────────────────────────────────────────────────────────────────────

describe('UIRadioGroupElement — reconnect zero-residue', () => {
  it('group-reconnect: after disconnect+reconnect, selection is preserved; listeners re-arm once', () => {
    const result = buildGroup(3)
    const group = result[0]
    const radios = result.slice(1) as ProbeRadio[]

    click(radios[1]!)
    expect(radios[1]!.checked).toBe(true)

    group.remove()

    // Reconnect — the group's connected() re-runs; it re-seeds from the currently-checked radio.
    document.body.append(group)

    // After reconnect, should still be able to change selection.
    click(radios[0]!)
    expect(radios[0]!.checked).toBe(true)
    expect(radios[1]!.checked).toBe(false)

    group.remove()
  })
})

// ── C7 — disabled group blocks child interaction (group-disabled-propagates) ─────────────────────

describe('UIRadioGroupElement — disabled-propagation (C7)', () => {
  it('group-disabled-propagates: a disabled group blocks click/Space and Arrow from committing selection', () => {
    const result = buildGroup(3)
    const group = result[0]
    const radios = result.slice(1) as ProbeRadio[]

    group.disabled = true
    let groupChanges = 0
    group.addEventListener('change', () => groupChanges++)

    // Click on an unchecked radio — the group's change listener returns early (effectiveDisabled guard).
    click(radios[0]!)
    expect(group.testFormValue).toBeNull()  // selection was NOT committed
    expect(groupChanges).toBe(0)            // no group-level change event

    // Arrow key — the rovingFocus onMove is guarded; no commit runs.
    key(group, 'ArrowDown')
    expect(group.testFormValue).toBeNull()
    expect(groupChanges).toBe(0)

    group.remove()
  })
})

// ── C10 — inspect(sig).subscribers === 0 post-disconnect (zero residue, signal proof) ───────────

describe('UIRadioGroupElement — C10 signal zero-residue (inspect)', () => {
  it('group-c10-inspect: selected-value signal has 0 subscribers after disconnect, 1 after reconnect', () => {
    const group = makeGroup()
    // Before connect: no scope → form effect not installed → 0 subscribers on the probe signal.
    expect(inspect(group.selectedSig).subscribers).toBe(0)

    document.body.append(group)
    // After connect: the scope-owned form effect reads formValue() → co-subscribes selectedSig.
    expect(inspect(group.selectedSig).subscribers).toBeGreaterThanOrEqual(1)

    group.remove()
    // After disconnect: scope.dispose() tears every form/control effect → 0 subscribers.
    expect(inspect(group.selectedSig).subscribers).toBe(0)

    document.body.append(group) // reconnect
    // Re-subscribed exactly once — not stacked from the old scope.
    expect(inspect(group.selectedSig).subscribers).toBe(1)
    group.remove()
  })
})

// ── formReset — group-level coordination (bug-A fix: Indicator controls never reset) ─────────────
//
// Each radio is its OWN UIFormElement participant with its OWN formResetCallback (indicator-element.ts,
// now fixed) that silently restores ITS checked ← defaultChecked. The GROUP owns a SEPARATE
// #selectedValue signal that no radio's own reset can reach — these probes cover the group's own
// formReset() override (radio-group.ts), which recomputes #selectedValue from every child's
// `defaultChecked` getter rather than live `checked` (so it is correct regardless of which of the two
// resets — the group's or its radios' — the platform runs first; the platform resets FACE members
// independently, in an order this suite must not assume).

describe('UIRadioGroupElement — formReset (bug-A fix: group-level coordination)', () => {
  it('group-reset-no-initial-selection: reset restores "nothing selected" when no radio was default-checked', () => {
    const [group, r1, r2, r3] = buildGroup(3)
    click(r2)
    expect(group.testFormValue).toBe('r2')

    // Simulate the platform resetting every FACE member independently (order unspecified).
    group.formResetCallback()
    r1.formResetCallback()
    r2.formResetCallback()
    r3.formResetCallback()

    expect(group.testFormValue).toBeNull()
    expect(r1.checked).toBe(false)
    expect(r2.checked).toBe(false)
    expect(r3.checked).toBe(false)
    group.remove()
  })

  it('group-reset-restores-initial-checked: reset restores the ORIGINALLY-checked radio, not the current selection', () => {
    const group = makeGroup()
    const r1 = makeRadio('r1')
    r1.setAttribute('checked', '') // markup-equivalent default — set before connect
    const r2 = makeRadio('r2')
    const r3 = makeRadio('r3')
    group.append(r1, r2, r3)
    document.body.append(group)

    expect(r1.checked).toBe(true) // seeded from markup (the group's existing connected()-time seed)
    expect(group.testFormValue).toBe('r1')

    click(r3) // user selects r3 instead
    expect(group.testFormValue).toBe('r3')
    expect(r1.checked).toBe(false)

    group.formResetCallback()
    r1.formResetCallback()
    r2.formResetCallback()
    r3.formResetCallback()

    expect(r1.checked).toBe(true)          // ← its own defaultChecked
    expect(r3.checked).toBe(false)         // ← its own defaultChecked (false)
    expect(group.testFormValue).toBe('r1') // ← the group's own recompute from defaultChecked

    group.remove()
  })

  it('group-reset-order-independent: the group\'s OWN reset alone (before any radio has reset) already recomputes correctly — no dependency on radios resetting first', () => {
    const group = makeGroup()
    const r1 = makeRadio('r1')
    r1.setAttribute('checked', '')
    const r2 = makeRadio('r2')
    group.append(r1, r2)
    document.body.append(group)

    click(r2) // select r2 instead of the default r1 — r1.checked is now false, r2.checked is true
    expect(group.testFormValue).toBe('r2')

    // ONLY the group resets — r1/r2 have NOT reset their own `checked` (still mid-transition: r2=true).
    group.formResetCallback()
    expect(group.testFormValue).toBe('r1') // already correct — read from r1.defaultChecked, not live checked

    group.remove()
  })

  it('group-reset-negative-control: nothing ever selected — reset is a no-op', () => {
    const [group, r1, r2, r3] = buildGroup(3)
    expect(group.testFormValue).toBeNull()
    group.formResetCallback()
    expect(group.testFormValue).toBeNull()
    expect(r1.checked).toBe(false)
    expect(r2.checked).toBe(false)
    expect(r3.checked).toBe(false)
    group.remove()
  })
})

// ── descriptor trip-wire (contract↔props) ────────────────────────────────────────────────────────
//
// Two layers: (a) STRUCTURAL — validateComponentDescriptor reports ZERO failures.
//             (b) CONTRACT↔PROPS — compareDescriptorToProps finds ZERO drift with UIRadioGroupElement.props.

const GROUP_DIR = `${process.cwd()}/packages/agent-ui/components/src/controls/radio`
const groupMd = readFileSync(`${GROUP_DIR}/radio-group.md`, 'utf8') as string
const { fence: groupFence } = splitFrontmatter(groupMd)
const groupParsed = parseDescriptor(groupFence)
// Attribute names in the order declared in radio-group.md frontmatter (anti-vacuous anchor).
const GROUP_ATTR_NAMES = ['name', 'disabled', 'required']

describe('radio-group.md descriptor — structural validity (s10 part a)', () => {
  it('carries the ADR-0004 / plan §10 descriptor field set as top-level keys', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(groupParsed.topLevelKeys.has(field), `missing descriptor field: ${field}`).toBe(true)
  })

  it('tag=ui-radio-group, extends=UIFormElement, tier=container, face.formAssociated=true', () => {
    expect(/^tag:\s*ui-radio-group\s*$/m.test(groupFence)).toBe(true)
    expect(/^extends:\s*UIFormElement\b/m.test(groupFence)).toBe(true)
    expect(/^tier:\s*container\b/m.test(groupFence)).toBe(true)
    expect(/formAssociated:\s*true/.test(groupFence)).toBe(true)
  })

  it('validateComponentDescriptor reports ZERO structural failures (schema-valid)', () => {
    // anti-vacuous: all 3 attributes parse before the schema is consulted
    expect(groupParsed.attributes.map((a) => a.name)).toEqual(GROUP_ATTR_NAMES)
    expect(validateComponentDescriptor(groupParsed)).toEqual([])
  })
})

describe('radio-group.md descriptor — contract↔props trip-wire (s10 part b)', () => {
  it('attributes[] is a faithful bijection with UIRadioGroupElement.props (0 drift)', () => {
    // anti-vacuous: all 3 attribute names parse before the trip-wire is consulted
    expect(groupParsed.attributes.map((a) => a.name)).toEqual(GROUP_ATTR_NAMES)
    expect(compareDescriptorToProps(groupParsed.attributes, UIRadioGroupElement.props)).toEqual([])
  })

  it('a drifted attribute FAILS the trip-wire (negative control — reflect + default)', () => {
    const flipReflect = groupParsed.attributes.map((a) => (a.name === 'disabled' ? { ...a, reflect: false } : { ...a }))
    expect(compareDescriptorToProps(flipReflect, UIRadioGroupElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_REFLECT', path: 'attributes.disabled.reflect' }),
    )
    const flipDefault = groupParsed.attributes.map((a) => (a.name === 'name' ? { ...a, default: 'bogus' } : { ...a }))
    expect(compareDescriptorToProps(flipDefault, UIRadioGroupElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_DEFAULT', path: 'attributes.name.default' }),
    )
  })

  it('a removed or added attribute FAILS the trip-wire (negative control — bijection both ways)', () => {
    const dropName = groupParsed.attributes.filter((a) => a.name !== 'name')
    expect(compareDescriptorToProps(dropName, UIRadioGroupElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_MISSING', path: 'attributes.name' }),
    )
    const addBogus = [...groupParsed.attributes, { name: 'bogus', type: 'string', default: '', reflect: false }]
    expect(compareDescriptorToProps(addBogus, UIRadioGroupElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_EXTRA', path: 'attributes.bogus' }),
    )
  })
})
