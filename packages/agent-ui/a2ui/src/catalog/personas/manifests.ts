// manifests.ts — the enumerated set of shipped persona-scoped local pattern sets' Node/Workers-SAFE
// manifests (GH #516). The DOM-less twin of `index.ts`'s `SHIPPED_PERSONA_CATALOGS`: imports ONLY each
// persona's `manifest.ts` (never its `index.ts`/`factories.ts`), so this module carries zero
// `@agent-ui/components` bytes and is safe to import from a server host (`dev-proxy-plugin.ts`'s Node
// process, `worker/index.ts`'s Workers runtime) — see `compose.ts`'s `PersonaCatalogManifest` header
// for why that import boundary is load-bearing. A static, explicit list (the `index.ts` precedent) so
// the set stays browser-safe-AND-server-safe without a filesystem glob.

import { fixtureDemoManifest } from './fixture-demo/manifest.ts'
import { conciergeManifest } from './concierge/manifest.ts'
import { croupierManifest } from './croupier/manifest.ts'
import type { PersonaCatalogManifest } from '../compose.ts'

export const SHIPPED_PERSONA_CATALOG_MANIFESTS: readonly PersonaCatalogManifest[] = [fixtureDemoManifest, conciergeManifest, croupierManifest]
