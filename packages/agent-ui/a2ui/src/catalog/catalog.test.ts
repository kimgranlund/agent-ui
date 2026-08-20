import { describe, it, expect } from 'vitest'
import { loadCatalog, CatalogError, CatalogLoadCode, describePropType, valueSlots } from './catalog.ts'
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
    'a requires entry that is not a string array',
    { catalogId: 'c', protocolVersion: 'v1.0', components: { A: { properties: { x: { type: {}, mapsTo: 'x', requires: 'label' } } } } },
    CatalogLoadCode.MALFORMED,
  )
  throws(
    'a requires array with a non-string member',
    { catalogId: 'c', protocolVersion: 'v1.0', components: { A: { properties: { x: { type: {}, mapsTo: 'x', requires: [1] } } } } },
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

// ADR-0226 cl.3 — the opt-in cross-prop `PropDef.requires` (GH #1189's `required` shape, widened to
// name sibling keys rather than just gating the declaring key's own presence).
describe('loadCatalog — PropDef.requires (ADR-0226 cl.3)', () => {
  it('a declared requires array survives loading, byte-identical', () => {
    const cat = loadCatalog({
      catalogId: 'c',
      protocolVersion: 'v1.0',
      components: {
        A: {
          properties: {
            icon: { type: { type: 'string' }, mapsTo: 'icon', requires: ['label'] },
            label: { type: { type: 'string' }, mapsTo: 'label' },
          },
        },
      },
    })
    expect(cat.components.A.properties.icon!.requires).toEqual(['label'])
  })

  it('a property that does not declare requires stays undefined (byte-identical for every non-opted-in prop)', () => {
    const cat = loadCatalog(demoCatalogDoc)
    expect(cat.components.Button.properties.label!.requires).toBeUndefined()
  })
})

// ADR-0161 — the `value` mark widens to one-or-more slots (Calendar range + SliderMulti write-back,
// GH #314). The single-object form (demoCatalogDoc's TextField, above) stays legal, byte-unchanged.
describe('loadCatalog — the value mark widens to one-or-more slots (ADR-0161)', () => {
  const withValue = (value: unknown) => ({
    catalogId: 'c',
    protocolVersion: 'v1.0',
    components: { A: { properties: { lo: { type: {}, mapsTo: 'lo' }, hi: { type: {}, mapsTo: 'hi' } }, value } },
  })

  it('accepts a non-empty array of {prop,event} slots with distinct props', () => {
    const cat = loadCatalog(withValue([{ prop: 'lo', event: 'change' }, { prop: 'hi', event: 'change' }]))
    expect(cat.components.A.value).toEqual([{ prop: 'lo', event: 'change' }, { prop: 'hi', event: 'change' }])
  })

  it('events MAY repeat across slots (a shared commit event, the Calendar range precedent)', () => {
    const cat = loadCatalog(withValue([{ prop: 'lo', event: 'change' }, { prop: 'hi', event: 'change' }]))
    const slots = cat.components.A.value!
    expect(Array.isArray(slots) && slots.every((s) => s.event === 'change')).toBe(true)
  })

  const throwsValue = (label: string, value: unknown) =>
    it(`rejects ${label}`, () => {
      try {
        loadCatalog(withValue(value))
        expect.unreachable('expected loadCatalog to throw')
      } catch (e) {
        expect(e).toBeInstanceOf(CatalogError)
        expect((e as CatalogError).code).toBe(CatalogLoadCode.MALFORMED)
      }
    })

  throwsValue('an empty array', [])
  throwsValue('an array entry missing `event`', [{ prop: 'lo' }])
  throwsValue('an array entry missing `prop`', [{ event: 'change' }])
  throwsValue('an array entry that is not an object', [{ prop: 'lo', event: 'change' }, 'nope'])
  throwsValue('duplicate slot props across the array', [{ prop: 'lo', event: 'change' }, { prop: 'lo', event: 'input' }])
})

describe('valueSlots (ADR-0161) — the shared per-slot reader', () => {
  it('normalizes the single-object form to a one-element array', () => {
    expect(valueSlots({ prop: 'value', event: 'change' })).toEqual([{ prop: 'value', event: 'change' }])
  })

  it('passes the array form through untouched', () => {
    const slots = [{ prop: 'lo', event: 'change' }, { prop: 'hi', event: 'change' }]
    expect(valueSlots(slots)).toBe(slots) // same reference — no copy needed
  })
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
