import { describe, it, expect } from 'vitest'
import { UIChoiceGroupElement } from './choice-group.ts'
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

// choice-group.md descriptor (ADR-0004 / ADR-0220). Three layers, all targeting the fence:
//   (a) STRUCTURAL — the YAML frontmatter parses + is schema-valid.
//   (b) CONTRACT↔PROPS — attributes[] is a faithful bijection with UIChoiceGroupElement.props
//       (the formProps spread [name/disabled/required] PLUS multiple/value/values/min/gap/label).
//   (c) CONTRACT↔SOURCE — customStates (`user-invalid`) tells the truth about choice-group.ts/.css.

const DIR = `${process.cwd()}/packages/agent-ui/components/src/controls/choice-group`
const md = readFileSync(`${DIR}/choice-group.md`, 'utf8') as string
const ts = readFileSync(`${DIR}/choice-group.ts`, 'utf8') as string
const css = readFileSync(`${DIR}/choice-group.css`, 'utf8') as string

const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)

const ATTR_NAMES = ['name', 'disabled', 'required', 'multiple', 'value', 'values', 'min', 'gap', 'label']

describe('choice-group.md descriptor — frontmatter parses + schema-valid (part a)', () => {
  it('has a leading frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body.trim().length).toBeGreaterThan(0)
    expect(body).toContain('# ui-choice-group')
  })

  it('carries the ADR-0004 / plan §10 descriptor field set as top-level keys', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing descriptor field: ${field}`).toBe(true)
  })

  it('tag is ui-choice-group, extends UIFormElement, and face records a form-associated container', () => {
    expect(/^tag:\s*ui-choice-group\s*$/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIFormElement\b/m.test(fence)).toBe(true) // composes rovingFocus+selectionCommit directly (cl.1), NOT a UIListboxElement subclass
    expect(/formAssociated:\s*true/.test(fence)).toBe(true)
  })

  it('validateComponentDescriptor reports ZERO structural failures', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })
})

describe('choice-group.md descriptor — contract↔props trip-wire (part b)', () => {
  it('attributes[] is a faithful bijection with finalize(UIChoiceGroupElement).props (0 drift)', () => {
    expect(compareDescriptorToProps(parsed.attributes, UIChoiceGroupElement.props)).toEqual([])
  })

  it('a drifted attribute FAILS the trip-wire (negative control — reflect + default)', () => {
    const flipReflect: ParsedAttribute[] = parsed.attributes.map((a) => (a.name === 'multiple' ? { ...a, reflect: false } : { ...a }))
    expect(compareDescriptorToProps(flipReflect, UIChoiceGroupElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_REFLECT', path: 'attributes.multiple.reflect' }),
    )

    const flipDefault: ParsedAttribute[] = parsed.attributes.map((a) => (a.name === 'gap' ? { ...a, default: 'lg' } : { ...a }))
    expect(compareDescriptorToProps(flipDefault, UIChoiceGroupElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_DEFAULT', path: 'attributes.gap.default' }),
    )
  })

  it('a removed or added attribute FAILS the trip-wire (negative control — bijection both ways)', () => {
    const dropValues: ParsedAttribute[] = parsed.attributes.filter((a) => a.name !== 'values')
    expect(compareDescriptorToProps(dropValues, UIChoiceGroupElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_MISSING', path: 'attributes.values' }),
    )

    const addBogus: ParsedAttribute[] = [...parsed.attributes, { name: 'orientation', type: 'string', default: '', reflect: false }]
    expect(compareDescriptorToProps(addBogus, UIChoiceGroupElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_EXTRA', path: 'attributes.orientation' }),
    )
  })

  it('the gap enum values are the declared bijection (negative control — a bogus member fails round-trip)', () => {
    const addBogusMember: ParsedAttribute[] = parsed.attributes.map((a) =>
      a.name === 'gap' ? { ...a, values: [...(a.values ?? []), 'huge'] } : { ...a },
    )
    expect(compareDescriptorToProps(addBogusMember, UIChoiceGroupElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_VALUES', path: 'attributes.gap.values' }),
    )
  })
})

describe('choice-group.md descriptor — contract↔source trip-wire (part c)', () => {
  it('customStates tells the truth about choice-group.ts/.css (0 source-drift)', () => {
    expect(compareDescriptorToSource(parsed, { ts, css })).toEqual([])
  })
})
