// checks.ts: the concierge persona's semantic checks (ADR-0238), run by `produce()` on every `<base>--concierge` turn.
//
// T-0265 (the recorded Haiku 5.5 spa booking, round 3 regress-concierge-spa-booking-haiku-1): the services ask, the
// booking and its confirmation were each answered in prose with no surface, so the guest never saw a treatment list, a
// pre-filled BookingForm or a BookingConfirmation. A say turn whose words ask for one of those moments must open a
// surface; an answer with none is SURFACE_MISSING. A question with no services, booking or confirm word (pool hours,
// a policy) may still be answered in prose.
//
// T-0278 (round 4, the Haiku spa confirm): a confirm while the open BookingForm still has a blank required field cannot
// be confirmed, so the reply that asks for the missing value is right. Such a turn is held open: no SURFACE_MISSING
// asking for a BookingConfirmation, and no FLOW_END_MISSING round (`holdsFlowOpen`).
// DOM-less and node-free, like `semantic-check.ts`: both server hosts import the manifest that carries it.

import { readPointer } from '../../semantic-check.ts'
import type { SemanticCheck, SemanticCheckInput, SemanticFinding, SurfaceView } from '../../semantic-check.ts'

/** The guest confirms a booking already read back ("please confirm the booking"; T-0282: "Confirm it, the details are
 *  right.", "Yes, confirm the table for four."). */
const CONFIRM = /\bconfirm\s+it\b|\bconfirm\b[^.?!]*\b(booking|reservation|appointment|slot|table|tour)\b/i
/** The guest asks what can be booked ("What spa services can I book?"). */
const SERVICES = /\b(services|treatments|amenities|facilities|menu)\b/i
/** The guest asks to book ("Book a 60-minute massage on Thursday at 15:00"; T-0282: "I'd like a table at Vela"). */
const BOOK = /\b(book|reserve|reservation)\b|\b(i'?d|i would|we'?d|we would) like (a|an) (table|room|treatment|massage|tour|appointment)\b/i

/** The moment a say turn's words ask for, with the surface that answers it, or undefined. */
function askedMoment(intent: string): { moment: string; surface: string } | undefined {
  if (CONFIRM.test(intent)) return { moment: 'confirm', surface: 'a BookingConfirmation with the confirmed details and a reference' }
  if (SERVICES.test(intent)) return { moment: 'services', surface: 'one ServiceCard per service the guest can book, each with its book action' }
  if (BOOK.test(intent)) return { moment: 'booking', surface: 'a BookingForm with its value bound to the details the guest already gave, so they arrive pre-filled' }
  return undefined
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isBlank = (v: unknown): boolean => v === undefined || v === null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0)

/** T-0278: the label (or path) of the first required BookingForm field an open surface leaves blank, or undefined. */
export function blankRequiredField(open: readonly SurfaceView[]): string | undefined {
  for (const view of open) {
    for (const node of view.components.values()) {
      const n = node as Record<string, unknown>
      if (n['component'] !== 'BookingForm' || !Array.isArray(n['fields'])) continue
      const value = n['value']
      const booking = isRecord(value) && typeof value['path'] === 'string' ? readPointer(view.dataModel, value['path']) : value
      for (const field of n['fields']) {
        if (!isRecord(field) || field['required'] !== true || typeof field['path'] !== 'string') continue
        const key = field['path'].replace(/^\//, '')
        if (isBlank(readPointer(booking, `/${key}`))) return typeof field['label'] === 'string' ? field['label'] : key
      }
    }
  }
  return undefined
}

/** T-0278: a confirm ask while the open booking still has a blank required field; the turn cannot confirm. */
const confirmHeldOpen = ({ intent, open }: SemanticCheckInput): boolean =>
  intent !== undefined && open !== undefined && askedMoment(intent)?.moment === 'confirm' && blankRequiredField(open) !== undefined

/** T-0265: a services, booking or confirm ask answered with no surface is SURFACE_MISSING. */
export const conciergeSurfaceRequired: SemanticCheck = {
  id: 'concierge-surface-required',
  requires: ['BookingForm', 'BookingConfirmation'],
  check(input): SemanticFinding[] {
    const { surfaces, action, intent } = input
    if (action !== undefined || intent === undefined || surfaces.length > 0 || confirmHeldOpen(input)) return []
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
  holdsFlowOpen: confirmHeldOpen,
}

/** Every concierge semantic check, in the order `produce()` runs them. */
export const conciergeSemanticChecks: readonly SemanticCheck[] = [conciergeSurfaceRequired]
