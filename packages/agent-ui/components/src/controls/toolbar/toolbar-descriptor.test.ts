import { describe, it, expect } from 'vitest'
import { UIToolbarElement } from './toolbar.ts'
import {
  splitFrontmatter,
  parseDescriptor,
  validateComponentDescriptor,
  compareDescriptorToProps,
  compareDescriptorToSource,
  collectUsedStates,
  collectStyledSlots,
  type ParsedAttribute,
} from '../../descriptor/component-descriptor.ts'
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// toolbar-descriptor.test.ts — toolbar.lld.md LLD-C7 (ADR-0121). Three layers against the toolbar.md fence:
//   (a) STRUCTURAL — the YAML frontmatter parses + is schema-valid (UIContainerElement is a live BASE_CLASSES
//       member — no deferred BAD_EXTENDS filter needed, the toast-region-descriptor.test.ts precedent).
//   (b) CONTRACT↔PROPS — the descriptor `attributes[]` is a faithful bijection with the live
//       UIToolbarElement.props (the surfaceProps spread + orientation/align/justify/gap/overflow/label).
//   (c) CONTRACT↔SOURCE — customStates/slots tell the truth: toolbar carries neither (host-as-flex, no
//       internals.states of its own, no :state()/[slot=…] anywhere in the source).

const DIR = `${process.cwd()}/packages/agent-ui/components/src/controls/toolbar`
const md = readFileSync(`${DIR}/toolbar.md`, 'utf8') as string
const ts = readFileSync(`${DIR}/toolbar.ts`, 'utf8') as string
const css = readFileSync(`${DIR}/toolbar.css`, 'utf8') as string

const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)

// The settled attribute surface, in declaration order (anti-vacuous anchor): the surfaceProps spread then the
// toolbar-own props.
const ATTR_NAMES = ['elevation', 'brightness', 'orientation', 'align', 'justify', 'gap', 'overflow', 'label']

