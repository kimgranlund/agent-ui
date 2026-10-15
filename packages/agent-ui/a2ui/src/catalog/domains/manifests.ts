// domains/manifests.ts: the Node/Workers-safe twin of `index.ts` (the `personas/manifests.ts` precedent): only
// each domain's `manifest.ts`, never its factories, so both server hosts may import it. Held equal to
// `SHIPPED_DOMAIN_CATALOGS` by `records.test.ts`.

import type { DomainCatalogManifest } from '../compose.ts'

export const SHIPPED_DOMAIN_CATALOG_MANIFESTS: readonly DomainCatalogManifest[] = []
