// index.ts — the `fixture-demo` persona-scoped local pattern set (SPEC-R1, M-D's first build slice,
// GH #480). A FIXTURE (SPEC-N6): proves the `catalog/personas/<persona-id>/` package shape end-to-end
// (a `catalog.json`-shaped fragment + `factories.ts` + `targetCatalogs`), never real persona content —
// no concierge/croupier here; that ships as its own later slice once this mechanism lands. Mirrors
// `a2ui-basic/index.ts`'s own shape (ADR-0169 cl.1), one tier down (SPEC-R1's "third tier" AC1).
//
// `FixtureBanner` is a single, deliberately non-colliding demo component so SPEC-R2's derive-then-
// register step has a real, package-shipped (fragment, base) pairing to compose against BOTH shipped
// bases (`targetCatalogs`, SPEC-N5's widening) — proving one fragment can target more than one base at
// once, the exact shape SPEC-R3 AC3's cross-base recognition test needs a real registered pair for.

import { loadCatalogFragment } from '../../compose.ts'
import type { CatalogFragment, PersonaCatalogPackage } from '../../compose.ts'
import fragmentDoc from './catalog.json'
import { fixtureDemoFactories } from './factories.ts'

export const FIXTURE_DEMO_PERSONA_ID = 'fixture-demo'

/** The loaded, structurally-validated fixture fragment (SPEC-R1 AC2). */
export const fixtureDemoFragment: CatalogFragment = loadCatalogFragment(fragmentDoc)

/** Targets BOTH shipped bases (SPEC-N5's widening) — the fixture's own proof that a single fragment
 *  composes independently over more than one base. */
export const fixtureDemoTargetCatalogs: readonly string[] = ['agent-ui', 'a2ui-basic']

export { fixtureDemoFactories }

/** The derive-then-register input `composePersonaCatalogs` (SPEC-R2) consumes directly. */
export const fixtureDemoPersona: PersonaCatalogPackage = {
  personaId: FIXTURE_DEMO_PERSONA_ID,
  fragment: fixtureDemoFragment,
  factories: fixtureDemoFactories,
  targetCatalogs: fixtureDemoTargetCatalogs,
}
