import { describe, it, expect } from 'vitest'
import { UIChoiceCardElement } from './choice-card.ts'
import {
  splitFrontmatter,
  parseDescriptor,
  validateComponentDescriptor,
  compareDescriptorToProps,
  compareDescriptorToSource,
} from '../../descriptor/component-descriptor.ts'
import type { ParsedAttribute } from '../../descriptor/component-descriptor.ts'
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// choice-card.md descriptor (ADR-0004 / ADR-0220). Three layers, all targeting the fence:
//   (a) STRUCTURAL — the YAML frontmatter parses + is schema-valid.
//   (b) CONTRACT↔PROPS — attributes[] is a faithful bijection with UIChoiceCardElement.props.
//   (c) CONTRACT↔SOURCE — customStates (`selected`) tells the truth about choice-card.ts/.css.

const DIR = `${process.cwd()}/packages/agent-ui/components/src/controls/choice-card`
const md = readFileSync(`${DIR}/choice-card.md`, 'utf8') as string
const ts = readFileSync(`${DIR}/choice-card.ts`, 'utf8') as string
const css = readFileSync(`${DIR}/choice-card.css`, 'utf8') as string

const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)

const ATTR_NAMES = ['value', 'disabled']

describe('choice-card.md descriptor — frontmatter parses + schema-valid (part a)', () => {
  it('has a leading frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body.trim().length).toBeGreaterThan(0)
    expect(body).toContain('# ui-choice-card')
  })

  it('carries the ADR-0004 / plan §10 descriptor field set as top-level keys', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing descriptor field: ${field}`).toBe(true)
  })

  it('tag is ui-choice-card, extends UIElement, and face records a NON-form-associated leaf', () => {
    expect(/^tag:\s*ui-choice-card\s*$/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIElement\b/m.test(fence)).toBe(true) // the GROUP is the form participant, not the card
    expect(/formAssociated:\s*false/.test(fence)).toBe(true)
  })

  it('validateComponentDescriptor reports ZERO structural failures', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })
})

describe('choice-card.md descriptor — contract↔props trip-wire (part b)', () => {
  it('attributes[] is a faithful bijection with finalize(UIChoiceCardElement).props (0 drift)', () => {
    expect(compareDescriptorToProps(parsed.attributes, UIChoiceCardElement.props)).toEqual([])
  })

  it('a drifted attribute FAILS the trip-wire (negative control — reflect + default)', () => {
    const flipReflect: ParsedAttribute[] = parsed.attributes.map((a) => (a.name === 'value' ? { ...a, reflect: false } : { ...a }))
    expect(compareDescriptorToProps(flipReflect, UIChoiceCardElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_REFLECT', path: 'attributes.value.reflect' }),
    )

    const flipDefault: ParsedAttribute[] = parsed.attributes.map((a) => (a.name === 'disabled' ? { ...a, default: 'true' } : { ...a }))
    expect(compareDescriptorToProps(flipDefault, UIChoiceCardElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_DEFAULT', path: 'attributes.disabled.default' }),
    )
  })

  it('a removed or added attribute FAILS the trip-wire (negative control — bijection both ways)', () => {
    const dropValue: ParsedAttribute[] = parsed.attributes.filter((a) => a.name !== 'value')
    expect(compareDescriptorToProps(dropValue, UIChoiceCardElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_MISSING', path: 'attributes.value' }),
    )

    const addBogus: ParsedAttribute[] = [...parsed.attributes, { name: 'variant', type: 'string', default: '', reflect: false }]
    expect(compareDescriptorToProps(addBogus, UIChoiceCardElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_EXTRA', path: 'attributes.variant' }),
    )
  })
})

describe('choice-card.md descriptor — contract↔source trip-wire (part c)', () => {
  it('customStates tells the truth about choice-card.ts/.css (0 source-drift)', () => {
    expect(compareDescriptorToSource(parsed, { ts, css })).toEqual([])
  })
})
