// index.ts: the `stylist` persona-scoped local pattern set (ADR-0244 cl.3, T-0090). One composite type,
// `ContrastPair`: a text color painted on a background with its computed WCAG ratio and AA/AAA verdicts, so the
// Stylist never states a ratio the surface did not compute.
//
// The browser-only, factory-bearing PersonaCatalogPackage the renderer composes. `manifest.ts` carries the
// same data factory-free for a server host (GH #516).

import type { PersonaCatalogPackage } from '../../compose.ts'
import { STYLIST_PERSONA_ID, stylistFragment, stylistTargetCatalogs } from './manifest.ts'
import { stylistFactories } from './factories.ts'

export { STYLIST_PERSONA_ID, stylistFragment, stylistTargetCatalogs, stylistFactories }

/** The derive-then-register input `composePersonaCatalogs` (SPEC-R2) consumes directly. */
export const stylistPersona: PersonaCatalogPackage = {
  personaId: STYLIST_PERSONA_ID,
  fragment: stylistFragment,
  factories: stylistFactories,
  targetCatalogs: stylistTargetCatalogs,
}
