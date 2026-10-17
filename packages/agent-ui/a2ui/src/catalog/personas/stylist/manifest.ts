// manifest.ts: the `stylist` persona's Node/Workers-safe manifest (GH #516, `PersonaCatalogManifest`).
// `personaId`/`fragment`/`targetCatalogs` only, so a DOM-less server host imports it without pulling in
// `factories.ts`. `index.ts` adds the factories for the browser-side renderer (the quizmaster precedent).

import { loadCatalogFragment } from '../../compose.ts'
import type { CatalogFragment, PersonaCatalogManifest } from '../../compose.ts'
import fragmentDoc from './catalog.json' with { type: 'json' }

export const STYLIST_PERSONA_ID = 'stylist'

/** The loaded, structurally-validated stylist fragment (SPEC-R1 AC2). */
export const stylistFragment: CatalogFragment = loadCatalogFragment(fragmentDoc)

/** Targets `agent-ui` alone: the sidecar's Swatch edge and the Stylist's Swatch, Ramp and Ladder idioms are
 *  default-catalog types that `a2ui-basic` does not carry. */
export const stylistTargetCatalogs: readonly string[] = ['agent-ui']

/** The server-side derive input `composePersonaCatalogDocs` (GH #516) consumes directly. */
export const stylistManifest: PersonaCatalogManifest = {
  personaId: STYLIST_PERSONA_ID,
  fragment: stylistFragment,
  targetCatalogs: stylistTargetCatalogs,
}
