import { describe, it, expect } from 'vitest'
import {
  splitFrontmatter,
  parseDescriptor,
  validateComponentDescriptor,
  compareDescriptorToSource,
  collectUsedStates,
  collectStyledSlots,
  scalarSeq,
} from '../../descriptor/component-descriptor.ts'
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// source-list.md descriptor — structural + contract<->source (ADR-0004/ADR-0214, GH #1394). The
// contract<->props layer is SKIPPED here by design (ADR-0173 cl.4c/OF4, the table.md/table-descriptor.test.ts
// precedent): source-list.ts's `static props` IMPORTS `source-list.props.gen.ts`, itself GENERATED from this
// same source-list.md (including its ONE `codec:`-referenced bespoke prop — `sources`, OF1) — the bijection
// is structurally true by construction, ships already-converted from day one (never a commit where s10's
// hand-bijection check and the generator-drift gate coexist for one control). The drift gate — regenerating
// in-memory and diffing against the committed generated file — lives fleet-wide in
// `descriptor/props-gen-driftwire.test.ts` (source-list's entry lands in the SAME commit as this file).

const DIR = `${process.cwd()}/packages/agent-ui/components/src/controls/source-list`
const md = readFileSync(`${DIR}/source-list.md`, 'utf8') as string
const ts = readFileSync(`${DIR}/source-list.ts`, 'utf8') as string
const css = readFileSync(`${DIR}/source-list.css`, 'utf8') as string

const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)
const ATTR_NAMES = ['sources']

describe('source-list.md descriptor — structural validity', () => {
  it('has a leading frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body.trim().length).toBeGreaterThan(0)
    expect(body).toContain('# ui-source-list')
  })

  it('carries the ADR-0004 / plan §10 descriptor field set as top-level keys', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing descriptor field: ${field}`).toBe(true)
  })

  it('tag=ui-source-list, extends=UIElement, tier=display, face.formAssociated=false', () => {
    expect(/^tag:\s*ui-source-list\s*$/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIElement\b/m.test(fence)).toBe(true)
    expect(/^tier:\s*display\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*false/.test(fence)).toBe(true)
  })

  it('validateComponentDescriptor reports ZERO structural failures (schema-valid)', () => {
    // anti-vacuous: the one attribute parses before the schema is consulted
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })

  it('no [size]/[scale] selector in source-list.css and no size/scale attribute declared (Display class)', () => {
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(/\[size\b/.test(bare)).toBe(false)
    expect(/\[scale\b/.test(bare)).toBe(false)
    expect(parsed.attributes.some((a) => a.name === 'size')).toBe(false)
  })

  it('no --md-sys-height-* declaration/consumption anywhere (Display class has no control-height lever)', () => {
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(bare).not.toMatch(/--md-sys-height-/)
  })
})

describe('source-list.md descriptor — contract↔source trip-wire', () => {
  it('customStates/slots tell the truth about the source (0 source-drift)', () => {
    // NO custom states (no :state() — a static attribution receipt has nothing to transition) and NO
    // author-slotted content (no [slot=...] selector — every child is control-built).
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
