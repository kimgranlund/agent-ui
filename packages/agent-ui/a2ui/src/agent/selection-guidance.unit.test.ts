// selection-guidance.unit.test.ts: the loader's own contract on inline fixtures. Every rejection rule
// throws `SelectionGuidanceError` with its code; `selectionGuidanceFor` resolves base, derived, and
// unknown ids; `renderSelectionClause` renders the exact clause shape. The shipped-tree coverage gate
// (bijection, reciprocity, persona composition, orphans) lives in `catalog/selection-guidance.test.ts`.

import { describe, it, expect } from 'vitest'
import type { Catalog } from '../catalog/catalog.ts'
import { A2UI_BASIC_CANONICAL_URI } from '../catalog/a2ui-basic/index.ts'
import {
  loadSelectionGuidance,
  renderSelectionClause,
  selectionGuidanceFor,
  SelectionGuidanceError,
  SelectionGuidanceErrorCode,
  SELECTION_GUIDANCE_CHAR_BUDGET,
} from './selection-guidance.ts'

const { MALFORMED, CAP, UNRESOLVED } = SelectionGuidanceErrorCode

/** A minimal valid entry, overridable per test. */
const entry = (over: Record<string, unknown> = {}): Record<string, unknown> => ({ intents: ['a job'], notFor: [], ...over })

/** A one-type document pinned to a catalog. */
const doc = (types: Record<string, unknown>, pin: Record<string, unknown> = { catalogId: 'x' }): Record<string, unknown> => ({ ...pin, types })

/** The `SelectionGuidanceError` code `fn` throws, or `null` when it does not throw. */
function codeOf(fn: () => unknown): string | null {
  try {
    fn()
  } catch (e) {
    if (e instanceof SelectionGuidanceError) {
      expect(e.name).toBe('SelectionGuidanceError')
      return e.code
    }
    throw e
  }
  return null
}

const load = (d: unknown) => () => loadSelectionGuidance(d)

/** A `Catalog` stand-in carrying only what the resolver and renderer read. */
const cat = (catalogId: string, components: readonly string[] = []): Catalog => ({
  catalogId,
  protocolVersion: 'v1.0',
  components: Object.fromEntries(components.map((c) => [c, { name: c, properties: {} }])),
  functions: {},
})

describe('loadSelectionGuidance: accepts', () => {
  it('a minimal catalogId-pinned and a personaId-pinned document', () => {
    expect(codeOf(load(doc({ Text: entry() })))).toBeNull()
    expect(codeOf(load(doc({ Text: entry() }, { personaId: 'p' })))).toBeNull()
  })

  it('every cap at its boundary: 3 intents of 60 chars, 4 edges with 90-char whys', () => {
    const intents = ['a'.repeat(60), 'b'.repeat(60), 'c'.repeat(60)]
    const notFor = ['A', 'B', 'C', 'D'].map((type) => ({ type, why: 'w'.repeat(90) }))
    const out = loadSelectionGuidance(doc({ Text: { intents, notFor } }))
    expect(out.Text!.intents).toEqual(intents)
    expect(out.Text!.notFor).toHaveLength(4)
  })

  it('returns the types map in document order, frozen', () => {
    const out = loadSelectionGuidance(doc({ B: entry(), A: entry() }))
    expect(Object.keys(out)).toEqual(['B', 'A'])
    expect(Object.isFrozen(out)).toBe(true)
    expect(Object.isFrozen(out.B)).toBe(true)
  })
})

describe('loadSelectionGuidance: MALFORMED shape defects', () => {
  const cases: readonly [string, unknown][] = [
    ['a non-object root', []],
    ['a null root', null],
    ['no pin key', { types: {} }],
    ['both pin keys', { catalogId: 'x', personaId: 'p', types: {} }],
    ['an extra root key', { catalogId: 'x', types: {}, extra: 1 }],
    ['an empty pin', { catalogId: '', types: {} }],
    ['a non-string pin', { catalogId: 7, types: {} }],
    ['a missing types object', { catalogId: 'x' }],
    ['a non-object types', { catalogId: 'x', types: [] }],
    ['a non-object entry', doc({ Text: 'use it' })],
    ['an entry missing notFor', doc({ Text: { intents: ['a job'] } })],
    ['an entry with an extra key', doc({ Text: entry({ confusableWith: [] }) })],
    ['a non-array intents', doc({ Text: entry({ intents: 'a job' }) })],
    ['a non-string intent', doc({ Text: entry({ intents: [7] }) })],
    ['a non-array notFor', doc({ Text: entry({ notFor: {} }) })],
    ['an edge that is not an object', doc({ Text: entry({ notFor: ['Code'] }) })],
    ['an edge with an extra key', doc({ Text: entry({ notFor: [{ type: 'Code', why: 'w', note: 'n' }] }) })],
    ['an edge with an empty target', doc({ Text: entry({ notFor: [{ type: '', why: 'w' }] }) })],
    ['an edge with a non-string why', doc({ Text: entry({ notFor: [{ type: 'Code', why: 1 }] }) })],
  ]
  for (const [name, d] of cases) {
    it(name, () => expect(codeOf(load(d))).toBe(MALFORMED))
  }
})

