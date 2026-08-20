import { describe, it, expect } from 'vitest'
import { UIBreadcrumbElement } from './breadcrumb.ts'
import {
  splitFrontmatter,
  parseDescriptor,
  validateComponentDescriptor,
  compareDescriptorToProps,
  compareDescriptorToSource,
  collectUsedStates,
  collectStyledSlots,
  type ParsedAttribute,
} from '../../descriptor/component-descriptor.ts'
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// breadcrumb-descriptor.test.ts — the three-layer descriptor pattern (pagination-descriptor.test.ts /
// toolbar-descriptor.test.ts precedent): structural, contract↔props, contract↔source. S2 scope (GH #1515):
// `label`/`inline`/`collapse`/`collapseKeepTrailing` — the full attribute contract now that S2 has landed.

const DIR = `${process.cwd()}/packages/agent-ui/components/src/controls/breadcrumb`
const md = readFileSync(`${DIR}/breadcrumb.md`, 'utf8') as string
const ts = readFileSync(`${DIR}/breadcrumb.ts`, 'utf8') as string
const css = readFileSync(`${DIR}/breadcrumb.css`, 'utf8') as string

const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)
const ATTR_NAMES = ['label', 'inline', 'collapse', 'collapseKeepTrailing']

describe('breadcrumb.md descriptor — structural validity', () => {
  it('has a leading frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body.trim().length).toBeGreaterThan(0)
    expect(body).toContain('# ui-breadcrumb')
  })

  it('carries the ADR-0004 / plan §10 descriptor field set as top-level keys', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing descriptor field: ${field}`).toBe(true)
  })

  it('tag=ui-breadcrumb, tier=pattern, extends UIElement, face NOT form-associated', () => {
    expect(/^tag:\s*ui-breadcrumb\s*$/m.test(fence)).toBe(true)
    expect(/^tier:\s*pattern\b/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIElement\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*false/.test(fence)).toBe(true)
  })

  it('declares role=navigation via internals (never a host attribute) + the label ARIA source', () => {
    expect(fence).toMatch(/role:\s*navigation\b/)
    expect(fence).toMatch(/roleSource:\s*internals\b/)
    expect(fence).toMatch(/labelSource:.*internals\.ariaLabel/)
  })

  it('declares no [size]/[scale] attribute — the intake Geometry row: no new geometry row of its own', () => {
    const names = new Set(parsed.attributes.map((a) => a.name))
    expect(names.has('size')).toBe(false)
    expect(names.has('scale')).toBe(false)
  })

  it('S2 (GH #1515): collapse enum [none,menu] default none; collapseKeepTrailing number default 2', () => {
    const collapse = parsed.attributes.find((a) => a.name === 'collapse')
    const keepTrailing = parsed.attributes.find((a) => a.name === 'collapseKeepTrailing')
    expect(collapse?.type).toBe('enum')
    expect(collapse?.values).toEqual(['none', 'menu'])
    expect(collapse?.default).toBe('none')
    expect(collapse?.reflect).toBe(true)
    expect(keepTrailing?.type).toBe('number')
    expect(keepTrailing?.default).toBe('2')
    expect(keepTrailing?.reflect).toBe(true)
  })

  it('declares exactly TWO parts — separator, overflow (GH #1515 S2)', () => {
    const names = (parsed.sequences.get('parts') ?? []).map((p) => p.get('name'))
    expect(names).toEqual(['separator', 'overflow'])
  })

  it('declares exactly ONE slot — separator', () => {
    const names = (parsed.sequences.get('slots') ?? []).map((s) => s.get('name'))
    expect(names).toEqual(['separator'])
  })

  it('declares zero events — crumb activation is native anchor navigation only', () => {
    expect(parsed.sequences.get('events') ?? []).toEqual([])
  })

  it('validateComponentDescriptor reports ZERO structural failures', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES) // anti-vacuous
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })
})

describe('breadcrumb.md descriptor — contract↔props trip-wire', () => {
  it('attributes[] is a faithful bijection with finalize(UIBreadcrumbElement).props (0 drift)', () => {
    expect(compareDescriptorToProps(parsed.attributes, UIBreadcrumbElement.props)).toEqual([])
  })

  it("label defaults '', inline defaults false — both reflect", () => {
    const label = parsed.attributes.find((a) => a.name === 'label')
    const inline = parsed.attributes.find((a) => a.name === 'inline')
    expect(label?.default).toBe('')
    expect(inline?.default).toBe('false')
    expect(label?.reflect).toBe(true)
    expect(inline?.reflect).toBe(true)
  })

  it('a drifted attribute FAILS the trip-wire (negative control)', () => {
    const flipDefault: ParsedAttribute[] = parsed.attributes.map((a) => (a.name === 'label' ? { ...a, default: 'x' } : { ...a }))
    expect(compareDescriptorToProps(flipDefault, UIBreadcrumbElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_DEFAULT', path: 'attributes.label.default' }),
    )

    const dropInline: ParsedAttribute[] = parsed.attributes.filter((a) => a.name !== 'inline')
    expect(compareDescriptorToProps(dropInline, UIBreadcrumbElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_MISSING', path: 'attributes.inline' }),
    )

    const addBogus: ParsedAttribute[] = [...parsed.attributes, { name: 'bogus', type: 'string', default: '', reflect: false }]
    expect(compareDescriptorToProps(addBogus, UIBreadcrumbElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_EXTRA', path: 'attributes.bogus' }),
    )
  })
})

describe('breadcrumb.md descriptor — contract↔source trip-wire', () => {
  it('customStates/slots tell the truth — the ONE [slot="separator"] use in source is declared (0 drift)', () => {
    expect([...collectUsedStates(ts, css)]).toEqual([])
    expect([...collectStyledSlots(css)]).toEqual([])
    expect(compareDescriptorToSource(parsed, { ts, css })).toEqual([])
  })

  it('a state used in source but undocumented FAILS (negative control)', () => {
    const withState = `${ts}\nthis.internals.states?.add('zzstate')`
    expect(compareDescriptorToSource(parsed, { ts: withState, css })).toContainEqual(
      expect.objectContaining({ code: 'STATE_UNDOCUMENTED', path: 'customStates.zzstate' }),
    )
  })
})
