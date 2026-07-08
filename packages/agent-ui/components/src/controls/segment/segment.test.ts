// segment.test.ts — UISegmentElement jsdom probes (ADR-0095 clause 3).
//
// UISegmentElement adds NO new prop/behavior of its own — it is UIRadioElement, re-tagged. These probes
// mirror radio.test.ts's shape (role, form value, standalone toggle, grouped() guard) but exercise the NEW
// tag, and — the one thing worth proving fresh — that `#radios()`'s `instanceof UIRadioElement` walk on the
// REAL `UISegmentedControlElement` parent finds a `ui-segment` child by construction (ADR-0095 clause 1's
// "matches the subclass by construction" claim), not just a bespoke jsdom probe subclass.
//
// Named probes: segment-role · segment-form-value-unchecked · segment-form-value-checked ·
// segment-reflects-checked · segment-standalone-toggle · segment-grouped-guard-checked ·
// segment-grouped-guard-unchecked · segment-in-real-segmented-control.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { UISegmentElement } from './segment.ts'
import { UISegmentedControlElement } from '../segmented-control/segmented-control.ts'
import {
  splitFrontmatter,
  parseDescriptor,
  validateComponentDescriptor,
  compareDescriptorToProps,
} from '../../descriptor/component-descriptor.ts'
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

class ProbeSegment extends UISegmentElement {
  get testInternals(): ElementInternals {
    return this.internals
  }
}
if (!customElements.get('ui-segment-probe')) customElements.define('ui-segment-probe', ProbeSegment)

// A thin probe subclass over the REAL UISegmentedControlElement — exposes the protected `internals` seam
// for the jsdom form-association stub; adds nothing else (the "matches by construction" claim below tests
// the REAL class, not a bespoke reimplementation).
class ProbeSegmentedControl extends UISegmentedControlElement {
  get testInternals(): ElementInternals {
    return this.internals
  }
}
if (!customElements.get('ui-segmented-control-probe')) {
  customElements.define('ui-segmented-control-probe', ProbeSegmentedControl)
}

function makeSegment(value = 'on'): ProbeSegment {
  const el = new ProbeSegment()
  el.value = value
  stubFormAssoc(el.testInternals)
  return el
}

function makeSegmentedControl(): ProbeSegmentedControl {
  const el = new ProbeSegmentedControl()
  stubFormAssoc(el.testInternals)
  return el
}

const key = (el: Element, type: 'keydown' | 'keyup', k: string): void => {
  el.dispatchEvent(new KeyboardEvent(type, { key: k, bubbles: true, cancelable: true }))
}
const click = (el: Element): void => {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
}

// ── role ──────────────────────────────────────────────────────────────────────────────────────────

describe('UISegmentElement — role (inherited from UIIndicatorElement)', () => {
  let segment: ProbeSegment

  beforeEach(() => {
    segment = makeSegment()
    document.body.append(segment)
  })
  afterEach(() => segment.remove())

  it('segment-role: internals.role is "radio" — the class-declared static role is inherited unchanged', () => {
    expect(segment.testInternals.role).toBe('radio')
    expect(segment.getAttribute('role')).toBeNull()
  })

  it('segment-aria-checked-true: ariaChecked="true" after checked becomes true', async () => {
    segment.checked = true
    await segment.updateComplete
    expect(segment.testInternals.ariaChecked).toBe('true')
  })
})

// ── form value ────────────────────────────────────────────────────────────────────────────────────

describe('UISegmentElement — form value (inherited from UIIndicatorElement)', () => {
  let segment: ProbeSegment

  beforeEach(() => {
    segment = makeSegment()
    document.body.append(segment)
  })
  afterEach(() => segment.remove())

  it('segment-form-value-unchecked: formValue() returns null when unchecked', () => {
    const fv = (segment as unknown as { formValue(): string | null }).formValue
    expect(fv.call(segment)).toBeNull()
  })

  it('segment-form-value-checked: formValue() returns this.value when checked', () => {
    segment.value = 'option-a'
    segment.checked = true
    const fv = (segment as unknown as { formValue(): string | null }).formValue
    expect(fv.call(segment)).toBe('option-a')
  })

  it('segment-reflects-checked: checked reflects to/from the attribute (boolean presence)', () => {
    expect(segment.getAttribute('checked')).toBeNull()
    segment.checked = true
    expect(segment.getAttribute('checked')).toBe('')
    segment.checked = false
    expect(segment.getAttribute('checked')).toBeNull()
  })
})