describe('loadSelectionGuidance: MALFORMED content rules', () => {
  const edge = (type: string, why: string) => entry({ notFor: [{ type, why }] })
  const cases: readonly [string, Record<string, unknown>][] = [
    ['a duplicate target', doc({ Text: entry({ notFor: [{ type: 'Code', why: 'one' }, { type: 'Code', why: 'two' }] }) })],
    ['a self edge', doc({ Text: edge('Text', 'prose again') })],
    ['an intent restating the type name', doc({ TextField: entry({ intents: ['a job', 'Text-field!'] }) })],
    ['a why restating the target name', doc({ Text: edge('TextField', 'text field') })],
    ['a middle dot in an intent', doc({ Text: entry({ intents: ['a · b'] }) })],
    ['a middle dot in a why', doc({ Text: edge('Code', 'a · b') })],
    ['a semicolon in an intent', doc({ Text: entry({ intents: ['a; b'] }) })],
    ['an open parenthesis in a why', doc({ Text: edge('Code', 'verbatim (raw)') })],
    ['a close parenthesis in a why', doc({ Text: edge('Code', 'verbatim raw)') })],
    ['an em dash in an intent', doc({ Text: entry({ intents: ['a \u2014 b'] }) })],
    ['an em dash in a why', doc({ Text: edge('Code', 'a \u2014 b') })],
    ['an em dash in a type name', doc({ 'Te\u2014xt': entry() })],
  ]
  for (const [name, d] of cases) {
    it(name, () => expect(codeOf(load(d))).toBe(MALFORMED))
  }
})

describe('loadSelectionGuidance: CAP count and length breaches', () => {
  const edges = (n: number) => Array.from({ length: n }, (_, i) => ({ type: `T${i}`, why: 'w' }))
  const cases: readonly [string, Record<string, unknown>][] = [
    ['zero intents', doc({ Text: entry({ intents: [] }) })],
    ['four intents', doc({ Text: entry({ intents: ['a', 'b', 'c', 'd'] }) })],
    ['an empty intent', doc({ Text: entry({ intents: [''] }) })],
    ['a 61-char intent', doc({ Text: entry({ intents: ['a'.repeat(61)] }) })],
    ['five notFor edges', doc({ Text: entry({ notFor: edges(5) }) })],
    ['an empty why', doc({ Text: entry({ notFor: [{ type: 'Code', why: '' }] }) })],
    ['a 91-char why', doc({ Text: entry({ notFor: [{ type: 'Code', why: 'w'.repeat(91) }] }) })],
  ]
  for (const [name, d] of cases) {
    it(name, () => expect(codeOf(load(d))).toBe(CAP))
  }
})

describe('selectionGuidanceFor: keyed on catalogId only', () => {
  const defaultKeys = Object.keys(selectionGuidanceFor(cat('agent-ui')))
  const basicKeys = Object.keys(selectionGuidanceFor(cat('a2ui-basic')))

  it('agent-ui and a2ui-basic resolve to their own sidecars', () => {
    expect(defaultKeys).toContain('Badge')
    expect(defaultKeys).not.toContain('CheckBox')
    expect(basicKeys).toContain('CheckBox')
    expect(basicKeys).not.toContain('Badge')
  })

  it('a derived <base>--<persona> id is the base entries plus the persona entries', () => {
    const croupier = selectionGuidanceFor(cat('agent-ui--croupier'))
    expect(Object.keys(croupier)).toEqual([...defaultKeys, 'PlayingCard'])
    const concierge = selectionGuidanceFor(cat('a2ui-basic--concierge'))
    expect(Object.keys(concierge)).toEqual([...basicKeys, 'BookingForm', 'BookingConfirmation'])
  })

  it('an unknown persona half returns the base only', () => {
    expect(Object.keys(selectionGuidanceFor(cat('agent-ui--nobody')))).toEqual(defaultKeys)
  })

  it('an unknown base half, an unknown id, the canonical-URI alias, and prototype keys return {}', () => {
    for (const id of ['nope--croupier', 'nope', A2UI_BASIC_CANONICAL_URI, 'constructor', 'constructor--croupier', '']) {
      expect(Object.keys(selectionGuidanceFor(cat(id))), id).toEqual([])
    }
  })
})

describe('renderSelectionClause', () => {
  const catalog = cat('agent-ui', ['Text', 'Code'])

  it('renders intents joined by "; " then notFor items as "Type (why)" joined by ", "', () => {
    const clause = renderSelectionClause(
      { intents: ['a', 'b'], notFor: [{ type: 'Text', why: 'w' }, { type: 'Code', why: 'v' }] },
      catalog,
    )
    expect(clause).toBe(' · use: a; b · not for: Text (w), Code (v)')
  })

  it('renders a bare use clause when notFor is empty', () => {
    expect(renderSelectionClause({ intents: ['a'], notFor: [] }, catalog)).toBe(' · use: a')
  })

  it('throws UNRESOLVED on a target the catalog does not declare', () => {
    expect(codeOf(() => renderSelectionClause({ intents: ['a'], notFor: [{ type: 'Ghost', why: 'w' }] }, catalog))).toBe(UNRESOLVED)
  })

  it('renders "" for a missing entry and never throws (coverage belongs to the gate)', () => {
    expect(renderSelectionClause(undefined, catalog)).toBe('')
  })

  it('exports a positive char budget', () => {
    expect(SELECTION_GUIDANCE_CHAR_BUDGET).toBeGreaterThan(0)
  })
})
