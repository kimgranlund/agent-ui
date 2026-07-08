// segmented-control.test.ts — UISegmentedControlElement jsdom probes (ADR-0095).
//
// UISegmentedControlElement inherits 100% of UIRadioGroupElement's exclusivity/roving/value/validity
// machinery (already covered exhaustively by radio-group.test.ts, which stays green unmodified — the ADR's
// own DoD). These probes cover ONLY what this subclass adds: the class-derived HORIZONTAL default
// orientation (defaultOrientation() override) and the renamed moving-indicator state seam
// (--ui-segmented-control-index/-count, via the inherited selectionChanged() hook), fired on connect, every
// selection-apply (#commit + the public value setter), and formReset() — the SAME three call sites ADR-0086
// wired its (retired) --ui-radio-group-index/-count seam to.
//
// Named probes: sc-role · sc-default-orientation-horizontal · sc-orientation-author-wins ·
// sc-no-variant-prop · sc-seam-seeded · sc-seam-click-commit · sc-seam-arrow-commit ·
// sc-seam-value-setter · sc-seam-form-reset · sc-exclusivity · sc-value-missing.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { UISegmentedControlElement } from './segmented-control.ts'
import { UISegmentElement } from '../segment/segment.ts'
import {
  splitFrontmatter,
  parseDescriptor,
  validateComponentDescriptor,
  compareDescriptorToProps,
} from '../../descriptor/component-descriptor.ts'
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

function stubFormAssoc(internals: ElementInternals): void {
  const i = internals as unknown as Record<string, unknown>
  if (typeof i['setFormValue'] !== 'function') {
    i['setFormValue'] = (): void => {}
    i['setValidity'] = (): void => {}
  }
}

class ProbeControl extends UISegmentedControlElement {
  get testInternals(): ElementInternals {
    return this.internals
  }
}
if (!customElements.get('ui-segmented-control-probe')) customElements.define('ui-segmented-control-probe', ProbeControl)

// A thin probe subclass over the REAL UISegmentElement — exposes the protected `internals` seam for the
// jsdom form-association stub; adds nothing else.
class ProbeSegment extends UISegmentElement {
  get testInternals(): ElementInternals {
    return this.internals
  }
}
if (!customElements.get('ui-segment-probe-sc')) customElements.define('ui-segment-probe-sc', ProbeSegment)

function makeControl(required = false): ProbeControl {
  const el = new ProbeControl()
  if (required) el.required = true
  stubFormAssoc(el.testInternals)
  return el
}

function makeSegment(value: string, label = ''): ProbeSegment {
  const el = new ProbeSegment()
  el.value = value
  if (label) el.textContent = label
  stubFormAssoc(el.testInternals)
  return el
}

function buildControl(n: number): [ProbeControl, ...UISegmentElement[]] {
  const control = makeControl()
  const segments = Array.from({ length: n }, (_, i) => makeSegment(`s${i + 1}`, `Segment ${i + 1}`))
  for (const s of segments) control.append(s)
  document.body.append(control)
  return [control, ...segments] as [ProbeControl, ...UISegmentElement[]]
}

const key = (el: Element, k: string): void => {
  el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }))
}
const click = (el: Element): void => {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
}

// ── ARIA (inherited role='radiogroup') ───────────────────────────────────────────────────────────

describe('UISegmentedControlElement — role (inherited from UIRadioGroupElement)', () => {
  it('sc-role: internals.role is "radiogroup"; no host role attribute (FACE)', () => {
    const [control] = buildControl(3)
    expect(control.testInternals.role).toBe('radiogroup')
    expect(control.getAttribute('role')).toBeNull()
    control.remove()
  })

  it('sc-data-radio-group-marker: the [data-radio-group] group-detection marker is set (grouped() finds it)', () => {
    const [control] = buildControl(3)
    expect(control.hasAttribute('data-radio-group')).toBe(true)
    control.remove()
  })
})

// ── the class-derived default orientation (ADR-0095 clause 1) ─────────────────────────────────────

