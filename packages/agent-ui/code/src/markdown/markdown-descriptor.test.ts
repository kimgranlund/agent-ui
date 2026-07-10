import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  splitFrontmatter,
  parseDescriptor,
  validateComponentDescriptor,
  compareDescriptorToProps,
  compareDescriptorToSource,
  collectUsedStates,
  collectStyledSlots,
  scalarSeq,
} from '@agent-ui/components/descriptor'
import { UIMarkdownElement } from './markdown.ts'

declare const process: { cwd(): string }

// markdown-descriptor.test.ts (LLD-C9, SPEC-C9) — the per-package descriptor trip-wire, run INSIDE
// @agent-ui/code by importing the shared parser from @agent-ui/components/descriptor (the
// @agent-ui/router router-link.test.ts precedent — no components-side allowlist entry is owed, SPEC-C10).

describe('ui-markdown — descriptor (ADR-0004, LLD-C9)', () => {
  const DIR = `${process.cwd()}/packages/agent-ui/code/src/markdown`
  const md = readFileSync(`${DIR}/markdown.md`, 'utf8') as string
  const ts = readFileSync(`${DIR}/markdown.ts`, 'utf8') as string
  const css = readFileSync(`${DIR}/markdown.css`, 'utf8') as string
  const { fence, body } = splitFrontmatter(md)
  const parsed = parseDescriptor(fence)
  const ATTR_NAMES = ['markdown']

  it('has a leading frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body).toContain('# ui-markdown')
  })

  it('carries the ADR-0004 descriptor field set as top-level keys, and is schema-valid', () => {
    const required = ['tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots', 'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors']
    for (const field of required) expect(parsed.topLevelKeys.has(field), field).toBe(true)
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })

  it('tag=ui-markdown, extends=UIElement, tier=display, formAssociated=false', () => {
    expect(/^tag:\s*ui-markdown\s*$/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIElement\b/m.test(fence)).toBe(true)
    expect(/^tier:\s*display\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*false/.test(fence)).toBe(true)
  })

  it('contract↔props: attributes[] is a faithful bijection with UIMarkdownElement.props — zero drift', () => {
    const drift = compareDescriptorToProps(parsed.attributes, UIMarkdownElement.props)
    expect(drift).toEqual([])
  })

  it('markdown is string, default \'\', NOT reflected', () => {
    const markdown = parsed.attributes.find((a) => a.name === 'markdown')
    expect(markdown?.type).toBe('string')
    expect(markdown?.default).toBe('')
    expect(markdown?.reflect).toBe(false)
  })

  it('negative control: a planted extra attribute fails the trip-wire', () => {
    const planted = [...parsed.attributes, { name: 'phantom', type: 'string', default: '', reflect: false }]
    expect(compareDescriptorToProps(planted, UIMarkdownElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_EXTRA', path: 'attributes.phantom' }),
    )
  })

  it('negative control: a genuinely drifted reflect flag fails the trip-wire', () => {
    const flipped = parsed.attributes.map((a) => (a.name === 'markdown' ? { ...a, reflect: true } : { ...a }))
    expect(compareDescriptorToProps(flipped, UIMarkdownElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_REFLECT', path: 'attributes.markdown.reflect' }),
    )
  })

  it('contract↔source: no customStates and no CSS-styled [slot] — the descriptor tells the truth', () => {
    expect(scalarSeq(parsed, 'customStates')).toEqual([])
    expect([...collectUsedStates(ts, css)]).toEqual([])
    expect([...collectStyledSlots(css)]).toEqual([])
    expect(compareDescriptorToSource(parsed, { ts, css })).toEqual([])
  })

  it('negative control: an undocumented used state fails the source-wire', () => {
    const syntheticTs = `${ts}\nthis.internals.states?.add('active') // synthetic — not real source`
    expect(compareDescriptorToSource(parsed, { ts: syntheticTs, css })).toContainEqual(
      expect.objectContaining({ code: 'STATE_UNDOCUMENTED', path: 'customStates.active' }),
    )
  })
})
