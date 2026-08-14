import { describe, it, expect } from 'vitest'
import { UIDrawerElement } from './drawer.ts'
import {
  splitFrontmatter,
  parseDescriptor,
  validateComponentDescriptor,
  compareDescriptorToProps,
  type ParsedAttribute,
} from '../../descriptor/component-descriptor.ts'
// Read drawer.md as text (the modal-descriptor.test.ts precedent — no @types/node devDep).
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// ADR-0188 s2 — drawer.md descriptor. Two layers, both targeting the fence, mirroring modal-descriptor.test.ts:
//   • (a) STRUCTURAL — the YAML frontmatter parses and is schema-valid.
//   • (b) CONTRACT↔PROPS — the descriptor's `attributes[]` is a faithful BIJECTION with the live
//     UIDrawerElement.props (the ...surfaceProps spread elevation/brightness + open/persistent/edge), via the
//     fleet-wide compareDescriptorToProps trip-wire.
// Plus (c) the ADR-0188 §4 four-cell boundary sentence must land VERBATIM in the descriptor prose (the
// manifest n10 accept predicate — a grep-asserted requirement, not paraphrase).

const DRAWER = `${process.cwd()}/packages/agent-ui/components/src/controls/drawer`
const md = readFileSync(`${DRAWER}/drawer.md`, 'utf8') as string

const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)

// The settled attribute surface, in declaration order on the fence (the spread surface axes first).
const ATTR_NAMES = ['elevation', 'brightness', 'open', 'persistent', 'edge']

describe('drawer.md descriptor — frontmatter parses + schema-valid', () => {
  it('has a leading frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body.trim().length).toBeGreaterThan(0)
    expect(body).toContain('# ui-drawer') // the /site doc prose, not the contract
  })

  it('carries the ADR-0004 / plan §10 descriptor field set as top-level keys', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing descriptor field: ${field}`).toBe(true)
  })

  it('tag is ui-drawer, extends UIContainerElement, tier is container, and face is NOT form-associated', () => {
    expect(/^tag:\s*ui-drawer\s*$/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIContainerElement\b/m.test(fence)).toBe(true) // the surface base (not a form base)
    expect(/^tier:\s*container\b/m.test(fence)).toBe(true) // geometry.md container-class sizing
    expect(/formAssociated:\s*false/.test(fence)).toBe(true) // a <dialog> is not a form widget
  })

  it('validateComponentDescriptor reports ZERO structural failures', () => {
    // anti-vacuous: the reader actually parsed the five attributes (in order) before the schema is consulted
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    const failures = validateComponentDescriptor(parsed)
    expect(failures).toEqual([])
  })
})

describe('drawer.md descriptor — the bindable open + the dialog part + edge', () => {
  it('records the bindable `open` (reflected boolean) + the close/toggle events (the two-way bind, ADR-0019)', () => {
    const open = parsed.attributes.find((a) => a.name === 'open')
    expect(open?.type).toBe('boolean')
    expect(open?.reflect).toBe(true)
    const events = (parsed.sequences.get('events') ?? []).map((i) => i.get('name'))
    expect(events).toContain('close')
    expect(events).toContain('toggle') // the value:{event:'toggle'} two-way signal
    expect(events).toHaveLength(2) // NO new event names (ADR-0188 cl.4 — ⊂ the closed seven)
  })

  it('declares the dialog PART (not a user slot) and persistent defaults false', () => {
    const parts = (parsed.sequences.get('parts') ?? []).map((i) => i.get('name'))
    expect(parts).toContain('dialog')
    const persistent = parsed.attributes.find((a) => a.name === 'persistent')
    expect(persistent?.type).toBe('boolean')
    expect(persistent?.default).toBe('false') // default OFF
    expect(persistent?.reflect).toBe(true)
  })

  it('declares `edge` as a reflected enum, default `end`, with exactly the three ruled members (no `top`)', () => {
    const edge = parsed.attributes.find((a) => a.name === 'edge')
    expect(edge?.type).toBe('enum')
    expect(edge?.default).toBe('end')
    expect(edge?.reflect).toBe(true)
    expect(edge?.values).toEqual(['end', 'start', 'bottom']) // ADR-0188 cl.8 — 'top' deliberately fenced out
  })
})

describe('drawer.md descriptor — contract↔props trip-wire', () => {
  it('attributes[] is a faithful bijection with UIDrawerElement.props (0 drift)', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES) // anti-vacuous anchor
    expect(compareDescriptorToProps(parsed.attributes, UIDrawerElement.props)).toEqual([])
  })

  it('a drifted attribute FAILS the trip-wire (negative control — reflect + default)', () => {
    const flipReflect: ParsedAttribute[] = parsed.attributes.map((a) => (a.name === 'open' ? { ...a, reflect: false } : { ...a }))
    expect(compareDescriptorToProps(flipReflect, UIDrawerElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_REFLECT', path: 'attributes.open.reflect' }),
    )

    const flipDefault: ParsedAttribute[] = parsed.attributes.map((a) => (a.name === 'edge' ? { ...a, default: 'start' } : { ...a }))
    expect(compareDescriptorToProps(flipDefault, UIDrawerElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_DEFAULT', path: 'attributes.edge.default' }),
    )
  })

  it('a removed or added attribute FAILS the trip-wire (negative control — bijection both ways)', () => {
    const dropEdge: ParsedAttribute[] = parsed.attributes.filter((a) => a.name !== 'edge')
    expect(compareDescriptorToProps(dropEdge, UIDrawerElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_MISSING', path: 'attributes.edge' }),
    )

    const addBogus: ParsedAttribute[] = [...parsed.attributes, { name: 'bogus', type: 'string', default: '', reflect: false }]
    expect(compareDescriptorToProps(addBogus, UIDrawerElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_EXTRA', path: 'attributes.bogus' }),
    )
  })
})

// ── the four-cell boundary sentence (ADR-0188 §4 / the manifest n10 accept predicate) ─────────────────────
describe('drawer.md descriptor — the ADR-0188 four-cell boundary lands VERBATIM in the prose', () => {
  it('carries the exact fence sentence: "a persistent, non-scrimmed side panel is never a drawer"', () => {
    expect(body.replace(/\s+/g, ' ')).toContain('a persistent, non-scrimmed side panel is never a drawer')
  })

  it('names all four cells of the overlay/docking map', () => {
    const flat = body.replace(/\s+/g, ' ')
    expect(flat).toContain('centered modal')
    expect(flat).toContain('EDGE-DOCKED modal')
    expect(flat).toContain('anchored NON-modal top-layer')
    expect(flat).toContain('docked NON-overlay layout')
  })
})
