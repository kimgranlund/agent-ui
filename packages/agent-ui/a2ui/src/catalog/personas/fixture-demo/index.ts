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
//
// The browser-only, factory-bearing PersonaCatalogPackage (`renderer.ts`'s constructor consumes this
// directly). `manifest.ts` carries the SAME `personaId`/`fragment`/`targetCatalogs` data, factory-free
// and DOM-less, so a server host can compose derived catalog DOCUMENTS without ever importing this
// file (GH #516 — see `manifest.ts`'s own header for why that import boundary is load-bearing).

import type { PersonaCatalogPackage } from '../../compose.ts'
import { FIXTURE_DEMO_PERSONA_ID, fixtureDemoFragment, fixtureDemoTargetCatalogs } from './manifest.ts'
import { fixtureDemoFactories } from './factories.ts'

export { FIXTURE_DEMO_PERSONA_ID, fixtureDemoFragment, fixtureDemoTargetCatalogs, fixtureDemoFactories }

/** The derive-then-register input `composePersonaCatalogs` (SPEC-R2) consumes directly. */
export const fixtureDemoPersona: PersonaCatalogPackage = {
  personaId: FIXTURE_DEMO_PERSONA_ID,
  fragment: fixtureDemoFragment,
  factories: fixtureDemoFactories,
  targetCatalogs: fixtureDemoTargetCatalogs,
}
