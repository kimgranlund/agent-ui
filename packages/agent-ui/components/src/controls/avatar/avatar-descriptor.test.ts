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

// avatar-descriptor.test.ts — structural (s8) + contract↔source (s11); the text.md/stat.md pattern. The
// contract↔props leg (s10) RETIRED here (ADR-0173 cl.4c/OF4): avatar.ts's `static props` now IMPORTS
// `avatar.props.gen.ts`, GENERATED from this same avatar.md — the bijection is structurally true by
// construction. The replacement drift gate lives fleet-wide in `descriptor/props-gen-driftwire.test.ts`
// (avatar's entry lands in the SAME commit as this retirement).

const DIR = `${process.cwd()}/packages/agent-ui/components/src/controls/avatar`
const md = readFileSync(`${DIR}/avatar.md`, 'utf8') as string
const ts = readFileSync(`${DIR}/avatar.ts`, 'utf8') as string
const css = readFileSync(`${DIR}/avatar.css`, 'utf8') as string

const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)
const ATTR_NAMES = ['src', 'identity', 'label', 'size']

describe('avatar.md descriptor — structural validity', () => {
  it('has a leading frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body.trim().length).toBeGreaterThan(0)
    expect(body).toContain('# ui-avatar')
  })

  it('carries the ADR-0004 / plan §10 descriptor field set as top-level keys', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing descriptor field: ${field}`).toBe(true)
  })

  it('tag=ui-avatar, extends=UIElement, tier=indicator (the F3 widget-box class), face.formAssociated=false', () => {
    expect(/^tag:\s*ui-avatar\s*$/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIElement\b/m.test(fence)).toBe(true)
    expect(/^tier:\s*indicator\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*false/.test(fence)).toBe(true)
  })

  it('validateComponentDescriptor reports ZERO structural failures (schema-valid)', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })
})

describe('avatar.md descriptor — contract↔source trip-wire', () => {
  it('customStates/slots tell the truth about avatar.ts + avatar.css (0 source-drift)', () => {
    // ui-avatar has NO custom states (no :state() — non-interactive, nothing to transition) and NO
    // author-slotted content (no [slot=...] selector — every child is control-built).
    expect([...collectUsedStates(ts, css)]).toEqual([])
    expect([...collectStyledSlots(css)]).toEqual([])
    expect(scalarSeq(parsed, 'customStates')).toEqual([])
    expect(compareDescriptorToSource(parsed, { ts, css })).toEqual([])
  })

  it('NEGATIVE: a synthetic source using an undocumented state FAILS the source-wire (STATE_UNDOCUMENTED)', () => {
    const syntheticTs = ts + "\nthis.internals.states?.add('ready') // synthetic — not real ui-avatar code"
    const result = compareDescriptorToSource(parsed, { ts: syntheticTs, css })
    expect(result).toContainEqual(expect.objectContaining({ code: 'STATE_UNDOCUMENTED', path: 'customStates.ready' }))
  })

  it('NEGATIVE: a synthetic css styling an undocumented slot FAILS the source-wire (SLOT_UNDOCUMENTED)', () => {
    const syntheticCss = css + "\n:scope > [slot='leading'] { display: none; } /* synthetic */"
    const result = compareDescriptorToSource(parsed, { ts, css: syntheticCss })
    expect(result).toContainEqual(expect.objectContaining({ code: 'SLOT_UNDOCUMENTED', path: 'slots.leading' }))
  })
})
