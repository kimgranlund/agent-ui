import { describe, it, expect } from 'vitest'
import { UIBarChartElement } from './bar-chart.ts'
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

// bar-chart.md descriptor — the icon/text-descriptor three-layer pattern: structural, contract<->props,
// contract<->source. LLD-C7 (chart-family.lld.md §4).

const DIR = `${process.cwd()}/packages/agent-ui/components/src/controls/bar-chart`
const md = readFileSync(`${DIR}/bar-chart.md`, 'utf8') as string
const ts = readFileSync(`${DIR}/bar-chart.ts`, 'utf8') as string
const css = readFileSync(`${DIR}/bar-chart.css`, 'utf8') as string

const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)
const ATTR_NAMES = ['data', 'label']

describe('bar-chart.md descriptor — structural validity', () => {
  it('has a leading frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body.trim().length).toBeGreaterThan(0)
    expect(body).toContain('# ui-bar-chart')
  })

  it('carries the ADR-0004 / plan §10 descriptor field set as top-level keys', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing descriptor field: ${field}`).toBe(true)
  })

  it('tag=ui-bar-chart, extends=UIElement, tier=display, face.formAssociated=false', () => {
    expect(/^tag:\s*ui-bar-chart\s*$/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIElement\b/m.test(fence)).toBe(true)
    expect(/^tier:\s*display\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*false/.test(fence)).toBe(true)
  })

  it('validateComponentDescriptor reports ZERO structural failures (schema-valid)', () => {
    // anti-vacuous: both attributes parse before the schema is consulted
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })

  it('SPEC-R12 AC2: no [size] selector in bar-chart.css and no `size` attribute declared', () => {
    // Display class takes no [size]/[scale] geometry row (ADR-0107 cl.5) — the family-coherence A2b
    // invariant (the inverse of A2) would catch a CSS [size] selector with no backing attribute; this
    // folder-local leg asserts the SAME fact directly, without importing that fleet-wide test file.
    expect(/\[size\b/.test(css.replace(/\/\*[\s\S]*?\*\//g, ''))).toBe(false)
    expect(parsed.attributes.some((a) => a.name === 'size')).toBe(false)
  })
})

describe('bar-chart.md descriptor — contract↔props trip-wire', () => {
  it('the `label` attribute is a faithful, zero-drift match against UIBarChartElement.props', () => {
    const labelOnly = parsed.attributes.filter((a) => a.name === 'label')
    const labelOnlyProps = { label: UIBarChartElement.props.label }
    expect(compareDescriptorToProps(labelOnly, labelOnlyProps)).toEqual([])
  })

  it('the full bijection is CLEAN — zero drift (the M1-b kindOf array-codec branch closes the ' +
    'array-hardened-codec gap: kindOf now classifies a codec whose from(null)=[] as "json", the SAME ' +
    'fix sparkline.md\'s `values` relies on)', () => {
    const result = compareDescriptorToProps(parsed.attributes, UIBarChartElement.props)
    expect(result).toEqual([])
  })

  it('negative control: a `data` descriptor mis-declared as "string" still FAILS the trip-wire ' +
    '(kindOf\'s array-codec branch does not blindly green everything)', () => {
    const flipType = parsed.attributes.map((a) => (a.name === 'data' ? { ...a, type: 'string' } : { ...a }))
    expect(compareDescriptorToProps(flipType, UIBarChartElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_TYPE', path: 'attributes.data.type' }),
    )
  })

  it('a drifted attribute FAILS the trip-wire (negative control — reflect + default, isolated on `label`)', () => {
    const labelOnly = parsed.attributes.filter((a) => a.name === 'label')
    const labelOnlyProps = { label: UIBarChartElement.props.label }
    const flipReflect = labelOnly.map((a) => ({ ...a, reflect: true }))
    expect(compareDescriptorToProps(flipReflect, labelOnlyProps)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_REFLECT', path: 'attributes.label.reflect' }),
    )
    const flipDefault = labelOnly.map((a) => ({ ...a, default: 'x' }))
    expect(compareDescriptorToProps(flipDefault, labelOnlyProps)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_DEFAULT', path: 'attributes.label.default' }),
    )
  })

  it('a removed or added attribute FAILS the trip-wire (negative control — bijection both ways, isolated on `label`)', () => {
    const labelOnlyProps = { label: UIBarChartElement.props.label }
    expect(compareDescriptorToProps([], labelOnlyProps)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_MISSING', path: 'attributes.label' }),
    )
    const addBogus = [{ name: 'bogus', type: 'string', default: '', reflect: false }]
    expect(compareDescriptorToProps(addBogus, labelOnlyProps)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_EXTRA', path: 'attributes.bogus' }),
    )
  })
})

describe('bar-chart.md descriptor — contract↔source trip-wire', () => {
  it('customStates/slots tell the truth about bar-chart.ts + bar-chart.css (0 source-drift)', () => {
    // ui-bar-chart has NO custom states (no :state() — a Display leaf has nothing to transition) and NO
    // [slot=...]-styled slots (every row is component-built via replaceChildren, never author-slotted —
    // the rows use [data-part], a different selector namespace collectStyledSlots does not match).
    expect([...collectUsedStates(ts, css)]).toEqual([])
    expect([...collectStyledSlots(css)]).toEqual([])
    expect(scalarSeq(parsed, 'customStates')).toEqual([])
    expect(compareDescriptorToSource(parsed, { ts, css })).toEqual([])
  })

  it('NEGATIVE: a synthetic source using an undocumented state FAILS the source-wire (STATE_UNDOCUMENTED)', () => {
    const syntheticTs = ts + "\nthis.internals.states?.add('ready') // synthetic — not real ui-bar-chart code"
    const result = compareDescriptorToSource(parsed, { ts: syntheticTs, css })
    expect(result).toContainEqual(expect.objectContaining({ code: 'STATE_UNDOCUMENTED', path: 'customStates.ready' }))
  })

  it('NEGATIVE: a synthetic css styling an undocumented slot FAILS the source-wire (SLOT_UNDOCUMENTED)', () => {
    const syntheticCss = css + "\n:scope > [slot='leading'] { display: none; } /* synthetic */"
    const result = compareDescriptorToSource(parsed, { ts, css: syntheticCss })
    expect(result).toContainEqual(expect.objectContaining({ code: 'SLOT_UNDOCUMENTED', path: 'slots.leading' }))
  })
})
