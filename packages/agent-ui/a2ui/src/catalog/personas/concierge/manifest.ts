// manifest.ts — the `concierge` persona's Node/Workers-safe manifest (GH #516, `PersonaCatalogManifest`):
// `personaId`/`fragment`/`targetCatalogs` ONLY, split out of `index.ts` so a DOM-less server host
// (`dev-proxy-plugin.ts`/`worker/index.ts`) can import this file directly without transitively pulling
// in `factories.ts`'s `@agent-ui/components` self-define (a hard crash outside a real DOM — see
// `catalog/compose.ts`'s `PersonaCatalogManifest` header). `index.ts` re-composes this manifest PLUS
// `factories.ts` into the full `PersonaCatalogPackage` for the browser-side `Renderer`, unchanged.

import { loadCatalogFragment } from '../../compose.ts'
import type { CatalogFragment, PersonaCatalogManifest } from '../../compose.ts'
import fragmentDoc from './catalog.json'

export const CONCIERGE_PERSONA_ID = 'concierge'

/** The loaded, structurally-validated concierge fragment (SPEC-R1 AC2). */
export const conciergeFragment: CatalogFragment = loadCatalogFragment(fragmentDoc)

/** Targets BOTH shipped bases (SPEC-N5's widening) — see `factories.ts`'s header for why this is safe. */
export const conciergeTargetCatalogs: readonly string[] = ['agent-ui', 'a2ui-basic']

/** The server-side derive input `composePersonaCatalogDocs` (GH #516) consumes directly. */
export const conciergeManifest: PersonaCatalogManifest = {
  personaId: CONCIERGE_PERSONA_ID,
  fragment: conciergeFragment,
  targetCatalogs: conciergeTargetCatalogs,
}
