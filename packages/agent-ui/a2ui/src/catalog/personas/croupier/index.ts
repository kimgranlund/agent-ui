// index.ts — the `croupier` persona-scoped local pattern set (SPEC-R1, GH #497). Promotes the ONE
// croupier idiom the decomp note's promotion table rules a real validation-enforceability win —
// `card rendering` — into one catalog type, `PlayingCard` (see `factories.ts`'s header). The table-frame
// arrangement and the game-HUD idiom stay prose, untouched, per the note's own ruling — nothing else
// ships here, and `game-table-chrome.md`/`game-hud.md` are NOT touched by this build.
//
// `targetCatalogs`: BOTH shipped bases — see `factories.ts`'s header (no dialect-fit question; this
// factory never routes through either base's own dialect).
//
// The browser-only, factory-bearing PersonaCatalogPackage (`renderer.ts`'s constructor consumes this
// directly). `manifest.ts` carries the SAME `personaId`/`fragment`/`targetCatalogs` data, factory-free
// and DOM-less, so a server host can compose derived catalog DOCUMENTS without ever importing this
// file (GH #516 — see `manifest.ts`'s own header for why that import boundary is load-bearing).

import type { PersonaCatalogPackage } from '../../compose.ts'
import { CROUPIER_PERSONA_ID, croupierFragment, croupierTargetCatalogs } from './manifest.ts'
import { croupierFactories } from './factories.ts'

export { CROUPIER_PERSONA_ID, croupierFragment, croupierTargetCatalogs, croupierFactories }

/** The derive-then-register input `composePersonaCatalogs` (SPEC-R2) consumes directly. */
export const croupierPersona: PersonaCatalogPackage = {
  personaId: CROUPIER_PERSONA_ID,
  fragment: croupierFragment,
  factories: croupierFactories,
  targetCatalogs: croupierTargetCatalogs,
}
