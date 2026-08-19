import { describe, it, expect } from 'vitest'
import { UIPieChartElement } from './pie-chart.ts'
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

// pie-chart.md descriptor — the icon/text-descriptor/bar-chart three-layer pattern: structural,
// contract<->props, contract<->source (ADR-0219, drafted SPEC §5.2 delta).

const DIR = `${process.cwd()}/packages/agent-ui/components/src/controls/pie-chart`
const md = readFileSync(`${DIR}/pie-chart.md`, 'utf8') as string
const ts = readFileSync(`${DIR}/pie-chart.ts`, 'utf8') as string
const css = readFileSync(`${DIR}/pie-chart.css`, 'utf8') as string

const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)
const ATTR_NAMES = ['data', 'label', 'variant']

describe('pie-chart.md descriptor — structural validity', () => {
  it('has a leading frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body.trim().length).toBeGreaterThan(0)
    expect(body).toContain('# ui-pie-chart')
  })

  it('carries the ADR-0004 / plan §10 descriptor field set as top-level keys', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing descriptor field: ${field}`).toBe(true)
  })

  it('tag=ui-pie-chart, extends=UIElement, tier=display, face.formAssociated=false', () => {
    expect(/^tag:\s*ui-pie-chart\s*$/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIElement\b/m.test(fence)).toBe(true)
    expect(/^tier:\s*display\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*false/.test(fence)).toBe(true)
  })

  it('validateComponentDescriptor reports ZERO structural failures (schema-valid)', () => {
    // anti-vacuous: all three attributes parse before the schema is consulted
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })

  it('SPEC-R12-class AC: no [size]/[scale] selector in pie-chart.css and no such attribute declared (Display class takes neither)', () => {
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(/\[size\b/.test(bare)).toBe(false)
    expect(/\[scale\b/.test(bare)).toBe(false)
    expect(parsed.attributes.some((a) => a.name === 'size')).toBe(false)
  })
})

describe('pie-chart.md descriptor — contract↔props trip-wire', () => {
  it('the `label` attribute is a faithful, zero-drift match against UIPieChartElement.props', () => {
    const labelOnly = parsed.attributes.filter((a) => a.name === 'label')
    const labelOnlyProps = { label: UIPieChartElement.props.label }
    expect(compareDescriptorToProps(labelOnly, labelOnlyProps)).toEqual([])
  })

  it('the full bijection is CLEAN — zero drift', () => {
    const result = compareDescriptorToProps(parsed.attributes, UIPieChartElement.props)
    expect(result).toEqual([])
  })

  it('negative control: a `data` descriptor mis-declared as "string" still FAILS the trip-wire', () => {
    const flipType = parsed.attributes.map((a) => (a.name === 'data' ? { ...a, type: 'string' } : { ...a }))
    expect(compareDescriptorToProps(flipType, UIPieChartElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_TYPE', path: 'attributes.data.type' }),
    )
  })

  it('a drifted attribute FAILS the trip-wire (negative control — reflect + default, isolated on `label`)', () => {
    const labelOnly = parsed.attributes.filter((a) => a.name === 'label')
    const labelOnlyProps = { label: UIPieChartElement.props.label }
    const flipReflect = labelOnly.map((a) => ({ ...a, reflect: false }))
    expect(compareDescriptorToProps(flipReflect, labelOnlyProps)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_REFLECT', path: 'attributes.label.reflect' }),
    )
    const flipDefault = labelOnly.map((a) => ({ ...a, default: 'x' }))
    expect(compareDescriptorToProps(flipDefault, labelOnlyProps)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_DEFAULT', path: 'attributes.label.default' }),
    )
  })

  it('a removed or added attribute FAILS the trip-wire (negative control — bijection both ways, isolated on `label`)', () => {
    const labelOnlyProps = { label: UIPieChartElement.props.label }
    expect(compareDescriptorToProps([], labelOnlyProps)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_MISSING', path: 'attributes.label' }),
    )
    const addBogus = [{ name: 'bogus', type: 'string', default: '', reflect: false }]
    expect(compareDescriptorToProps(addBogus, labelOnlyProps)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_EXTRA', path: 'attributes.bogus' }),
    )
  })

  it('variant enum values [donut, pie] match the live enum members', () => {
    const variantAttr = parsed.attributes.find((a) => a.name === 'variant')
    expect(variantAttr?.values).toEqual(['donut', 'pie'])
    expect(variantAttr?.default).toBe('donut')
  })
})

describe('pie-chart.md descriptor — contract↔source trip-wire', () => {
  it('customStates/slots tell the truth about pie-chart.ts + pie-chart.css (0 source-drift)', () => {
    // ui-pie-chart has NO custom states (no :state() — a Display leaf has nothing to transition) and NO
    // [slot=...]-styled slots (the ring + every key row are component-built via replaceChildren, never
    // author-slotted — they use [data-part], a different selector namespace collectStyledSlots ignores).
    expect([...collectUsedStates(ts, css)]).toEqual([])
    expect([...collectStyledSlots(css)]).toEqual([])
    expect(scalarSeq(parsed, 'customStates')).toEqual([])
    expect(compareDescriptorToSource(parsed, { ts, css })).toEqual([])
  })

  it('NEGATIVE: a synthetic source using an undocumented state FAILS the source-wire (STATE_UNDOCUMENTED)', () => {
    const syntheticTs = ts + "\nthis.internals.states?.add('ready') // synthetic — not real ui-pie-chart code"
    const result = compareDescriptorToSource(parsed, { ts: syntheticTs, css })
    expect(result).toContainEqual(expect.objectContaining({ code: 'STATE_UNDOCUMENTED', path: 'customStates.ready' }))
  })

  it('NEGATIVE: a synthetic css styling an undocumented slot FAILS the source-wire (SLOT_UNDOCUMENTED)', () => {
    const syntheticCss = css + "\n:scope > [slot='leading'] { display: none; } /* synthetic */"
    const result = compareDescriptorToSource(parsed, { ts, css: syntheticCss })
    expect(result).toContainEqual(expect.objectContaining({ code: 'SLOT_UNDOCUMENTED', path: 'slots.leading' }))
  })
})
