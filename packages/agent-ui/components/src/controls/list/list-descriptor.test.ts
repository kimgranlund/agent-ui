import { describe, it, expect } from 'vitest'
import { UIListElement } from './list.ts'
import {
  splitFrontmatter,
  parseDescriptor,
  validateComponentDescriptor,
  compareDescriptorToProps,
} from '../../descriptor/component-descriptor.ts'
import type { ParsedAttribute } from '../../descriptor/component-descriptor.ts'
// Read list.md as text (no `@types/node` devDep — same readFileSync approach as the button/text-field probes).
// @ts-expect-error - node:fs is untyped without @types/node; vitest/node resolves it at runtime
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// G9 s5 — list.md descriptor (ADR-0004 / ADR-0015 / ADR-0016). Two layers, both targeting the fence:
//   • (a) STRUCTURAL — the YAML frontmatter parses and is schema-valid (validateComponentDescriptor). ONE
//     known-pending exception: the descriptor schema's BASE_CLASSES does not yet list UIContainerElement —
//     that one-line edit lands in s12 (the integration barrel slice; decomp s12 acceptance). Until then the
//     schema flags `extends: UIContainerElement` as a single BAD_EXTENDS; we tolerate EXACTLY that (and pin
//     `extends` to UIContainerElement by regex so the tolerance can't mask a wrong base). Post-s12 the filter
//     is a no-op. *** FLAGGED to s12 in the handoff. ***
//   • (b) CONTRACT↔PROPS — the descriptor's `attributes[]` is a faithful BIJECTION with the live
//     UIListElement.props (the two SPREAD sets: surfaceProps elevation/brightness + flexProps
//     align/justify/gap/wrap), via the fleet-wide compareDescriptorToProps trip-wire; a drifted/added/removed
//     attribute FAILS (the negative controls).
// The fence READER + schema + trip-wire all live in ../../descriptor/component-descriptor.ts (one parser,
// proven fleet-wide; reused here, never a divergent copy).

const DIR = `${process.cwd()}/packages/agent-ui/components/src/controls/list`
const md = readFileSync(`${DIR}/list.md`, 'utf8') as string

const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)

// The settled attribute surface, in declaration order on the fence (the spread order: surfaceProps then
// flexProps) — the anti-vacuous anchor for both layers.
const ATTR_NAMES = ['elevation', 'brightness', 'align', 'justify', 'gap', 'wrap']

describe('list.md descriptor — frontmatter parses + schema-valid (s5 part a)', () => {
  it('has a leading frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body.trim().length).toBeGreaterThan(0)
    expect(body).toContain('# ui-list') // the /site doc prose, not the contract
  })

  it('carries the ADR-0004 / plan §10 descriptor field set as top-level keys', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing descriptor field: ${field}`).toBe(true)
  })

  it('tag is ui-list, tier layout, extends UIContainerElement, and face records a NON-form container', () => {
    expect(/^tag:\s*ui-list\s*$/m.test(fence)).toBe(true)
    expect(/^tier:\s*layout\b/m.test(fence)).toBe(true) // the Container/layout size-class (no control height)
    expect(/^extends:\s*UIContainerElement\b/m.test(fence)).toBe(true) // the surface base — pins the base (the tolerance below can't mask a wrong one)
    expect(/formAssociated:\s*false/.test(fence)).toBe(true) // NOT form-associated
  })

  it('the role rides INTERNALS, not a host attribute (aria.role=list, roleSource=internals)', () => {
    // the s5 role-source contract: role=list is the host's ElementInternals semantic, NEVER a host `role` attr
    expect(/role:\s*list\b/.test(fence)).toBe(true)
    expect(/roleSource:\s*internals\b/.test(fence)).toBe(true)
  })

  it('validateComponentDescriptor reports ZERO structural failures, modulo the s12-pending BASE_CLASSES edit', () => {
    // anti-vacuous: the reader actually parsed the six attributes (in order) before the schema is consulted
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    const failures = validateComponentDescriptor(parsed)
    // UIContainerElement joins BASE_CLASSES in s12; until then `extends` is the ONE tolerated BAD_EXTENDS.
    // Every OTHER field must be schema-clean now; post-s12 this filter removes nothing (the assertion holds
    // in both states). The wrong-base hole is closed by the `extends: UIContainerElement` regex pin above.
    const residual = failures.filter((f) => !(f.code === 'BAD_EXTENDS' && f.path === 'extends'))
    expect(residual).toEqual([])
  })
})

describe('list.md descriptor — contract↔props trip-wire (s5 part b)', () => {
  it('attributes[] is a faithful bijection with UIListElement.props (0 drift — the surfaceProps + flexProps spread)', () => {
    // anti-vacuous: the six attribute names parsed before the trip-wire is consulted
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(compareDescriptorToProps(parsed.attributes, UIListElement.props)).toEqual([])
  })

  it('a drifted attribute FAILS the trip-wire (negative control — reflect + default)', () => {
    // mutate a COPY of the parsed descriptor (list.md is never touched); each patch flips ONE field.
    const flipReflect: ParsedAttribute[] = parsed.attributes.map((a) => (a.name === 'gap' ? { ...a, reflect: false } : { ...a }))
    expect(compareDescriptorToProps(flipReflect, UIListElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_REFLECT', path: 'attributes.gap.reflect' }),
    )

    const flipDefault: ParsedAttribute[] = parsed.attributes.map((a) => (a.name === 'align' ? { ...a, default: 'center' } : { ...a }))
    expect(compareDescriptorToProps(flipDefault, UIListElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_DEFAULT', path: 'attributes.align.default' }),
    )
  })

  it('a removed or added attribute FAILS the trip-wire (negative control — bijection both ways)', () => {
    // DROP a live attribute → the live prop has no descriptor row (DRIFT_MISSING).
    const dropGap: ParsedAttribute[] = parsed.attributes.filter((a) => a.name !== 'gap')
    expect(compareDescriptorToProps(dropGap, UIListElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_MISSING', path: 'attributes.gap' }),
    )

    // ADD a phantom attribute → the descriptor row has no live prop (DRIFT_EXTRA).
    const addBogus: ParsedAttribute[] = [...parsed.attributes, { name: 'bogus', type: 'string', default: '', reflect: false }]
    expect(compareDescriptorToProps(addBogus, UIListElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_EXTRA', path: 'attributes.bogus' }),
    )
  })
})
