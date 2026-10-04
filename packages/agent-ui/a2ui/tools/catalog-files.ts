// catalog-files.ts: the Node-side `{catalogId -> catalog.json path}` registry (GH #1737, ADR-0169
// follow-up), the ONE place the corpus/harness CLIs learn which catalogs they can load.
//
// Why fs and not an import: `catalog/default/index.ts` and `catalog/a2ui-basic/index.ts` each do a bare
// `import catalogDoc from './catalog.json'`, which the bundler and Vitest resolve but Node's native ESM
// loader rejects outright (`ERR_IMPORT_ATTRIBUTE_MISSING`, hit running a CLI under
// `--experimental-strip-types`). Node-side tools therefore read `catalog.json` via `fs` and feed it
// through the SAME exported `loadCatalog()`, byte-identical to the module catalogs (precedent:
// `tools/conformance/generate-suites.ts`'s `CATALOG_SCHEMA_PATHS`, `tools/conformance/run.ts`'s
// `readCatalog`). `validate-payload.ts` (`--catalog <id>`) and `import-seeds.ts` (per-seed catalog,
// keyed on `seed.catalogId`) both resolve through here, so the two never disagree about the id set.
//
// The map is keyed `Record<SeedCatalogId, string>`: widening the seed catalog union without registering
// its file here is a compile error, not a runtime "unknown catalog" surprise.
//
// Paths are repo-root-relative (the CLIs run from the repo root, `process.cwd()`), so a sandbox repo
// root (the `import-seeds.test.ts` subprocess legs) resolves them against its own tree.
//
// Zero new deps (SPEC-N5). Plain `.ts`, run via Node type-stripping (`erasableSyntaxOnly`, ADR-0062).

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadCatalog } from '../src/catalog/catalog.ts'
import type { Catalog } from '../src/catalog/catalog.ts'
import type { SeedCatalogId } from '../src/examples/types.ts'

/** Repo-root-relative path of each loadable catalog's `catalog.json`. */
export const CATALOG_FILES: Readonly<Record<SeedCatalogId, string>> = {
  'agent-ui': 'packages/agent-ui/a2ui/src/catalog/default/catalog.json',
  'a2ui-basic': 'packages/agent-ui/a2ui/src/catalog/a2ui-basic/catalog.json',
}

/** The registered catalog ids, in registration order (for usage and error text). */
export const CATALOG_IDS: readonly SeedCatalogId[] = Object.keys(CATALOG_FILES) as SeedCatalogId[]

/** True iff `id` is a registered catalog id. Own-key test, so `toString` and friends never pass. */
export function isCatalogId(id: string): id is SeedCatalogId {
  return Object.prototype.hasOwnProperty.call(CATALOG_FILES, id)
}

/** Read and load one catalog from `repoRoot`. Throws if the document's own `catalogId` is not the id it
 *  was registered under (a mis-mapped path must fail here, not validate a payload against the wrong
 *  catalog). */
export function loadCatalogById(repoRoot: string, id: SeedCatalogId): Catalog {
  const doc: unknown = JSON.parse(readFileSync(join(repoRoot, CATALOG_FILES[id]), 'utf8') as string)
  const catalog = loadCatalog(doc)
  if (catalog.catalogId !== id) {
    throw new Error(`catalog-files: ${CATALOG_FILES[id]} declares catalogId "${catalog.catalogId}", but it is registered as "${id}"`)
  }
  return catalog
}

/** A LAZY, memoized per-id resolver: a catalog file is read the first time a caller asks for its id and
 *  never otherwise. Laziness is load-bearing, not an optimization: `import-seeds.ts` resolves by
 *  `seed.catalogId`, so a run whose shelf holds no Basic seed must not need `a2ui-basic/catalog.json` at
 *  all (the `import-seeds.test.ts` sandbox copies only the default catalog). */
export function createCatalogResolver(repoRoot: string): (id: SeedCatalogId) => Catalog {
  const cache = new Map<SeedCatalogId, Catalog>()
  return (id) => {
    let catalog = cache.get(id)
    if (catalog === undefined) {
      catalog = loadCatalogById(repoRoot, id)
      cache.set(id, catalog)
    }
    return catalog
  }
}
