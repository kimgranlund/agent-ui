// seed-catalogs.fixture.ts: the module-side `{catalogId -> Catalog}` registry the shard gates check each record
// against (`corpus-data.test.ts`, `multi-turn-shard.test.ts`, `repair-shard.test.ts`). The two bases are the
// module catalogs; each persona shard id (T-0240) is its fragment composed over its base by the same
// `composePersonaCatalogDocs` the server hosts call (a domain shard id, T-0197, by `composeDomainCatalogDocs`), so a persona record is held to the catalog a live persona turn
// validates against. Keyed `Record<SeedCatalogId, Catalog>`: widening `SeedCatalogId` reds the compile until the id
// is registered here. Test support only: never re-exported from the corpus barrel, never read by shipped code.

import { defaultCatalog } from '../catalog/default/index.ts'
import { a2uiBasicCatalog } from '../catalog/a2ui-basic/index.ts'
import { composeDomainCatalogDocs, composePersonaCatalogDocs } from '../catalog/compose.ts'
import { SHIPPED_PERSONA_CATALOG_MANIFESTS } from '../catalog/personas/manifests.ts'
import { SHIPPED_DOMAIN_CATALOG_MANIFESTS } from '../catalog/domains/manifests.ts'
import type { Catalog } from '../catalog/catalog.ts'
import type { SeedCatalogId } from '../examples/types.ts'

const BASES = new Map<string, Catalog>([
  ['agent-ui', defaultCatalog],
  ['a2ui-basic', a2uiBasicCatalog],
])
const PERSONA_DOCS = new Map<string, Catalog>([
  ...composePersonaCatalogDocs(BASES, SHIPPED_PERSONA_CATALOG_MANIFESTS),
  ...composeDomainCatalogDocs(BASES, SHIPPED_DOMAIN_CATALOG_MANIFESTS), // T-0197: the hospitality domain shard
])

function personaDoc(id: string): Catalog {
  const doc = PERSONA_DOCS.get(id)
  if (doc === undefined) throw new Error(`seed-catalogs.fixture: no shipped persona or domain composes "${id}"`)
  return doc
}

/** Every catalog a committed shard may be stamped with, keyed by `meta.catalogId` (= the shard stem). */
export const SEED_CATALOGS: Readonly<Record<SeedCatalogId, Catalog>> = {
  'agent-ui': defaultCatalog,
  'a2ui-basic': a2uiBasicCatalog,
  'agent-ui--croupier': personaDoc('agent-ui--croupier'),
  'agent-ui--hospitality': personaDoc('agent-ui--hospitality'),
}
