import { describe, it, expect } from 'vitest'
import { UIStatElement } from './stat.ts'
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

// stat-descriptor.test.ts — the sparkline.md/button.md three-layer pattern: structural, contract↔props,
// contract↔source. LLD-C9's named build-verify item: assert what `kindOf` actually yields for
// statValueProp/statDeltaProp BEFORE trusting the descriptor cells — see the dedicated describe block
// below, which pins the verdict this file's other assertions depend on.

const DIR = `${process.cwd()}/packages/agent-ui/components/src/controls/stat`
const md = readFileSync(`${DIR}/stat.md`, 'utf8') as string
const ts = readFileSync(`${DIR}/stat.ts`, 'utf8') as string
const css = readFileSync(`${DIR}/stat.css`, 'utf8') as string

const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)
const ATTR_NAMES = ['label', 'value', 'delta', 'caption']

describe('kindOf build-verify (LLD-C9) — value classifies "string", delta classifies "number"', () => {
  it('value: a null-defaulting, non-enum-snapping string-shaped codec classifies as "string"', () => {
    const drift = compareDescriptorToProps(
      parsed.attributes.map((a) => (a.name === 'value' ? { ...a, type: 'string' } : a)),
      UIStatElement.props,
    )
    expect(drift.filter((d) => d.path.startsWith('attributes.value'))).toEqual([])
  })

  it('delta: a null-defaulting numeric codec classifies as "number"', () => {
    const drift = compareDescriptorToProps(
      parsed.attributes.map((a) => (a.name === 'delta' ? { ...a, type: 'number' } : a)),
      UIStatElement.props,
    )
    expect(drift.filter((d) => d.path.startsWith('attributes.delta'))).toEqual([])
  })

  it('NEGATIVE: value mis-declared as "number" fails DRIFT_TYPE (kindOf does not blindly green everything)', () => {
    const flip = parsed.attributes.map((a) => (a.name === 'value' ? { ...a, type: 'number' } : a))
    expect(compareDescriptorToProps(flip, UIStatElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_TYPE', path: 'attributes.value.type' }),
    )
  })

  it('NEGATIVE: delta mis-declared as "string" fails DRIFT_TYPE', () => {
    const flip = parsed.attributes.map((a) => (a.name === 'delta' ? { ...a, type: 'string' } : a))
    expect(compareDescriptorToProps(flip, UIStatElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_TYPE', path: 'attributes.delta.type' }),
    )
  })
})

describe('stat.md descriptor — structural validity', () => {
  it('has a leading frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body.trim().length).toBeGreaterThan(0)
    expect(body).toContain('# ui-stat')
  })

  it('carries the ADR-0004 / plan §10 descriptor field set as top-level keys', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing descriptor field: ${field}`).toBe(true)
  })

  it('tag=ui-stat, extends=UIElement, tier=display, face.formAssociated=false', () => {
    expect(/^tag:\s*ui-stat\s*$/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIElement\b/m.test(fence)).toBe(true)
    expect(/^tier:\s*display\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*false/.test(fence)).toBe(true)
  })

  it('validateComponentDescriptor reports ZERO structural failures (schema-valid)', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })
})

describe('stat.md descriptor — contract↔props trip-wire', () => {
  it('attributes[] is a faithful bijection with UIStatElement.props by NAME', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    const drift = compareDescriptorToProps(parsed.attributes, UIStatElement.props)
    expect(drift.filter((d) => d.code === 'DRIFT_MISSING' || d.code === 'DRIFT_EXTRA')).toEqual([])
  })

  it('all four attributes are CLEAN — zero drift (type/default/reflect all agree with the live props)', () => {
    const drift = compareDescriptorToProps(parsed.attributes, UIStatElement.props)
    expect(drift).toEqual([])
  })

  it('negative control: a genuinely drifted attribute still FAILS the trip-wire', () => {
    const flipDefault = parsed.attributes.map((a) => (a.name === 'label' ? { ...a, default: 'x' } : { ...a }))
    expect(compareDescriptorToProps(flipDefault, UIStatElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_DEFAULT', path: 'attributes.label.default' }),
    )
    const dropCaption = parsed.attributes.filter((a) => a.name !== 'caption')
    expect(compareDescriptorToProps(dropCaption, UIStatElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_MISSING', path: 'attributes.caption' }),
    )
  })
})

describe('stat.md descriptor — contract↔source trip-wire', () => {
  it('customStates/slots tell the truth about stat.ts + stat.css (0 source-drift)', () => {
    // ui-stat has NO custom states (no :state() — a display leaf has nothing to transition) and NO
    // author-slotted content (no [slot=...] selector — every child is control-built).
    expect([...collectUsedStates(ts, css)]).toEqual([])
    expect([...collectStyledSlots(css)]).toEqual([])
    expect(scalarSeq(parsed, 'customStates')).toEqual([])
    expect(compareDescriptorToSource(parsed, { ts, css })).toEqual([])
  })

  it('NEGATIVE: a synthetic source using an undocumented state FAILS the source-wire (STATE_UNDOCUMENTED)', () => {
    const syntheticTs = ts + "\nthis.internals.states?.add('ready') // synthetic — not real ui-stat code"
    const result = compareDescriptorToSource(parsed, { ts: syntheticTs, css })
    expect(result).toContainEqual(expect.objectContaining({ code: 'STATE_UNDOCUMENTED', path: 'customStates.ready' }))
  })

  it('NEGATIVE: a synthetic css styling an undocumented slot FAILS the source-wire (SLOT_UNDOCUMENTED)', () => {
    const syntheticCss = css + "\n:scope > [slot='leading'] { display: none; } /* synthetic */"
    const result = compareDescriptorToSource(parsed, { ts, css: syntheticCss })
    expect(result).toContainEqual(expect.objectContaining({ code: 'SLOT_UNDOCUMENTED', path: 'slots.leading' }))
  })
})