describe('toolbar.md descriptor — frontmatter parses + schema-valid', () => {
  it('has a leading frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body.trim().length).toBeGreaterThan(0)
    expect(body).toContain('# ui-toolbar')
  })

  it('carries the ADR-0004 / plan §10 descriptor field set as top-level keys', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing descriptor field: ${field}`).toBe(true)
  })

  it('tag=ui-toolbar, tier=pattern, extends UIContainerElement, face NOT form-associated', () => {
    expect(/^tag:\s*ui-toolbar\s*$/m.test(fence)).toBe(true)
    expect(/^tier:\s*pattern\b/m.test(fence)).toBe(true) // geometry.md names toolbar explicitly as a Pattern-class example
    expect(/^extends:\s*UIContainerElement\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*false/.test(fence)).toBe(true)
  })

  it('declares role=toolbar via internals (never a host attribute) + the orientation/label ARIA sources', () => {
    expect(fence).toMatch(/role:\s*toolbar\b/)
    expect(fence).toMatch(/roleSource:\s*internals\b/)
    expect(fence).toMatch(/orientationSource:.*internals\.ariaOrientation/)
    expect(fence).toMatch(/labelSource:.*internals\.ariaLabel/)
  })

  it('declares no [size]/[density]/[wrap]/[reflow]/[posture] attribute (SPEC-R2/R5/R8 fences)', () => {
    const names = new Set(parsed.attributes.map((a) => a.name))
    for (const banned of ['size', 'density', 'wrap', 'reflow', 'posture']) expect(names.has(banned)).toBe(false)
  })

  it('validateComponentDescriptor reports ZERO structural failures (UIContainerElement is a live base — no deferred filter)', () => {
    // anti-vacuous: the reader actually parsed all 8 attributes (in order) before the schema is consulted
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })
})

describe('toolbar.md descriptor — contract↔props trip-wire', () => {
  it('attributes[] is a faithful bijection with finalize(UIToolbarElement).props (0 drift)', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES) // anti-vacuous
    expect(compareDescriptorToProps(parsed.attributes, UIToolbarElement.props)).toEqual([])
  })

  it('align defaults center (the bar look, NOT ui-row\'s start); gap defaults sm (NOT ui-row\'s none)', () => {
    const align = parsed.attributes.find((a) => a.name === 'align')
    const gap = parsed.attributes.find((a) => a.name === 'gap')
    expect(align?.default).toBe('center')
    expect(gap?.default).toBe('sm')
  })

  it('overflow defaults wrap (F4 — never hides an action); label defaults the empty string', () => {
    const overflow = parsed.attributes.find((a) => a.name === 'overflow')
    const label = parsed.attributes.find((a) => a.name === 'label')
    expect(overflow?.values).toEqual(['wrap', 'scroll'])
    expect(overflow?.default).toBe('wrap')
    expect(label?.type).toBe('string')
    expect(label?.default).toBe('')
  })

  it('a drifted attribute FAILS the trip-wire (negative control — reflect + default + bijection)', () => {
    const flipReflect: ParsedAttribute[] = parsed.attributes.map((a) => (a.name === 'orientation' ? { ...a, reflect: false } : { ...a }))
    expect(compareDescriptorToProps(flipReflect, UIToolbarElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_REFLECT', path: 'attributes.orientation.reflect' }),
    )

    const flipDefault: ParsedAttribute[] = parsed.attributes.map((a) => (a.name === 'align' ? { ...a, default: 'start' } : { ...a }))
    expect(compareDescriptorToProps(flipDefault, UIToolbarElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_DEFAULT', path: 'attributes.align.default' }),
    )

    const addBogus: ParsedAttribute[] = [...parsed.attributes, { name: 'bogus', type: 'string', default: '', reflect: false }]
    expect(compareDescriptorToProps(addBogus, UIToolbarElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_EXTRA', path: 'attributes.bogus' }),
    )
  })

  it('a removed attribute FAILS the trip-wire (negative control — bijection both ways)', () => {
    const dropGap: ParsedAttribute[] = parsed.attributes.filter((a) => a.name !== 'gap')
    expect(compareDescriptorToProps(dropGap, UIToolbarElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_MISSING', path: 'attributes.gap' }),
    )
  })
})

describe('toolbar.ts — posture is surface-only (SPEC-R8 AC2)', () => {
  it('carries no position/anchor/popover/ResizeObserver machinery and imports no overlay/dismissal trait', () => {
    for (const banned of ['position:', 'showPopover', 'hidePopover', 'ResizeObserver', 'anchor']) {
      expect(ts.includes(banned), `toolbar.ts unexpectedly references "${banned}"`).toBe(false)
    }
    for (const overlayTrait of ['overlay-controller', 'dismissal']) {
      expect(ts.includes(overlayTrait), `toolbar.ts unexpectedly imports the "${overlayTrait}" trait`).toBe(false)
    }
  })
})

describe('toolbar.md descriptor — contract↔source trip-wire', () => {
  it('a host-as-flex pattern declares NO customStates and NO named slots — and the source uses none (0 drift)', () => {
    // anti-vacuous: prove the extractors find the EMPTY source facts (toolbar.ts has no internals.states,
    // toolbar.css no :state() / no [slot=…] selector — the children ARE the flex items, not slotted).
    expect([...collectUsedStates(ts, css)]).toEqual([])
    expect([...collectStyledSlots(css)]).toEqual([])
    expect(compareDescriptorToSource(parsed, { ts, css })).toEqual([])
  })

  it('events[] and slots[] and parts[] and customStates[] all parse as empty sequences (anti-vacuous)', () => {
    expect(parsed.sequences.get('events')).toEqual([])
    expect(parsed.sequences.get('slots')).toEqual([])
    expect(parsed.sequences.get('parts')).toEqual([])
    expect(parsed.sequences.get('customStates')).toEqual([])
  })

  it('a state used in source but undocumented FAILS (negative control)', () => {
    const withState = `${ts}\nthis.internals.states?.add('zzstate')`
    expect(compareDescriptorToSource(parsed, { ts: withState, css })).toContainEqual(
      expect.objectContaining({ code: 'STATE_UNDOCUMENTED', path: 'customStates.zzstate' }),
    )
  })
})
