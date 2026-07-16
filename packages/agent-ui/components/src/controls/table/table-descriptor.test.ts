import { describe, it, expect } from 'vitest'
import { UITableElement } from './table.ts'
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

// table.md descriptor — the bar-chart/text three-layer pattern: structural, contract<->props,
// contract<->source. LLD-C9 (report-family.lld.md §5).

const DIR = `${process.cwd()}/packages/agent-ui/components/src/controls/table`
const md = readFileSync(`${DIR}/table.md`, 'utf8') as string
const ts = readFileSync(`${DIR}/table.ts`, 'utf8') as string
const css = readFileSync(`${DIR}/table.css`, 'utf8') as string

const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)
const ATTR_NAMES = ['columns', 'rows', 'label']

describe('table.md descriptor — structural validity', () => {
  it('has a leading frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body.trim().length).toBeGreaterThan(0)
    expect(body).toContain('# ui-table')
  })

  it('carries the ADR-0004 / plan §10 descriptor field set as top-level keys', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing descriptor field: ${field}`).toBe(true)
  })

  it('tag=ui-table, extends=UIElement, tier=display, face.formAssociated=false', () => {
    expect(/^tag:\s*ui-table\s*$/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIElement\b/m.test(fence)).toBe(true)
    expect(/^tier:\s*display\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*false/.test(fence)).toBe(true)
  })

  it('validateComponentDescriptor reports ZERO structural failures (schema-valid)', () => {
    // anti-vacuous: all three attributes parse before the schema is consulted
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })

  it('SPEC-R17 AC2: no [size]/[scale] selector in table.css and no `size`/`scale` attribute declared', () => {
    // Display class takes no [size]/[scale] geometry row — the family-coherence A2b invariant (the inverse
    // of A2) would catch a CSS [size] selector with no backing attribute; this folder-local leg asserts the
    // SAME fact directly, without importing that fleet-wide test file.
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(/\[size\b/.test(bare)).toBe(false)
    expect(/\[scale\b/.test(bare)).toBe(false)
    expect(parsed.attributes.some((a) => a.name === 'size')).toBe(false)
  })

  it('no --ui-height-* declaration/consumption anywhere (Display class has no control-height lever)', () => {
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(bare).not.toMatch(/--ui-height-/)
  })
})

describe('table.md descriptor — contract↔props trip-wire', () => {
  it('the `label` attribute is a faithful, zero-drift match against UITableElement.props', () => {
    const labelOnly = parsed.attributes.filter((a) => a.name === 'label')
    const labelOnlyProps = { label: UITableElement.props.label }
    expect(compareDescriptorToProps(labelOnly, labelOnlyProps)).toEqual([])
  })

  it('the full bijection is CLEAN — zero drift (columns/rows classify as "json" via kindOf\'s ' +
    'array-hardened-codec branch — the chart-family from(null)=[] construction)', () => {
    const result = compareDescriptorToProps(parsed.attributes, UITableElement.props)
    expect(result).toEqual([])
  })

  it('negative control: a `columns` descriptor mis-declared as "string" still FAILS the trip-wire', () => {
    const flipType = parsed.attributes.map((a) => (a.name === 'columns' ? { ...a, type: 'string' } : { ...a }))
    expect(compareDescriptorToProps(flipType, UITableElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_TYPE', path: 'attributes.columns.type' }),
    )
  })

  it('a drifted attribute FAILS the trip-wire (negative control — reflect + default, isolated on `label`)', () => {
    const labelOnly = parsed.attributes.filter((a) => a.name === 'label')
    const labelOnlyProps = { label: UITableElement.props.label }
    // label reflects TRUE since the TKT-0069 item 2 ruling — the synthetic drift flips the other way.
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
    const labelOnlyProps = { label: UITableElement.props.label }
    expect(compareDescriptorToProps([], labelOnlyProps)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_MISSING', path: 'attributes.label' }),
    )
    const addBogus = [{ name: 'bogus', type: 'string', default: '', reflect: false }]
    expect(compareDescriptorToProps(addBogus, labelOnlyProps)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_EXTRA', path: 'attributes.bogus' }),
    )
  })
})

describe('table.md descriptor — contract↔source trip-wire', () => {
  it('customStates/slots tell the truth about table.ts + table.css (0 source-drift)', () => {
    // ui-table has NO custom states (no :state() — a Display leaf has nothing to transition) and NO
    // [slot=...]-styled slots (every node is component-built via replaceChildren/insertBefore, never
    // author-slotted — the rows/header use real table elements + [data-part='scroll'], a different
    // selector namespace collectStyledSlots does not match).
    expect([...collectUsedStates(ts, css)]).toEqual([])
    expect([...collectStyledSlots(css)]).toEqual([])
    expect(scalarSeq(parsed, 'customStates')).toEqual([])
    expect(compareDescriptorToSource(parsed, { ts, css })).toEqual([])
  })

  it('NEGATIVE: a synthetic source using an undocumented state FAILS the source-wire (STATE_UNDOCUMENTED)', () => {
    const syntheticTs = ts + "\nthis.internals.states?.add('ready') // synthetic — not real ui-table code"
    const result = compareDescriptorToSource(parsed, { ts: syntheticTs, css })
    expect(result).toContainEqual(expect.objectContaining({ code: 'STATE_UNDOCUMENTED', path: 'customStates.ready' }))
  })

  it('NEGATIVE: a synthetic css styling an undocumented slot FAILS the source-wire (SLOT_UNDOCUMENTED)', () => {
    const syntheticCss = css + "\n:scope > [slot='leading'] { display: none; } /* synthetic */"
    const result = compareDescriptorToSource(parsed, { ts, css: syntheticCss })
    expect(result).toContainEqual(expect.objectContaining({ code: 'SLOT_UNDOCUMENTED', path: 'slots.leading' }))
  })
})
