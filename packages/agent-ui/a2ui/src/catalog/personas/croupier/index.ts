// index.ts: the `croupier` persona-scoped local pattern set (SPEC-R1, GH #497; ADR-0243). Two catalog types:
// `PlayingCard`, the one card idiom promoted to an enum-constrained row, and `CardTable`, the composite table
// over it (both hands, the totals, the bankroll and bet readout, the producer's action Buttons as children;
// see `factories.ts`'s header). The table-frame and game-HUD idioms stay prose in their mini-skills.
//
// `targetCatalogs`: both shipped bases, see `factories.ts`'s header (no dialect-fit question; neither
// factory routes through either base's own dialect).
//
// The browser-only, factory-bearing PersonaCatalogPackage (`renderer.ts`'s constructor consumes this
// directly). `manifest.ts` carries the SAME `personaId`/`fragment`/`targetCatalogs` data, factory-free
// and DOM-less, so a server host can compose derived catalog DOCUMENTS without ever importing this
// file (GH #516 — see `manifest.ts`'s own header for why that import boundary is load-bearing).
//
// `controls` (ADR-0233): the in-repo demonstration of the persona seam. `ui-playing-card` is a fleet
// control, so the base loader could serve it too; declaring its record here routes the tag through the
// persona's own loader, the path a persona whose control lives outside `@agent-ui/components` takes.

import type { PersonaCatalogPackage } from '../../compose.ts'
import { CROUPIER_PERSONA_ID, croupierFragment, croupierTargetCatalogs } from './manifest.ts'
import { croupierFactories } from './factories.ts'
import { CONTROLS } from '@agent-ui/components/registry'

export { CROUPIER_PERSONA_ID, croupierFragment, croupierTargetCatalogs, croupierFactories }

/** The derive-then-register input `composePersonaCatalogs` (SPEC-R2) consumes directly. */
export const croupierPersona: PersonaCatalogPackage = {
  personaId: CROUPIER_PERSONA_ID,
  fragment: croupierFragment,
  factories: croupierFactories,
  targetCatalogs: croupierTargetCatalogs,
  controls: [CONTROLS['ui-playing-card']!],
}
