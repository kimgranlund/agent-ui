// manifest.ts: the `quizmaster` persona's Node/Workers-safe manifest (GH #516, `PersonaCatalogManifest`).
// `personaId`/`fragment`/`targetCatalogs` only, so a DOM-less server host imports it without pulling in
// `factories.ts`. `index.ts` adds the factories for the browser-side renderer (the croupier precedent).

import { loadCatalogFragment } from '../../compose.ts'
import type { CatalogFragment, PersonaCatalogManifest } from '../../compose.ts'
import fragmentDoc from './catalog.json'

export const QUIZMASTER_PERSONA_ID = 'quizmaster'

/** The loaded, structurally-validated quizmaster fragment (SPEC-R1 AC2). */
export const quizmasterFragment: CatalogFragment = loadCatalogFragment(fragmentDoc)

/** Targets both shipped bases: the factory builds on `@agent-ui/components`, never on a base dialect. */
export const quizmasterTargetCatalogs: readonly string[] = ['agent-ui', 'a2ui-basic']

/** The server-side derive input `composePersonaCatalogDocs` (GH #516) consumes directly. */
export const quizmasterManifest: PersonaCatalogManifest = {
  personaId: QUIZMASTER_PERSONA_ID,
  fragment: quizmasterFragment,
  targetCatalogs: quizmasterTargetCatalogs,
}
