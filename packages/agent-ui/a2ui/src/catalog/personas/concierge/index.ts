// index.ts — the `concierge` persona-scoped local pattern set (SPEC-R1, GH #497). Promotes the ONE
// concierge idiom the decomp note's promotion table rules a real validation-enforceability win —
// `booking-flow` — into two catalog types, `BookingForm`/`BookingConfirmation` (the note's own §1
// argument: required-gating and confirmation-value-drift both close BY CONSTRUCTION, not by better
// prose; see `factories.ts`'s header for the full binding-mechanism resolution). Every OTHER concierge
// idiom in the note's table (gallery-swiper, itinerary-timeline, menu-card, facility-info) stays prose,
// untouched, per the note's own ruling — nothing else ships here.
//
// `targetCatalogs` resolution (the note's §2.2 second open flag, resolved at build): BOTH shipped bases.
// Verified, not assumed — both composite factories build DIRECTLY against `@agent-ui/components` DOM
// controls (`ui-form-provider`/`ui-calendar`/`ui-select`/`ui-checkbox`/`ui-card`/`ui-text`), never
// through either base's OWN catalog dialect (`a2ui-basic`'s narrower `ChoicePicker`/boolean-`CheckBox`
// rows are never referenced) — so there is no dialect-fit question to begin with, only the ORDINARY
// reject-loud name-collision check (SPEC-R2), which trivially passes (`BookingForm`/`BookingConfirmation`
// are new names on both bases). `renderer-persona-catalogs.test.ts` proves this with a real fixture.
//
// The browser-only, factory-bearing PersonaCatalogPackage (`renderer.ts`'s constructor consumes this
// directly). `manifest.ts` carries the SAME `personaId`/`fragment`/`targetCatalogs` data, factory-free
// and DOM-less, so a server host can compose derived catalog DOCUMENTS without ever importing this
// file (GH #516 — see `manifest.ts`'s own header for why that import boundary is load-bearing).

import type { PersonaCatalogPackage } from '../../compose.ts'
import { CONCIERGE_PERSONA_ID, conciergeFragment, conciergeTargetCatalogs } from './manifest.ts'
import { conciergeFactories } from './factories.ts'

export { CONCIERGE_PERSONA_ID, conciergeFragment, conciergeTargetCatalogs, conciergeFactories }

/** The derive-then-register input `composePersonaCatalogs` (SPEC-R2) consumes directly. */
export const conciergePersona: PersonaCatalogPackage = {
  personaId: CONCIERGE_PERSONA_ID,
  fragment: conciergeFragment,
  factories: conciergeFactories,
  targetCatalogs: conciergeTargetCatalogs,
}
