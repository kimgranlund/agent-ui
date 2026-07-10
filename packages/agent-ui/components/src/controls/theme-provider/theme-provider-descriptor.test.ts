import { describe, it, expect } from 'vitest'
import { UIThemeProviderElement } from './theme-provider.ts'
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
import type { ParsedAttribute } from '../../descriptor/component-descriptor.ts'
// Read theme-provider.md/.ts/.css as text (no `@types/node` devDep — the attachment/button precedent).
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// theme-provider-descriptor.test.ts — LLD-C5 (SPEC-R7). The attachment.md/stat.md three-layer pattern:
// structural validity, contract↔props (attributes[] ≡ static props), contract↔source (customStates/slots
// tell the truth about theme-provider.ts/.css — zero source drift, since this control has no :state() and
// styles no [slot=...] selector).

const DIR = `${process.cwd()}/packages/agent-ui/components/src/controls/theme-provider`
const md = readFileSync(`${DIR}/theme-provider.md`, 'utf8') as string
const ts = readFileSync(`${DIR}/theme-provider.ts`, 'utf8') as string
const css = readFileSync(`${DIR}/theme-provider.css`, 'utf8') as string

const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)
const ATTR_NAMES = ['scheme', 'scale', 'density', 'theme']

describe('theme-provider.md descriptor — structural validity', () => {
  it('has a leading frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body.trim().length).toBeGreaterThan(0)
    expect(body).toContain('# ui-theme-provider')
  })

  it('carries the ADR-0004 / plan §10 descriptor field set as top-level keys', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing descriptor field: ${field}`).toBe(true)
  })

  it('tag=ui-theme-provider, extends=UIElement (NOT UIFormElement/UIContainerElement), tier=container, face.formAssociated=false', () => {
    expect(/^tag:\s*ui-theme-provider\s*$/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIElement\b/m.test(fence)).toBe(true)
    expect(/^tier:\s*container\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*false/.test(fence)).toBe(true)
  })

  it('validateComponentDescriptor reports ZERO structural failures (schema-valid)', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })
})

describe('theme-provider.md descriptor — contract↔props trip-wire (SPEC-R2/R7)', () => {
  it('attributes[] is a faithful bijection with UIThemeProviderElement.props by NAME', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    const drift = compareDescriptorToProps(parsed.attributes, UIThemeProviderElement.props)
    expect(drift.filter((d) => d.code === 'DRIFT_MISSING' || d.code === 'DRIFT_EXTRA')).toEqual([])
  })

  it('all four attributes are CLEAN — zero drift (type/default/reflect all agree with the live props)', () => {
    const drift = compareDescriptorToProps(parsed.attributes, UIThemeProviderElement.props)
    expect(drift).toEqual([])
  })

  it('every axis defaults to the empty string — unset is the shared, real, in-vocabulary default (SPEC §2)', () => {
    for (const a of parsed.attributes) expect(a.default, a.name).toBe('')
  })

  it('negative control: a genuinely drifted attribute still FAILS the trip-wire', () => {
    const flipDefault = parsed.attributes.map((a) => (a.name === 'scheme' ? { ...a, default: 'light' } : { ...a }))
    expect(compareDescriptorToProps(flipDefault, UIThemeProviderElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_DEFAULT', path: 'attributes.scheme.default' }),
    )
    const dropTheme = parsed.attributes.filter((a) => a.name !== 'theme')
    expect(compareDescriptorToProps(dropTheme, UIThemeProviderElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_MISSING', path: 'attributes.theme' }),
    )
    const addBogus: ParsedAttribute[] = [...parsed.attributes, { name: 'bogus', type: 'string', default: '', reflect: false }]
    expect(compareDescriptorToProps(addBogus, UIThemeProviderElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_EXTRA', path: 'attributes.bogus' }),
    )
  })
})

describe('theme-provider.md descriptor — contract↔source trip-wire (SPEC-R6)', () => {
  it('customStates/slots tell the truth about theme-provider.ts + theme-provider.css (0 source-drift)', () => {
    // ui-theme-provider has NO custom states (no :state() — a pure coordination/carrier element has no
    // interaction states of its own) and styles NO author-slotted [slot=...] content (the declared
    // `default` slot is the light-DOM catch-all, documented-but-unstyled — not a defect per compareDescriptorToSource).
    expect([...collectUsedStates(ts, css)]).toEqual([])
    expect([...collectStyledSlots(css)]).toEqual([])
    expect(scalarSeq(parsed, 'customStates')).toEqual([])
    expect(compareDescriptorToSource(parsed, { ts, css })).toEqual([])
  })

  it('NEGATIVE: a synthetic source using an undocumented state FAILS the source-wire (STATE_UNDOCUMENTED)', () => {
    const syntheticTs = ts + "\nthis.internals.states?.add('ready') // synthetic — not real ui-theme-provider code"
    const result = compareDescriptorToSource(parsed, { ts: syntheticTs, css })
    expect(result).toContainEqual(expect.objectContaining({ code: 'STATE_UNDOCUMENTED', path: 'customStates.ready' }))
  })

  it('NEGATIVE: a synthetic css styling an undocumented slot FAILS the source-wire (SLOT_UNDOCUMENTED)', () => {
    const syntheticCss = css + "\n:scope > [slot='leading'] { display: none; } /* synthetic */"
    const result = compareDescriptorToSource(parsed, { ts, css: syntheticCss })
    expect(result).toContainEqual(expect.objectContaining({ code: 'SLOT_UNDOCUMENTED', path: 'slots.leading' }))
  })
})
