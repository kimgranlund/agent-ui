// index.ts — the `croupier` persona-scoped local pattern set (SPEC-R1, GH #497). Promotes the ONE
// croupier idiom the decomp note's promotion table rules a real validation-enforceability win —
// `card rendering` — into one catalog type, `PlayingCard` (see `factories.ts`'s header). The table-frame
// arrangement and the game-HUD idiom stay prose, untouched, per the note's own ruling — nothing else
// ships here, and `game-table-chrome.md`/`game-hud.md` are NOT touched by this build.
//
// `targetCatalogs`: BOTH shipped bases — see `factories.ts`'s header (no dialect-fit question; this
// factory never routes through either base's own dialect).

import { loadCatalogFragment } from '../../compose.ts'
import type { CatalogFragment, PersonaCatalogPackage } from '../../compose.ts'
import fragmentDoc from './catalog.json'
import { croupierFactories } from './factories.ts'

export const CROUPIER_PERSONA_ID = 'croupier'

/** The loaded, structurally-validated croupier fragment (SPEC-R1 AC2). */
export const croupierFragment: CatalogFragment = loadCatalogFragment(fragmentDoc)

/** Targets BOTH shipped bases (SPEC-N5's widening) — see the module header. */
export const croupierTargetCatalogs: readonly string[] = ['agent-ui', 'a2ui-basic']

export { croupierFactories }

/** The derive-then-register input `composePersonaCatalogs` (SPEC-R2) consumes directly. */
export const croupierPersona: PersonaCatalogPackage = {
  personaId: CROUPIER_PERSONA_ID,
  fragment: croupierFragment,
  factories: croupierFactories,
  targetCatalogs: croupierTargetCatalogs,
}
