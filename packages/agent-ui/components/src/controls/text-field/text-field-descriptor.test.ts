import { describe, it, expect } from 'vitest'
import { UITextFieldElement } from './text-field.ts'
import {
  splitFrontmatter,
  parseDescriptor,
  validateComponentDescriptor,
  compareDescriptorToProps,
} from '../../descriptor/component-descriptor.ts'
import type { ParsedAttribute } from '../../descriptor/component-descriptor.ts'
// Read text-field.md as text (no `@types/node` devDep — same readFileSync approach as the button s10 probe).
// @ts-expect-error - node:fs is untyped without @types/node; vitest/node resolves it at runtime
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// G6 s10 — text-field.md descriptor (ADR-0004 / ADR-0013 / ADR-0014). Two layers, both targeting the fence:
//   • (a) STRUCTURAL — the YAML frontmatter parses and is schema-valid: validateComponentDescriptor reports
//     ZERO failures (extends UIFormElement accepted by BASE_CLASSES; face.formAssociated=true). Self-contained
//     — it needs only text-field.md, so it stands even before the control class lands.
//   • (b) CONTRACT↔PROPS — the descriptor's `attributes[]` is a faithful BIJECTION with the live
//     `UITextFieldElement.props` (what `finalize` installs from), via the fleet-wide compareDescriptorToProps
//     trip-wire: the eight attributes (the ...UIFormElement.formProps spread name/disabled/required, plus
//     value/label/placeholder/size/readonly) agree on type/default/reflect/enum-values, and a drifted /
//     added / removed attribute FAILS (the negative control). The contract↔source check (customStates/slots
//     vs the .ts/.css) is NOT this slice's concern.
// The fence READER + schema + trip-wire all live in ../../descriptor/component-descriptor.ts (one parser,
// proven fleet-wide in src/descriptor/*; reused here, never a divergent copy).

const TF = `${process.cwd()}/packages/agent-ui/components/src/controls/text-field`
const md = readFileSync(`${TF}/text-field.md`, 'utf8') as string

const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)

// The settled attribute surface, in declaration order on the fence (anti-vacuous anchor for both layers).
// Wave 3 growth: `type` added after `size` (the Wave-3 field-variant axis — ADR-0044).
const ATTR_NAMES = ['value', 'label', 'placeholder', 'size', 'type', 'readonly', 'name', 'disabled', 'required']

describe('text-field.md descriptor — frontmatter parses + schema-valid (s10 part a)', () => {
  it('has a leading frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body.trim().length).toBeGreaterThan(0)
    expect(body).toContain('# ui-text-field') // the /site doc prose, not the contract
  })

  it('carries the ADR-0004 / plan §10 descriptor field set as top-level keys', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing descriptor field: ${field}`).toBe(true)
  })

  it('tag is ui-text-field, extends UIFormElement, and face records a form-associated control', () => {
    expect(/^tag:\s*ui-text-field\s*$/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIFormElement\b/m.test(fence)).toBe(true) // a FACE form control
    expect(/formAssociated:\s*true/.test(fence)).toBe(true)
  })

  it('validateComponentDescriptor reports ZERO structural failures (schema-valid, self-contained)', () => {
    // anti-vacuous: the reader actually parsed the eight attributes (in order) before the schema is consulted
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })
})

describe('text-field.md descriptor — contract↔props trip-wire (s10 part b)', () => {
  it('attributes[] is a faithful bijection with finalize(UITextFieldElement).props (0 drift)', () => {
    // anti-vacuous: the eight attribute names parsed before the trip-wire is consulted
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(compareDescriptorToProps(parsed.attributes, UITextFieldElement.props)).toEqual([])
  })

  it('a drifted attribute FAILS the trip-wire (negative control — reflect + default)', () => {
    // mutate a COPY of the parsed descriptor (text-field.md is never touched); each patch flips ONE field.
    const flipReflect: ParsedAttribute[] = parsed.attributes.map((a) => (a.name === 'size' ? { ...a, reflect: false } : { ...a }))
    expect(compareDescriptorToProps(flipReflect, UITextFieldElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_REFLECT', path: 'attributes.size.reflect' }),
    )

    const flipDefault: ParsedAttribute[] = parsed.attributes.map((a) => (a.name === 'size' ? { ...a, default: 'sm' } : { ...a }))
    expect(compareDescriptorToProps(flipDefault, UITextFieldElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_DEFAULT', path: 'attributes.size.default' }),
    )
  })

  it('a removed or added attribute FAILS the trip-wire (negative control — bijection both ways)', () => {
    // DROP a live attribute → the live prop has no descriptor row (DRIFT_MISSING).
    const dropValue: ParsedAttribute[] = parsed.attributes.filter((a) => a.name !== 'value')
    expect(compareDescriptorToProps(dropValue, UITextFieldElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_MISSING', path: 'attributes.value' }),
    )

    // ADD a phantom attribute → the descriptor row has no live prop (DRIFT_EXTRA).
    const addBogus: ParsedAttribute[] = [...parsed.attributes, { name: 'bogus', type: 'string', default: '', reflect: false }]
    expect(compareDescriptorToProps(addBogus, UITextFieldElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_EXTRA', path: 'attributes.bogus' }),
    )
  })
})
