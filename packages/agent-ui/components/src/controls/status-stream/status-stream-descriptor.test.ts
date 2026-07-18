import { describe, it, expect } from 'vitest'
import { UIStatusStreamElement } from './status-stream.ts'
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

// timeline-family.lld.md §4 · SPEC-R8/R9/R12 — ui-status-stream's descriptor probe (the live host).

const STREAM = `${process.cwd()}/packages/agent-ui/components/src/controls/status-stream`
const md = readFileSync(`${STREAM}/status-stream.md`, 'utf8') as string
const ts = readFileSync(`${STREAM}/status-stream.ts`, 'utf8') as string
const css = readFileSync(`${STREAM}/status-stream.css`, 'utf8') as string

const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)

const ATTR_NAMES = ['size', 'label', 'header']

describe('status-stream.md descriptor — frontmatter parses + schema-valid', () => {
  it('has a leading frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body.trim().length).toBeGreaterThan(0)
    expect(body).toContain('# ui-status-stream')
  })

  it('carries the ADR-0004 descriptor field set as top-level keys', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing descriptor field: ${field}`).toBe(true)
  })

  it('tag is ui-status-stream, extends UIContainerElement, tier is pattern, NOT form-associated', () => {
    expect(/^tag:\s*ui-status-stream\s*$/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIContainerElement\b/m.test(fence)).toBe(true)
    expect(/^tier:\s*pattern\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*false/.test(fence)).toBe(true)
  })

  it('validateComponentDescriptor reports ZERO structural failures', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })

  it('declares NO events (SPEC-R12 — streamed state rides role=log, never a synthetic event)', () => {
    expect(parsed.sequences.get('events')).toEqual([])
  })

  it('role is log (a POLITE live region)', () => {
    expect(/role:\s*log\b/.test(fence)).toBe(true)
  })

  it('header is a reflected boolean, default false (ADR-0146 F8 — the opt-in streaming header)', () => {
    const header = parsed.attributes.find((a) => a.name === 'header')
    expect(header?.type).toBe('boolean')
    expect(header?.default).toBe('false') // the parser stringifies scalar defaults (the disclosure `open` precedent)
    expect(header?.reflect).toBe(true)
  })
})

describe('status-stream.md descriptor — contract↔props trip-wire', () => {
  it('attributes[] is a faithful bijection with UIStatusStreamElement.props (0 drift)', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(compareDescriptorToProps(parsed.attributes, UIStatusStreamElement.props)).toEqual([])
  })

  it('a drifted attribute FAILS the trip-wire (negative control)', () => {
    const flipReflect: ParsedAttribute[] = parsed.attributes.map((a) => (a.name === 'label' ? { ...a, reflect: false } : { ...a }))
    expect(compareDescriptorToProps(flipReflect, UIStatusStreamElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_REFLECT', path: 'attributes.label.reflect' }),
    )
  })

  it('a removed or added attribute FAILS the trip-wire (negative control)', () => {
    const dropSize: ParsedAttribute[] = parsed.attributes.filter((a) => a.name !== 'size')
    expect(compareDescriptorToProps(dropSize, UIStatusStreamElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_MISSING', path: 'attributes.size' }),
    )
    const addBogus: ParsedAttribute[] = [...parsed.attributes, { name: 'bogus', type: 'string', default: '', reflect: false }]
    expect(compareDescriptorToProps(addBogus, UIStatusStreamElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_EXTRA', path: 'attributes.bogus' }),
    )
  })
})

describe('status-stream.md descriptor — contract↔source trip-wire (customStates/slots vs the real .ts/.css)', () => {
  it('agrees with the source: no internals.states usage, no :state() in css, no CSS-styled [slot=]', () => {
    expect(compareDescriptorToSource(parsed, { ts, css })).toEqual([])
  })
})

describe('status-stream.ts — no transport of its own (SPEC-R9 AC3 negative control)', () => {
  // strip comments first (the family-coherence.test.ts precedent) — this file's OWN prose documents the
  // absence of these names, which would otherwise false-positive a literal grep.
  const code = ts.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

  it('grep: NO fetch/ReadableStream/readNdjsonLines reference anywhere in the LIVE code (comments stripped)', () => {
    expect(code).not.toMatch(/\bfetch\s*\(/)
    expect(code).not.toMatch(/ReadableStream/)
    expect(code).not.toMatch(/readNdjsonLines/)
  })

  it('anti-vacuous: the raw source DOES mention these names in prose (documenting the absence) — proving the strip is real, not a no-op', () => {
    expect(ts).toMatch(/ReadableStream/)
    expect(ts).toMatch(/readNdjsonLines/)
  })
})
