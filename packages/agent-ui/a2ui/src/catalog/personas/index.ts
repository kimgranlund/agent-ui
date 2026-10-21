// personas/index.ts — the enumerated set of shipped persona-scoped local pattern sets (SPEC-R1/R2).
// A static, explicit list (the `default`/`a2ui-basic` precedent — `renderer.ts` imports each catalog
// by name, never a filesystem glob) so the set stays browser-safe and zero-dep (SPEC-N5/`agent-ui`
// zero-dep law): `renderer.ts`'s constructor composes+registers every entry here against every base its
// own `targetCatalogs` names (SPEC-R2). `fixture-demo` (SPEC-N6: mechanism only), the GH #497 content
// persona `croupier` (`PlayingCard`), and the ADR-0243 `quizmaster` (`QuestionCard`) and the ADR-0244 `stylist`
// (`ContrastPair`). The concierge's `BookingForm`/`BookingConfirmation` moved to the hospitality domain (T-0197).

import { fixtureDemoPersona } from './fixture-demo/index.ts'
import { croupierPersona } from './croupier/index.ts'
import { quizmasterPersona } from './quizmaster/index.ts'
import { stylistPersona } from './stylist/index.ts'
import type { PersonaCatalogPackage } from '../compose.ts'

export const SHIPPED_PERSONA_CATALOGS: readonly PersonaCatalogPackage[] = [
  fixtureDemoPersona,
  croupierPersona,
  quizmasterPersona,
  stylistPersona,
]
