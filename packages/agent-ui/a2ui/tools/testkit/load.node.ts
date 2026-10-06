// load.node.ts: the kit's data and catalogs in plain Node (T-0011), for `kit.ts` and the Node-only tests.
//
//   - `loadKitData(kitDir)` returns the same files `load.vite.ts` does, read from disk.
//   - `verifyKitPins(kitDir)` runs the T-0005 pin rule (`tools/agent-eval/pins.ts` `verifyPins`) on every
//     `__seeded__/<layer>/` directory (regular files directly in it; Kim's 2026-10-05 ruling).
//   - `nodeCatalogResolver(cwd)` resolves a catalog id lazily: a base id through `loadCatalogById`, and
//     `<base>--<persona>` through `composeCatalog(base, loadCatalogFragment(<persona catalog.json>),
//     persona)` (the `tools/agent-eval/cases.ts` precedent). Plain Node cannot import the catalog modules
//     (`ERR_IMPORT_ATTRIBUTE_MISSING` on their JSON imports), so this resolver is the Node path; a parity
//     test (`load.test.ts`) holds it equal to the module catalogs.

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { Catalog } from '../../src/catalog/catalog.ts'
import { composeCatalog, loadCatalogFragment } from '../../src/catalog/compose.ts'
import { isCatalogId, loadCatalogById } from '../catalog-files.ts'
import { verifyPins } from '../agent-eval/pins.ts'
import type { KitFile } from './load.vite.ts'

export const KIT_REL = 'packages/agent-ui/a2ui/tools/testkit'
const PERSONAS_REL = 'packages/agent-ui/a2ui/src/catalog/personas'

function jsonFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.json') && !e.name.startsWith('.'))
    .map((e) => e.name)
    .sort()
}

export function seededLayerDirs(kitDir: string): string[] {
  const root = join(kitDir, '__seeded__')
  if (!existsSync(root)) return []
  return readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()
}

export function loadKitData(kitDir: string): { scenarios: KitFile[]; seeded: KitFile[] } {
  const scenarios = jsonFiles(join(kitDir, 'scenarios'))
    .filter((n) => n.endsWith('.scenario.json'))
    .map((n) => ({ name: `scenarios/${n}`, raw: readFileSync(join(kitDir, 'scenarios', n), 'utf8') }))
  const seeded = seededLayerDirs(kitDir).flatMap((layer) =>
    jsonFiles(join(kitDir, '__seeded__', layer))
      .filter((n) => n !== 'pins.json')
      .map((n) => ({ name: `__seeded__/${layer}/${n}`, layer, raw: readFileSync(join(kitDir, '__seeded__', layer, n), 'utf8') })),
  )
  return { scenarios, seeded }
}

/** Every pin problem across the seeded layer dirs, each prefixed with its dir. Empty means clean. */
export function verifyKitPins(kitDir: string): string[] {
  const problems: string[] = []
  const dirs = seededLayerDirs(kitDir)
  if (dirs.length === 0) problems.push('__seeded__: no layer directories')
  for (const layer of dirs) {
    const check = verifyPins(join(kitDir, '__seeded__', layer))
    for (const p of check.problems) problems.push(`__seeded__/${layer}/${p}`)
  }
  return problems
}

export function nodeCatalogResolver(cwd: string): (catalogId: string) => Catalog | undefined {
  const cache = new Map<string, Catalog | undefined>()
  const resolve = (id: string): Catalog | undefined => {
    if (cache.has(id)) return cache.get(id)
    let catalog: Catalog | undefined
    if (isCatalogId(id)) catalog = loadCatalogById(cwd, id)
    else {
      const sep = id.indexOf('--')
      if (sep > 0) {
        const base = resolve(id.slice(0, sep))
        const persona = id.slice(sep + 2)
        const file = join(cwd, PERSONAS_REL, persona, 'catalog.json')
        if (base !== undefined && existsSync(file)) {
          catalog = composeCatalog(base, loadCatalogFragment(JSON.parse(readFileSync(file, 'utf8'))), persona)
        }
      }
    }
    cache.set(id, catalog)
    return catalog
  }
  return resolve
}
