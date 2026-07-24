import { describe, it, expect } from 'vitest'
import { UISandboxFrameElement } from './sandbox-frame.ts'
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
// Read sandbox-frame.md/.ts/.css as text (no `@types/node` devDep — the theme-provider/attachment precedent).
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// sandbox-frame-descriptor.test.ts — the theme-provider-descriptor.test.ts three-layer pattern:
// structural validity, contract↔props (attributes[] ≡ static props), contract↔source (customStates/
// slots tell the truth about sandbox-frame.ts/.css — zero source drift, since this control has no
// :state() and styles no [slot=...] selector).

const DIR = `${process.cwd()}/packages/agent-ui/components/src/controls/sandbox-frame`
const md = readFileSync(`${DIR}/sandbox-frame.md`, 'utf8') as string
const ts = readFileSync(`${DIR}/sandbox-frame.ts`, 'utf8') as string
const css = readFileSync(`${DIR}/sandbox-frame.css`, 'utf8') as string

const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)
const ATTR_NAMES = ['surfaceId', 'html', 'csp']

describe('sandbox-frame.md descriptor — structural validity', () => {
  it('has a leading frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body.trim().length).toBeGreaterThan(0)
    expect(body).toContain('# ui-sandbox-frame')
  })

  it('carries the ADR-0004 / plan §10 descriptor field set as top-level keys', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing descriptor field: ${field}`).toBe(true)
  })

  it('tag=ui-sandbox-frame, extends=UIElement, tier=container, face.formAssociated=false', () => {
    expect(/^tag:\s*ui-sandbox-frame\s*$/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIElement\b/m.test(fence)).toBe(true)
    expect(/^tier:\s*container\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*false/.test(fence)).toBe(true)
  })

  it('validateComponentDescriptor reports ZERO structural failures (schema-valid)', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })

  it('declares the two rendered parts truthfully by name (frame/fallback)', () => {
    const partNames = (parsed.sequences.get('parts') ?? []).map((p) => p.get('name'))
    expect(partNames).toEqual(['frame', 'fallback'])
  })

  it('declares exactly the one event, action, with the SPEC-R8 detail shape documented', () => {
    const events = parsed.sequences.get('events') ?? []
    expect(events.length).toBe(1)
    expect(events[0].get('name')).toBe('action')
  })
})

describe('sandbox-frame.md descriptor — contract↔props trip-wire', () => {
  it('attributes[] is a faithful bijection with UISandboxFrameElement.props by NAME', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    const drift = compareDescriptorToProps(parsed.attributes, UISandboxFrameElement.props)
    expect(drift.filter((d) => d.code === 'DRIFT_MISSING' || d.code === 'DRIFT_EXTRA')).toEqual([])
  })

  it('all three attributes are CLEAN — zero drift (type/default/reflect all agree with the live props)', () => {
    const drift = compareDescriptorToProps(parsed.attributes, UISandboxFrameElement.props)
    expect(drift).toEqual([])
  })

  it('negative control: a genuinely drifted attribute still FAILS the trip-wire', () => {
    const flipDefault = parsed.attributes.map((a) => (a.name === 'html' ? { ...a, default: 'not-empty' } : { ...a }))
    expect(compareDescriptorToProps(flipDefault, UISandboxFrameElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_DEFAULT', path: 'attributes.html.default' }),
    )
    const dropCsp = parsed.attributes.filter((a) => a.name !== 'csp')
    expect(compareDescriptorToProps(dropCsp, UISandboxFrameElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_MISSING', path: 'attributes.csp' }),
    )
    const addBogus: ParsedAttribute[] = [...parsed.attributes, { name: 'bogus', type: 'string', default: '', reflect: false }]
    expect(compareDescriptorToProps(addBogus, UISandboxFrameElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_EXTRA', path: 'attributes.bogus' }),
    )
  })
})

describe('sandbox-frame.md descriptor — contract↔source trip-wire', () => {
  it('customStates/slots tell the truth about sandbox-frame.ts + sandbox-frame.css (0 source-drift)', () => {
    // ui-sandbox-frame has NO custom states (no :state()) and styles no author-slotted [slot=...]
    // content (slots: [] — every child is control-built, never author-slotted).
    expect([...collectUsedStates(ts, css)]).toEqual([])
    expect([...collectStyledSlots(css)]).toEqual([])
    expect(scalarSeq(parsed, 'customStates')).toEqual([])
    expect(compareDescriptorToSource(parsed, { ts, css })).toEqual([])
  })

  it('NEGATIVE: a synthetic source using an undocumented state FAILS the source-wire (STATE_UNDOCUMENTED)', () => {
    const syntheticTs = `${ts}\nthis.internals.states?.add('ready') // synthetic — not real ui-sandbox-frame code`
    const result = compareDescriptorToSource(parsed, { ts: syntheticTs, css })
    expect(result).toContainEqual(expect.objectContaining({ code: 'STATE_UNDOCUMENTED', path: 'customStates.ready' }))
  })

  it('NEGATIVE: a synthetic css styling an undocumented slot FAILS the source-wire (SLOT_UNDOCUMENTED)', () => {
    const syntheticCss = `${css}\n:scope > [slot='leading'] { display: none; } /* synthetic */`
    const result = compareDescriptorToSource(parsed, { ts, css: syntheticCss })
    expect(result).toContainEqual(expect.objectContaining({ code: 'SLOT_UNDOCUMENTED', path: 'slots.leading' }))
  })
})
