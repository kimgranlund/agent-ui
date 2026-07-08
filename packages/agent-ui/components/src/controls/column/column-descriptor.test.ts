import { describe, it, expect } from 'vitest'
import { UIColumnElement } from './column.ts'
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
// Read column.md/.ts/.css as text (vite strips `.md?raw`; no `@types/node` devDep — same approach as the
// button descriptor probe).
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// s4 — column.md descriptor (ADR-0004). Three layers, mirroring the button probe:
//   • structural — the YAML frontmatter parses and carries the ADR-0004 / plan §10 field set; the schema is clean
//     EXCEPT the one transient `extends` code (BASE_CLASSES gains UIContainerElement in s12 — filtered here).
//   • contract↔props — the descriptor's `attributes[]` is a faithful BIJECTION with live `UIColumnElement.props`
//     (the spread surfaceProps + flexProps), via compareDescriptorToProps.
//   • contract↔source — customStates/slots tell the truth about column.ts/.css (both empty for a layout box).

const COL = `${process.cwd()}/packages/agent-ui/components/src/controls/column`
const md = readFileSync(`${COL}/column.md`, 'utf8') as string
const ts = readFileSync(`${COL}/column.ts`, 'utf8') as string
const css = readFileSync(`${COL}/column.css`, 'utf8') as string

const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)

describe('column.md descriptor — frontmatter parses + schema (s4)', () => {
  it('has a leading frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body.trim().length).toBeGreaterThan(0)
    expect(body).toContain('# ui-column') // the /site doc prose, not the contract
  })

  it('carries the ADR-0004 / plan §10 descriptor field set as top-level keys', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing descriptor field: ${field}`).toBe(true)
  })

  it('tag is ui-column, tier is a layout size-class, face records a non-form-associated container', () => {
    expect(/^tag:\s*ui-column\b/m.test(fence)).toBe(true)
    expect(/^tier:\s*layout\b/m.test(fence)).toBe(true) // Container/layout band — NO control height
    expect(/formAssociated:\s*false/.test(fence)).toBe(true) // a structural container, not a FACE form control
  })

  it('is schema-clean EXCEPT the transient extends code (BASE_CLASSES gains UIContainerElement at s12)', () => {
    // `extends: UIContainerElement` trips BAD_EXTENDS until the s12 descriptor-schema edit lands; assert every
    // OTHER structural rule passes. Filtering (not asserting BAD_EXTENDS is present) keeps this GREEN after s12.
    const failures = validateComponentDescriptor(parsed)
    expect(failures.filter((f) => f.code !== 'BAD_EXTENDS')).toEqual([])
  })
})

describe('column.md descriptor — contract↔props trip-wire (s4)', () => {
  it('attributes[] is a faithful bijection with UIColumnElement.props (0 drift) — surfaceProps + flexProps + stretch + reflow', () => {
    // anti-vacuous: the reader actually parsed all eight attributes before the trip-wire is consulted
    // (surfaceProps ×2 + flexProps ×4 + the column-local `stretch` sizing opt-in + the ADR-0096 `reflow` gate)
    expect(parsed.attributes.map((a) => a.name)).toEqual(['elevation', 'brightness', 'align', 'justify', 'gap', 'wrap', 'stretch', 'reflow'])
    expect(compareDescriptorToProps(parsed.attributes, UIColumnElement.props)).toEqual([])
  })

  it('reflow defaults to `locked` (ADR-0096 cl.2 — the deliberate default flip) with `auto` as the opt-in', () => {
    const reflow = parsed.attributes.find((a) => a.name === 'reflow')
    expect(reflow?.default).toBe('locked')
    expect(reflow?.values).toEqual(['locked', 'auto']) // locked LEADS — default + invalid-value snap target
    expect(reflow?.reflect).toBe(true)
  })

  it('a drifted attribute FAILS the trip-wire (negative control — reflect + default + enum values)', () => {
    // mutate a COPY of the parsed descriptor (column.md is never touched); each patch flips ONE field.
    const flipReflect: ParsedAttribute[] = parsed.attributes.map((a) => (a.name === 'align' ? { ...a, reflect: false } : { ...a }))
    expect(compareDescriptorToProps(flipReflect, UIColumnElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_REFLECT', path: 'attributes.align.reflect' }),
    )

    const flipDefault: ParsedAttribute[] = parsed.attributes.map((a) => (a.name === 'gap' ? { ...a, default: 'md' } : { ...a }))
    expect(compareDescriptorToProps(flipDefault, UIColumnElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_DEFAULT', path: 'attributes.gap.default' }),
    )

    // declare a BOGUS extra member on the elevation enum → it does not round-trip the live codec (DRIFT_VALUES).
    // NOTE a DROPPED member is invisible to an opaque-closure probe (the documented asymmetry); a non-member is
    // the detectable drift, so the negative control plants one.
    const bogusMember: ParsedAttribute[] = parsed.attributes.map((a) =>
      a.name === 'elevation' ? { ...a, values: ['0', '1', '2', '3', '-1', '-2', '-3', '5'] } : { ...a },
    )
    expect(compareDescriptorToProps(bogusMember, UIColumnElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_VALUES', path: 'attributes.elevation.values' }),
    )
  })
})

describe('column.md descriptor — contract↔source trip-wire (s4)', () => {
  it('customStates/slots tell the truth about column.ts + column.css (0 source-drift — a layout box has none)', () => {
    // a layout primitive uses NO custom states and NO named slots — both source sets are genuinely empty.
    expect([...collectUsedStates(ts, css)]).toEqual([])
    expect([...collectStyledSlots(css)]).toEqual([])
    expect(compareDescriptorToSource(parsed, { ts, css })).toEqual([])
  })

  it('the slot extractor is non-vacuous — it WOULD find a styled slot if one existed (synthetic control)', () => {
    // prove the empty result above is the truth, not a broken extractor: a synthetic `[slot='x']` is detected.
    expect([...collectStyledSlots(`:scope > [slot='x'] { color: red; }`)]).toEqual(['x'])
  })
})
