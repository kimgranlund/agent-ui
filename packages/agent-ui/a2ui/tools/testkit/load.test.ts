// load.test.ts: the kit's two loaders agree (T-0011). Node environment (the `tools` project): the Vite
// loader's glob is transformed by vitest, the Node loader reads the disk. The Node catalog resolver deep-
// equals the module catalogs for every id `allCatalogs()` derives.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { armOffline } from './offline.ts'
import { kitScenarioFiles, kitSeededFiles } from './load.vite.ts'
import { KIT_REL, loadKitData, nodeCatalogResolver } from './load.node.ts'
import { allCatalogs } from './catalogs.ts'

let disarm: () => void
beforeAll(() => {
  disarm = armOffline()
})
afterAll(() => disarm())

describe('load.vite and load.node', () => {
  it('return the same names and bytes', () => {
    const node = loadKitData(`${process.cwd()}/${KIT_REL}`)
    const vite = { scenarios: kitScenarioFiles(), seeded: kitSeededFiles() }
    expect(vite.scenarios.length).toBeGreaterThan(0)
    expect(vite.seeded.length).toBeGreaterThan(0)
    expect(vite).toEqual(node)
    expect(vite.seeded.every((f) => f.name !== `__seeded__/${f.layer}/pins.json`)).toBe(true)
  })

  it('nodeCatalogResolver deep-equals the module catalog for every id allCatalogs() derives', () => {
    const resolve = nodeCatalogResolver(process.cwd())
    const catalogs = allCatalogs()
    expect(catalogs.length).toBeGreaterThan(2)
    for (const c of catalogs) expect(resolve(c.catalogId), c.catalogId).toEqual(c)
    expect(resolve('agent-ui--no-such-persona')).toBeUndefined()
  })
})
