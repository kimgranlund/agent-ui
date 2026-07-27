import { describe, it, expect } from 'vitest'
import { loadCatalog, CatalogError, CatalogLoadCode, describePropType } from './catalog.ts'
import type { PropDef } from './catalog.ts'
import { demoCatalogDoc } from '../fixtures.ts'

describe('loadCatalog — structural validation (catalog LLD-C1, SPEC-R1/R4)', () => {
  it('loads a valid document and exposes the typed model', () => {
    const cat = loadCatalog(demoCatalogDoc)
    expect(cat.catalogId).toBe('demo')
    expect(cat.protocolVersion).toBe('v1.0')
    expect(Object.keys(cat.components)).toContain('TextField')
    // name defaults to the declaring key
    expect(cat.components.TextField.name).toBe('TextField')
    // child models and input value contract are preserved
    expect(cat.components.Column.children).toBe('children')
    expect(cat.components.Card.children).toBe('child')
    expect(cat.components.TextField.value).toEqual({ prop: 'value', event: 'input' })
    // bindable flag survives
    expect(cat.components.Text.properties.text.bindable).toBe(true)
  })

  it('accepts a JSON string and parses it', () => {
    const cat = loadCatalog(JSON.stringify(demoCatalogDoc))
    expect(cat.catalogId).toBe('demo')
  })

  it('defaults missing functions to {}', () => {
    const cat = loadCatalog({
      catalogId: 'c',
      protocolVersion: 'v1.0',
      components: { Text: { properties: {} } },
    })
    expect(cat.functions).toEqual({})
  })

  const throws = (label: string, doc: unknown, code: CatalogLoadCode) =>
    it(`rejects ${label}`, () => {
      try {
        loadCatalog(doc)
        expect.unreachable('expected loadCatalog to throw')
      } catch (e) {
        expect(e).toBeInstanceOf(CatalogError)
        expect((e as CatalogError).code).toBe(code)
      }
    })

  throws('a non-object root', 42, CatalogLoadCode.MALFORMED)
  throws('unparseable JSON', '{ not json', CatalogLoadCode.MALFORMED)
  throws('a missing catalogId', { protocolVersion: 'v1.0', components: { A: { properties: {} } } }, CatalogLoadCode.MALFORMED)
  throws('a missing protocolVersion', { catalogId: 'c', components: { A: { properties: {} } } }, CatalogLoadCode.MALFORMED)
  throws('zero components', { catalogId: 'c', protocolVersion: 'v1.0', components: {} }, CatalogLoadCode.MALFORMED)
  throws(
    'an invalid child model',
    { catalogId: 'c', protocolVersion: 'v1.0', components: { A: { properties: {}, children: 'kids' } } },
    CatalogLoadCode.MALFORMED,
  )
  throws(
    'a property without mapsTo',
    { catalogId: 'c', protocolVersion: 'v1.0', components: { A: { properties: { x: { type: { type: 'string' } } } } } },
    CatalogLoadCode.MALFORMED,
  )

  throws(
    'a reserved @ component name',
    { catalogId: 'c', protocolVersion: 'v1.0', components: { '@index': { properties: {} } } },
    CatalogLoadCode.NAME_INVALID,
  )
  throws(
    'a non-UAX-31 property name',
    { catalogId: 'c', protocolVersion: 'v1.0', components: { A: { properties: { 'bad-prop': { type: {}, mapsTo: 'x' } } } } },
    CatalogLoadCode.NAME_INVALID,
  )
  throws(
    'a non-UAX-31 function name',
    {
      catalogId: 'c',
      protocolVersion: 'v1.0',
      components: { A: { properties: {} } },
      functions: { 'has space': { args: [], returns: {} } },
    },
    CatalogLoadCode.NAME_INVALID,
  )
})

// GH #288 (root-caused by #286) — describePropType is the single source both the system prompt's
// catalog inventory (system-prompt.ts's catalogInventory) and produce.ts's self-correct feedback
// (expectedTypeNote) render from; every type-shape a shipped catalog row can declare gets its own case.
describe('describePropType (GH #288) — the compact model-facing type/enum description', () => {
  const pd = (type: PropDef['type']): PropDef => ({ type, mapsTo: 'x' })

  it('an enum schema renders its members |-joined, in declared order', () => {
    expect(describePropType(pd({ type: 'string', enum: ['h1', 'h2', 'caption', 'body'] }))).toBe('h1|h2|caption|body')
  })

  it('a boolean schema renders "boolean"', () => {
    expect(describePropType(pd({ type: 'boolean' }))).toBe('boolean')
  })

  it('a string schema renders "string"', () => {
    expect(describePropType(pd({ type: 'string' }))).toBe('string')
  })

  it('a number schema renders "number"', () => {
    expect(describePropType(pd({ type: 'number' }))).toBe('number')
  })

  it('an array-of-types schema |-joins the members', () => {
    expect(describePropType(pd({ type: ['string', 'number'] }))).toBe('string|number')
  })

  it('an unconstrained schema (no `type` keyword) renders "any"', () => {
    expect(describePropType(pd({}))).toBe('any')
  })

  it('a bare `true` boolean JSON-Schema renders "any" (accepts everything)', () => {
    expect(describePropType(pd(true))).toBe('any')
  })

  it('a bare `false` boolean JSON-Schema renders "never" (accepts nothing)', () => {
    expect(describePropType(pd(false))).toBe('never')
  })

  it('enum takes priority over `type` when both are present', () => {
    expect(describePropType(pd({ type: 'string', enum: ['single', 'range'] }))).toBe('single|range')
  })

  // GH #286/#288 follow-up (2): a numeric-spelled string enum (Card.elevation) rendered unquoted
  // (`-3|-2|-1|0|1|2|3`) is indistinguishable from an actual number, so the model kept guessing the
  // bare number instead of the required string literal.
  it('numeric-spelled enum members are individually quoted to disambiguate from a number type', () => {
    expect(describePropType(pd({ type: 'string', enum: ['-3', '-2', '-1', '0', '1', '2', '3'] }))).toBe(
      '"-3"|"-2"|"-1"|"0"|"1"|"2"|"3"',
    )
  })

  it('non-numeric-spelled enum members stay unquoted (h1|h2|body, unchanged)', () => {
    expect(describePropType(pd({ type: 'string', enum: ['h1', 'h2', 'body'] }))).toBe('h1|h2|body')
  })
})
