// matrix.test.ts: the catalog-generated per-type conformance matrix in jsdom (T-0011). One cell per type of
// every catalog `allCatalogs()` derives (both bases and every derived persona catalog), each cell its own
// `it`. A cell derives its minimal surface, validates it at finalize, mounts it, and requires its root, no
// placeholder, no error client message, and every custom-element-named node defined. Adding a catalog type
// adds a cell; a type that cannot be derived, validated or mounted reds. No per-type hand file.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { armOffline } from '../../tools/testkit/offline.ts'
import { allCatalogs } from '../../tools/testkit/catalogs.ts'
import { minimalMessages, MinimalUnderivable, cellSurfaceId } from '../../tools/testkit/minimal-node.ts'
import { createKitMount, RenderError } from '../../tools/testkit/mount.ts'
import type { KitMount } from '../../tools/testkit/mount.ts'
import { validateA2ui } from '../renderer/validate.ts'
import type { Catalog } from '../catalog/catalog.ts'
import { defaultCatalog } from '../catalog/default/index.ts'
import { defaultFactories } from '../catalog/default/factories.ts'
import type { WidgetFactory } from '../catalog/types.ts'

let disarm: () => void
beforeAll(() => {
  disarm = armOffline()
})
afterAll(() => disarm())

/** The one cell predicate: every defect of one (catalog, type) cell, `[]` when the cell is green. */
export async function cellDefects(catalog: Catalog, type: string, before?: (m: KitMount) => void): Promise<string[]> {
  let messages
  try {
    messages = minimalMessages(catalog, type)
  } catch (err) {
    if (err instanceof MinimalUnderivable) return [err.message]
    throw err
  }
  const verdict = validateA2ui(messages, catalog, undefined, { atFinalize: true })
  if (!verdict.valid) return verdict.failures.map((f) => `validate: ${f.code} at ${f.path}`)
  const sid = cellSurfaceId(type)
  const m = createKitMount()
  const defects: string[] = []
  try {
    before?.(m)
    m.ingest(messages.map((msg) => JSON.stringify(msg)))
    m.finalize(sid)
    try {
      await m.settle()
    } catch (err) {
      if (!(err instanceof RenderError)) throw err
      return [err.message]
    }
    const root = m.surfaceRoot(sid)
    if (root === undefined) return ['no surface root']
    const nodes = [root, ...Array.from(root.querySelectorAll('*'))]
    if (nodes.some((n) => n.localName === 'a2ui-placeholder')) defects.push('a placeholder rendered')
    for (const n of nodes) if (n.localName.includes('-') && customElements.get(n.localName) === undefined) defects.push(`<${n.localName}> is not defined`)
    for (const c of m.clientMessages()) if ('error' in c) defects.push(`error message: ${JSON.stringify(c.error)}`)
  } finally {
    m.dispose()
  }
  return defects
}

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
