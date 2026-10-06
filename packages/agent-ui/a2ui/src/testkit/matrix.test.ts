// matrix.test.ts: the catalog-generated per-type conformance matrix in jsdom (T-0011). One cell per type of
// every catalog `allCatalogs()` derives (both bases and every derived persona catalog), each cell its own
// `it`. A cell derives its minimal surface, validates it at finalize, mounts it, and requires its root, no
// placeholder, no error client message, and every custom-element-named node defined. Adding a catalog type
// adds a cell; a type that cannot be derived, validated or mounted reds. No per-type hand file.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { armOffline } from '../../tools/testkit/offline.ts'
import { allCatalogs } from '../../tools/testkit/catalogs.ts'
import { cellDefects } from '../../tools/testkit/matrix.ts'
import type { Catalog } from '../catalog/catalog.ts'
import { defaultCatalog } from '../catalog/default/index.ts'
import { defaultFactories } from '../catalog/default/factories.ts'
import type { WidgetFactory } from '../catalog/types.ts'

let disarm: () => void
beforeAll(() => {
  disarm = armOffline()
})
afterAll(() => disarm())

const catalogs = allCatalogs()
const cells = catalogs.flatMap((c) => Object.keys(c.components).map((type) => ({ catalog: c, type })))

describe('the generated per-type matrix', () => {
  it('one cell per type of every derived catalog', () => {
    expect(catalogs.length).toBeGreaterThan(2)
    expect(cells.length).toBe(catalogs.reduce((n, c) => n + Object.keys(c.components).length, 0))
  })

  for (const { catalog, type } of cells) {
    it(`${catalog.catalogId} ${type}`, async () => {
      expect(await cellDefects(catalog, type)).toEqual([])
    })
  }

  it('NEGATIVE CONTROL: a planted type whose factory tag no loader defines reds the same predicate', async () => {
    const planted: Catalog = { ...defaultCatalog, catalogId: 'kit-planted', components: { ...defaultCatalog.components, Ghost: { name: 'Ghost', properties: {} } } }
    const ghost: WidgetFactory = { tag: 'ui-kit-ghost', create: () => document.createElement('ui-kit-ghost'), applyProp: () => {} }
    const defects = await cellDefects(planted, 'Ghost', (m) => m.host.register(planted, { ...defaultFactories, Ghost: ghost }))
    expect(defects).toContain('<ui-kit-ghost> is not defined')
  })
})
