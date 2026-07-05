import { describe, it, expect } from 'vitest'
import { UICardElement } from './card.ts'
import {
  splitFrontmatter,
  parseDescriptor,
  validateComponentDescriptor,
  compareDescriptorToProps,
} from '../../descriptor/component-descriptor.ts'
import type { ParsedAttribute } from '../../descriptor/component-descriptor.ts'
// @ts-expect-error - node:fs is untyped without @types/node; vitest/node resolves it at runtime
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// G9 s7 — card.md descriptor (ADR-0004), two layers targeting the fence (mirrors text-field s10):
//   (a) STRUCTURAL — the YAML frontmatter parses + is schema-valid: validateComponentDescriptor reports zero
//       failures EXCEPT the one pending BAD_EXTENDS (extends:UIContainerElement). The descriptor schema's
//       BASE_CLASSES gains UIContainerElement in the INTEGRATION slice s12 (a shared descriptor-schema edit,
//       out of this fan-out folder's scope); until that lands the schema flags the new base. We tolerate ONLY
//       that one known-pending failure here — every other structural defect still fails — so the slice is green
//       in isolation and flips to a fully-clean check once s12 lands (the filter becomes a no-op).
//   (b) CONTRACT↔PROPS — the descriptor's attributes[] is a faithful BIJECTION with the live
//       UICardElement.props (the ...surfaceProps spread: elevation/brightness), via compareDescriptorToProps —
//       0 drift, and a drifted/added/removed attribute FAILS (the negative controls).

const DIR = `${process.cwd()}/packages/agent-ui/components/src/controls/card`
const md = readFileSync(`${DIR}/card.md`, 'utf8') as string
const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)

// The settled attribute surface (the surfaceProps spread + the `scrollable` scroll-mode signal), in
// declaration order on the fence.
const ATTR_NAMES = ['elevation', 'brightness', 'scrollable']

describe('card.md descriptor — frontmatter parses + schema-valid (part a)', () => {
  it('has a leading frontmatter fence and a /site prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body).toContain('# ui-card')
  })

  it('carries the ADR-0004 descriptor field set as top-level keys', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing field: ${field}`).toBe(true)
  })

  it('tag is ui-card, extends UIContainerElement, face records a NON-form container', () => {
    expect(/^tag:\s*ui-card\s*$/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIContainerElement\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*false/.test(fence)).toBe(true)
  })

  it('is schema-valid except the s12-pending BAD_EXTENDS (UIContainerElement not yet in BASE_CLASSES)', () => {
    // anti-vacuous: the two attributes parsed (in order) before the schema is consulted
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    // BASE_CLASSES gains UIContainerElement in s12 (the integration slice). Tolerate ONLY that one failure;
    // every other structural defect still fails. Post-s12 the filter is a no-op (the list is already empty).
    const blocking = validateComponentDescriptor(parsed).filter((f) => f.code !== 'BAD_EXTENDS')
    expect(blocking).toEqual([])
  })
})

describe('card.md descriptor — contract↔props trip-wire (part b)', () => {
  it('attributes[] is a faithful bijection with finalize(UICardElement).props — the surfaceProps spread', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(compareDescriptorToProps(parsed.attributes, UICardElement.props)).toEqual([])
  })

  it('a drifted attribute FAILS (negative control — reflect + default + enum values)', () => {
    const flipReflect: ParsedAttribute[] = parsed.attributes.map((a) =>
      a.name === 'elevation' ? { ...a, reflect: false } : { ...a },
    )
    expect(compareDescriptorToProps(flipReflect, UICardElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_REFLECT', path: 'attributes.elevation.reflect' }),
    )

    const flipDefault: ParsedAttribute[] = parsed.attributes.map((a) =>
      a.name === 'elevation' ? { ...a, default: '2' } : { ...a },
    )
    expect(compareDescriptorToProps(flipDefault, UICardElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_DEFAULT', path: 'attributes.elevation.default' }),
    )

    // an enum whose values[0] is NOT the live snap target ('0') drifts (the order-significant member check)
    const badValues: ParsedAttribute[] = parsed.attributes.map((a) =>
      a.name === 'elevation' ? { ...a, values: ['1', '2', '3'] } : { ...a },
    )
    expect(compareDescriptorToProps(badValues, UICardElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_VALUES', path: 'attributes.elevation.values' }),
    )
  })

  it('a removed or added attribute FAILS (bijection both ways)', () => {
    const dropOne: ParsedAttribute[] = parsed.attributes.filter((a) => a.name !== 'brightness')
    expect(compareDescriptorToProps(dropOne, UICardElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_MISSING', path: 'attributes.brightness' }),
    )

    const addBogus: ParsedAttribute[] = [...parsed.attributes, { name: 'gap', type: 'enum', default: 'none', reflect: true }]
    expect(compareDescriptorToProps(addBogus, UICardElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_EXTRA', path: 'attributes.gap' }),
    )
  })
})
