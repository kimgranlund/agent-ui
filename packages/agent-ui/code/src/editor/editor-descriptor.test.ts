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
import { UICodeEditorElement } from './editor.ts'

declare const process: { cwd(): string }

// editor-descriptor.test.ts (ADR-0004 / ADR-0139) — the per-package descriptor trip-wire, run INSIDE
// @agent-ui/code by importing the shared parser from @agent-ui/components/descriptor (the markdown-descriptor
// / router-link precedent — no components-side allowlist entry is owed). The element lives OUTSIDE
// @agent-ui/components, so it carries NO catalog row (ADR-0139 cl.4); the fleet DoD descriptor still applies.

describe('ui-code-editor — descriptor (ADR-0004, ADR-0139)', () => {
  const DIR = `${process.cwd()}/packages/agent-ui/code/src/editor`
  const md = readFileSync(`${DIR}/editor.md`, 'utf8') as string
  const ts = readFileSync(`${DIR}/editor.ts`, 'utf8') as string
  const css = readFileSync(`${DIR}/editor.css`, 'utf8') as string
  const { fence, body } = splitFrontmatter(md)
  const parsed = parseDescriptor(fence)
  const ATTR_NAMES = ['value', 'language', 'label', 'placeholder', 'rows', 'readonly', 'name', 'disabled', 'required']

  it('has a leading frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body).toContain('# ui-code-editor')
  })

  it('carries the ADR-0004 descriptor field set as top-level keys, and is schema-valid', () => {
    const required = ['tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots', 'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors']
    for (const field of required) expect(parsed.topLevelKeys.has(field), field).toBe(true)
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })

  it('tag=ui-code-editor, extends=UIFormElement, tier=control, formAssociated=true', () => {
    expect(/^tag:\s*ui-code-editor\s*$/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIFormElement\b/m.test(fence)).toBe(true)
    expect(/^tier:\s*control\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*true/.test(fence)).toBe(true)
  })

  it('contract↔props: attributes[] is a faithful bijection with UICodeEditorElement.props — zero drift', () => {
    const drift = compareDescriptorToProps(parsed.attributes, UICodeEditorElement.props)
    expect(drift).toEqual([])
  })

  it('language is string, default \'\', reflected (the [language] CSS hook)', () => {
    const language = parsed.attributes.find((a) => a.name === 'language')
    expect(language?.type).toBe('string')
    expect(language?.default).toBe('')
    expect(language?.reflect).toBe(true)
  })

  it('value is string, default \'\', NOT reflected (the live value rides the surface)', () => {
    const value = parsed.attributes.find((a) => a.name === 'value')
    expect(value?.type).toBe('string')
    expect(value?.default).toBe('')
    expect(value?.reflect).toBe(false)
  })

  it('negative control: a planted extra attribute fails the trip-wire', () => {
    const planted = [...parsed.attributes, { name: 'phantom', type: 'string', default: '', reflect: false }]
    expect(compareDescriptorToProps(planted, UICodeEditorElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_EXTRA', path: 'attributes.phantom' }),
    )
  })

  it('negative control: a genuinely drifted reflect flag fails the trip-wire', () => {
    const flipped = parsed.attributes.map((a) => (a.name === 'value' ? { ...a, reflect: true } : { ...a }))
    expect(compareDescriptorToProps(flipped, UICodeEditorElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_REFLECT', path: 'attributes.value.reflect' }),
    )
  })

  it('contract↔source: the documented customStates match the used states, and no CSS-styled [slot]', () => {
    expect(scalarSeq(parsed, 'customStates')).toEqual(['ready', 'disabled', 'user-invalid'])
    expect([...collectUsedStates(ts, css)].sort()).toEqual(['disabled', 'ready', 'user-invalid'])
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
