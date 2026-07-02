import { describe, it, expect } from 'vitest'
import { UIFieldElement } from './field.ts'
import {
  splitFrontmatter,
  parseDescriptor,
  validateComponentDescriptor,
  compareDescriptorToProps,
} from '../../descriptor/component-descriptor.ts'
import type { ParsedAttribute } from '../../descriptor/component-descriptor.ts'
// Read field.md as text (no `@types/node` devDep — same readFileSync approach as the button s10 probe).
// @ts-expect-error - node:fs is untyped without @types/node; vitest/node resolves it at runtime
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// G7 s10 — field.md descriptor (ADR-0004 / ADR-0051 / LLD-C4/C6, field-form-provider.lld.md §4). Two layers,
// both targeting the fence:
//   • (a) STRUCTURAL — the YAML frontmatter parses and is schema-valid: validateComponentDescriptor reports
//     ZERO failures (extends UIElement accepted by BASE_CLASSES; face.formAssociated=false — a structural
//     wrapper, not itself form-associated). Self-contained — it needs only field.md.
//   • (b) CONTRACT↔PROPS — the descriptor's `attributes[]` is a faithful BIJECTION with the live
//     `UIFieldElement.props` (LLD-C4: label + description, both plain un-reflected strings), via the
//     fleet-wide compareDescriptorToProps trip-wire; a drifted / added / removed attribute FAILS (the
//     negative control). The contract↔source check (customStates/slots vs the .ts/.css) is NOT this slice's
//     concern.
// The fence READER + schema + trip-wire all live in ../../descriptor/component-descriptor.ts (one parser,
// proven fleet-wide in src/descriptor/*; reused here, never a divergent copy).

const FIELD = `${process.cwd()}/packages/agent-ui/components/src/controls/field`
const md = readFileSync(`${FIELD}/field.md`, 'utf8') as string

const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)

// The settled attribute surface, in declaration order on the fence — an anti-vacuous anchor for both layers.
const ATTR_NAMES = ['label', 'description']

describe('field.md descriptor — frontmatter parses + schema-valid (s10 part a)', () => {
  it('has a leading frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body.trim().length).toBeGreaterThan(0)
    expect(body).toContain('# ui-field') // the /site doc prose, not the contract
  })

  it('carries the ADR-0004 / plan §10 descriptor field set as top-level keys', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing descriptor field: ${field}`).toBe(true)
  })

  it('tag is ui-field, extends UIElement, and face records a structural (non-form-associated) wrapper', () => {
    expect(/^tag:\s*ui-field\s*$/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIElement\b/m.test(fence)).toBe(true) // NOT UIFormElement — carries no form value of its own
    expect(/formAssociated:\s*false/.test(fence)).toBe(true)
  })

  it('validateComponentDescriptor reports ZERO structural failures (schema-valid, self-contained)', () => {
    // anti-vacuous: the reader actually parsed the two attributes (in order) before the schema is consulted
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })
})

describe('field.md descriptor — contract↔props trip-wire (s10 part b)', () => {
  it('attributes[] is a faithful bijection with finalize(UIFieldElement).props (0 drift)', () => {
    // anti-vacuous: the two attribute names parsed before the trip-wire is consulted
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(compareDescriptorToProps(parsed.attributes, UIFieldElement.props)).toEqual([])
  })

  it('a drifted attribute FAILS the trip-wire (negative control — reflect + default)', () => {
    // mutate a COPY of the parsed descriptor (field.md is never touched); each patch flips ONE field.
    const flipReflect: ParsedAttribute[] = parsed.attributes.map((a) => (a.name === 'label' ? { ...a, reflect: true } : { ...a }))
    expect(compareDescriptorToProps(flipReflect, UIFieldElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_REFLECT', path: 'attributes.label.reflect' }),
    )

    const flipDefault: ParsedAttribute[] = parsed.attributes.map((a) => (a.name === 'label' ? { ...a, default: 'x' } : { ...a }))
    expect(compareDescriptorToProps(flipDefault, UIFieldElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_DEFAULT', path: 'attributes.label.default' }),
    )
  })

  it('a removed or added attribute FAILS the trip-wire (negative control — bijection both ways)', () => {
    // DROP a live attribute → the live prop has no descriptor row (DRIFT_MISSING).
    const dropDescription: ParsedAttribute[] = parsed.attributes.filter((a) => a.name !== 'description')
    expect(compareDescriptorToProps(dropDescription, UIFieldElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_MISSING', path: 'attributes.description' }),
    )

    // ADD a phantom attribute → the descriptor row has no live prop (DRIFT_EXTRA).
    const addBogus: ParsedAttribute[] = [...parsed.attributes, { name: 'bogus', type: 'string', default: '', reflect: false }]
    expect(compareDescriptorToProps(addBogus, UIFieldElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_EXTRA', path: 'attributes.bogus' }),
    )
  })
})
