// domains/index.ts: the enumerated shipped domain catalogs (T-0202, catalog architecture SPEC CA-R2). A static,
// explicit list like `personas/index.ts`: each `domains/<domain>/` folder has the persona fragment's shape
// (`catalog.json`, `factories.ts`, `index.ts`, server-safe `manifest.ts`, `selection.json`) and its package joins
// this list and `manifests.ts`. Empty in W0: the mechanism ships first, the games, hospitality and design domains
// arrive in W1 and commerce in W2.

import type { DomainCatalogPackage } from '../compose.ts'

export const SHIPPED_DOMAIN_CATALOGS: readonly DomainCatalogPackage[] = []
