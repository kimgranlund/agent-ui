import { describe, it, expect } from 'vitest'
import { UICodeElement } from './code.ts'
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

// code.md descriptor — the bar-chart/text-descriptor three-layer pattern: structural, contract<->props,
// contract<->source. LLD-C7 (content-family.lld.md §3).

const DIR = `${process.cwd()}/packages/agent-ui/components/src/controls/code`
const md = readFileSync(`${DIR}/code.md`, 'utf8') as string
const ts = readFileSync(`${DIR}/code.ts`, 'utf8') as string
const css = readFileSync(`${DIR}/code.css`, 'utf8') as string

const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)
const ATTR_NAMES = ['language']

describe('code.md descriptor — structural validity', () => {
  it('has a leading frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body.trim().length).toBeGreaterThan(0)
    expect(body).toContain('# ui-code')
  })

  it('carries the ADR-0004 / plan §10 descriptor field set as top-level keys', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing descriptor field: ${field}`).toBe(true)
  })

  it('tag=ui-code, extends=UIElement, tier=display, face.formAssociated=false', () => {
    expect(/^tag:\s*ui-code\s*$/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIElement\b/m.test(fence)).toBe(true)
    expect(/^tier:\s*display\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*false/.test(fence)).toBe(true)
  })

  it('validateComponentDescriptor reports ZERO structural failures (schema-valid)', () => {
    // anti-vacuous: the one attribute parses before the schema is consulted
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })

  it('events/properties/parts/customStates are all declared empty (a zero-machinery display leaf)', () => {
    expect(parsed.sequences.get('events')).toEqual([])
    expect(parsed.sequences.get('properties')).toEqual([])
    expect(parsed.sequences.get('parts')).toEqual([])
    expect(parsed.sequences.get('customStates')).toEqual([])
  })

  it('SPEC-R20: no [size]/[scale] selector in code.css and no `size`/`scale` attribute declared', () => {
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(bare).not.toMatch(/\[size\b/)
    expect(bare).not.toMatch(/\[scale\b/)
    expect(parsed.attributes.some((a) => a.name === 'size')).toBe(false)
    expect(parsed.attributes.some((a) => a.name === 'scale')).toBe(false)
  })
})

describe('code.md descriptor — contract↔props trip-wire', () => {
  it('the full bijection is CLEAN — zero drift', () => {
    const result = compareDescriptorToProps(parsed.attributes, UICodeElement.props)
    expect(result).toEqual([])
  })

  it('negative control: `language` mis-declared as an enum FAILS the trip-wire (DRIFT_TYPE)', () => {
    const flipType = parsed.attributes.map((a) => (a.name === 'language' ? { ...a, type: 'enum', values: ['a'] } : { ...a }))
    expect(compareDescriptorToProps(flipType, UICodeElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_TYPE', path: 'attributes.language.type' }),
    )
  })

  it('negative control: a drifted `reflect`/`default` FAILS the trip-wire', () => {
    const flipReflect = parsed.attributes.map((a) => (a.name === 'language' ? { ...a, reflect: false } : { ...a }))
    expect(compareDescriptorToProps(flipReflect, UICodeElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_REFLECT', path: 'attributes.language.reflect' }),
    )
    const flipDefault = parsed.attributes.map((a) => (a.name === 'language' ? { ...a, default: 'x' } : { ...a }))
    expect(compareDescriptorToProps(flipDefault, UICodeElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_DEFAULT', path: 'attributes.language.default' }),
    )
  })

  it('negative control: a removed or added attribute FAILS the trip-wire (bijection both ways)', () => {
    expect(compareDescriptorToProps([], UICodeElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_MISSING', path: 'attributes.language' }),
    )
    const addBogus = [...parsed.attributes, { name: 'bogus', type: 'string', default: '', reflect: false }]
    expect(compareDescriptorToProps(addBogus, UICodeElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_EXTRA', path: 'attributes.bogus' }),
    )
  })
})

describe('code.md descriptor — contract↔source trip-wire', () => {
  it('customStates/slots tell the truth about code.ts + code.css (0 source-drift)', () => {
    // ui-code has NO custom states (no :state() — a Display leaf has nothing to transition) and NO
    // [slot=...]-styled slots (host-as-content — the light-DOM text is unnamed default content, never a
    // named [slot] selector).
    expect([...collectUsedStates(ts, css)]).toEqual([])
    expect([...collectStyledSlots(css)]).toEqual([])
    expect(scalarSeq(parsed, 'customStates')).toEqual([])
    expect(compareDescriptorToSource(parsed, { ts, css })).toEqual([])
  })

  it('NEGATIVE: a synthetic source using an undocumented state FAILS the source-wire (STATE_UNDOCUMENTED)', () => {
    const syntheticTs = ts + "\nthis.internals.states?.add('ready') // synthetic — not real ui-code code"
    const result = compareDescriptorToSource(parsed, { ts: syntheticTs, css })
    expect(result).toContainEqual(expect.objectContaining({ code: 'STATE_UNDOCUMENTED', path: 'customStates.ready' }))
  })

  it('NEGATIVE: a synthetic css styling an undocumented slot FAILS the source-wire (SLOT_UNDOCUMENTED)', () => {
    const syntheticCss = css + "\n:scope > [slot='leading'] { display: none; } /* synthetic */"
    const result = compareDescriptorToSource(parsed, { ts, css: syntheticCss })
    expect(result).toContainEqual(expect.objectContaining({ code: 'SLOT_UNDOCUMENTED', path: 'slots.leading' }))
  })
})
