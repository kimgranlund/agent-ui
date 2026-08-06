// personas/index.ts — the enumerated set of shipped persona-scoped local pattern sets (SPEC-R1/R2).
// A static, explicit list (the `default`/`a2ui-basic` precedent — `renderer.ts` imports each catalog
// by name, never a filesystem glob) so the set stays browser-safe and zero-dep (SPEC-N5/`agent-ui`
// zero-dep law): `renderer.ts`'s constructor composes+registers every entry here against every base its
// own `targetCatalogs` names (SPEC-R2). One entry this slice — `fixture-demo` (SPEC-N6: mechanism only,
// no real concierge/croupier content yet).

import { fixtureDemoPersona } from './fixture-demo/index.ts'
import type { PersonaCatalogPackage } from '../compose.ts'

export const SHIPPED_PERSONA_CATALOGS: readonly PersonaCatalogPackage[] = [fixtureDemoPersona]
