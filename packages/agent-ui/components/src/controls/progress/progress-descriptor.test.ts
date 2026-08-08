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

// progress-descriptor.test.ts — structural (s8) + contract↔source (s11); the stat.md/button.md pattern.
// The contract↔props leg (s10) — INCLUDING the kindOf build-verify block that used to pin `current`/`max`'s
// shared "number" classification against differing defaults — RETIRED here (ADR-0173 cl.4c/OF4):
// progress.ts's `static props` now IMPORTS `progress.props.gen.ts`, GENERATED from this same progress.md —
// the bijection (and the kindOf verdict it depended on) is structurally true by construction. The
// replacement drift gate lives fleet-wide in `descriptor/props-gen-driftwire.test.ts` (progress's entry
// lands in the SAME commit as this retirement).

const DIR = `${process.cwd()}/packages/agent-ui/components/src/controls/progress`
const md = readFileSync(`${DIR}/progress.md`, 'utf8') as string
const ts = readFileSync(`${DIR}/progress.ts`, 'utf8') as string
const css = readFileSync(`${DIR}/progress.css`, 'utf8') as string

const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)
const ATTR_NAMES = ['current', 'max', 'label', 'segments']

describe('progress.md descriptor — structural validity', () => {
  it('has a leading frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body.trim().length).toBeGreaterThan(0)
    expect(body).toContain('# ui-progress')
  })

  it('carries the ADR-0004 / plan §10 descriptor field set as top-level keys', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing descriptor field: ${field}`).toBe(true)
  })

  it('tag=ui-progress, extends=UIElement, tier=display, face.formAssociated=false', () => {
    expect(/^tag:\s*ui-progress\s*$/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIElement\b/m.test(fence)).toBe(true)
    expect(/^tier:\s*display\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*false/.test(fence)).toBe(true)
  })

  it('validateComponentDescriptor reports ZERO structural failures (schema-valid)', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })

  it('events: [] — SPEC-R1 AC3, a display leaf emits nothing', () => {
    expect(parsed.sequences.get('events')).toEqual([])
  })
})

describe('progress.md descriptor — contract↔source trip-wire', () => {
  it('customStates/slots tell the truth about progress.ts + progress.css (0 source-drift)', () => {
    // ui-progress has NO custom states (no :state() — a display leaf has nothing to transition) and NO
    // author-slotted content (no [slot=...] selector — the track/fill pair is entirely component-built).
    expect([...collectUsedStates(ts, css)]).toEqual([])
    expect([...collectStyledSlots(css)]).toEqual([])
    expect(scalarSeq(parsed, 'customStates')).toEqual([])
    expect(compareDescriptorToSource(parsed, { ts, css })).toEqual([])
  })

  it('NEGATIVE: a synthetic source using an undocumented state FAILS the source-wire (STATE_UNDOCUMENTED)', () => {
    const syntheticTs = ts + "\nthis.internals.states?.add('ready') // synthetic — not real ui-progress code"
    const result = compareDescriptorToSource(parsed, { ts: syntheticTs, css })
    expect(result).toContainEqual(expect.objectContaining({ code: 'STATE_UNDOCUMENTED', path: 'customStates.ready' }))
  })

  it('NEGATIVE: a synthetic css styling an undocumented slot FAILS the source-wire (SLOT_UNDOCUMENTED)', () => {
    const syntheticCss = css + "\n:scope > [slot='leading'] { display: none; } /* synthetic */"
    const result = compareDescriptorToSource(parsed, { ts, css: syntheticCss })
    expect(result).toContainEqual(expect.objectContaining({ code: 'SLOT_UNDOCUMENTED', path: 'slots.leading' }))
  })
})
