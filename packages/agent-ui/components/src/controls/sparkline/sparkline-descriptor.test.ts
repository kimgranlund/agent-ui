import { describe, it, expect } from 'vitest'
import { UISparklineElement } from './sparkline.ts'
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

// sparkline.md descriptor — the icon.md/button.md three-layer pattern: structural, contract↔props,
// contract↔source.

const DIR = `${process.cwd()}/packages/agent-ui/components/src/controls/sparkline`
const md = readFileSync(`${DIR}/sparkline.md`, 'utf8') as string
const ts = readFileSync(`${DIR}/sparkline.ts`, 'utf8') as string
const css = readFileSync(`${DIR}/sparkline.css`, 'utf8') as string

const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)
const ATTR_NAMES = ['values', 'label', 'variant']

describe('sparkline.md descriptor — structural validity', () => {
  it('has a leading frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body.trim().length).toBeGreaterThan(0)
    expect(body).toContain('# ui-sparkline')
  })

  it('carries the ADR-0004 / plan §10 descriptor field set as top-level keys', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing descriptor field: ${field}`).toBe(true)
  })

  it('tag=ui-sparkline, extends=UIElement, tier=display, face.formAssociated=false', () => {
    expect(/^tag:\s*ui-sparkline\s*$/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIElement\b/m.test(fence)).toBe(true)
    expect(/^tier:\s*display\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*false/.test(fence)).toBe(true)
  })

  it('validateComponentDescriptor reports ZERO structural failures (schema-valid)', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })
})

describe('sparkline.md descriptor — contract↔props trip-wire', () => {
  it('attributes[] is a faithful bijection with UISparklineElement.props by NAME (values, label, variant)', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    const drift = compareDescriptorToProps(parsed.attributes, UISparklineElement.props)
    // NAME bijection holds cleanly (no DRIFT_MISSING / DRIFT_EXTRA) — only the KNOWN kindOf gap below fires.
    expect(drift.filter((d) => d.code === 'DRIFT_MISSING' || d.code === 'DRIFT_EXTRA')).toEqual([])
  })

  it('label and variant are CLEAN — zero drift (type/default/reflect/enum-values all agree)', () => {
    const drift = compareDescriptorToProps(parsed.attributes, UISparklineElement.props)
    expect(drift.filter((d) => d.path.startsWith('attributes.label') || d.path.startsWith('attributes.variant'))).toEqual([])
  })

  it('`values` is CLEAN — zero drift (the M1-b kindOf array-codec branch closes the array-hardened-codec ' +
    'gap: kindOf now classifies a codec whose from(null)=[] as "json", matching the descriptor)', () => {
    const drift = compareDescriptorToProps(parsed.attributes, UISparklineElement.props)
    expect(drift.filter((d) => d.path.startsWith('attributes.values'))).toEqual([])
  })

  it('negative control: a `values` descriptor mis-declared as "string" still FAILS the trip-wire ' +
    '(kindOf\'s array-codec branch does not blindly green everything)', () => {
    const flipType = parsed.attributes.map((a) => (a.name === 'values' ? { ...a, type: 'string' } : { ...a }))
    expect(compareDescriptorToProps(flipType, UISparklineElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_TYPE', path: 'attributes.values.type' }),
    )
  })

  it('a genuinely drifted attribute (unrelated to the known gap) still FAILS the trip-wire (negative control)', () => {
    const flipDefault = parsed.attributes.map((a) => (a.name === 'label' ? { ...a, default: 'x' } : { ...a }))
    expect(compareDescriptorToProps(flipDefault, UISparklineElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_DEFAULT', path: 'attributes.label.default' }),
    )
    const dropVariant = parsed.attributes.filter((a) => a.name !== 'variant')
    expect(compareDescriptorToProps(dropVariant, UISparklineElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_MISSING', path: 'attributes.variant' }),
    )
  })
})

describe('sparkline.md descriptor — contract↔source trip-wire', () => {
  it('customStates/slots tell the truth about sparkline.ts + sparkline.css (0 source-drift)', () => {
    // ui-sparkline has NO custom states (no :state() — a display leaf has nothing to transition) and NO
    // styled slots (no [slot=...] selector — the only child is the control-built <svg>, never author-slotted).
    expect([...collectUsedStates(ts, css)]).toEqual([])
    expect([...collectStyledSlots(css)]).toEqual([])
    expect(scalarSeq(parsed, 'customStates')).toEqual([])
    expect(compareDescriptorToSource(parsed, { ts, css })).toEqual([])
  })

  it('NEGATIVE: a synthetic source using an undocumented state FAILS the source-wire (STATE_UNDOCUMENTED)', () => {
    const syntheticTs = ts + "\nthis.internals.states?.add('ready') // synthetic — not real ui-sparkline code"
    const result = compareDescriptorToSource(parsed, { ts: syntheticTs, css })
    expect(result).toContainEqual(expect.objectContaining({ code: 'STATE_UNDOCUMENTED', path: 'customStates.ready' }))
  })

  it('NEGATIVE: a synthetic css styling an undocumented slot FAILS the source-wire (SLOT_UNDOCUMENTED)', () => {
    const syntheticCss = css + "\n:scope > [slot='leading'] { display: none; } /* synthetic */"
    const result = compareDescriptorToSource(parsed, { ts, css: syntheticCss })
    expect(result).toContainEqual(expect.objectContaining({ code: 'SLOT_UNDOCUMENTED', path: 'slots.leading' }))
  })
})
