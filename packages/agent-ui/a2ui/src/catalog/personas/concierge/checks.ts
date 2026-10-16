// checks.ts: the concierge persona's semantic checks (ADR-0238), run by `produce()` on every `<base>--concierge` turn.
//
// T-0265 (the recorded Haiku 5.5 spa booking, round 3 regress-concierge-spa-booking-haiku-1): the services ask, the
// booking and its confirmation were each answered in prose with no surface, so the guest never saw a treatment list, a
// pre-filled BookingForm or a BookingConfirmation. A say turn whose words ask for one of those moments must open a
// surface; an answer with none is SURFACE_MISSING. A question with no services, facility, booking or confirm word (a
// policy) may still be answered in prose.
//
// T-0285 (Kim's ruling): a facility or hours ask ("When do the pool and gym close?") is its own moment, answered with a
// compact info card, ONE Card holding a DescriptionList; a services ask is one ProductCard per priced service (T-0279).
//
// T-0278 (round 4, the Haiku spa confirm): a confirm while the open BookingForm still has a blank required field cannot
// be confirmed, so the reply that asks for the missing value is right. Such a turn is held open: no SURFACE_MISSING
// asking for a BookingConfirmation, and no FLOW_END_MISSING round (`holdsFlowOpen`).
//
// T-0293 (round 5, the Haiku boat tour): a BookingForm bound to /booking named its fields "booking.tour", "booking.date"
// and so on. The factory prefills each field from value[field.path], so all four rendered blank, and the T-0278 hold
// then read them as blank and let a prose "is booked" pass. A field path that misses the bound value while its last
// segment is a key of it is BOOKING_FIELD_PATH, and such a field never holds a confirm open.
//
// T-0289 (round 5, the Haiku confirm refusal): a guest's chat confirm on a complete BookingForm IS the submission, so
// the confirm repair asks for a BookingConfirmation reading back the form's values and never for a reference (the
// catalog's BookingConfirmation has no such field, and Haiku refused to invent one).
// DOM-less and node-free, like `semantic-check.ts`: both server hosts import the manifest that carries it.

import { readPointer } from '../../semantic-check.ts'
import type { SemanticCheck, SemanticCheckInput, SemanticFinding, SurfaceView } from '../../semantic-check.ts'

/** The guest confirms a booking already read back ("please confirm the booking"; T-0282: "Confirm it, the details are
 *  right.", "Yes, confirm the table for four."). */
const CONFIRM = /\bconfirm\s+it\b|\bconfirm\b[^.?!]*\b(booking|reservation|appointment|slot|table|tour)\b/i
/** The guest asks what can be booked ("What spa services can I book?"). */
const SERVICES = /\b(services|treatments|amenities|menu)\b/i
/** T-0285: the guest asks about the hotel's facilities or their hours ("When do the pool and gym close?", "What are
 *  the opening hours of the pool, gym and spa?", "Which restaurants and bars does the hotel have?"). */
const FACILITY_NOUN = '(pool|gym|spa|sauna|restaurant|restaurants|bar|bars)'
const FACILITY = new RegExp(
  `\\b(facilities|opening hours)\\b|\\b(which|what) (restaurants|bars|facilities)\\b|` +
    `\\b${FACILITY_NOUN}\\b[^.?!]*\\b(open|opens|close|closes|closed|hours)\\b|\\b(open|opens|close|closes|hours)\\b[^.?!]*\\b${FACILITY_NOUN}\\b`,
  'i',
)
/** The guest asks to book ("Book a 60-minute massage on Thursday at 15:00"; T-0282: "I'd like a table at Vela"). */
const BOOK = /\b(book|reserve|reservation)\b|\b(i'?d|i would|we'?d|we would) like (a|an) (table|room|treatment|massage|tour|appointment)\b/i

