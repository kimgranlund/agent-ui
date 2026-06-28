import { describe, it, expect } from 'vitest'
import { UIModalElement } from './modal.ts'
import {
  splitFrontmatter,
  parseDescriptor,
  validateComponentDescriptor,
  compareDescriptorToProps,
  type DescriptorFailure,
  type ParsedAttribute,
} from '../../descriptor/component-descriptor.ts'
// Read modal.md as text (no `@types/node` devDep — same readFileSync approach as the text-field s10 probe).
// @ts-expect-error - node:fs is untyped without @types/node; vitest/node resolves it at runtime
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// G9 s9 — modal.md descriptor (ADR-0004 / ADR-0017 / ADR-0019). Two layers, both targeting the fence:
//   • (a) STRUCTURAL — the YAML frontmatter parses and is schema-valid. ONE caveat: `extends:
//     UIContainerElement` is flagged BAD_EXTENDS until the integration slice s12 adds UIContainerElement to the
//     descriptor schema's BASE_CLASSES (a fleet-schema edit deferred to the single integration writer — see the
//     decomp s12 acceptance + the handoff escalation). So we tolerate EXACTLY that one pending failure and
//     require every other field schema-clean; once s12 lands, the filter still passes (failures == []).
//   • (b) CONTRACT↔PROPS — the descriptor's `attributes[]` is a faithful BIJECTION with the live
//     UIModalElement.props (the ...surfaceProps spread elevation/brightness + open/persistent), via the
//     fleet-wide compareDescriptorToProps trip-wire. Independent of BASE_CLASSES → a FULL green now.
// The fence READER + schema + trip-wire all live in ../../descriptor/component-descriptor.ts (one parser).

const MODAL = `${process.cwd()}/packages/agent-ui/components/src/controls/modal`
const md = readFileSync(`${MODAL}/modal.md`, 'utf8') as string

const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)

// The settled attribute surface, in declaration order on the fence (the spread surface axes first).
const ATTR_NAMES = ['elevation', 'brightness', 'open', 'persistent']

// UIContainerElement enters the descriptor BASE_CLASSES at the integration slice s12; until then `extends:
// UIContainerElement` is the ONE tolerated structural failure.
const pendingBaseClass = (f: DescriptorFailure): boolean => f.code === 'BAD_EXTENDS' && f.path === 'extends'

describe('modal.md descriptor — frontmatter parses + schema-valid (s9 part a)', () => {
  it('has a leading frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body.trim().length).toBeGreaterThan(0)
    expect(body).toContain('# ui-modal') // the /site doc prose, not the contract
  })

  it('carries the ADR-0004 / plan §10 descriptor field set as top-level keys', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing descriptor field: ${field}`).toBe(true)
  })

  it('tag is ui-modal, extends UIContainerElement, tier is pattern, and face is NOT form-associated', () => {
    expect(/^tag:\s*ui-modal\s*$/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIContainerElement\b/m.test(fence)).toBe(true) // the surface base (not a form base)
    expect(/^tier:\s*pattern\b/m.test(fence)).toBe(true) // geometry.md lists `dialog` under Pattern
    expect(/formAssociated:\s*false/.test(fence)).toBe(true) // a <dialog> is not a form widget (ADR-0017)
  })

  it('validateComponentDescriptor reports ZERO structural failures BEYOND the s12-pending BAD_EXTENDS', () => {
    // anti-vacuous: the reader actually parsed the four attributes (in order) before the schema is consulted
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    const failures = validateComponentDescriptor(parsed)
    expect(failures.filter((f) => !pendingBaseClass(f))).toEqual([]) // every OTHER field is schema-clean
    expect(failures.filter(pendingBaseClass).length).toBeLessThanOrEqual(1) // the lone pending failure (gone after s12)
  })
})

describe('modal.md descriptor — the bindable open + the dialog part (s9)', () => {
  it('records the bindable `open` (reflected boolean) + the close/toggle events (the two-way bind, ADR-0019)', () => {
    const open = parsed.attributes.find((a) => a.name === 'open')
    expect(open?.type).toBe('boolean')
    expect(open?.reflect).toBe(true)
    const events = (parsed.sequences.get('events') ?? []).map((i) => i.get('name'))
    expect(events).toContain('close')
    expect(events).toContain('toggle') // the value:{event:'toggle'} two-way signal
  })

  it('declares the dialog PART (not a user slot) and persistent defaults false', () => {
    const parts = (parsed.sequences.get('parts') ?? []).map((i) => i.get('name'))
    expect(parts).toContain('dialog')
    const persistent = parsed.attributes.find((a) => a.name === 'persistent')
    expect(persistent?.type).toBe('boolean')
    expect(persistent?.default).toBe('false') // default OFF
    expect(persistent?.reflect).toBe(true)
  })
})

describe('modal.md descriptor — contract↔props trip-wire (s9 part b)', () => {
  it('attributes[] is a faithful bijection with UIModalElement.props (0 drift)', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES) // anti-vacuous anchor
    expect(compareDescriptorToProps(parsed.attributes, UIModalElement.props)).toEqual([])
  })

  it('a drifted attribute FAILS the trip-wire (negative control — reflect + default)', () => {
    // mutate a COPY of the parsed descriptor (modal.md is never touched); each patch flips ONE field.
    const flipReflect: ParsedAttribute[] = parsed.attributes.map((a) => (a.name === 'open' ? { ...a, reflect: false } : { ...a }))
    expect(compareDescriptorToProps(flipReflect, UIModalElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_REFLECT', path: 'attributes.open.reflect' }),
    )

    const flipDefault: ParsedAttribute[] = parsed.attributes.map((a) => (a.name === 'persistent' ? { ...a, default: 'true' } : { ...a }))
    expect(compareDescriptorToProps(flipDefault, UIModalElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_DEFAULT', path: 'attributes.persistent.default' }),
    )
  })

  it('a removed or added attribute FAILS the trip-wire (negative control — bijection both ways)', () => {
    const dropOpen: ParsedAttribute[] = parsed.attributes.filter((a) => a.name !== 'open')
    expect(compareDescriptorToProps(dropOpen, UIModalElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_MISSING', path: 'attributes.open' }),
    )

    const addBogus: ParsedAttribute[] = [...parsed.attributes, { name: 'bogus', type: 'string', default: '', reflect: false }]
    expect(compareDescriptorToProps(addBogus, UIModalElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_EXTRA', path: 'attributes.bogus' }),
    )
  })
})
