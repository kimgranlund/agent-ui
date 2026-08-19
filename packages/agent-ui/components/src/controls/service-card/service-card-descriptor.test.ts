import { describe, it, expect } from 'vitest'
import { UIServiceCardElement } from './service-card.ts'
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

// service-card-descriptor.test.ts — the checkbox.test.ts / description-list-descriptor.test.ts three-layer
// pattern (ADR-0004): structural validity, contract↔props (compareDescriptorToProps), contract↔source
// (compareDescriptorToSource — customStates + slots tell the truth about the .ts/.css).

const DIR = `${process.cwd()}/packages/agent-ui/components/src/controls/service-card`
const md = readFileSync(`${DIR}/service-card.md`, 'utf8') as string
const ts = readFileSync(`${DIR}/service-card.ts`, 'utf8') as string
const css = readFileSync(`${DIR}/service-card.css`, 'utf8') as string

const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)
const ATTR_NAMES = ['name', 'path', 'description', 'available', 'actionLabel', 'inline']

describe('service-card.md descriptor — structural validity', () => {
  it('has a leading frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body.trim().length).toBeGreaterThan(0)
    expect(body).toContain('# ui-service-card')
  })

  it('carries the ADR-0004 / plan §10 descriptor field set as top-level keys', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing descriptor field: ${field}`).toBe(true)
  })

  it('tag=ui-service-card, extends=UIElement, tier=pattern, face.formAssociated=false', () => {
    expect(/^tag:\s*ui-service-card\s*$/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIElement\b/m.test(fence)).toBe(true)
    expect(/^tier:\s*pattern\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*false/.test(fence)).toBe(true)
  })

  it('validateComponentDescriptor reports ZERO structural failures (schema-valid)', () => {
    // anti-vacuous: all 6 attributes parse before the schema is consulted
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })
})

describe('service-card.md descriptor — contract↔props trip-wire', () => {
  it('attributes[] is a faithful bijection with UIServiceCardElement.props (zero drift)', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(compareDescriptorToProps(parsed.attributes, UIServiceCardElement.props)).toEqual([])
  })

  it('negative control: a genuinely drifted attribute FAILS the trip-wire (bijection both ways)', () => {
    const dropAvailable = parsed.attributes.filter((a) => a.name !== 'available')
    expect(compareDescriptorToProps(dropAvailable, UIServiceCardElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_MISSING', path: 'attributes.available' }),
    )
    const phantom = [...parsed.attributes, { name: 'phantom', type: 'string', default: '', reflect: false }]
    expect(compareDescriptorToProps(phantom, UIServiceCardElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_EXTRA', path: 'attributes.phantom' }),
    )
  })

  it('negative control: a flipped default/reflect FAILS the trip-wire', () => {
    const flipDefault = parsed.attributes.map((a) => (a.name === 'available' ? { ...a, default: 'false' } : { ...a }))
    expect(compareDescriptorToProps(flipDefault, UIServiceCardElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_DEFAULT', path: 'attributes.available.default' }),
    )
    const flipReflect = parsed.attributes.map((a) => (a.name === 'inline' ? { ...a, reflect: false } : { ...a }))
    expect(compareDescriptorToProps(flipReflect, UIServiceCardElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_REFLECT', path: 'attributes.inline.reflect' }),
    )
  })
})

describe('service-card.md descriptor — contract↔source trip-wire', () => {
  it('customStates/slots tell the truth about the source (0 source-drift)', () => {
    // NO custom state (the whole availability repaint keys on the plain reflected [available] attribute,
    // self-reflect-guarded at connect — service-card.ts's file banner; the fleet custom-state vocabulary,
    // naming.md §6, is closed and stays untouched); exactly one styled slot (menu)
    expect([...collectUsedStates(ts, css)]).toEqual([])
    expect([...collectStyledSlots(css)]).toEqual(['menu'])
    expect(scalarSeq(parsed, 'customStates')).toEqual([])
    expect(compareDescriptorToSource(parsed, { ts, css })).toEqual([])
  })

  it('NEGATIVE: a synthetic source using an undocumented state FAILS the source-wire (STATE_UNDOCUMENTED)', () => {
    const syntheticTs = `${ts}\nthis.internals.states?.add('ready') // synthetic — not real code`
    expect(compareDescriptorToSource(parsed, { ts: syntheticTs, css })).toContainEqual(
      expect.objectContaining({ code: 'STATE_UNDOCUMENTED', path: 'customStates.ready' }),
    )
  })

  it('NEGATIVE: a synthetic css styling an undocumented slot FAILS the source-wire (SLOT_UNDOCUMENTED)', () => {
    const syntheticCss = `${css}\n:scope > [slot='trailing'] { display: none; } /* synthetic */`
    expect(compareDescriptorToSource(parsed, { ts, css: syntheticCss })).toContainEqual(
      expect.objectContaining({ code: 'SLOT_UNDOCUMENTED', path: 'slots.trailing' }),
    )
  })

  it('NEGATIVE: a synthetic descriptor documenting an unused state FAILS the source-wire (STATE_UNUSED)', () => {
    const syntheticFence = `${fence}\ncustomStates:\n  - phantom-state`
    const syntheticParsed = parseDescriptor(syntheticFence)
    expect(compareDescriptorToSource(syntheticParsed, { ts, css })).toContainEqual(
      expect.objectContaining({ code: 'STATE_UNUSED', path: 'customStates.phantom-state' }),
    )
  })
})