/** The moment a say turn's words ask for, with the surface that answers it, or undefined. */
function askedMoment(intent: string): { moment: string; surface: string } | undefined {
  if (CONFIRM.test(intent)) return { moment: 'confirm', surface: 'a BookingConfirmation reading back the values on the open BookingForm (the guest\'s confirm in chat is their submission, so nothing waits on the form button; add no reference number)' }
  if (SERVICES.test(intent)) return { moment: 'services', surface: 'one ProductCard per service the guest can book, templated in a Grid, each with its price and book action' }
  if (BOOK.test(intent)) return { moment: 'booking', surface: 'a BookingForm with its value bound to the details the guest already gave, so they arrive pre-filled' }
  if (FACILITY.test(intent)) return { moment: 'facility', surface: 'one compact info card: ONE Card holding a DescriptionList, one row per facility with its hours and location' }
  return undefined
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isBlank = (v: unknown): boolean => v === undefined || v === null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0)

/** Every BookingForm on these surfaces, with the booking object its value resolves to. */
function* bookingForms(views: readonly SurfaceView[]): Generator<{ view: SurfaceView; node: Record<string, unknown>; fields: unknown[]; booking: unknown }> {
  for (const view of views) {
    for (const node of view.components.values()) {
      const n = node as Record<string, unknown>
      if (n['component'] !== 'BookingForm' || !Array.isArray(n['fields'])) continue
      const value = n['value']
      const booking = isRecord(value) && typeof value['path'] === 'string' ? readPointer(view.dataModel, value['path']) : value
      yield { view, node: n, fields: n['fields'], booking }
    }
  }
}

/** T-0293: the key-only path a mis-pathed field meant ("booking.tour" on a value holding `tour` means "tour"), or
 *  undefined when the path reads the bound value as it is, or its last segment is no key of it either. */
function misPathedKey(booking: unknown, path: string): string | undefined {
  const key = path.replace(/^\//, '')
  if (!isRecord(booking) || Object.hasOwn(booking, key)) return undefined
  const segments = key.split(/[./]/)
  const last = segments.at(-1)!
  return segments.length > 1 && Object.hasOwn(booking, last) ? last : undefined
}

/** T-0278: the label (or path) of the first required BookingForm field an open surface leaves blank, or undefined. A
 *  mis-pathed field (T-0293) renders blank only because of its path; its value is there, so it holds nothing open. */
export function blankRequiredField(open: readonly SurfaceView[]): string | undefined {
  for (const { fields, booking } of bookingForms(open)) {
    for (const field of fields) {
      if (!isRecord(field) || field['required'] !== true || typeof field['path'] !== 'string') continue
      const key = field['path'].replace(/^\//, '')
      if (isBlank(readPointer(booking, `/${key}`)) && misPathedKey(booking, key) === undefined) return typeof field['label'] === 'string' ? field['label'] : key
    }
  }
  return undefined
}

/** T-0293: a BookingForm whose field paths miss its bound value renders those fields blank; name the key-only paths. */
export const conciergeBookingFieldPaths: SemanticCheck = {
  id: 'concierge-booking-field-paths',
  requires: ['BookingForm'],
  check({ surfaces }): SemanticFinding[] {
    const findings: SemanticFinding[] = []
    for (const { view, node, fields, booking } of bookingForms(surfaces)) {
      const fixes = fields.flatMap((field) => {
        if (!isRecord(field) || typeof field['path'] !== 'string') return []
        const key = misPathedKey(booking, field['path'])
        return key === undefined ? [] : [`"${field['path']}" to "${key}"`]
      })
      if (fixes.length === 0) continue
      const bound = isRecord(node['value']) && typeof node['value']['path'] === 'string' ? node['value']['path'] : 'its value'
      findings.push({
        code: 'BOOKING_FIELD_PATH',
        path: `${view.surfaceId}:${String(node['id'])}`,
        message:
          `${view.surfaceId}'s BookingForm binds its value to ${bound}, and each field path is read as a key of that object, ` +
          `so ${fixes.length === 1 ? 'one field renders' : 'these fields render'} blank. Change ${fixes.join(', ')} and keep everything else.`,
      })
    }
    return findings
  },
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
export const conciergeSemanticChecks: readonly SemanticCheck[] = [conciergeSurfaceRequired, conciergeBookingFieldPaths]
