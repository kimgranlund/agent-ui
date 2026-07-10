import { describe, it, expect } from 'vitest'
import { UITimelineElement } from './timeline.ts'
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

// timeline-family.lld.md §3 · SPEC-R6/R7 — ui-timeline's descriptor probe (the durable host).

const TIMELINE = `${process.cwd()}/packages/agent-ui/components/src/controls/timeline`
const md = readFileSync(`${TIMELINE}/timeline.md`, 'utf8') as string
const ts = readFileSync(`${TIMELINE}/timeline.ts`, 'utf8') as string
const css = readFileSync(`${TIMELINE}/timeline.css`, 'utf8') as string

const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)

const ATTR_NAMES = ['size', 'label']

describe('timeline.md descriptor — frontmatter parses + schema-valid', () => {
  it('has a leading frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body.trim().length).toBeGreaterThan(0)
    expect(body).toContain('# ui-timeline')
  })

  it('carries the ADR-0004 descriptor field set as top-level keys', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing descriptor field: ${field}`).toBe(true)
  })

  it('tag is ui-timeline, extends UIContainerElement, tier is pattern, NOT form-associated', () => {
    expect(/^tag:\s*ui-timeline\s*$/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIContainerElement\b/m.test(fence)).toBe(true)
    expect(/^tier:\s*pattern\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*false/.test(fence)).toBe(true)
  })

  it('validateComponentDescriptor reports ZERO structural failures', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })

  it('declares NO events (SPEC-R7 AC2 — a display-first structural host)', () => {
    expect(parsed.sequences.get('events')).toEqual([])
  })
})

describe('timeline.md descriptor — contract↔props trip-wire', () => {
  it('attributes[] is a faithful bijection with UITimelineElement.props (0 drift)', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(compareDescriptorToProps(parsed.attributes, UITimelineElement.props)).toEqual([])
  })

  it('a drifted attribute FAILS the trip-wire (negative control)', () => {
    const flipReflect: ParsedAttribute[] = parsed.attributes.map((a) => (a.name === 'size' ? { ...a, reflect: false } : { ...a }))
    expect(compareDescriptorToProps(flipReflect, UITimelineElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_REFLECT', path: 'attributes.size.reflect' }),
    )
  })

  it('a removed or added attribute FAILS the trip-wire (negative control)', () => {
    const dropSize: ParsedAttribute[] = parsed.attributes.filter((a) => a.name !== 'size')
    expect(compareDescriptorToProps(dropSize, UITimelineElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_MISSING', path: 'attributes.size' }),
    )
    const addBogus: ParsedAttribute[] = [...parsed.attributes, { name: 'bogus', type: 'string', default: '', reflect: false }]
    expect(compareDescriptorToProps(addBogus, UITimelineElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_EXTRA', path: 'attributes.bogus' }),
    )
  })
})

describe('timeline.md descriptor — contract↔source trip-wire (customStates/slots vs the real .ts/.css)', () => {
  it('agrees with the source: no internals.states usage, no :state() in css, no CSS-styled [slot=]', () => {
    expect(compareDescriptorToSource(parsed, { ts, css })).toEqual([])
  })

  it('NEGATIVE control: a planted internals.states usage would be flagged STATE_UNDOCUMENTED', () => {
    const withState = `${ts}\nthis.internals.states?.add('zz')`
    expect(compareDescriptorToSource(parsed, { ts: withState, css })).toContainEqual(
      expect.objectContaining({ code: 'STATE_UNDOCUMENTED', path: 'customStates.zz' }),
    )
  })
})

describe('timeline.ts — the static negative control (SPEC-R6 AC3)', () => {
  it('grep: NO imperative append/update/finalize API, NO live-region role, in the real source', () => {
    expect(ts).not.toMatch(/\bappend\s*\(/)
    expect(ts).not.toMatch(/\bfinalize\s*\(/)
    expect(ts).not.toMatch(/role\s*=\s*['"]log['"]/)
  })
})