// ── standalone toggle (no group parent) ──────────────────────────────────────────────────────────

describe('UISegmentElement — standalone toggle (no ui-segmented-control parent)', () => {
  let segment: ProbeSegment

  beforeEach(() => {
    segment = makeSegment()
    document.body.append(segment)
  })
  afterEach(() => segment.remove())

  it('segment-standalone-toggle: click toggles unchecked → checked (no group, acts like checkbox)', () => {
    expect(segment.checked).toBe(false)
    click(segment)
    expect(segment.checked).toBe(true)
  })

  it('segment-standalone-space: Space keyup toggles unchecked → checked', () => {
    key(segment, 'keydown', ' ')
    key(segment, 'keyup', ' ')
    expect(segment.checked).toBe(true)
  })

  it('segment-standalone-enter-no-toggle: Enter does NOT toggle (platform parity)', () => {
    key(segment, 'keydown', 'Enter')
    expect(segment.checked).toBe(false)
  })
})

// ── grouped() guard — inside a REAL ui-segmented-control (the "matches by construction" claim) ────

describe('UISegmentElement — grouped() guard inside a REAL ui-segmented-control', () => {
  let control: ProbeSegmentedControl
  let segment: ProbeSegment

  beforeEach(() => {
    control = makeSegmentedControl()
    segment = makeSegment('a')
    control.append(segment)
    document.body.append(control)
  })
  afterEach(() => control.remove())

  it('segment-in-real-segmented-control: the well-known [data-radio-group] marker is set by the REAL parent class', () => {
    // UISegmentedControlElement inherits UIRadioGroupElement.connected() unchanged — it sets the marker
    // grouped() reads via a CSS attribute-selector `closest()`, no circular import, no tag-name check.
    expect(control.hasAttribute('data-radio-group')).toBe(true)
  })

  it('segment-grouped-guard-unchecked: clicking unchecked segment inside a real segmented control checks it', () => {
    expect(segment.checked).toBe(false)
    click(segment)
    expect(segment.checked).toBe(true)
  })

  it('segment-grouped-guard-checked: clicking an already-checked segment does NOT uncheck it (guard fires)', () => {
    segment.checked = true
    click(segment)
    expect(segment.checked).toBe(true) // the capture-phase guard stops the base toggle
  })

  it('segment-grouped-space-checked: Space on an already-checked segment has no effect (guard)', () => {
    segment.checked = true
    key(segment, 'keydown', ' ')
    key(segment, 'keyup', ' ')
    expect(segment.checked).toBe(true)
  })

  it("#radios()'s instanceof UIRadioElement walk finds the ui-segment child (ADR-0095 clause 1 claim)", () => {
    // The parent's own #commit path only fires a group `change` when it finds the segment via #radios() —
    // observing that `change` fires (and the sibling exclusivity holds) is an END-TO-END proof the walk
    // matched `UISegmentElement` by construction, not a special-cased tag check.
    const second = makeSegment('b')
    control.append(second)
    let changes = 0
    control.addEventListener('change', () => changes++)
    click(second)
    expect(changes).toBe(1)
    expect(control.value).toBe('b')
    expect(segment.checked).toBe(false) // exclusivity — the FIRST segment (a real ui-segment) was cleared
  })
})

// ── connect/disconnect zero-residue ──────────────────────────────────────────────────────────────

