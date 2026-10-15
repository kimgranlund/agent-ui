// checks.ts: the concierge persona's semantic checks (ADR-0238), run by `produce()` on every `<base>--concierge` turn.
//
// T-0265 (the recorded Haiku 5.5 spa booking, round 3 regress-concierge-spa-booking-haiku-1): the services ask, the
// booking and its confirmation were each answered in prose with no surface, so the guest never saw a treatment list, a
// pre-filled BookingForm or a BookingConfirmation. A say turn whose words ask for one of those moments must open a
// surface; an answer with none is SURFACE_MISSING. A question with no services, booking or confirm word (pool hours,
// a policy) may still be answered in prose.
// DOM-less and node-free, like `semantic-check.ts`: both server hosts import the manifest that carries it.

import type { SemanticCheck, SemanticFinding } from '../../semantic-check.ts'

/** The guest confirms a booking already read back ("please confirm the booking"). */
const CONFIRM = /\bconfirm\b[^.?!]*\b(booking|reservation|appointment|slot)\b/i
/** The guest asks what can be booked ("What spa services can I book?"). */
const SERVICES = /\b(services|treatments|amenities|facilities|menu)\b/i
/** The guest asks to book ("Book a 60-minute massage on Thursday at 15:00"). */
const BOOK = /\b(book|reserve|reservation)\b/i

/** The moment a say turn's words ask for, with the surface that answers it, or undefined. */
function askedMoment(intent: string): { moment: string; surface: string } | undefined {
  if (CONFIRM.test(intent)) return { moment: 'confirm', surface: 'a BookingConfirmation with the confirmed details and a reference' }
  if (SERVICES.test(intent)) return { moment: 'services', surface: 'one ServiceCard per service the guest can book, each with its book action' }
  if (BOOK.test(intent)) return { moment: 'booking', surface: 'a BookingForm with its value bound to the details the guest already gave, so they arrive pre-filled' }
  return undefined
}

/** T-0265: a services, booking or confirm ask answered with no surface is SURFACE_MISSING. */
export const conciergeSurfaceRequired: SemanticCheck = {
  id: 'concierge-surface-required',
  requires: ['BookingForm', 'BookingConfirmation'],
  check({ surfaces, action, intent }): SemanticFinding[] {
    if (action !== undefined || intent === undefined || surfaces.length > 0) return []
    const asked = askedMoment(intent)
    if (asked === undefined) return []
    return [
      {
        code: 'SURFACE_MISSING',
        path: `intent:${asked.moment}`,
        message:
          `The guest asked "${intent.trim()}" and this turn shows no surface, so the ${asked.moment} step exists only in prose. ` +
          `Call render_surface with a createSurface holding ${asked.surface}, and keep the reply to one short sentence.`,
      },
    ]
  },
}

/** Every concierge semantic check, in the order `produce()` runs them. */
export const conciergeSemanticChecks: readonly SemanticCheck[] = [conciergeSurfaceRequired]
