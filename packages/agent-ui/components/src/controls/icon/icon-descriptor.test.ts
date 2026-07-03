import { describe, it, expect } from 'vitest'
import { UIIconElement } from './icon.ts'
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
// @ts-expect-error - node:fs is untyped without @types/node; vitest/node resolves it at runtime
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// icon.md descriptor — the button/text-descriptor three-layer pattern: (s8) structural, (s10)
// contract↔props, (s11) contract↔source.

const ICN = `${process.cwd()}/packages/agent-ui/components/src/controls/icon`
const md = readFileSync(`${ICN}/icon.md`, 'utf8') as string
const ts = readFileSync(`${ICN}/icon.ts`, 'utf8') as string
const css = readFileSync(`${ICN}/icon.css`, 'utf8') as string

const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)
const ATTR_NAMES = ['name', 'label']

describe('icon.md descriptor — structural validity (s8)', () => {
  it('has a leading frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body.trim().length).toBeGreaterThan(0)
    expect(body).toContain('# ui-icon')
  })

  it('carries the ADR-0004 / plan §10 descriptor field set as top-level keys', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing descriptor field: ${field}`).toBe(true)
  })

  it('tag=ui-icon, extends=UIElement, tier=display, face.formAssociated=false', () => {
    expect(/^tag:\s*ui-icon\s*$/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIElement\b/m.test(fence)).toBe(true)
    expect(/^tier:\s*display\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*false/.test(fence)).toBe(true)
  })

  it('validateComponentDescriptor reports ZERO structural failures (schema-valid)', () => {
    // anti-vacuous: both attributes parse before the schema is consulted
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })
})

describe('icon.md descriptor — contract↔props trip-wire (s10)', () => {
  it('attributes[] is a faithful bijection with UIIconElement.props (name, label)', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(compareDescriptorToProps(parsed.attributes, UIIconElement.props)).toEqual([])
  })

  it('both attributes are string type, non-reflected, default empty string', () => {
    for (const name of ATTR_NAMES) {
      const a = parsed.attributes.find((x) => x.name === name)
      expect(a?.type, `${name}.type`).toBe('string')
      expect(a?.default, `${name}.default`).toBe('')
      expect(a?.reflect, `${name}.reflect`).toBe(false)
    }
  })

  it('a drifted attribute FAILS the trip-wire (negative control — reflect + default)', () => {
    const flipReflect = parsed.attributes.map((a) => (a.name === 'name' ? { ...a, reflect: true } : { ...a }))
    expect(compareDescriptorToProps(flipReflect, UIIconElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_REFLECT', path: 'attributes.name.reflect' }),
    )
    const flipDefault = parsed.attributes.map((a) => (a.name === 'label' ? { ...a, default: 'x' } : { ...a }))
    expect(compareDescriptorToProps(flipDefault, UIIconElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_DEFAULT', path: 'attributes.label.default' }),
    )
  })

  it('a removed or added attribute FAILS the trip-wire (negative control — bijection both ways)', () => {
    const dropName = parsed.attributes.filter((a) => a.name !== 'name')
    expect(compareDescriptorToProps(dropName, UIIconElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_MISSING', path: 'attributes.name' }),
    )
    const addBogus = [...parsed.attributes, { name: 'bogus', type: 'string', default: '', reflect: false }]
    expect(compareDescriptorToProps(addBogus, UIIconElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_EXTRA', path: 'attributes.bogus' }),
    )
  })
})

describe('icon.md descriptor — contract↔source trip-wire (s11)', () => {
  it('customStates/slots tell the truth about icon.ts + icon.css (0 source-drift)', () => {
    // ui-icon has NO custom states (no :state() — a Display leaf has nothing to transition) and NO
    // styled slots (no [slot=...] selector — the only child is the control-injected <svg>, never author-slotted).
    expect([...collectUsedStates(ts, css)]).toEqual([])
    expect([...collectStyledSlots(css)]).toEqual([])
    expect(scalarSeq(parsed, 'customStates')).toEqual([])
    expect(compareDescriptorToSource(parsed, { ts, css })).toEqual([])
  })

  it('NEGATIVE: a synthetic source using an undocumented state FAILS the source-wire (STATE_UNDOCUMENTED)', () => {
    const syntheticTs = ts + "\nthis.internals.states?.add('ready') // synthetic — not real ui-icon code"
    const result = compareDescriptorToSource(parsed, { ts: syntheticTs, css })
    expect(result).toContainEqual(expect.objectContaining({ code: 'STATE_UNDOCUMENTED', path: 'customStates.ready' }))
  })

  it('NEGATIVE: a synthetic css styling an undocumented slot FAILS the source-wire (SLOT_UNDOCUMENTED)', () => {
    const syntheticCss = css + "\n:scope > [slot='leading'] { display: none; } /* synthetic */"
    const result = compareDescriptorToSource(parsed, { ts, css: syntheticCss })
    expect(result).toContainEqual(expect.objectContaining({ code: 'SLOT_UNDOCUMENTED', path: 'slots.leading' }))
  })
})
