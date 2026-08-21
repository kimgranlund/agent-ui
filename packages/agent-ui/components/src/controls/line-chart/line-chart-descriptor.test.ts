import { describe, it, expect } from 'vitest'
import { UILineChartElement } from './line-chart.ts'
import {
  splitFrontmatter,
  parseDescriptor,
  validateComponentDescriptor,
  compareDescriptorToProps,
  compareDescriptorToSource,
  collectUsedStates,
  collectStyledSlots,
} from '../../descriptor/component-descriptor.ts'
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// line-chart.md descriptor — the column-chart/pie-chart/bar-chart three-layer pattern: structural,
// contract<->props, contract<->source (ADR-0205, EXTENDED by ADR-0229 cl.3). This file did not exist
// before this wave (a pre-existing fleet gap, adjacent to the `axes` build — the SAME three-layer pattern
// every OTHER chart-family control already has; added here since this wave already rewrites the fence).

const DIR = `${process.cwd()}/packages/agent-ui/components/src/controls/line-chart`
const md = readFileSync(`${DIR}/line-chart.md`, 'utf8') as string
const ts = readFileSync(`${DIR}/line-chart.ts`, 'utf8') as string
const css = readFileSync(`${DIR}/line-chart.css`, 'utf8') as string

const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)
const ATTR_NAMES = ['values', 'label', 'variant', 'axes', 'labels', 'projected']

describe('line-chart.md descriptor — structural validity', () => {
  it('has a leading frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body.trim().length).toBeGreaterThan(0)
    expect(body).toContain('# ui-line-chart')
  })

  it('carries the ADR-0004 / plan §10 descriptor field set as top-level keys', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing descriptor field: ${field}`).toBe(true)
  })

  it('tag=ui-line-chart, extends=UIElement, tier=display, face.formAssociated=false', () => {
    expect(/^tag:\s*ui-line-chart\s*$/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIElement\b/m.test(fence)).toBe(true)
    expect(/^tier:\s*display\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*false/.test(fence)).toBe(true)
  })

  it('validateComponentDescriptor reports ZERO structural failures (schema-valid)', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })

  it('events: [] — the display tier stays zero-event in BOTH states', () => {
    expect(parsed.sequences.get('events') ?? []).toEqual([])
  })

  it('SPEC-R12-class AC: no [size]/[scale] selector in line-chart.css and no such attribute declared (Display class takes neither)', () => {
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(/\[size\b/.test(bare)).toBe(false)
    expect(/\[scale\b/.test(bare)).toBe(false)
    expect(parsed.attributes.some((a) => a.name === 'size')).toBe(false)
  })
})

describe('line-chart.md descriptor — contract↔props trip-wire', () => {
  it('the full bijection is CLEAN — zero drift', () => {
    expect(compareDescriptorToProps(parsed.attributes, UILineChartElement.props)).toEqual([])
  })

  it('negative control: a `values` descriptor mis-declared as "string" still FAILS the trip-wire', () => {
    const flipType = parsed.attributes.map((a) => (a.name === 'values' ? { ...a, type: 'string' } : { ...a }))
    expect(compareDescriptorToProps(flipType, UILineChartElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_TYPE', path: 'attributes.values.type' }),
    )
  })

  it('a drifted attribute FAILS the trip-wire (negative control — reflect + default, isolated on `label`)', () => {
    const labelOnly = parsed.attributes.filter((a) => a.name === 'label')
    const labelOnlyProps = { label: UILineChartElement.props.label }
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
    const labelOnlyProps = { label: UILineChartElement.props.label }
    expect(compareDescriptorToProps([], labelOnlyProps)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_MISSING', path: 'attributes.label' }),
    )
    const addBogus = [{ name: 'bogus', type: 'string', default: '', reflect: false }]
    expect(compareDescriptorToProps(addBogus, labelOnlyProps)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_EXTRA', path: 'attributes.bogus' }),
    )
  })

  it('axes is `boolean` reflected; labels is `json` defaulting []; projected is `number` defaulting 0', () => {
    const axes = parsed.attributes.find((a) => a.name === 'axes')
    const labels = parsed.attributes.find((a) => a.name === 'labels')
    const projected = parsed.attributes.find((a) => a.name === 'projected')
    expect(axes?.type).toBe('boolean')
    expect(axes?.reflect).toBe(true)
    expect(labels?.type).toBe('json')
    expect(projected?.type).toBe('number')
    expect(projected?.default).toBe('0')
    expect(projected?.reflect).toBe(true)
  })
})

describe('line-chart.md descriptor — contract↔source trip-wire', () => {
  it('customStates/slots tell the truth about line-chart.ts + line-chart.css (0 source-drift)', () => {
    // ui-line-chart has NO custom states (a Display leaf has nothing to transition) and NO
    // [slot=...]-styled slots (every layer is component-built via replaceChildren, [data-part] only).
    expect([...collectUsedStates(ts, css)]).toEqual([])
    expect([...collectStyledSlots(css)]).toEqual([])
    expect(compareDescriptorToSource(parsed, { ts, css })).toEqual([])
  })

  it('NEGATIVE: a synthetic source using an undocumented state FAILS the source-wire (STATE_UNDOCUMENTED)', () => {
    const syntheticTs = ts + "\nthis.internals.states?.add('ready') // synthetic — not real ui-line-chart code"
    const result = compareDescriptorToSource(parsed, { ts: syntheticTs, css })
    expect(result).toContainEqual(expect.objectContaining({ code: 'STATE_UNDOCUMENTED', path: 'customStates.ready' }))
  })

  it('NEGATIVE: a synthetic css styling an undocumented slot FAILS the source-wire (SLOT_UNDOCUMENTED)', () => {
    const syntheticCss = css + "\n:scope > [slot='leading'] { display: none; } /* synthetic */"
    const result = compareDescriptorToSource(parsed, { ts, css: syntheticCss })
    expect(result).toContainEqual(expect.objectContaining({ code: 'SLOT_UNDOCUMENTED', path: 'slots.leading' }))
  })
})
