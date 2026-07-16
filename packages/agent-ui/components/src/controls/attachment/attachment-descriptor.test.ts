import { describe, it, expect } from 'vitest'
import { UIAttachmentElement } from './attachment.ts'
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

// attachment-descriptor.test.ts — the stat.md/button.md three-layer pattern: structural, contract↔props,
// contract↔source (LLD-C10).

const DIR = `${process.cwd()}/packages/agent-ui/components/src/controls/attachment`
const md = readFileSync(`${DIR}/attachment.md`, 'utf8') as string
const ts = readFileSync(`${DIR}/attachment.ts`, 'utf8') as string
const css = readFileSync(`${DIR}/attachment.css`, 'utf8') as string

const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)
const ATTR_NAMES = ['filename', 'mimeType', 'sizeBytes', 'href']

describe('attachment.md descriptor — structural validity', () => {
  it('has a leading frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body.trim().length).toBeGreaterThan(0)
    expect(body).toContain('# ui-attachment')
  })

  it('carries the ADR-0004 / plan §10 descriptor field set as top-level keys', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing descriptor field: ${field}`).toBe(true)
  })

  it('tag=ui-attachment, extends=UIElement, tier=display, face.formAssociated=false', () => {
    expect(/^tag:\s*ui-attachment\s*$/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIElement\b/m.test(fence)).toBe(true)
    expect(/^tier:\s*display\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*false/.test(fence)).toBe(true)
  })

  it('validateComponentDescriptor reports ZERO structural failures (schema-valid)', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })
})

describe('attachment.md descriptor — contract↔props trip-wire', () => {
  it('attributes[] is a faithful bijection with UIAttachmentElement.props by NAME', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    const drift = compareDescriptorToProps(parsed.attributes, UIAttachmentElement.props)
    expect(drift.filter((d) => d.code === 'DRIFT_MISSING' || d.code === 'DRIFT_EXTRA')).toEqual([])
  })

  it('all four attributes are CLEAN — zero drift (type/default/reflect all agree with the live props)', () => {
    const drift = compareDescriptorToProps(parsed.attributes, UIAttachmentElement.props)
    expect(drift).toEqual([])
  })

  it('negative control: a genuinely drifted attribute still FAILS the trip-wire', () => {
    const flipDefault = parsed.attributes.map((a) => (a.name === 'filename' ? { ...a, default: 'x' } : { ...a }))
    expect(compareDescriptorToProps(flipDefault, UIAttachmentElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_DEFAULT', path: 'attributes.filename.default' }),
    )
    const dropHref = parsed.attributes.filter((a) => a.name !== 'href')
    expect(compareDescriptorToProps(dropHref, UIAttachmentElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_MISSING', path: 'attributes.href' }),
    )
  })
})

describe('attachment.md descriptor — contract↔source trip-wire', () => {
  it('customStates/slots tell the truth about attachment.ts + attachment.css (0 source-drift)', () => {
    // ui-attachment has NO custom states (no :state() — a display leaf has nothing to transition) and NO
    // author-slotted content (no [slot=...] selector — every child is control-built).
    expect([...collectUsedStates(ts, css)]).toEqual([])
    expect([...collectStyledSlots(css)]).toEqual([])
    expect(scalarSeq(parsed, 'customStates')).toEqual([])
    expect(compareDescriptorToSource(parsed, { ts, css })).toEqual([])
  })

  it('NEGATIVE: a synthetic source using an undocumented state FAILS the source-wire (STATE_UNDOCUMENTED)', () => {
    const syntheticTs = ts + "\nthis.internals.states?.add('ready') // synthetic — not real ui-attachment code"
    const result = compareDescriptorToSource(parsed, { ts: syntheticTs, css })
    expect(result).toContainEqual(expect.objectContaining({ code: 'STATE_UNDOCUMENTED', path: 'customStates.ready' }))
  })

  it('NEGATIVE: a synthetic css styling an undocumented slot FAILS the source-wire (SLOT_UNDOCUMENTED)', () => {
    const syntheticCss = css + "\n:scope > [slot='leading'] { display: none; } /* synthetic */"
    const result = compareDescriptorToSource(parsed, { ts, css: syntheticCss })
    expect(result).toContainEqual(expect.objectContaining({ code: 'SLOT_UNDOCUMENTED', path: 'slots.leading' }))
  })
})
