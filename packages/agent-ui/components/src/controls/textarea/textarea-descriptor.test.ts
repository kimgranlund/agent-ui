import { describe, it, expect } from 'vitest'
import { UITextareaElement } from './textarea.ts'
import {
  splitFrontmatter,
  parseDescriptor,
  validateComponentDescriptor,
  compareDescriptorToProps,
} from '../../descriptor/component-descriptor.ts'
import type { ParsedAttribute } from '../../descriptor/component-descriptor.ts'
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// textarea.md descriptor (ADR-0004 / ADR-0013 / ADR-0134). Mirrors text-field-descriptor.test.ts's two-layer
// shape: (a) STRUCTURAL — the YAML frontmatter parses and is schema-valid; (b) CONTRACT↔PROPS — the
// descriptor's `attributes[]` is a faithful bijection with the live `UITextareaElement.props`.

const TA = `${process.cwd()}/packages/agent-ui/components/src/controls/textarea`
const md = readFileSync(`${TA}/textarea.md`, 'utf8') as string

const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)

// value/label/placeholder/rows/size/readonly (control-specific) + the spread formProps (name/disabled/required).
const ATTR_NAMES = ['value', 'label', 'placeholder', 'rows', 'size', 'readonly', 'name', 'disabled', 'required']

describe('textarea.md descriptor — frontmatter parses + schema-valid', () => {
  it('has a leading frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body.trim().length).toBeGreaterThan(0)
    expect(body).toContain('# ui-textarea')
  })

  it('carries the ADR-0004 / plan §10 descriptor field set as top-level keys', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing descriptor field: ${field}`).toBe(true)
  })

  it('tag is ui-textarea, extends UIFormElement, and face records a form-associated control', () => {
    expect(/^tag:\s*ui-textarea\s*$/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIFormElement\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*true/.test(fence)).toBe(true)
  })

  it('validateComponentDescriptor reports ZERO structural failures (schema-valid, self-contained)', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })
})

describe('textarea.md descriptor — contract↔props trip-wire', () => {
  it('attributes[] is a faithful bijection with finalize(UITextareaElement).props (0 drift)', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(compareDescriptorToProps(parsed.attributes, UITextareaElement.props)).toEqual([])
  })

  it('a drifted attribute FAILS the trip-wire (negative control — reflect + default)', () => {
    const flipReflect: ParsedAttribute[] = parsed.attributes.map((a) => (a.name === 'rows' ? { ...a, reflect: false } : { ...a }))
    expect(compareDescriptorToProps(flipReflect, UITextareaElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_REFLECT', path: 'attributes.rows.reflect' }),
    )

    const flipDefault: ParsedAttribute[] = parsed.attributes.map((a) => (a.name === 'size' ? { ...a, default: 'sm' } : { ...a }))
    expect(compareDescriptorToProps(flipDefault, UITextareaElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_DEFAULT', path: 'attributes.size.default' }),
    )
  })

  it('a removed or added attribute FAILS the trip-wire (negative control — bijection both ways)', () => {
    const dropValue: ParsedAttribute[] = parsed.attributes.filter((a) => a.name !== 'value')
    expect(compareDescriptorToProps(dropValue, UITextareaElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_MISSING', path: 'attributes.value' }),
    )

    const addBogus: ParsedAttribute[] = [...parsed.attributes, { name: 'bogus', type: 'string', default: '', reflect: false }]
    expect(compareDescriptorToProps(addBogus, UITextareaElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_EXTRA', path: 'attributes.bogus' }),
    )
  })
})