describe('UISegmentedControlElement — class-derived default orientation (horizontal)', () => {
  it('sc-default-orientation-horizontal: with no explicit orientation, resolves to horizontal at connect (NOT the base class\'s vertical)', () => {
    const control = makeControl()
    expect(control.hasAttribute('orientation')).toBe(false) // anti-vacuous: nothing resolved yet
    document.body.append(control)
    expect(control.orientation).toBe('horizontal')
    expect(control.getAttribute('orientation')).toBe('horizontal')
    control.remove()
  })

  it('sc-orientation-author-wins: an explicit orientation="vertical" is NOT overridden by the class default', () => {
    const control = new ProbeControl()
    control.orientation = 'vertical' // author-set BEFORE connect
    stubFormAssoc(control.testInternals)
    document.body.append(control)
    expect(control.orientation).toBe('vertical') // NOT flipped to horizontal
    control.remove()
  })

  it('sc-orientation-html-authored: markup `<ui-segmented-control orientation="vertical">` honours the explicit attribute', () => {
    const control = document.createElement('ui-segmented-control-probe') as ProbeControl
    control.setAttribute('orientation', 'vertical')
    stubFormAssoc(control.testInternals)
    document.body.append(control)
    expect(control.orientation).toBe('vertical')
    control.remove()
  })

  it('sc-no-variant-prop: carries no `variant` prop at all (ADR-0095 — a standalone tag, not a variant)', () => {
    const [control] = buildControl(3)
    expect((control as unknown as Record<string, unknown>)['variant']).toBeUndefined()
    expect('variant' in UISegmentedControlElement.props).toBe(false)
    control.remove()
  })
})

// ── horizontal roving (the class default — ArrowLeft/Right) ────────────────────────────────────────

describe('UISegmentedControlElement — horizontal roving (Arrow Left/Right, the class default)', () => {
  let control: ProbeControl
  let segments: UISegmentElement[]
  afterEach(() => control?.remove())

  beforeEach(() => {
    const result = buildControl(3)
    control = result[0]
    segments = result.slice(1) as UISegmentElement[]
  })

  it('sc-horizontal-arrow-right: ArrowRight moves focus + selection to the next segment', () => {
    key(control, 'ArrowRight')
    expect(segments[1]!.checked).toBe(true)
    expect(segments[1]!.tabIndex).toBe(0)
  })

  it('sc-horizontal-arrow-down-inert: ArrowDown does NOT move a horizontal control (dead key, per orientation)', () => {
    key(control, 'ArrowDown')
    expect(segments.some((s) => s.checked)).toBe(false)
  })
})

// ── the moving-indicator state seam: --ui-segmented-control-index / -count (ADR-0095 clause 2) ────

describe('UISegmentedControlElement — the moving-indicator state seam (--ui-segmented-control-index/-count)', () => {
  let control: ProbeControl
  let segments: UISegmentElement[]
  afterEach(() => control?.remove())

  beforeEach(() => {
    const result = buildControl(3)
    control = result[0]
    segments = result.slice(1) as UISegmentElement[]
  })

  it('sc-seam-seeded: connect seeds --ui-segmented-control-count (and index=0 when nothing selected)', () => {
    expect(control.style.getPropertyValue('--ui-segmented-control-count')).toBe('3')
    expect(control.style.getPropertyValue('--ui-segmented-control-index')).toBe('0')
  })

  it('sc-seam-click-commit: clicking segment[2] writes index=2', () => {
    click(segments[2]!)
    expect(control.style.getPropertyValue('--ui-segmented-control-index')).toBe('2')
    expect(control.style.getPropertyValue('--ui-segmented-control-count')).toBe('3')
  })

  it('sc-seam-arrow-commit: ArrowRight navigation refreshes the index on every commit', () => {
    key(control, 'ArrowRight') // 0 → 1
    expect(control.style.getPropertyValue('--ui-segmented-control-index')).toBe('1')
    key(control, 'ArrowRight') // 1 → 2
    expect(control.style.getPropertyValue('--ui-segmented-control-index')).toBe('2')
  })

  it('sc-seam-value-setter: the public `value` setter also refreshes the seam', () => {
    control.value = 's3'
    expect(control.style.getPropertyValue('--ui-segmented-control-index')).toBe('2')
  })

  it('sc-seam-form-reset: formResetCallback() recomputes the index from defaultChecked, not the stale pre-reset selection', () => {
    // Re-build with a markup-preselected first segment (defaultChecked).
    control.remove()
    const c = makeControl()
    const s1 = makeSegment('s1')
    s1.setAttribute('checked', '')
    const s2 = makeSegment('s2')
    c.append(s1, s2)
    document.body.append(c)
    expect(c.style.getPropertyValue('--ui-segmented-control-index')).toBe('0')

    click(s2) // user selects s2 (index 1)
    expect(c.style.getPropertyValue('--ui-segmented-control-index')).toBe('1')

    c.formResetCallback()
    s1.formResetCallback()
    s2.formResetCallback()

    // Snaps back to s1's defaultChecked index (0), not the stale pre-reset '1' — the ADR-0086 B4 fix,
    // preserved by construction (the call sites did not move).
    expect(c.style.getPropertyValue('--ui-segmented-control-index')).toBe('0')
    expect(c.style.getPropertyValue('--ui-segmented-control-count')).toBe('2')
    c.remove()
  })
})

