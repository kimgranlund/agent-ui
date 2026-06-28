import { describe, it, expect } from 'vitest'
import { UITabsElement } from './tabs.ts'
import {
  splitFrontmatter,
  parseDescriptor,
  validateComponentDescriptor,
  compareDescriptorToProps,
  compareDescriptorToSource,
  scalarSeq,
  type ParsedAttribute,
} from '../../descriptor/component-descriptor.ts'
// Read the tabs sources as text (no @types/node devDep — the button/text-field readFileSync precedent).
// @ts-expect-error - node:fs is untyped without @types/node; vitest/node resolves it at runtime
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// G9 s8 — tabs.md descriptor (ADR-0004). Three layers against the PRIMARY-element fence (ui-tabs):
//   (a) STRUCTURAL — the YAML frontmatter parses + is schema-valid. ONE caveat: `extends: UIContainerElement`
//       is not yet in the schema's BASE_CLASSES (the descriptor-schema edit is decomp s12 / integration — the
//       lone fleet-file change deferred there). Until s12 the validator flags BAD_EXTENDS for it; this probe
//       FILTERS exactly that one failure (forward-compatible — the filter becomes a no-op once s12 lands), and
//       FLAGS the dependency. Everything else must be 0 failures.
//   (b) CONTRACT↔PROPS — the descriptor `attributes[]` is a faithful bijection with the live
//       UITabsElement.props (the surfaceProps spread elevation/brightness + the bindable selected).
//   (c) CONTRACT↔SOURCE — customStates/slots tell the truth about the .ts/.css of the WHOLE trio (the states
//       span three files: `ready` on tabs.ts, `selected` on tab.ts; both referenced in tabs.css).

const DIR = `${process.cwd()}/packages/agent-ui/components/src/controls/tabs`
const md = readFileSync(`${DIR}/tabs.md`, 'utf8') as string
const ts = ['tabs.ts', 'tab.ts', 'tab-panel.ts'].map((f) => readFileSync(`${DIR}/${f}`, 'utf8') as string).join('\n')
const css = readFileSync(`${DIR}/tabs.css`, 'utf8') as string

const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)

// The settled attribute surface, in declaration order (anti-vacuous anchor): the surfaceProps spread then selected.
const ATTR_NAMES = ['elevation', 'brightness', 'selected']

describe('tabs.md descriptor — frontmatter parses + schema-valid (s8 part a)', () => {
  it('has a leading frontmatter fence and a prose body documenting the three elements', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body).toContain('# ui-tabs · ui-tab · ui-tab-panel')
  })

  it('carries the ADR-0004 descriptor field set; tag is ui-tabs; tier pattern; face NOT form-associated', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing descriptor field: ${field}`).toBe(true)
    expect(/^tag:\s*ui-tabs\s*$/m.test(fence)).toBe(true)
    expect(/^tier:\s*pattern\b/m.test(fence)).toBe(true) // geometry.md Pattern class (container + control-height rows)
    expect(/^extends:\s*UIContainerElement\b/m.test(fence)).toBe(true) // the first non-form family base
    expect(/formAssociated:\s*false/.test(fence)).toBe(true)
  })

  it('declares the tablist PART and the tab/tabpanel roleSource (ARIA rides internals)', () => {
    expect(parsed.sequences.get('parts')?.some((p) => p.get('name') === 'tablist')).toBe(true)
    expect(fence).toMatch(/role:\s*tablist/)
    expect(fence).toMatch(/tabRole:\s*tab\b/)
    expect(fence).toMatch(/panelRole:\s*tabpanel\b/)
  })

  it('validateComponentDescriptor reports ZERO structural failures (modulo the s12-pending BASE_CLASSES edit)', () => {
    // anti-vacuous: the reader actually parsed the three attributes in order before the schema is consulted
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    // FILTER the single BAD_EXTENDS for UIContainerElement (the schema's BASE_CLASSES gains it at decomp s12).
    const failures = validateComponentDescriptor(parsed).filter(
      (f) => !(f.code === 'BAD_EXTENDS' && /UIContainerElement/.test(f.message)),
    )
    expect(failures).toEqual([])
    // and PROVE the only filtered failure is exactly that one (so the filter is not masking a real defect)
    expect(validateComponentDescriptor(parsed)).toContainEqual(
      expect.objectContaining({ code: 'BAD_EXTENDS', path: 'extends' }),
    )
  })
})

describe('tabs.md descriptor — contract↔props trip-wire (s8 part b)', () => {
  it('attributes[] is a faithful bijection with finalize(UITabsElement).props (0 drift)', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES) // anti-vacuous
    expect(compareDescriptorToProps(parsed.attributes, UITabsElement.props)).toEqual([])
  })

  it('the bindable `selected` is a reflected string (the LLD-C8 two-way prop, ADR-0019)', () => {
    const selected = parsed.attributes.find((a) => a.name === 'selected')
    expect(selected?.type).toBe('string')
    expect(selected?.reflect).toBe(true)
    expect(selected?.default).toBe('')
  })

  it('a drifted attribute FAILS the trip-wire (negative control — reflect + default + bijection)', () => {
    const flipReflect: ParsedAttribute[] = parsed.attributes.map((a) => (a.name === 'selected' ? { ...a, reflect: false } : { ...a }))
    expect(compareDescriptorToProps(flipReflect, UITabsElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_REFLECT', path: 'attributes.selected.reflect' }),
    )

    const flipDefault: ParsedAttribute[] = parsed.attributes.map((a) => (a.name === 'elevation' ? { ...a, default: '1' } : { ...a }))
    expect(compareDescriptorToProps(flipDefault, UITabsElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_DEFAULT', path: 'attributes.elevation.default' }),
    )

    const addBogus: ParsedAttribute[] = [...parsed.attributes, { name: 'bogus', type: 'string', default: '', reflect: false }]
    expect(compareDescriptorToProps(addBogus, UITabsElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_EXTRA', path: 'attributes.bogus' }),
    )
  })
})

describe('tabs.md descriptor — contract↔source trip-wire (s8 part c)', () => {
  it('customStates {ready, selected} are USED across the trio .ts/.css (0 source drift)', () => {
    // anti-vacuous: the documented states are exactly the two the source uses (across tabs.ts + tab.ts + tabs.css)
    expect(scalarSeq(parsed, 'customStates').sort()).toEqual(['ready', 'selected'])
    expect(compareDescriptorToSource(parsed, { ts, css })).toEqual([])
  })

  it('a state used in source but undocumented FAILS (negative control)', () => {
    const dropped = parseDescriptor(fence.replace(/^  - selected.*$/m, '')) // drop `selected` from customStates
    expect(compareDescriptorToSource(dropped, { ts, css })).toContainEqual(
      expect.objectContaining({ code: 'STATE_UNDOCUMENTED', path: 'customStates.selected' }),
    )
  })
})
