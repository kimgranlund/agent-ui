// manifest.ts: the `hospitality` domain's Node/Workers-safe manifest (`DomainCatalogManifest`, T-0197, moved from
// the concierge persona fragment): `domainId`/`fragment`/`targetCatalogs` plus the DOM-less `semanticChecks`
// (`checks.ts`, T-0265, W0 D4) ONLY, split out of `index.ts` so a DOM-less server host
// (`dev-proxy-plugin.ts`/`worker/index.ts`) can import this file directly without transitively pulling
// in `factories.ts`'s `@agent-ui/components` self-define (a hard crash outside a real DOM — see
// `catalog/compose.ts`'s `PersonaCatalogManifest` header). `index.ts` re-composes this manifest PLUS
// `factories.ts` into the full `DomainCatalogPackage` for the browser-side `Renderer`, unchanged.

import { loadCatalogFragment } from '../../compose.ts'
import type { CatalogFragment, DomainCatalogManifest } from '../../compose.ts'
import fragmentDoc from './catalog.json' with { type: 'json' }
import { hospitalitySemanticChecks } from './checks.ts'

export const HOSPITALITY_DOMAIN_ID = 'hospitality'

/** The loaded, structurally-validated hospitality fragment (SPEC-R1 AC2). */
export const hospitalityFragment: CatalogFragment = loadCatalogFragment(fragmentDoc)

/** Targets BOTH shipped bases (SPEC-N5's widening) — see `factories.ts`'s header for why this is safe. */
export const hospitalityTargetCatalogs: readonly string[] = ['agent-ui', 'a2ui-basic']

/** The server-side derive input `composeDomainCatalogDocs` consumes directly. `semanticChecks` (ADR-0238, T-0265,
 *  T-0316, W0 D4): the checks `produce()` runs on every turn whose catalog holds this domain and the types each
 *  reads. */
export const hospitalityManifest: DomainCatalogManifest = {
  domainId: HOSPITALITY_DOMAIN_ID,
  fragment: hospitalityFragment,
  targetCatalogs: hospitalityTargetCatalogs,
  semanticChecks: hospitalitySemanticChecks,
}