// ── exclusivity + required→valueMissing (inherited, spot-check) ────────────────────────────────────

describe('UISegmentedControlElement — exclusivity + validity (inherited from UIRadioGroupElement)', () => {
  it('sc-exclusivity: clicking a segment checks it and clears the others', () => {
    const [control, s1, s2, s3] = buildControl(3)
    click(s2!)
    expect(s1!.checked).toBe(false)
    expect(s2!.checked).toBe(true)
    expect(s3!.checked).toBe(false)
    control.remove()
  })

  it('sc-value-missing: required + no selection → valueMissing', () => {
    const control = makeControl(true)
    const s1 = makeSegment('s1')
    control.append(s1)
    document.body.append(control)
    const validity = (control as unknown as { formValidity(): { valid: boolean; flags?: { valueMissing?: boolean } } })
      .formValidity.call(control)
    expect(validity.valid).toBe(false)
    expect(validity.flags?.valueMissing).toBe(true)
    control.remove()
  })
})

// ── descriptor trip-wire (contract↔props) ────────────────────────────────────────────────────────

const SC_DIR = `${process.cwd()}/packages/agent-ui/components/src/controls/segmented-control`
const scMd = readFileSync(`${SC_DIR}/segmented-control.md`, 'utf8') as string
const { fence: scFence } = splitFrontmatter(scMd)
const scParsed = parseDescriptor(scFence)
// Attribute names in the order declared in segmented-control.md frontmatter (anti-vacuous anchor) —
// IDENTICAL shape to radio-group.md's post-ADR-0095 shape (name/disabled/required/orientation, no variant).
const SC_ATTR_NAMES = ['name', 'disabled', 'required', 'orientation']

describe('segmented-control.md descriptor — structural validity (s10 part a)', () => {
  it('carries the ADR-0004 / plan §10 descriptor field set as top-level keys', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(scParsed.topLevelKeys.has(field), `missing descriptor field: ${field}`).toBe(true)
  })

  it('tag=ui-segmented-control, extends=UIFormElement, tier=pattern, face.formAssociated=true', () => {
    expect(/^tag:\s*ui-segmented-control\s*$/m.test(scFence)).toBe(true)
    expect(/^extends:\s*UIFormElement\b/m.test(scFence)).toBe(true)
    expect(/^tier:\s*pattern\b/m.test(scFence)).toBe(true)
    expect(/formAssociated:\s*true/.test(scFence)).toBe(true)
  })

  it('validateComponentDescriptor reports ZERO structural failures (schema-valid)', () => {
    // anti-vacuous: all 4 attributes parse before the schema is consulted
    expect(scParsed.attributes.map((a) => a.name)).toEqual(SC_ATTR_NAMES)
    expect(validateComponentDescriptor(scParsed)).toEqual([])
  })
})

describe('segmented-control.md descriptor — contract↔props trip-wire (s10 part b)', () => {
  it('attributes[] is a faithful bijection with UISegmentedControlElement.props (0 drift)', () => {
    expect(scParsed.attributes.map((a) => a.name)).toEqual(SC_ATTR_NAMES)
    expect(compareDescriptorToProps(scParsed.attributes, UISegmentedControlElement.props)).toEqual([])
  })

  it('a drifted attribute FAILS the trip-wire (negative control — reflect + default)', () => {
    const flipReflect = scParsed.attributes.map((a) => (a.name === 'disabled' ? { ...a, reflect: false } : { ...a }))
    expect(compareDescriptorToProps(flipReflect, UISegmentedControlElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_REFLECT', path: 'attributes.disabled.reflect' }),
    )
    const flipDefault = scParsed.attributes.map((a) => (a.name === 'name' ? { ...a, default: 'bogus' } : { ...a }))
    expect(compareDescriptorToProps(flipDefault, UISegmentedControlElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_DEFAULT', path: 'attributes.name.default' }),
    )
  })

  it('a removed or added attribute FAILS the trip-wire (negative control — bijection both ways)', () => {
    const dropName = scParsed.attributes.filter((a) => a.name !== 'name')
    expect(compareDescriptorToProps(dropName, UISegmentedControlElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_MISSING', path: 'attributes.name' }),
    )
    const addBogus = [...scParsed.attributes, { name: 'bogus', type: 'string', default: '', reflect: false }]
    expect(compareDescriptorToProps(addBogus, UISegmentedControlElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_EXTRA', path: 'attributes.bogus' }),
    )
  })
})
