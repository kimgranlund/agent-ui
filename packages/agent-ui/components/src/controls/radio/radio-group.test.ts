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

  it('group-tabindex-late-append: a radio appended to an ALREADY-connected group is not a second tab stop', () => {
    // The radio.ts grouped() tabindex correction's load-bearing case (TKT-0068 item 3, measured):
    // rovingFocus's applyTabindexes ran at GROUP connect, before this radio existed — it never
    // stamped `data-roving` here, so the tabbable trait's tabIndex=0 write is NOT deferred. Without
    // the correction the late joiner keeps 0 and the group grows a second tab stop. (Disabling the
    // correction flips exactly this assertion; every other radio-family test stays green — the
    // mutation probe that motivated this test.)
    const late = makeRadio('r-late', 'Late option')
    group.append(late)
    expect(late.tabIndex).toBe(-1)
    // The seeded roving stop is untouched.
    expect(radios[0]!.tabIndex).toBe(0)
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

// ── orientation reflected prop (ADR-0086; `variant` retired by ADR-0095) ──────────────────────────

describe('UIRadioGroupElement — orientation reflected prop', () => {
  let group: ProbeGroup
  afterEach(() => group?.remove())

  it('carries no `variant` prop at all (ADR-0095 clause 1 — retired, not a live accessor)', () => {
    group = makeGroup()
    document.body.append(group)
    expect((group as unknown as Record<string, unknown>)['variant']).toBeUndefined()
    expect('variant' in UIRadioGroupElement.props).toBe(false)
  })

  it('orientation-default: orientation defaults to "vertical"', () => {
    group = makeGroup()
    document.body.append(group)
    expect(group.orientation).toBe('vertical')
    expect(group.getAttribute('orientation')).toBe('vertical')
  })

  it('orientation-reflects: setting orientation="horizontal" reflects the attribute', () => {
    group = makeGroup()
    document.body.append(group)
    group.orientation = 'horizontal'
    expect(group.getAttribute('orientation')).toBe('horizontal')
  })
})

// ── the class-derived orientation default, resolved ONCE at connect (ADR-0095 clause 1) ───────────

describe('UIRadioGroupElement — resolved-orientation-at-connect (class-derived default)', () => {
  afterEach(() => document.body.querySelectorAll('ui-radio-group-test').forEach((el) => el.remove()))

  it('resolve-base-default: with no explicit orientation, resolves to this base class\'s default (vertical)', () => {
    const group = makeGroup()
    document.body.append(group)
    expect(group.orientation).toBe('vertical')
    group.remove()
  })

  it('resolve-author-wins: an explicit orientation="horizontal" set before connect is NOT overridden', () => {
    const group = new ProbeGroup()
    group.orientation = 'horizontal' // author-set BEFORE connect — must win over the class-derived default
    stubFormAssoc(group.testInternals)
    expect(group.hasAttribute('orientation')).toBe(true) // anti-vacuous: the author's explicit set already reflected
    document.body.append(group)
    expect(group.orientation).toBe('horizontal') // NOT reset to the base default
    group.remove()
  })

  it('resolve-html-authored: markup `<ui-radio-group orientation="horizontal">` honours the explicit attribute', () => {
    const group = document.createElement('ui-radio-group-test') as ProbeGroup
    group.setAttribute('orientation', 'horizontal')
    stubFormAssoc(group.testInternals)
    document.body.append(group)
    expect(group.orientation).toBe('horizontal')
    group.remove()
  })

  it('defaultOrientation() is a protected, overridable seam (the ADR-0095 clause 1 subclass mechanism)', () => {
    class HorizontalByDefaultGroup extends ProbeGroup {
      protected override defaultOrientation(): 'horizontal' | 'vertical' {
        return 'horizontal'
      }
    }
    if (!customElements.get('ui-radio-group-horizontal-test')) {
      customElements.define('ui-radio-group-horizontal-test', HorizontalByDefaultGroup)
    }
    const group = new HorizontalByDefaultGroup()
    stubFormAssoc(group.testInternals)
    document.body.append(group) // no explicit orientation attribute/property ever touched
    expect(group.orientation).toBe('horizontal') // the OVERRIDDEN default, not the base class's 'vertical'
    group.remove()
  })
})

// ── selectionChanged() — the protected post-selection hook (ADR-0095 clause 2) ─────────────────────

describe('UIRadioGroupElement — selectionChanged() protected hook', () => {
  it('is a no-op in the base (costs nothing for the plain dot-group presentation)', () => {
    const [group] = buildGroup(3)
    // A no-op hook writes no host style at all — the base class never touches `this.style`.
    expect(group.style.length).toBe(0)
    group.remove()
  })

  it('fires on connect (seed), every selection-apply (#commit + the public value setter), and formReset()', () => {
    const seen: Array<{ count: number; index: number }> = []
    class RecordingGroup extends ProbeGroup {
      protected override selectionChanged(radios: UIRadioElement[], index: number): void {
        seen.push({ count: radios.length, index })
      }
    }
    if (!customElements.get('ui-radio-group-recording-test')) {
      customElements.define('ui-radio-group-recording-test', RecordingGroup)
    }
    const group = new RecordingGroup()
    stubFormAssoc(group.testInternals)
    const r1 = makeRadio('r1')
    const r2 = makeRadio('r2')
    group.append(r1, r2)
    document.body.append(group) // fires #1: the connect-time seed
    expect(seen.at(-1)).toEqual({ count: 2, index: -1 })

    click(r2) // #commit → #applySelection → fires #2
    expect(seen.at(-1)).toEqual({ count: 2, index: 1 })

    group.value = 'r1' // the public setter → #applySelection → fires #3
    expect(seen.at(-1)).toEqual({ count: 2, index: 0 })

    group.formResetCallback() // fires #4
    expect(seen.at(-1)).toEqual({ count: 2, index: -1 }) // neither radio was default-checked

    group.remove()
  })
})

// ── the roving axis follows the resolved orientation (horizontal Left/Right) ───────────────────────

describe('UIRadioGroupElement — horizontal roving (Arrow Left/Right)', () => {
  let group: ProbeGroup
  let radios: ProbeRadio[]
  afterEach(() => group?.remove())

  beforeEach(() => {
    group = makeGroup()
    group.orientation = 'horizontal' // author-set before connect — resolved as-is (no variant needed)
    radios = [makeRadio('r1', 'One'), makeRadio('r2', 'Two'), makeRadio('r3', 'Three')]
    for (const r of radios) group.append(r)
    document.body.append(group)
  })

  it('adr86-horizontal-arrow-right: ArrowRight moves focus + selection to the next radio', () => {
    key(group, 'ArrowRight')
    expect(radios[1]!.checked).toBe(true)
    expect(radios[0]!.checked).toBe(false)
    expect(radios[1]!.tabIndex).toBe(0)
  })

  it('adr86-horizontal-arrow-left: ArrowLeft moves focus + selection to the previous radio (wraps)', () => {
    key(group, 'ArrowLeft')
    expect(radios[2]!.checked).toBe(true) // wraps to last
  })

  it('adr86-horizontal-arrow-down-inert: ArrowDown/Up do NOT move a horizontal group (dead keys, per orientation)', () => {
    key(group, 'ArrowDown')
    expect(radios.some((r) => r.checked)).toBe(false) // no radio checked — ArrowDown is not the horizontal axis
  })

  it('adr86-horizontal-home-end: Home/End still jump to the first/last regardless of axis', () => {
    key(group, 'End')
    expect(radios[2]!.checked).toBe(true)
    key(group, 'Home')
    expect(radios[0]!.checked).toBe(true)
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

// ── answered/settled choice state (ADR-0196, GH #1065) ───────────────────────────────────────────

describe('UIRadioGroupElement — :state(answered) (ADR-0196)', () => {
  it('group-answered-state: setting `answered` adds the custom state; clearing it removes it', async () => {
    const group = makeGroup()
    document.body.append(group)
    await group.updateComplete
    const states = group.testInternals.states
    if (!states) {
      // jsdom may not implement CustomStateSet — the browser smoke proves the real state.
      group.remove()
      return
    }
    expect(states.has('answered')).toBe(false)
    group.answered = true
    await group.updateComplete
    expect(states.has('answered')).toBe(true)
    group.answered = false
    await group.updateComplete
    expect(states.has('answered')).toBe(false)
    group.remove()
  })

  it('group-answered-default: `answered` defaults to false', () => {
    const group = makeGroup()
    expect(group.answered).toBe(false)
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

  it('reset-refires-selectionChanged (B4 fix, ADR-0095 clause 2): formReset() fires the hook with the RECOMPUTED defaultChecked index, not the stale pre-reset one', () => {
    const seen: Array<{ index: number }> = []
    class RecordingGroup extends ProbeGroup {
      protected override selectionChanged(_radios: UIRadioElement[], index: number): void {
        seen.push({ index })
      }
    }
    if (!customElements.get('ui-radio-group-reset-recording-test')) {
      customElements.define('ui-radio-group-reset-recording-test', RecordingGroup)
    }
    const group = new RecordingGroup()
    stubFormAssoc(group.testInternals)
    const r1 = makeRadio('r1') // defaultChecked, index 0
    r1.setAttribute('checked', '')
    const r2 = makeRadio('r2')
    const r3 = makeRadio('r3')
    group.append(r1, r2, r3)
    document.body.append(group)
    expect(seen.at(-1)).toEqual({ index: 0 }) // seeded from r1 at connect

    click(r3) // user selects r3 (index 2) — the hook follows the click via #commit
    expect(seen.at(-1)).toEqual({ index: 2 })

    // Reset every FACE member (order unspecified — the platform resets independently).
    group.formResetCallback()
    r1.formResetCallback()
    r2.formResetCallback()
    r3.formResetCallback()

    // Without the B4 fix, formReset() restored #selectedValue/checked but never fired the hook again —
    // a segmented-indicator subclass would park its moving fill on the STALE index '2'. The fix fires
    // selectionChanged with the RECOMPUTED defaultChecked index (0), same as #selectedValue.
    expect(seen.at(-1)).toEqual({ index: 0 })
    expect(r1.checked).toBe(true)
    expect(group.testFormValue).toBe('r1')

    group.remove()
  })

  it('reset-refires-selectionChanged-no-default: reset with NO default-checked radio fires the hook with index -1, not NaN', () => {
    const seen: Array<{ index: number }> = []
    class RecordingGroup extends ProbeGroup {
      protected override selectionChanged(_radios: UIRadioElement[], index: number): void {
        seen.push({ index })
      }
    }
    if (!customElements.get('ui-radio-group-reset-recording-no-default-test')) {
      customElements.define('ui-radio-group-reset-recording-no-default-test', RecordingGroup)
    }
    const group = new RecordingGroup()
    stubFormAssoc(group.testInternals)
    const r1 = makeRadio('r1')
    const r2 = makeRadio('r2')
    const r3 = makeRadio('r3')
    group.append(r1, r2, r3) // none default-checked
    document.body.append(group)

    click(r2)
    expect(seen.at(-1)).toEqual({ index: 1 })

    group.formResetCallback()
    r1.formResetCallback()
    r2.formResetCallback()
    r3.formResetCallback()

    // findIndex → -1 (no defaultChecked); a consuming subclass (ui-segmented-control) is responsible for
    // clamping that to 0 the way ADR-0086's seam did — harmless there, since its CSS hides the indicator
    // whenever no radio is [checked] (which is also the post-reset state here).
    expect(seen.at(-1)).toEqual({ index: -1 })
    expect(group.testFormValue).toBeNull()
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

// ── GH #1333 — pre-connect value-setter writes must not pollute the radios' defaultChecked ────────
//
// The reported door: children appended, `group.value = 'r2'` set BEFORE connect — `#radios()` sees
// light-DOM children regardless of connection, so `#applySelection` writes `r2.checked = true`
// immediately; the radio's first-connect capture then snapshotted that programmatic write as the
// authored default (`r2.defaultChecked === true` where native parity says false), and form reset
// restored the wrong state. Fixed at the base (indicator-element.ts): the capture reads the DECLARED
// (attribute-channel) state only — these probes pin the group-level repro end to end.

describe('UIRadioGroupElement — GH #1333 (pre-connect value setter vs defaultChecked)', () => {
  it('group-preconnect-value-not-default: append children → set value → connect → the matched radio\'s defaultChecked stays false; reset clears back to the authored (empty) default', () => {
    const group = makeGroup()
    const r1 = makeRadio('r1')
    const r2 = makeRadio('r2')
    const r3 = makeRadio('r3')
    group.append(r1, r2, r3)
    group.value = 'r2' // pre-connect programmatic direct-match write — #radios() sees light-DOM children already
    expect(r2.checked).toBe(true) // the live write lands immediately (the reported mechanism)
    document.body.append(group) // connect — the first-connect capture runs on every radio

    expect(r2.defaultChecked).toBe(false) // the Done-when probe: not snapshotted as the authored default
    expect(r1.defaultChecked).toBe(false)
    expect(r3.defaultChecked).toBe(false)
    expect(group.testFormValue).toBe('r2') // the live selection itself still seeds correctly at connect

    // Platform reset — group + radios reset as independent FACE members (order-independent contract).
    group.formResetCallback()
    r1.formResetCallback()
    r2.formResetCallback()
    r3.formResetCallback()
    expect(r2.checked).toBe(false) // restored to the DECLARED default: nothing was authored checked
    expect(group.testFormValue).toBeNull()
    group.remove()
  })

  it('group-preconnect-value-vs-declared: a markup-declared [checked] radio stays the reset default even when a pre-connect value write moved the live selection', () => {
    const group = makeGroup()
    const r1 = makeRadio('r1')
    r1.setAttribute('checked', '') // the AUTHORED default (the markup channel)
    const r2 = makeRadio('r2')
    group.append(r1, r2)
    group.value = 'r2' // pre-connect programmatic move: unchecks r1, checks r2
    document.body.append(group)

    expect(r1.checked).toBe(false) // live: the programmatic write holds
    expect(r2.checked).toBe(true)
    expect(r1.defaultChecked).toBe(true) // the declared record survives the programmatic uncheck
    expect(r2.defaultChecked).toBe(false)

    group.formResetCallback()
    r1.formResetCallback()
    r2.formResetCallback()
    expect(r1.checked).toBe(true) // reset restores the authored default
    expect(r2.checked).toBe(false)
    expect(group.testFormValue).toBe('r1')
    group.remove()
  })
})

// ── public `value` accessor ───────────────────────────────────────────────────────────────────────
//
// The public getter/setter pair delegating to #selectedValue (the UICheckboxElement.indeterminate
// precedent — checkbox.ts:39). Getter reflects the current selection; setter selects the matching
// child ui-radio (unchecking others), mirrors the SAME state transition #commit produces, but stays
// silent (no `change` — the UICheckboxElement.checked / UISelectElement.value programmatic-set
// convention). A no-match value clears the selection (the HTMLSelectElement.value precedent).

describe('UIRadioGroupElement — public value accessor', () => {
  let group: ProbeGroup
  let radios: ProbeRadio[]
  afterEach(() => group?.remove())

  beforeEach(() => {
    const result = buildGroup(3)
    group = result[0]
    radios = result.slice(1) as ProbeRadio[]
  })

  it('value-getter-reflects-user-selection: getter returns the checked radio\'s value after a click', () => {
    expect(group.value).toBeNull()
    click(radios[1]!)
    expect(group.value).toBe('r2')
  })

  it('value-setter-selects-matching-radio: setting value checks the matching radio, unchecks others', () => {
    group.value = 'r2'
    expect(radios[0]!.checked).toBe(false)
    expect(radios[1]!.checked).toBe(true)
    expect(radios[2]!.checked).toBe(false)
  })

  it('value-setter-switches-selection: setting a new value moves the checked radio (exclusivity holds)', () => {
    group.value = 'r1'
    expect(radios[0]!.checked).toBe(true)
    group.value = 'r3'
    expect(radios[0]!.checked).toBe(false)
    expect(radios[2]!.checked).toBe(true)
  })

  it('value-round-trip: set then get returns exactly what was set', () => {
    group.value = 'r2'
    expect(group.value).toBe('r2')
  })

  it('value-setter-updates-form-value: setting value updates formValue() (the group form participant)', () => {
    group.value = 'r3'
    expect(group.testFormValue).toBe('r3')
  })

  it('value-setter-silent: setting value does NOT emit change (programmatic-set convention)', () => {
    let changes = 0
    group.addEventListener('change', () => changes++)
    group.value = 'r2'
    expect(changes).toBe(0)
    expect(group.value).toBe('r2') // the write still landed — just silently
  })

  it('value-setter-null-clears: setting value=null clears the selection', () => {
    click(radios[1]!) // user-selects r2
    expect(group.value).toBe('r2')
    group.value = null
    expect(group.value).toBeNull()
    expect(radios[1]!.checked).toBe(false)
  })

  it('value-setter-no-match-clears: setting a value matching no child radio clears the selection (HTMLSelectElement.value precedent)', () => {
    click(radios[1]!) // user-selects r2
    expect(group.value).toBe('r2')
    group.value = 'no-such-value'
    expect(group.value).toBeNull()
    expect(radios[0]!.checked).toBe(false)
    expect(radios[1]!.checked).toBe(false)
    expect(radios[2]!.checked).toBe(false)
  })

  it('value-setter-idempotent-same-value: re-setting the currently-selected value is a no-op (no spurious change)', () => {
    group.value = 'r1'
    let changes = 0
    group.addEventListener('change', () => changes++)
    group.value = 'r1'
    expect(changes).toBe(0)
    expect(radios[0]!.checked).toBe(true)
  })

  it('value-then-user-commit-still-emits: a subsequent real click still emits change after a silent programmatic set', () => {
    group.value = 'r1' // silent
    let changes = 0
    group.addEventListener('change', () => changes++)
    click(radios[2]!) // real user commit
    expect(changes).toBe(1)
    expect(group.value).toBe('r3')
  })
})

// ── value set before ANY child radio exists — order-independent resolution ─────────────────────────
//
// A2UI catalog bug class (widget resolution applies catalog props — `el.value = '…'` — at CREATE time,
// THEN appends the item children in the same `updateComponents` hop): the setter above previously found
// no match against an empty `#radios()` and the intent was lost. `#pendingValue` retains it; resolved
// either at this group's own connect (children already appended, subtree connected as one) or via a
// genuinely later-registering `ui-radio` (`resolvePendingValue`, called from `radio.ts`'s `grouped()`).

describe('UIRadioGroupElement — value set before children exist (order-independent)', () => {
  afterEach(() => {
    document.body.querySelectorAll('ui-radio-group-test').forEach((el) => el.remove())
  })

  it('value-before-children-resolves-at-connect: retained + applied once the whole assembled subtree connects', () => {
    const group = makeGroup()
    group.value = 'r2' // set BEFORE any radio child exists — must not be lost
    const r1 = makeRadio('r1', 'One')
    const r2 = makeRadio('r2', 'Two')
    const r3 = makeRadio('r3', 'Three')
    group.append(r1, r2, r3)
    document.body.append(group) // connects the whole assembled subtree in one hop
    expect(group.value).toBe('r2')
    expect(r1.checked).toBe(false)
    expect(r2.checked).toBe(true)
    expect(r3.checked).toBe(false)
    // Exactly one roving tab stop, on the resolved radio — not whichever radio connected first.
    expect(r1.tabIndex).toBe(-1)
    expect(r2.tabIndex).toBe(0)
    expect(r3.tabIndex).toBe(-1)
    group.remove()
  })

  it('value-before-children-negative-control: a value never set leaves nothing checked', () => {
    const group = makeGroup()
    const r1 = makeRadio('r1', 'One')
    const r2 = makeRadio('r2', 'Two')
    group.append(r1, r2)
    document.body.append(group)
    expect(group.value).toBeNull()
    expect(r1.checked).toBe(false)
    expect(r2.checked).toBe(false)
    group.remove()
  })

  it('value-before-children-late-append: an unmatched pending value resolves when a matching radio is later appended to an already-connected group', () => {
    const group = makeGroup()
    const r1 = makeRadio('r1', 'One')
    group.append(r1)
    document.body.append(group) // connects with only r1 present
    group.value = 'r2' // no match yet (r2 doesn't exist) — retained, not lost
    expect(group.value).toBeNull()
    const r2 = makeRadio('r2', 'Two')
    group.append(r2) // late-append into an ALREADY-connected group — connectedCallback fires synchronously
    expect(group.value).toBe('r2')
    expect(r2.checked).toBe(true)
    expect(r1.tabIndex).toBe(-1)
    expect(r2.tabIndex).toBe(0)
    group.remove()
  })
})

// ── component-checker correctives (P-A/P-A2/P-B/P-C/P-D) ────────────────────────────────────────────
//
// An independent component-checker pass reproduced five defects in the original value-before-children
// fix (1b3196fa) and this suite pins the two correctives that closed them:
//   1. Committed state OUTRANKS a pending value: a real user commit clears `#pendingValue` outright
//      (P-C), and the group's connect-time resolution was retired entirely so an unmatched pending can
//      never force an `#applySelection(radios, -1)` on (re)connect (P-D).
//   2. Pending resolution happens SOLELY via the per-radio `resolvePendingValue` seam — called from each
//      radio's own `grouped()`, strictly AFTER that SAME radio's `defaultChecked` capture — so resolving
//      a pending value never pollutes the reset baseline (P-A/P-A2), and an unmatched pending at connect
//      can never uncheck an authored `checked` child before its own default capture (P-B).

describe('UIRadioGroupElement — component-checker correctives', () => {
  afterEach(() => {
    document.body.querySelectorAll('ui-radio-group-test').forEach((el) => el.remove())
  })

  it('P-A/P-A2: resolving a value-before-children pending value does NOT pollute the resolved radio\'s defaultChecked; formReset() returns to the authored default (null)', () => {
    const group = makeGroup()
    group.value = 'r2' // set BEFORE any radio exists — retained as pending
    const r1 = makeRadio('r1')
    const r2 = makeRadio('r2')
    const r3 = makeRadio('r3')
    group.append(r1, r2, r3)
    document.body.append(group) // connects the whole assembled subtree; pending resolves via r2's own grouped()

    expect(group.value).toBe('r2')
    expect(r2.checked).toBe(true)
    // P-A: no radio was ever AUTHORED with a `checked` attribute — the resolution must not retroactively
    // masquerade as the authored default.
    expect(r1.defaultChecked).toBe(false)
    expect(r2.defaultChecked).toBe(false)
    expect(r3.defaultChecked).toBe(false)

    // P-A2: formReset() must restore the AUTHORED default (nothing checked), not the pending-resolved
    // selection. The platform resets every FACE member independently (order unspecified).
    group.formResetCallback()
    r1.formResetCallback()
    r2.formResetCallback()
    r3.formResetCallback()
    expect(group.value).toBeNull()
    expect(r1.checked).toBe(false)
    expect(r2.checked).toBe(false)
    expect(r3.checked).toBe(false)

    group.remove()
  })

  it('P-B: an unmatched pending value at connect must not uncheck an authored `checked` child before its own default capture', () => {
    const group = makeGroup()
    group.value = 'zzz' // set BEFORE any radio exists — will NEVER match r1/r2, stays pending forever
    const r1 = makeRadio('r1')
    r1.setAttribute('checked', '') // authored default
    const r2 = makeRadio('r2')
    group.append(r1, r2)
    document.body.append(group) // connects; the group's own connected() must not touch r1's checked state

    expect(r1.checked).toBe(true) // the authored default must survive an outstanding unmatched pending
    expect(r2.checked).toBe(false)
    expect(group.value).toBe('r1') // seeded from the authored-checked radio
    expect(r1.defaultChecked).toBe(true) // captured correctly — never overwritten before its own connect
    expect(r2.defaultChecked).toBe(false)

    group.remove()
  })

  it('P-C: a later user commit outranks a stale pending — a matching child appended AFTER the commit must not jump the selection', () => {
    const group = makeGroup()
    const r1 = makeRadio('r1', 'One')
    group.append(r1)
    document.body.append(group) // connects with only r1 present

    group.value = 'r2' // no match yet (r2 doesn't exist) — retained as pending
    expect(group.value).toBeNull()

    click(r1) // a REAL user commit — must retire the stale pending outright
    expect(group.value).toBe('r1')
    expect(r1.checked).toBe(true)

    const r2 = makeRadio('r2', 'Two')
    group.append(r2) // r2 now matches the old pending value — must NOT resolve; the user's commit stands
    expect(group.value).toBe('r1') // no jump
    expect(r1.checked).toBe(true)
    expect(r2.checked).toBe(false)

    group.remove()
  })

  it('P-D: a committed selection survives disconnect+reconnect even with a stale unmatched pending still outstanding', () => {
    const group = makeGroup()
    group.value = 'never-matches' // set BEFORE any radio exists — no radio will ever carry this value
    const r1 = makeRadio('r1', 'One')
    const r2 = makeRadio('r2', 'Two')
    group.append(r1, r2)
    document.body.append(group) // connects; pending stays outstanding (unmatched)

    click(r1) // a real user commit
    expect(group.value).toBe('r1')
    expect(r1.checked).toBe(true)

    group.remove() // disconnect
    document.body.append(group) // reconnect — must NOT re-run any -1 clear against the stale pending

    expect(group.value).toBe('r1')
    expect(r1.checked).toBe(true)
    expect(r2.checked).toBe(false)

    group.remove()
  })
})

// ── ADR-0212 — nearest-group-scoped descendant discovery ────────────────────────────────────────────
//
// The six failing probes from GH #1365's verification (jsdom probe against the pre-ADR-0212 source):
// B1 nested click commits · B2 cross-container exclusivity · B3 exactly ONE group-re-emitted `change`
// escapes per nested commit · B4 arrow roving spans nested radios in tree order · C1 programmatic
// `value` selects a nested radio · D1 `#pendingValue` resolves for a nested late-appended child. Plus
// the anti-vacuous ownership-boundary negative control (an inner `ui-radio-group`'s radios never join
// the outer group's set) and a flat-children baseline living alongside (the rest of this file already
// exercises the flat-children suite byte-unchanged — direct children are the degenerate case of the
// widened query).

/** Build a group with radios nested one level behind an interposed non-group container (a plain div —
 *  the model-grid shape's "provider card"/"row" stand-in). Returns [group, container, ...radios]. */
function buildNestedGroup(n: number, required = false): [ProbeGroup, HTMLDivElement, ...ProbeRadio[]] {
  const group = makeGroup(required)
  const container = document.createElement('div')
  const radios = Array.from({ length: n }, (_, i) => makeRadio(`r${i + 1}`, `Option ${i + 1}`))
  for (const r of radios) container.append(r)
  group.append(container)
  document.body.append(group)
  return [group, container, ...radios] as [ProbeGroup, HTMLDivElement, ...ProbeRadio[]]
}

describe('UIRadioGroupElement — ADR-0212 nearest-group-scoped descendant discovery', () => {
  afterEach(() => document.body.querySelectorAll('ui-radio-group-test').forEach((el) => el.remove()))

  it('B1 (nested click commits): clicking a radio nested behind an interposed container commits the group value', () => {
    const [group, , r1, r2] = buildNestedGroup(3)
    click(r2!)
    expect(group.testFormValue).toBe('r2')
    expect(r1!.checked).toBe(false)
    expect(r2!.checked).toBe(true)
  })

  it('B2 (cross-container exclusivity): selecting a second nested radio leaves exactly ONE checked, never two', () => {
    const [group, , r1, r2, r3] = buildNestedGroup(3)
    click(r1!)
    expect(r1!.checked).toBe(true)
    click(r2!)
    expect(r1!.checked).toBe(false)
    expect(r2!.checked).toBe(true)
    expect(r3!.checked).toBe(false)
    const checkedCount = [r1!, r2!, r3!].filter((r) => r.checked).length
    expect(checkedCount).toBe(1)
    expect(group.testFormValue).toBe('r2')
  })

  it('B3 (exactly one re-emit per nested commit): the group re-emits exactly ONE `change`; the radio\'s own change never escapes to an outside listener', () => {
    const [group, , r1] = buildNestedGroup(3)
    let groupChanges = 0
    let outsideRadioChanges = 0
    group.addEventListener('change', () => groupChanges++)
    document.body.addEventListener('change', (e) => {
      if (e.target !== group) outsideRadioChanges++
    })
    click(r1!)
    expect(groupChanges).toBe(1)
    expect(outsideRadioChanges, 'the nested radio\'s own change event must not escape un-swallowed').toBe(0)
  })

  it('B4 (arrow roving spans nested radios in tree order): ArrowDown moves focus + selection into/through the interposed container', () => {
    const [group, , r1, r2] = buildNestedGroup(3)
    key(group, 'ArrowDown')
    expect(r2!.checked).toBe(true)
    expect(r1!.checked).toBe(false)
    expect(r2!.tabIndex).toBe(0)
    expect(r1!.tabIndex).toBe(-1)
  })

  it('C1 (programmatic value selects a nested radio): setting `value` selects the matching radio even when nested behind a container', () => {
    const [group, , r1, r2] = buildNestedGroup(3)
    group.value = 'r2'
    expect(r1!.checked).toBe(false)
    expect(r2!.checked).toBe(true)
    expect(group.value).toBe('r2')
  })

  it('D1 (#pendingValue resolves for a nested late-appended child): a value set before a matching nested radio exists resolves once that radio registers', () => {
    const group = makeGroup()
    const container = document.createElement('div')
    const r1 = makeRadio('r1', 'One')
    container.append(r1)
    group.append(container)
    document.body.append(group) // connects with only r1 (nested) present
    group.value = 'r2' // no match yet — retained as pending
    expect(group.value).toBeNull()

    const r2 = makeRadio('r2', 'Two')
    container.append(r2) // late-append INTO the interposed container, not the group directly
    expect(group.value).toBe('r2')
    expect(r2.checked).toBe(true)
    expect(r1.tabIndex).toBe(-1)
    expect(r2.tabIndex).toBe(0)
    group.remove()
  })

  it('ownership-boundary (anti-vacuous negative control): an inner ui-radio-group\'s radios never join the outer group\'s set — value, exclusivity, and roving all respect the boundary', () => {
    const outer = makeGroup()
    const outerR1 = makeRadio('outer-1', 'Outer One')
    const inner = new ProbeGroup()
    stubFormAssoc(inner.testInternals)
    const innerR1 = makeRadio('inner-1', 'Inner One')
    const innerR2 = makeRadio('inner-2', 'Inner Two')
    inner.append(innerR1, innerR2)
    outer.append(outerR1, inner)
    document.body.append(outer)

    // Clicking an INNER radio must commit the INNER group only — the outer group's value/roving are untouched.
    click(innerR1)
    expect(inner.testFormValue).toBe('inner-1')
    expect(outer.testFormValue).toBeNull()

    // The outer group's roving set is [outerR1] ALONE — Arrow key on the outer group cannot reach into
    // the inner group's radios at all (a single-item loop wraps onto itself, selecting outerR1 — never
    // any inner radio).
    expect(outerR1.tabIndex).toBe(0)
    key(outer, 'ArrowDown')
    expect(outer.testFormValue).toBe('outer-1') // the outer's OWN (only) radio, never an inner one
    expect(innerR1.checked).toBe(true) // untouched by the outer's roving
    expect(innerR2.checked).toBe(false)

    // Programmatic value on the outer cannot select an inner radio by its value.
    outer.value = 'inner-1'
    expect(outer.value).toBeNull() // no match in the outer's OWN set
    expect(innerR1.checked).toBe(true) // the inner selection is untouched

    outer.remove()
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
const GROUP_ATTR_NAMES = ['name', 'disabled', 'required', 'orientation', 'answered']

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
    // anti-vacuous: all 4 attributes parse before the schema is consulted
    expect(groupParsed.attributes.map((a) => a.name)).toEqual(GROUP_ATTR_NAMES)
    expect(validateComponentDescriptor(groupParsed)).toEqual([])
  })
})

describe('radio-group.md descriptor — contract↔props trip-wire (s10 part b)', () => {
  it('attributes[] is a faithful bijection with UIRadioGroupElement.props (0 drift)', () => {
    // anti-vacuous: all 4 attribute names parse before the trip-wire is consulted
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
