import { describe, it, expect } from 'vitest'
import { UIDescriptionListElement } from './description-list.ts'
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

// description-list-descriptor.test.ts — the stat.md three-layer pattern: structural, contract↔props,
// contract↔source (ADR-0004/ADR-0201). `rows` classifies by BEHAVIOUR (kindOf probes the codec):
// from(null) is `[]` (an array) ⇒ 'json' — pinned below before the other assertions trust it.

const DIR = `${process.cwd()}/packages/agent-ui/components/src/controls/description-list`
const md = readFileSync(`${DIR}/description-list.md`, 'utf8') as string
const ts = readFileSync(`${DIR}/description-list.ts`, 'utf8') as string
const css = readFileSync(`${DIR}/description-list.css`, 'utf8') as string

const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)
const ATTR_NAMES = ['rows']

describe('kindOf build-verify — rows classifies "json" (array-returning safe codec)', () => {
  it('rows: the safeJsonCodec-shaped array prop classifies as "json" (zero drift as declared)', () => {
    const drift = compareDescriptorToProps(parsed.attributes, UIDescriptionListElement.props)
    expect(drift.filter((d) => d.path.startsWith('attributes.rows'))).toEqual([])
  })

  it('NEGATIVE: rows mis-declared as "string" fails DRIFT_TYPE (kindOf does not blindly green everything)', () => {
    const flip = parsed.attributes.map((a) => (a.name === 'rows' ? { ...a, type: 'string' } : a))
    expect(compareDescriptorToProps(flip, UIDescriptionListElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_TYPE', path: 'attributes.rows.type' }),
    )
  })
})

describe('description-list.md descriptor — structural validity', () => {
  it('has a leading frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body.trim().length).toBeGreaterThan(0)
    expect(body).toContain('# ui-description-list')
  })

  it('carries the ADR-0004 / plan §10 descriptor field set as top-level keys', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing descriptor field: ${field}`).toBe(true)
  })

  it('tag=ui-description-list, extends=UIElement, tier=display, face.formAssociated=false', () => {
    expect(/^tag:\s*ui-description-list\s*$/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIElement\b/m.test(fence)).toBe(true)
    expect(/^tier:\s*display\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*false/.test(fence)).toBe(true)
  })

  it('validateComponentDescriptor reports ZERO structural failures (schema-valid)', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })
})

describe('description-list.md descriptor — contract↔props trip-wire', () => {
  it('attributes[] is a faithful bijection with UIDescriptionListElement.props (zero drift)', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(compareDescriptorToProps(parsed.attributes, UIDescriptionListElement.props)).toEqual([])
  })

  it('negative control: a genuinely drifted attribute still FAILS the trip-wire', () => {
    const dropRows = parsed.attributes.filter((a) => a.name !== 'rows')
    expect(compareDescriptorToProps(dropRows, UIDescriptionListElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_MISSING', path: 'attributes.rows' }),
    )
    const phantom = [...parsed.attributes, { name: 'phantom', type: 'string', default: '', reflect: false }]
    expect(compareDescriptorToProps(phantom, UIDescriptionListElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_EXTRA', path: 'attributes.phantom' }),
    )
  })
})

describe('description-list.md descriptor — contract↔source trip-wire', () => {
  it('customStates/slots tell the truth about the source (0 source-drift)', () => {
    // NO custom states (no :state() — a display leaf has nothing to transition) and NO author-slotted
    // content (no [slot=...] selector — every child is control-built).
    expect([...collectUsedStates(ts, css)]).toEqual([])
    expect([...collectStyledSlots(css)]).toEqual([])
    expect(scalarSeq(parsed, 'customStates')).toEqual([])
    expect(compareDescriptorToSource(parsed, { ts, css })).toEqual([])
  })

  it('NEGATIVE: a synthetic source using an undocumented state FAILS the source-wire (STATE_UNDOCUMENTED)', () => {
    const syntheticTs = ts + "\nthis.internals.states?.add('ready') // synthetic — not real code"
    expect(compareDescriptorToSource(parsed, { ts: syntheticTs, css })).toContainEqual(
      expect.objectContaining({ code: 'STATE_UNDOCUMENTED', path: 'customStates.ready' }),
    )
  })

  it('NEGATIVE: a synthetic css styling an undocumented slot FAILS the source-wire (SLOT_UNDOCUMENTED)', () => {
    const syntheticCss = css + "\n:scope > [slot='leading'] { display: none; } /* synthetic */"
    expect(compareDescriptorToSource(parsed, { ts, css: syntheticCss })).toContainEqual(
      expect.objectContaining({ code: 'SLOT_UNDOCUMENTED', path: 'slots.leading' }),
    )
  })
})