describe('UISegmentElement — connect/disconnect zero-residue', () => {
  it('segment-connect-disconnect: after disconnect, listeners are removed; reconnect re-arms once', () => {
    const segment = makeSegment()
    document.body.append(segment)

    click(segment)
    expect(segment.checked).toBe(true)

    segment.remove()
    segment.checked = false
    click(segment)
    expect(segment.checked).toBe(false) // disconnected — listeners gone

    document.body.append(segment) // reconnect
    click(segment)
    expect(segment.checked).toBe(true)

    segment.remove()
  })
})

// ── descriptor trip-wire (contract↔props) ────────────────────────────────────────────────────────

const SEGMENT_DIR = `${process.cwd()}/packages/agent-ui/components/src/controls/segment`
const segmentMd = readFileSync(`${SEGMENT_DIR}/segment.md`, 'utf8') as string
const { fence: segmentFence } = splitFrontmatter(segmentMd)
const segmentParsed = parseDescriptor(segmentFence)
// Attribute names in the order declared in segment.md frontmatter (anti-vacuous anchor) — IDENTICAL shape
// to radio.md's, since UISegmentElement adds no prop of its own.
const SEGMENT_ATTR_NAMES = ['checked', 'value', 'size', 'name', 'disabled', 'required']

describe('segment.md descriptor — structural validity (s10 part a)', () => {
  it('carries the ADR-0004 / plan §10 descriptor field set as top-level keys', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(segmentParsed.topLevelKeys.has(field), `missing descriptor field: ${field}`).toBe(true)
  })

  it('tag=ui-segment, extends=UIIndicatorElement, tier=indicator, face.formAssociated=true', () => {
    expect(/^tag:\s*ui-segment\s*$/m.test(segmentFence)).toBe(true)
    expect(/^extends:\s*UIIndicatorElement\b/m.test(segmentFence)).toBe(true)
    expect(/^tier:\s*indicator\b/m.test(segmentFence)).toBe(true)
    expect(/formAssociated:\s*true/.test(segmentFence)).toBe(true)
  })

  it('validateComponentDescriptor reports ZERO structural failures (schema-valid)', () => {
    // anti-vacuous: all 6 attributes parse before the schema is consulted
    expect(segmentParsed.attributes.map((a) => a.name)).toEqual(SEGMENT_ATTR_NAMES)
    expect(validateComponentDescriptor(segmentParsed)).toEqual([])
  })
})

describe('segment.md descriptor — contract↔props trip-wire (s10 part b)', () => {
  it('attributes[] is a faithful bijection with UISegmentElement.props (0 drift)', () => {
    // anti-vacuous: all 6 attribute names parse before the trip-wire is consulted
    expect(segmentParsed.attributes.map((a) => a.name)).toEqual(SEGMENT_ATTR_NAMES)
    expect(compareDescriptorToProps(segmentParsed.attributes, UISegmentElement.props)).toEqual([])
  })

  it('a drifted attribute FAILS the trip-wire (negative control — reflect + default)', () => {
    const flipReflect = segmentParsed.attributes.map((a) => (a.name === 'size' ? { ...a, reflect: false } : { ...a }))
    expect(compareDescriptorToProps(flipReflect, UISegmentElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_REFLECT', path: 'attributes.size.reflect' }),
    )
    const flipDefault = segmentParsed.attributes.map((a) => (a.name === 'value' ? { ...a, default: 'off' } : { ...a }))
    expect(compareDescriptorToProps(flipDefault, UISegmentElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_DEFAULT', path: 'attributes.value.default' }),
    )
  })

  it('a removed or added attribute FAILS the trip-wire (negative control — bijection both ways)', () => {
    const dropChecked = segmentParsed.attributes.filter((a) => a.name !== 'checked')
    expect(compareDescriptorToProps(dropChecked, UISegmentElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_MISSING', path: 'attributes.checked' }),
    )
    const addBogus = [...segmentParsed.attributes, { name: 'bogus', type: 'string', default: '', reflect: false }]
    expect(compareDescriptorToProps(addBogus, UISegmentElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_EXTRA', path: 'attributes.bogus' }),
    )
  })
})
