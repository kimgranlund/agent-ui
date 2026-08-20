import { describe, it, expect } from 'vitest'
import { UIPlayingCardElement } from './playing-card.ts'
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

// playing-card.md descriptor — the pie-chart three-layer pattern: structural, contract<->props,
// contract<->source (ADR-0225, GH #1478).

const DIR = `${process.cwd()}/packages/agent-ui/components/src/controls/playing-card`
const md = readFileSync(`${DIR}/playing-card.md`, 'utf8') as string
const ts = readFileSync(`${DIR}/playing-card.ts`, 'utf8') as string
const css = readFileSync(`${DIR}/playing-card.css`, 'utf8') as string

const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)
const ATTR_NAMES = ['rank', 'suit', 'faceDown', 'size']

describe('playing-card.md descriptor — structural validity', () => {
  it('has a leading frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body.trim().length).toBeGreaterThan(0)
    expect(body).toContain('# ui-playing-card')
  })

  it('carries the ADR-0004 / plan §10 descriptor field set as top-level keys', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing descriptor field: ${field}`).toBe(true)
  })

  it('tag=ui-playing-card, extends=UIElement, tier=display, face.formAssociated=false', () => {
    expect(/^tag:\s*ui-playing-card\s*$/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIElement\b/m.test(fence)).toBe(true)
    expect(/^tier:\s*display\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*false/.test(fence)).toBe(true)
  })

  it('validateComponentDescriptor reports ZERO structural failures (schema-valid)', () => {
    // anti-vacuous: all four attributes parse before the schema is consulted
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })

  it('events/slots/keyboard are all empty — a non-interactive, non-slotted display leaf (ADR-0225 cl.7)', () => {
    expect(scalarSeq(parsed, 'events')).toEqual([])
    expect(scalarSeq(parsed, 'slots')).toEqual([])
    expect(scalarSeq(parsed, 'keyboard')).toEqual([])
  })
})

describe('playing-card.md descriptor — contract↔props trip-wire', () => {
  it('the full bijection is CLEAN — zero drift', () => {
    const result = compareDescriptorToProps(parsed.attributes, UIPlayingCardElement.props)
    expect(result).toEqual([])
  })

  it('rank enum values match the live 14-member set ("" + A + 2..10 + J/Q/K)', () => {
    const rankAttr = parsed.attributes.find((a) => a.name === 'rank')
    expect(rankAttr?.values).toEqual(['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'])
    expect(rankAttr?.default).toBe('')
  })

  it('suit enum values match the live 5-member set', () => {
    const suitAttr = parsed.attributes.find((a) => a.name === 'suit')
    expect(suitAttr?.values).toEqual(['', 'spades', 'hearts', 'diamonds', 'clubs'])
    expect(suitAttr?.default).toBe('')
  })

  it('size enum ≡ [sm, md, lg], default md (family-coherence A2)', () => {
    const sizeAttr = parsed.attributes.find((a) => a.name === 'size')
    expect(sizeAttr?.values).toEqual(['sm', 'md', 'lg'])
    expect(sizeAttr?.default).toBe('md')
  })

  it('faceDown is boolean, default false, attribute face-down', () => {
    const faceDownAttr = parsed.attributes.find((a) => a.name === 'faceDown')
    expect(faceDownAttr?.type).toBe('boolean')
    expect(faceDownAttr?.default).toBe('false')
    expect(faceDownAttr?.attribute).toBe('face-down')
  })

  it('negative control: a removed or added attribute FAILS the trip-wire (isolated on `size`)', () => {
    const sizeOnlyProps = { size: UIPlayingCardElement.props.size }
    expect(compareDescriptorToProps([], sizeOnlyProps)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_MISSING', path: 'attributes.size' }),
    )
    const addBogus = [{ name: 'bogus', type: 'string', default: '', reflect: false }]
    expect(compareDescriptorToProps(addBogus, sizeOnlyProps)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_EXTRA', path: 'attributes.bogus' }),
    )
  })

  it('negative control: a drifted reflect FAILS the trip-wire (isolated on `size`)', () => {
    const sizeOnly = parsed.attributes.filter((a) => a.name === 'size')
    const sizeOnlyProps = { size: UIPlayingCardElement.props.size }
    const flipReflect = sizeOnly.map((a) => ({ ...a, reflect: false }))
    expect(compareDescriptorToProps(flipReflect, sizeOnlyProps)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_REFLECT', path: 'attributes.size.reflect' }),
    )
  })
})

describe('playing-card.md descriptor — contract↔source trip-wire', () => {
  it('customStates/slots tell the truth about playing-card.ts + playing-card.css (0 source-drift)', () => {
    // ui-playing-card has exactly ONE custom state (:state(ready), the motion gate) and NO
    // author-slotted content ([data-part=...] is a different selector namespace collectStyledSlots
    // ignores — every part is component-built, never author-slotted).
    expect([...collectUsedStates(ts, css)]).toEqual(['ready'])
    expect([...collectStyledSlots(css)]).toEqual([])
    expect(scalarSeq(parsed, 'customStates')).toEqual(['ready'])
    expect(compareDescriptorToSource(parsed, { ts, css })).toEqual([])
  })

  it('NEGATIVE: a synthetic source using an undocumented state FAILS the source-wire (STATE_UNDOCUMENTED)', () => {
    const syntheticCss = css + "\n:scope:state(bogus) { color: red; } /* synthetic — not real ui-playing-card code */"
    const result = compareDescriptorToSource(parsed, { ts, css: syntheticCss })
    expect(result).toContainEqual(expect.objectContaining({ code: 'STATE_UNDOCUMENTED', path: 'customStates.bogus' }))
  })

  it('NEGATIVE: a synthetic css styling an undocumented slot FAILS the source-wire (SLOT_UNDOCUMENTED)', () => {
    const syntheticCss = css + "\n:scope > [slot='leading'] { display: none; } /* synthetic */"
    const result = compareDescriptorToSource(parsed, { ts, css: syntheticCss })
    expect(result).toContainEqual(expect.objectContaining({ code: 'SLOT_UNDOCUMENTED', path: 'slots.leading' }))
  })
})
