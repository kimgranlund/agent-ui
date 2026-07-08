import { describe, it, expect } from 'vitest'
import { UIRowElement } from './row.ts'
import {
  splitFrontmatter,
  parseDescriptor,
  validateComponentDescriptor,
  compareDescriptorToProps,
  compareDescriptorToSource,
  collectUsedStates,
  collectStyledSlots,
} from '../../descriptor/component-descriptor.ts'
import type { ParsedAttribute } from '../../descriptor/component-descriptor.ts'
// Read row.md/.ts/.css as text (no `@types/node` devDep — same readFileSync approach as the button s10 probe).
// @ts-expect-error - node:fs is untyped without @types/node; vitest/node resolves it at runtime
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// s3 — row.md descriptor (ADR-0004). Three layers, all targeting the fence:
//   • (a) STRUCTURAL — the YAML frontmatter parses + is schema-valid. ONE caveat: `extends: UIContainerElement`
//     is the FIRST non-form base, and the schema's BASE_CLASSES gains it at the integration slice (decomp s12);
//     until then the structural schema flags exactly that as BAD_EXTENDS, which this probe FILTERS as the one
//     deferred code (robust across the s12 transition — see the assertion).
//   • (b) CONTRACT↔PROPS — the descriptor's `attributes[]` is a faithful BIJECTION with the live
//     `UIRowElement.props` (the surfaceProps + flexProps spread), via the fleet-wide compareDescriptorToProps
//     trip-wire; a drifted / dropped / added attribute FAILS (the negative controls).
//   • (c) CONTRACT↔SOURCE — a pure layout primitive declares NO customStates and NO named slots; the source
//     scan confirms row.ts/.css reference none, so compareDescriptorToSource is 0-drift.

const ROW = `${process.cwd()}/packages/agent-ui/components/src/controls/row`
const md = readFileSync(`${ROW}/row.md`, 'utf8') as string
const ts = readFileSync(`${ROW}/row.ts`, 'utf8') as string
const css = readFileSync(`${ROW}/row.css`, 'utf8') as string

const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)

// The settled attribute surface, in declaration order (the surfaceProps + flexProps spread) — the anti-vacuous
// anchor for both the schema and the trip-wire layers.
const ATTR_NAMES = ['elevation', 'brightness', 'align', 'justify', 'gap', 'wrap', 'reflow']

describe('row.md descriptor — frontmatter parses + schema-valid (s3 part a)', () => {
  it('has a leading frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body.trim().length).toBeGreaterThan(0)
    expect(body).toContain('# ui-row') // the /site doc prose, not the contract
  })

  it('carries the ADR-0004 / plan §10 descriptor field set as top-level keys', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing descriptor field: ${field}`).toBe(true)
  })

  it('tag is ui-row, tier is layout, extends UIContainerElement, and face is non-form-associated', () => {
    expect(/^tag:\s*ui-row\s*$/m.test(fence)).toBe(true)
    expect(/^tier:\s*layout\b/m.test(fence)).toBe(true) // the Container/layout size-class — no control height
    expect(/^extends:\s*UIContainerElement\b/m.test(fence)).toBe(true) // the FIRST non-form base
    expect(/formAssociated:\s*false/.test(fence)).toBe(true)
  })

  it('validateComponentDescriptor reports ZERO structural failures aside from the deferred extends (schema-valid)', () => {
    // anti-vacuous: the reader actually parsed the six attributes (in order) before the schema is consulted
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    const failures = validateComponentDescriptor(parsed)
    // robust across s12: before it, extends:UIContainerElement is flagged BAD_EXTENDS (filtered); after it
    // registers the base in BASE_CLASSES, there is no such failure (filter is a no-op). Either way: 0 OTHERS.
    expect(failures.filter((f) => f.code !== 'BAD_EXTENDS')).toEqual([])
    // and any BAD_EXTENDS that IS present is exactly the (deferred) `extends` field — never a hidden second defect
    expect(failures.filter((f) => f.code === 'BAD_EXTENDS').every((f) => f.path === 'extends')).toBe(true)
  })
})

describe('row.md descriptor — contract↔props trip-wire (s3 part b)', () => {
  it('attributes[] is a faithful bijection with finalize(UIRowElement).props (0 drift)', () => {
    // anti-vacuous: the seven attribute names parsed before the trip-wire is consulted
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(compareDescriptorToProps(parsed.attributes, UIRowElement.props)).toEqual([])
  })

  it('reflow defaults to `auto` (ADR-0096 cl.2 — UNCHANGED behavior) with `locked` as the pin opt-in', () => {
    const reflow = parsed.attributes.find((a) => a.name === 'reflow')
    expect(reflow?.default).toBe('auto')
    expect(reflow?.values).toEqual(['auto', 'locked']) // auto LEADS — default + invalid-value snap target
    expect(reflow?.reflect).toBe(true)
  })

  it('a drifted attribute FAILS the trip-wire (negative control — reflect + default + enum values)', () => {
    // mutate a COPY of the parsed descriptor (row.md is never touched); each patch flips ONE field.
    const flipReflect: ParsedAttribute[] = parsed.attributes.map((a) => (a.name === 'gap' ? { ...a, reflect: false } : { ...a }))
    expect(compareDescriptorToProps(flipReflect, UIRowElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_REFLECT', path: 'attributes.gap.reflect' }),
    )

    const flipDefault: ParsedAttribute[] = parsed.attributes.map((a) => (a.name === 'align' ? { ...a, default: 'center' } : { ...a }))
    expect(compareDescriptorToProps(flipDefault, UIRowElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_DEFAULT', path: 'attributes.align.default' }),
    )

    // a wrong enum first-member (snap target) → DRIFT_VALUES (the live codec snaps to '0', not '1')
    const flipValues: ParsedAttribute[] = parsed.attributes.map((a) => (a.name === 'elevation' ? { ...a, values: ['1', '0', '2', '3', '-1', '-2', '-3'] } : { ...a }))
    expect(compareDescriptorToProps(flipValues, UIRowElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_VALUES', path: 'attributes.elevation.values' }),
    )
  })

  it('a removed or added attribute FAILS the trip-wire (negative control — bijection both ways)', () => {
    const dropGap: ParsedAttribute[] = parsed.attributes.filter((a) => a.name !== 'gap')
    expect(compareDescriptorToProps(dropGap, UIRowElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_MISSING', path: 'attributes.gap' }),
    )

    const addBogus: ParsedAttribute[] = [...parsed.attributes, { name: 'direction', type: 'enum', values: ['row', 'column'], default: 'row', reflect: true }]
    expect(compareDescriptorToProps(addBogus, UIRowElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_EXTRA', path: 'attributes.direction' }), // direction is NOT a prop — the tag names the axis
    )
  })
})

describe('row.md descriptor — contract↔source trip-wire (s3 part c)', () => {
  it('a layout primitive declares NO customStates and NO named slots — and the source uses none (0 drift)', () => {
    // anti-vacuous: prove the extractors find the EMPTY source facts (row.ts has no internals.states, row.css
    // no :state() / no [slot] selector — host-as-flex places the default children, not named slots).
    expect([...collectUsedStates(ts, css)]).toEqual([])
    expect([...collectStyledSlots(css)]).toEqual([])
    expect(compareDescriptorToSource(parsed, { ts, css })).toEqual([])
  })
})
