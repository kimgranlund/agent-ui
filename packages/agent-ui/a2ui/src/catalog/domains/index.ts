// domains/index.ts: the enumerated shipped domain catalogs (T-0202, catalog architecture SPEC CA-R2). A static,
// explicit list like `personas/index.ts`: each `domains/<domain>/` folder has the persona fragment's shape
// (`catalog.json`, `factories.ts`, `index.ts`, server-safe `manifest.ts`, `selection.json`) and its package joins
// this list and `manifests.ts`. The mechanism shipped first in W0; hospitality (T-0197, BookingForm and
// BookingConfirmation, moved from the concierge persona) is the first domain, games and design follow in W1 and
// commerce in W2.

import type { DomainCatalogPackage } from '../compose.ts'
import { hospitalityDomain } from './hospitality/index.ts'

export const SHIPPED_DOMAIN_CATALOGS: readonly DomainCatalogPackage[] = [hospitalityDomain]
