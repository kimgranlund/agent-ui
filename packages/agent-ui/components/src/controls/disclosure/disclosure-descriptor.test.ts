import { describe, it, expect } from 'vitest'
import { UIDisclosureElement } from './disclosure.ts'
import {
  splitFrontmatter,
  parseDescriptor,
  validateComponentDescriptor,
  compareDescriptorToProps,
  compareDescriptorToSource,
  type ParsedAttribute,
} from '../../descriptor/component-descriptor.ts'
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// content-family M1-a — disclosure.md descriptor (ADR-0004; content-family LLD-C10; SPEC-R14…R18).
// Three layers, mirroring the modal/select descriptor probes:
//   (a) STRUCTURAL — the frontmatter parses and is schema-valid (zero tolerated failures; UIElement is
//       already a known BASE_CLASSES member, unlike modal's UIContainerElement s9-pending caveat).
//   (b) CONTRACT↔PROPS — attributes[] is a faithful bijection with the live UIDisclosureElement.props.
//   (c) CONTRACT↔SOURCE — customStates/slots tell the truth about the .ts/.css source (compareDescriptorToSource).

const DISCLOSURE = `${process.cwd()}/packages/agent-ui/components/src/controls/disclosure`
const md = readFileSync(`${DISCLOSURE}/disclosure.md`, 'utf8') as string
const ts = readFileSync(`${DISCLOSURE}/disclosure.ts`, 'utf8') as string
const css = readFileSync(`${DISCLOSURE}/disclosure.css`, 'utf8') as string

const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)

const ATTR_NAMES = ['open', 'summary']

describe('disclosure.md descriptor — frontmatter parses + schema-valid', () => {
  it('has a leading frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body.trim().length).toBeGreaterThan(0)
    expect(body).toContain('# ui-disclosure')
  })

  it('carries the ADR-0004 / plan §10 descriptor field set as top-level keys', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing descriptor field: ${field}`).toBe(true)
  })

  it('tag is ui-disclosure, extends UIElement, tier is pattern, and face is NOT form-associated', () => {
    expect(/^tag:\s*ui-disclosure\s*$/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIElement\b/m.test(fence)).toBe(true)
    expect(/^tier:\s*pattern\b/m.test(fence)).toBe(true) // geometry.md names "accordion" under Pattern
    expect(/formAssociated:\s*false/.test(fence)).toBe(true) // a <details> is not a form widget (ADR-0113 Context)
  })

  it('validateComponentDescriptor reports ZERO structural failures', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES) // anti-vacuous anchor
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })
})

describe('disclosure.md descriptor — the bindable open + the toggle event + parts', () => {
  it('records the bindable `open` (reflected boolean) + the toggle event (ADR-0019/ADR-0101)', () => {
    const open = parsed.attributes.find((a) => a.name === 'open')
    expect(open?.type).toBe('boolean')
    expect(open?.default).toBe('false')
    expect(open?.reflect).toBe(true)
    const events = (parsed.sequences.get('events') ?? []).map((i) => i.get('name'))
    expect(events).toEqual(['toggle']) // the ONE event — no click, no open/close (SPEC-R15)
  })

  it('records the bindable `summary` (reflected string, default empty)', () => {
    const summary = parsed.attributes.find((a) => a.name === 'summary')
    expect(summary?.type).toBe('string')
    expect(summary?.default).toBe('')
    expect(summary?.reflect).toBe(true)
  })

  it('declares the FIVE parts (not user slots) — details/summary/chevron/summary-text/body', () => {
    const parts = (parsed.sequences.get('parts') ?? []).map((i) => i.get('name'))
    expect(parts).toEqual(['details', 'summary', 'chevron', 'summary-text', 'body'])
  })

  it('declares NO customStates (no :state() hooks — [open] is the native <details> attribute)', () => {
    expect(parsed.sequences.get('customStates')).toEqual([])
  })
})

describe('disclosure.md descriptor — contract↔props trip-wire', () => {
  it('attributes[] is a faithful bijection with UIDisclosureElement.props (0 drift)', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES) // anti-vacuous anchor
    expect(compareDescriptorToProps(parsed.attributes, UIDisclosureElement.props)).toEqual([])
  })

  it('a drifted attribute FAILS the trip-wire (negative control — reflect + default)', () => {
    const flipReflect: ParsedAttribute[] = parsed.attributes.map((a) => (a.name === 'open' ? { ...a, reflect: false } : { ...a }))
    expect(compareDescriptorToProps(flipReflect, UIDisclosureElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_REFLECT', path: 'attributes.open.reflect' }),
    )

    const flipDefault: ParsedAttribute[] = parsed.attributes.map((a) => (a.name === 'summary' ? { ...a, default: 'x' } : { ...a }))
    expect(compareDescriptorToProps(flipDefault, UIDisclosureElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_DEFAULT', path: 'attributes.summary.default' }),
    )
  })

  it('a removed or added attribute FAILS the trip-wire (negative control — bijection both ways)', () => {
    const dropOpen: ParsedAttribute[] = parsed.attributes.filter((a) => a.name !== 'open')
    expect(compareDescriptorToProps(dropOpen, UIDisclosureElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_MISSING', path: 'attributes.open' }),
    )

    const addBogus: ParsedAttribute[] = [...parsed.attributes, { name: 'bogus', type: 'string', default: '', reflect: false }]
    expect(compareDescriptorToProps(addBogus, UIDisclosureElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_EXTRA', path: 'attributes.bogus' }),
    )
  })
})

describe('disclosure.md descriptor — contract↔source trip-wire (customStates/slots vs the real .ts/.css)', () => {
  it('agrees with the source: no undocumented/unused states, no undocumented styled slot', () => {
    expect(compareDescriptorToSource(parsed, { ts, css })).toEqual([])
  })

  it('NEGATIVE control: an undocumented customStates entry is caught (STATE_UNUSED)', () => {
    const bogusStates = new Map(parsed.sequences)
    bogusStates.set('customStates', [new Map([['#scalar', 'bogus-state']])])
    const bogusParsed = { ...parsed, sequences: bogusStates }
    expect(compareDescriptorToSource(bogusParsed, { ts, css })).toContainEqual(
      expect.objectContaining({ code: 'STATE_UNUSED', path: 'customStates.bogus-state' }),
    )
  })
})
