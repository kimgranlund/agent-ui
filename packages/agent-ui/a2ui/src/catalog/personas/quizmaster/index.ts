// index.ts: the `quizmaster` persona-scoped local pattern set (ADR-0243 cl.2, T-0074). One composite type,
// `QuestionCard`: the quiz round's question, choices, reveal and run progress as one catalog row, so a
// round is one component with a bound `value` instead of a hand-minted Text, RadioGroup and Disclosure.
//
// The browser-only, factory-bearing PersonaCatalogPackage the renderer composes. `manifest.ts` carries the
// same data factory-free for a server host (GH #516).

import type { PersonaCatalogPackage } from '../../compose.ts'
import { QUIZMASTER_PERSONA_ID, quizmasterFragment, quizmasterTargetCatalogs } from './manifest.ts'
import { quizmasterFactories } from './factories.ts'

export { QUIZMASTER_PERSONA_ID, quizmasterFragment, quizmasterTargetCatalogs, quizmasterFactories }

/** The derive-then-register input `composePersonaCatalogs` (SPEC-R2) consumes directly. */
export const quizmasterPersona: PersonaCatalogPackage = {
  personaId: QUIZMASTER_PERSONA_ID,
  fragment: quizmasterFragment,
  factories: quizmasterFactories,
  targetCatalogs: quizmasterTargetCatalogs,
}
