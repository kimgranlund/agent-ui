import { describe, it, expect } from 'vitest'
import { loadCatalog, CatalogError, CatalogLoadCode } from './catalog.ts'
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
