// catalogs.ts: every catalog the kit's generated matrix covers (T-0011), derived, never listed: the two
// bases plus every derived `<base>--<persona>` catalog of every shipped persona manifest. The a2ui-basic
// canonical-URI alias is excluded: it carries the same components under a second id.
//
// Imports the catalog modules (JSON imports), so it loads under Vite (jsdom legs and the browser shard)
// but not in plain Node; the Node path is `load.node.ts`'s `nodeCatalogResolver`.

import type { Catalog } from '../../src/catalog/catalog.ts'
import { defaultCatalog } from '../../src/catalog/default/index.ts'
import { a2uiBasicCatalog } from '../../src/catalog/a2ui-basic/index.ts'
import { composePersonaCatalogDocs } from '../../src/catalog/compose.ts'
import { SHIPPED_PERSONA_CATALOG_MANIFESTS } from '../../src/catalog/personas/manifests.ts'

export const BASE_CATALOGS: ReadonlyMap<string, Catalog> = new Map([
  [defaultCatalog.catalogId, defaultCatalog],
  [a2uiBasicCatalog.catalogId, a2uiBasicCatalog],
])

let memo: Catalog[] | undefined

export function allCatalogs(): Catalog[] {
  memo ??= [...BASE_CATALOGS.values(), ...composePersonaCatalogDocs(BASE_CATALOGS, SHIPPED_PERSONA_CATALOG_MANIFESTS).values()]
  return [...memo]
}

/** A resolver by id over `allCatalogs()`: the `runScenario` env's `resolveCatalog`. */
export function resolveKitCatalog(catalogId: string): Catalog | undefined {
  return allCatalogs().find((c) => c.catalogId === catalogId)
}
