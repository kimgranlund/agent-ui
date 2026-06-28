import { describe, it, expect } from 'vitest'
import { UIGridElement } from './grid.ts'
import {
  splitFrontmatter,
  parseDescriptor,
  validateComponentDescriptor,
  compareDescriptorToProps,
  compareDescriptorToSource,
} from '../../descriptor/component-descriptor.ts'
import type { ParsedAttribute } from '../../descriptor/component-descriptor.ts'
// Read grid.md/.ts/.css as text (no `@types/node` devDep — same readFileSync approach as the button/text-field probes).
// @ts-expect-error - node:fs is untyped without @types/node; vitest/node resolves it at runtime
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// s6 — grid.md descriptor (ADR-0004). Three layers, all targeting the fence:
//   • (a) STRUCTURAL — the YAML frontmatter parses + is schema-valid. ONE caveat: `extends:
//     UIContainerElement` is a NEW base the schema's BASE_CLASSES gains at the s12 integration slice (decomp);
//     until then validateComponentDescriptor reports exactly one BAD_EXTENDS for it, so we assert ZERO OTHER
//     structural failures (the filter is a no-op once s12 lands → green before AND after integration).
//   • (b) CONTRACT↔PROPS — the descriptor's `attributes[]` is a faithful BIJECTION with the live
//     `UIGridElement.props` (what `finalize` installs from), via compareDescriptorToProps: the four attributes
//     (the ...surfaceProps spread elevation/brightness, plus gap + min) agree on type/default/reflect/enum
//     values, and a drifted / added / removed attribute FAILS (the negative controls).
//   • (c) CONTRACT↔SOURCE — customStates/slots tell the truth about grid.ts/grid.css (a layout primitive has
//     no states; the only slot is the unstyled default cell) → zero source-drift.

const GRID = `${process.cwd()}/packages/agent-ui/components/src/controls/grid`
const md = readFileSync(`${GRID}/grid.md`, 'utf8') as string
const ts = readFileSync(`${GRID}/grid.ts`, 'utf8') as string
const css = readFileSync(`${GRID}/grid.css`, 'utf8') as string

const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)

// The settled attribute surface, in declaration order on the fence (anti-vacuous anchor for every layer).
const ATTR_NAMES = ['elevation', 'brightness', 'gap', 'min']

describe('grid.md descriptor — frontmatter parses + schema-valid (part a)', () => {
  it('has a leading frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body.trim().length).toBeGreaterThan(0)
    expect(body).toContain('# ui-grid')
  })

  it('carries the ADR-0004 / plan §10 descriptor field set as top-level keys', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing descriptor field: ${field}`).toBe(true)
  })

  it('tag is ui-grid, extends UIContainerElement, and face records a NON-form-associated container', () => {
    expect(/^tag:\s*ui-grid\s*$/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIContainerElement\b/m.test(fence)).toBe(true) // the shared surface base (NOT UIFormElement)
    expect(/formAssociated:\s*false/.test(fence)).toBe(true)
  })

  it('validateComponentDescriptor reports ZERO structural failures BEYOND the s12-deferred BAD_EXTENDS', () => {
    // anti-vacuous: the reader actually parsed the four attributes (in order) before the schema is consulted.
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    // BASE_CLASSES gains UIContainerElement at s12; filtering BAD_EXTENDS leaves the rest, and the filter is a
    // no-op once s12 lands (no BAD_EXTENDS is produced), so this assertion holds before AND after integration.
    const failures = validateComponentDescriptor(parsed)
    expect(failures.filter((f) => f.code !== 'BAD_EXTENDS')).toEqual([])
  })
})

describe('grid.md descriptor — contract↔props trip-wire (part b)', () => {
  it('attributes[] is a faithful bijection with finalize(UIGridElement).props (0 drift)', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(compareDescriptorToProps(parsed.attributes, UIGridElement.props)).toEqual([])
  })

  it('a drifted attribute FAILS the trip-wire (negative control — reflect + default)', () => {
    const flipReflect: ParsedAttribute[] = parsed.attributes.map((a) => (a.name === 'gap' ? { ...a, reflect: false } : { ...a }))
    expect(compareDescriptorToProps(flipReflect, UIGridElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_REFLECT', path: 'attributes.gap.reflect' }),
    )

    const flipDefault: ParsedAttribute[] = parsed.attributes.map((a) => (a.name === 'gap' ? { ...a, default: 'md' } : { ...a }))
    expect(compareDescriptorToProps(flipDefault, UIGridElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_DEFAULT', path: 'attributes.gap.default' }),
    )
  })

  it('a removed or added attribute FAILS the trip-wire (negative control — bijection both ways)', () => {
    const dropMin: ParsedAttribute[] = parsed.attributes.filter((a) => a.name !== 'min')
    expect(compareDescriptorToProps(dropMin, UIGridElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_MISSING', path: 'attributes.min' }),
    )

    const addBogus: ParsedAttribute[] = [...parsed.attributes, { name: 'columns', type: 'number', default: 'null', reflect: false }]
    expect(compareDescriptorToProps(addBogus, UIGridElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_EXTRA', path: 'attributes.columns' }),
    )
  })
})

describe('grid.md descriptor — contract↔source trip-wire (part c)', () => {
  it('customStates/slots tell the truth about grid.ts + grid.css (0 source-drift — no states; default cell only)', () => {
    expect(compareDescriptorToSource(parsed, { ts, css })).toEqual([])
  })
})
