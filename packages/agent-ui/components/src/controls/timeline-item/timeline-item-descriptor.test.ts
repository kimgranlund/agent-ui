import { describe, it, expect } from 'vitest'
import { UITimelineItemElement } from './timeline-item.ts'
import {
  splitFrontmatter,
  parseDescriptor,
  validateComponentDescriptor,
  compareDescriptorToProps,
  compareDescriptorToSource,
  type ParsedAttribute,
} from '../../descriptor/component-descriptor.ts'
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// timeline-family.lld.md §2 · SPEC-R1/R2/R16 · ADR-0122 F1/F2/F3/F6 — ui-timeline-item's descriptor probe.
// Mirrors the disclosure/toast descriptor-probe template: (a) STRUCTURAL schema-validity, (b)
// CONTRACT↔PROPS bijection with the live static props, (c) CONTRACT↔SOURCE (customStates/slots vs the
// real .ts/.css — the item's ONE customState, `truncated`, and its zero CSS-styled `[slot=]`s).

const ITEM = `${process.cwd()}/packages/agent-ui/components/src/controls/timeline-item`
const md = readFileSync(`${ITEM}/timeline-item.md`, 'utf8') as string
const ts = readFileSync(`${ITEM}/timeline-item.ts`, 'utf8') as string
const css = readFileSync(`${ITEM}/timeline-item.css`, 'utf8') as string

const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)

const ATTR_NAMES = ['status', 'label', 'description', 'timestamp', 'icon', 'size']

describe('timeline-item.md descriptor — frontmatter parses + schema-valid', () => {
  it('has a leading frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body.trim().length).toBeGreaterThan(0)
    expect(body).toContain('# ui-timeline-item')
  })

  it('carries the ADR-0004 descriptor field set as top-level keys', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing descriptor field: ${field}`).toBe(true)
  })

  it('tag is ui-timeline-item, extends UIElement, tier is pattern, NOT form-associated', () => {
    expect(/^tag:\s*ui-timeline-item\s*$/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIElement\b/m.test(fence)).toBe(true)
    expect(/^tier:\s*pattern\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*false/.test(fence)).toBe(true)
  })

  it('validateComponentDescriptor reports ZERO structural failures', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES) // anti-vacuous anchor
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })
})

describe('timeline-item.md descriptor — status/size reflect, label/description/timestamp/icon do not', () => {
  it('status is a reflected enum ["","pending","active","done","error","warning"], default "" (ADR-0146 F7 extends it)', () => {
    const status = parsed.attributes.find((a) => a.name === 'status')
    expect(status?.type).toBe('enum')
    expect(status?.values).toEqual(['', 'pending', 'active', 'done', 'error', 'warning'])
    expect(status?.default).toBe('')
    expect(status?.reflect).toBe(true)
  })

  it('size is a reflected enum [sm,md,lg], default md', () => {
    const size = parsed.attributes.find((a) => a.name === 'size')
    expect(size?.type).toBe('enum')
    expect(size?.values).toEqual(['sm', 'md', 'lg'])
    expect(size?.default).toBe('md')
    expect(size?.reflect).toBe(true)
  })

  it('description/timestamp/icon are unreflected; label reflects (TKT-0069 item 2 ruling); all strings, default empty', () => {
    for (const name of ['label', 'description', 'timestamp', 'icon']) {
      const a = parsed.attributes.find((x) => x.name === name)
      expect(a?.type, name).toBe('string')
      expect(a?.default, name).toBe('')
      expect(a?.reflect, name).toBe(name === 'label')
    }
  })

  it('declares exactly ONE event (toggle) — the composed disclosure re-emit, no bespoke name', () => {
    const events = (parsed.sequences.get('events') ?? []).map((i) => i.get('name'))
    expect(events).toEqual(['toggle'])
  })

  it('declares exactly ONE customState (truncated) — the completion-invariant escape hatch', () => {
    expect(parsed.sequences.get('customStates')).toEqual([new Map([['#scalar', 'truncated']])])
  })
})

describe('timeline-item.md descriptor — contract↔props trip-wire', () => {
  it('attributes[] is a faithful bijection with UITimelineItemElement.props (0 drift)', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES) // anti-vacuous anchor
    expect(compareDescriptorToProps(parsed.attributes, UITimelineItemElement.props)).toEqual([])
  })

  it('a drifted attribute FAILS the trip-wire (negative control — reflect + default)', () => {
    const flipReflect: ParsedAttribute[] = parsed.attributes.map((a) => (a.name === 'status' ? { ...a, reflect: false } : { ...a }))
    expect(compareDescriptorToProps(flipReflect, UITimelineItemElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_REFLECT', path: 'attributes.status.reflect' }),
    )

    const flipDefault: ParsedAttribute[] = parsed.attributes.map((a) => (a.name === 'size' ? { ...a, default: 'lg' } : { ...a }))
    expect(compareDescriptorToProps(flipDefault, UITimelineItemElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_DEFAULT', path: 'attributes.size.default' }),
    )
  })

  it('a removed or added attribute FAILS the trip-wire (negative control — bijection both ways)', () => {
    const dropStatus: ParsedAttribute[] = parsed.attributes.filter((a) => a.name !== 'status')
    expect(compareDescriptorToProps(dropStatus, UITimelineItemElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_MISSING', path: 'attributes.status' }),
    )

    const addBogus: ParsedAttribute[] = [...parsed.attributes, { name: 'bogus', type: 'string', default: '', reflect: false }]
    expect(compareDescriptorToProps(addBogus, UITimelineItemElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_EXTRA', path: 'attributes.bogus' }),
    )
  })
})

describe('timeline-item.md descriptor — contract↔source trip-wire (customStates vs the real .ts/.css)', () => {
  it('agrees with the source: truncated is used (markTruncated + :state(truncated)) and documented; no CSS-styled [slot=] undocumented', () => {
    expect(compareDescriptorToSource(parsed, { ts, css })).toEqual([])
  })

  it('NEGATIVE control: an undocumented customStates entry is caught (STATE_UNUSED)', () => {
    const bogusStates = new Map(parsed.sequences)
    bogusStates.set('customStates', [new Map([['#scalar', 'bogus-state']])])
    const bogusParsed = { ...parsed, sequences: bogusStates }
    expect(compareDescriptorToSource(bogusParsed, { ts, css })).toContainEqual(
      expect.objectContaining({ code: 'STATE_UNUSED', path: 'customStates.bogus-state' }),
    )
  })

  it('NEGATIVE control: dropping the real "truncated" customState is caught (STATE_UNDOCUMENTED)', () => {
    const emptyStates = new Map(parsed.sequences)
    emptyStates.set('customStates', [])
    const emptyParsed = { ...parsed, sequences: emptyStates }
    expect(compareDescriptorToSource(emptyParsed, { ts, css })).toContainEqual(
      expect.objectContaining({ code: 'STATE_UNDOCUMENTED', path: 'customStates.truncated' }),
    )
  })
})
