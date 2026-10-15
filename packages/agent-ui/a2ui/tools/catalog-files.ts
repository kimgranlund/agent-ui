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
// T-0240: a persona shard id (`PersonaShardCatalogId`, `<base>--<persona>`) is registered too. Its path is the
// persona's fragment (`catalog/personas/<persona>/catalog.json`, read by fs for the same reason), and
// `loadCatalogById` composes it over its base with the SAME `composeCatalog` the renderer and the server hosts
// use, so a persona seed is admitted against exactly the catalog a live persona turn validates against.
//
// Paths are repo-root-relative (the CLIs run from the repo root, `process.cwd()`), so a sandbox repo
// root (the `import-seeds.test.ts` subprocess legs) resolves them against its own tree.
//
// Zero new deps (SPEC-N5). Plain `.ts`, run via Node type-stripping (`erasableSyntaxOnly`, ADR-0062).

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadCatalog } from '../src/catalog/catalog.ts'
import type { Catalog } from '../src/catalog/catalog.ts'
import { composeCatalog, loadCatalogFragment } from '../src/catalog/compose.ts'
import { splitCatalogId } from '../src/catalog/catalog-id.ts'
import type { BaseCatalogId, SeedCatalogId } from '../src/examples/types.ts'

/** Repo-root-relative path of each loadable catalog's `catalog.json`: the document itself for a base id, the
 *  persona's fragment for a persona shard id. */
export const CATALOG_FILES: Readonly<Record<SeedCatalogId, string>> = {
  'agent-ui': 'packages/agent-ui/a2ui/src/catalog/default/catalog.json',
  'a2ui-basic': 'packages/agent-ui/a2ui/src/catalog/a2ui-basic/catalog.json',
  'agent-ui--croupier': 'packages/agent-ui/a2ui/src/catalog/personas/croupier/catalog.json',
  'agent-ui--concierge': 'packages/agent-ui/a2ui/src/catalog/personas/concierge/catalog.json',
}

/** The registered catalog ids, in registration order (for usage and error text). */
export const CATALOG_IDS: readonly SeedCatalogId[] = Object.keys(CATALOG_FILES) as SeedCatalogId[]

/** The registered BASE catalog ids (no `--` tail), in registration order: the whole documents, never a persona
 *  composition. A reader that enumerates catalogs as bases (the capability registry) iterates these. */
export const BASE_CATALOG_IDS: readonly BaseCatalogId[] = CATALOG_IDS.filter((id): id is BaseCatalogId => splitCatalogId(id).tail === undefined)

/** True iff `id` is a registered catalog id. Own-key test, so `toString` and friends never pass. */
export function isCatalogId(id: string): id is SeedCatalogId {
  return Object.prototype.hasOwnProperty.call(CATALOG_FILES, id)
}

/** Read and load one catalog from `repoRoot`. Throws if the registered file cannot be read (ONE line
 *  naming the id, the repo-relative path and the fs error code, never a raw ENOENT stack) or if the
 *  document's own `catalogId` is not the id it was registered under (a mis-mapped path must fail here,
 *  not validate a payload against the wrong catalog). A persona shard id loads its base the same way, then
 *  composes its fragment over it; the composed id must equal the registered one. */
export function loadCatalogById(repoRoot: string, id: SeedCatalogId): Catalog {
  let text: string
  try {
    text = readFileSync(join(repoRoot, CATALOG_FILES[id]), 'utf8') as string
  } catch (err) {
    const code = (err as { code?: unknown }).code
    throw new Error(`catalog-files: cannot read catalog "${id}" at ${CATALOG_FILES[id]} (${typeof code === 'string' ? code : 'read failed'})`)
  }
  const doc: unknown = JSON.parse(text)
  const { base, tail } = splitCatalogId(id)
  const catalog = tail === undefined ? loadCatalog(doc) : composeCatalog(loadCatalogById(repoRoot, base as BaseCatalogId), loadCatalogFragment(doc), tail)
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
