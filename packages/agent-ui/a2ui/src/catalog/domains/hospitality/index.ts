// index.ts — the `hospitality` domain (T-0197; first shipped as the concierge persona fragment, SPEC-R1, GH #497). Promotes the ONE
// concierge idiom the decomp note's promotion table rules a real validation-enforceability win —
// `booking-flow` — into two catalog types, `BookingForm`/`BookingConfirmation` (the note's own §1
// argument: required-gating and confirmation-value-drift both close BY CONSTRUCTION, not by better
// prose; see `factories.ts`'s header for the full binding-mechanism resolution). Every OTHER concierge
// idiom in the note's table (gallery-swiper, itinerary-timeline, menu-card, facility-info) stays prose,
// untouched, per the note's own ruling — nothing else ships here.
//
// `targetCatalogs` resolution (the note's §2.2 second open flag, resolved at build): BOTH shipped bases.
// Verified, not assumed — both composite factories build DIRECTLY against `@agent-ui/components` DOM
// controls (`ui-form-provider`/`ui-field`/`ui-text-field`/`ui-select`/`ui-radio-group`/`ui-card`/`ui-calendar`/`ui-popover`/`ui-text`), never
// through either base's OWN catalog dialect (`a2ui-basic`'s narrower `ChoicePicker`/boolean-`CheckBox`
// rows are never referenced) — so there is no dialect-fit question to begin with, only the ORDINARY
// reject-loud name-collision check (SPEC-R2), which trivially passes (`BookingForm`/`BookingConfirmation`
// are new names on both bases). `renderer-persona-catalogs.test.ts` proves this with a real fixture.
//
// The browser-only, factory-bearing DomainCatalogPackage (`domains/body.ts` composes it on demand).
// `manifest.ts` carries the SAME `domainId`/`fragment`/`targetCatalogs` data, factory-free
// and DOM-less, so a server host can compose derived catalog DOCUMENTS without ever importing this
// file (GH #516 — see `manifest.ts`'s own header for why that import boundary is load-bearing).

import type { DomainCatalogPackage } from '../../compose.ts'
import { HOSPITALITY_DOMAIN_ID, hospitalityFragment, hospitalityTargetCatalogs } from './manifest.ts'
import { hospitalityFactories } from './factories.ts'

export { HOSPITALITY_DOMAIN_ID, hospitalityFragment, hospitalityTargetCatalogs, hospitalityFactories }

/** The package `composeDomainEntry` (CA-R2) composes onto each base it targets. */
export const hospitalityDomain: DomainCatalogPackage = {
  domainId: HOSPITALITY_DOMAIN_ID,
  fragment: hospitalityFragment,
  factories: hospitalityFactories,
  targetCatalogs: hospitalityTargetCatalogs,
}
