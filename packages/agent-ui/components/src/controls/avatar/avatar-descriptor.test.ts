import { describe, it, expect } from 'vitest'
import { UIAvatarElement } from './avatar.ts'
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
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// avatar-descriptor.test.ts — the text.md/stat.md three-layer pattern (LLD-C10, feed-family.lld.md §6):
// structural (s8), contract↔props (s10), contract↔source (s11).

const DIR = `${process.cwd()}/packages/agent-ui/components/src/controls/avatar`
const md = readFileSync(`${DIR}/avatar.md`, 'utf8') as string
const ts = readFileSync(`${DIR}/avatar.ts`, 'utf8') as string
const css = readFileSync(`${DIR}/avatar.css`, 'utf8') as string

const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)
const ATTR_NAMES = ['src', 'name', 'label', 'size']

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

describe('avatar.md descriptor — contract↔props trip-wire', () => {
  it('attributes[] is a faithful bijection with UIAvatarElement.props by NAME, in order', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    const drift = compareDescriptorToProps(parsed.attributes, UIAvatarElement.props)
    expect(drift.filter((d) => d.code === 'DRIFT_MISSING' || d.code === 'DRIFT_EXTRA')).toEqual([])
  })

  it('all four attributes are CLEAN — zero drift (type/default/reflect/values all agree with the live props)', () => {
    const drift = compareDescriptorToProps(parsed.attributes, UIAvatarElement.props)
    expect(drift).toEqual([])
  })

  it('src/name/label are string, reflect=false, default=\'\'', () => {
    for (const name of ['src', 'name', 'label']) {
      const a = parsed.attributes.find((x) => x.name === name)
      expect(a?.type, name).toBe('string')
      expect(a?.default, name).toBe('')
      expect(a?.reflect, name).toBe(false)
    }
  })

  it('size is enum sm/md/lg, default=md, REFLECTED (the CSS [size] hook)', () => {
    const s = parsed.attributes.find((x) => x.name === 'size')
    expect(s?.type).toBe('enum')
    expect(s?.default).toBe('md')
    expect(s?.reflect).toBe(true)
    expect(s?.values).toEqual(['sm', 'md', 'lg'])
  })

  it('negative control: a genuinely drifted attribute still FAILS the trip-wire', () => {
    const flipReflect: ParsedAttribute[] = parsed.attributes.map((a) =>
      a.name === 'size' ? { ...a, reflect: false } : { ...a },
    )
    expect(compareDescriptorToProps(flipReflect, UIAvatarElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_REFLECT', path: 'attributes.size.reflect' }),
    )
    const dropName = parsed.attributes.filter((a) => a.name !== 'name')
    expect(compareDescriptorToProps(dropName, UIAvatarElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_MISSING', path: 'attributes.name' }),
    )
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
