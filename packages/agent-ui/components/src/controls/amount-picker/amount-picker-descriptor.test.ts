import { describe, it, expect } from 'vitest'
import { UIAmountPickerElement } from './amount-picker.ts'
import {
  splitFrontmatter,
  parseDescriptor,
  validateComponentDescriptor,
  compareDescriptorToProps,
  compareDescriptorToSource,
  collectUsedStates,
  collectStyledSlots,
  scalarSeq,
} from '../../descriptor/component-descriptor.ts'
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// amount-picker.md descriptor: structural validity, contract<->props and contract<->source trip-wires
// (the result-card-descriptor.test.ts shape; T-0196 Design).

const DIR = `${process.cwd()}/packages/agent-ui/components/src/controls/amount-picker`
const md = readFileSync(`${DIR}/amount-picker.md`, 'utf8') as string
const ts = readFileSync(`${DIR}/amount-picker.ts`, 'utf8') as string
const css = readFileSync(`${DIR}/amount-picker.css`, 'utf8') as string

const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)
const ATTR_NAMES = [
  'value', 'min', 'max', 'step', 'presets', 'slider', 'currency', 'unit', 'label',
  'actionName', 'actionLabel', 'size', 'inline', 'name', 'disabled', 'required',
]

describe('amount-picker.md descriptor: structural validity', () => {
  it('has a leading frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body).toContain('# ui-amount-picker')
  })

  it('carries the descriptor field set as top-level keys', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing descriptor field: ${field}`).toBe(true)
  })

  it('tag=ui-amount-picker, extends=UIFormElement, tier=pattern, face.formAssociated=true', () => {
    expect(/^tag:\s*ui-amount-picker\s*$/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIFormElement\b/m.test(fence)).toBe(true)
    expect(/^tier:\s*pattern\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*true/.test(fence)).toBe(true)
  })

  it('validateComponentDescriptor reports zero structural failures, attributes in the pinned order', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })

  it('events are exactly input, change and action (the ADR-0153 set); no slots, no custom states', () => {
    expect(scalarSeq(parsed, 'slots')).toEqual([])
    expect(scalarSeq(parsed, 'customStates')).toEqual([])
    const events = [...fence.slice(fence.indexOf('\nevents:'), fence.indexOf('\nslots:')).matchAll(/^\s+- name: (\w+)\s*$/gm)].map((m) => m[1])
    expect(events).toEqual(['input', 'change', 'action'])
  })

  it('the first body paragraph is the one inventory sentence (the dogfood budget pin)', () => {
    const afterHeading = body.slice(body.indexOf('# ui-amount-picker') + '# ui-amount-picker'.length).trim()
    expect(afterHeading.split(/\n\s*\n/)[0]).toBe(
      '`ui-amount-picker` picks one bounded number with minus and plus, optional preset chips and an optional slider, and commits it once.',
    )
  })
})

describe('amount-picker.md descriptor: contract<->props trip-wire', () => {
  it('the full bijection is clean', () => {
    expect(compareDescriptorToProps(parsed.attributes, UIAmountPickerElement.props)).toEqual([])
  })

  it('actionName and actionLabel are observed as kebab attributes and not reflected', () => {
    for (const [name, attribute] of [['actionName', 'action-name'], ['actionLabel', 'action-label']] as const) {
      const attr = parsed.attributes.find((a) => a.name === name)
      expect(attr?.attribute).toBe(attribute)
      expect(attr?.reflect).toBe(false)
    }
  })

  it('inline is the reflected boolean sizing opt-out (ADR-0223)', () => {
    const inline = parsed.attributes.find((a) => a.name === 'inline')
    expect(inline?.type).toBe('boolean')
    expect(inline?.reflect).toBe(true)
  })

  it('negative control: a removed or added attribute fails the trip-wire (isolated on `inline`)', () => {
    const inlineOnly = { inline: UIAmountPickerElement.props.inline }
    expect(compareDescriptorToProps([], inlineOnly)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_MISSING', path: 'attributes.inline' }),
    )
    const addBogus = [{ name: 'bogus', type: 'string', default: '', reflect: false }]
    expect(compareDescriptorToProps(addBogus, inlineOnly)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_EXTRA', path: 'attributes.bogus' }),
    )
  })
})

describe('amount-picker.md descriptor: contract<->source trip-wire', () => {
  it('customStates and slots tell the truth about amount-picker.ts and amount-picker.css', () => {
    expect([...collectUsedStates(ts, css)]).toEqual([])
    expect([...collectStyledSlots(css)]).toEqual([])
    expect(compareDescriptorToSource(parsed, { ts, css })).toEqual([])
  })

  it('every part amount-picker.ts builds is documented in parts[]', () => {
    const built = new Set([
      ...[...ts.matchAll(/part\('(?:div|span|button)', '([\w-]+)'\)/g)].map((m) => m[1]),
      ...[...ts.matchAll(/button\('([\w-]+)'\)/g)].map((m) => m[1]),
      ...[...ts.matchAll(/dataset\.part = '([\w-]+)'/g)].map((m) => m[1]),
    ])
    expect(built).toEqual(new Set(['label', 'stepper', 'decrease', 'readout', 'increase', 'presets', 'preset', 'commit', 'slider', 'glyph']))
    const documented = new Set([...fence.slice(fence.indexOf('\nparts:'), fence.indexOf('\ncustomStates:')).matchAll(/^\s+- name: ([\w-]+)\s*$/gm)].map((m) => m[1]))
    for (const name of built) expect(documented, `part ${name} is built but not documented`).toContain(name)
  })
})
