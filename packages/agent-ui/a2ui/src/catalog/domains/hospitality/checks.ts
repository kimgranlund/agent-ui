// checks.ts: the hospitality domain's semantic checks (ADR-0238, W0 D4; first the concierge persona's), run by `produce()` on
// every turn whose catalog holds the domain (`<base>--hospitality`), each gated on its own `requires` types. The
// check ids keep their `concierge-` prefix: recorded traces and replays name them.
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
// asking for the confirm, and no inferred flowEnd (`holdsFlowOpen`, T-0309).
//
// T-0293 (round 5, the Haiku boat tour): a BookingForm bound to /booking named its fields "booking.tour", "booking.date"
// and so on. The factory prefills each field from value[field.path], so all four rendered blank, and the T-0278 hold
// then read them as blank and let a prose "is booked" pass. A field path that misses the bound value while its last
// segment is a key of it is BOOKING_FIELD_PATH, and such a field never holds a confirm open.
//
// T-0289 (round 5, the Haiku confirm refusal): a guest's chat confirm on a complete BookingForm IS the submission, so
// the confirm repair asks for a BookingConfirmation reading back the form's values and never for a reference (the
// catalog's BookingConfirmation has no such field, and Haiku refused to invent one). T-0401: on a catalog with
// ConfirmReceipt the repair asks for the settle in place (the form's surface updated, or re-created when the form is its
// root); a2ui-basic--hospitality keeps this read-back through `concierge-basic-surface-required`, gated `unless`
// ConfirmReceipt.
//
// T-0449 (round 13 :75-:76, the Haiku spa booking): the data model was written at the root while the form bound /booking, so
// every field rendered blank (BOOKING_VALUE_UNBOUND, from the same check) and the T-0278 hold then read them as blank and
// let a note-only "booked" with flowEnd pass. A form bound to a path the surface never wrote holds nothing open, so that
// confirm is SURFACE_MISSING and asks for the ConfirmReceipt.
//
// T-0197: a `dateRange` field holds two dates, its start at `path` and its end at a string `endPath`; both checks read
// the end path as a second path of the field (`fieldPaths`).
//
// T-0322: a say turn that targets the open BookingForm and sends it no update is ACTION_NOT_APPLIED
// (`conciergeEditApplied`).
//
// T-0313: the confirm, services and booking asks are read from the composite-moment rows (`askedCompositeMoment`), the
// one matcher for each moment; only the facility ask stays here, since its answer is no composite.
// DOM-less and node-free, like `semantic-check.ts`: both server hosts import the manifest that carries it.

import { askedCompositeMoment } from '../../composite-moments.ts'
import { readPointer } from '../../semantic-check.ts'
import type { SemanticCheck, SemanticCheckInput, SemanticFinding, SurfaceView } from '../../semantic-check.ts'

/** T-0285: the guest asks about the hotel's facilities or their hours ("When do the pool and gym close?", "What are
 *  the opening hours of the pool, gym and spa?", "Which restaurants and bars does the hotel have?"). */
const FACILITY_NOUN = '(pool|gym|spa|sauna|restaurant|restaurants|bar|bars)'
const FACILITY = new RegExp(
  `\\b(facilities|opening hours)\\b|\\b(which|what) (restaurants|bars|facilities)\\b|` +
    `\\b${FACILITY_NOUN}\\b[^.?!]*\\b(open|opens|close|closes|closed|hours)\\b|\\b(open|opens|close|closes|hours)\\b[^.?!]*\\b${FACILITY_NOUN}\\b`,
  'i',
)

/** The moment a say turn's words ask for, with the surface that answers it, or undefined: a composite moment's row
 *  first (confirm, services, booking), then the facility ask. */
function askedMoment(intent: string): { moment: string; surface: string } | undefined {
  const composite = askedCompositeMoment(intent)
  if (composite !== undefined) return composite
  if (FACILITY.test(intent)) return { moment: 'facility', surface: 'one compact info card: ONE Card holding a DescriptionList, one row per facility with its hours and location' }
  return undefined
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isBlank = (v: unknown): boolean => v === undefined || v === null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0)

/** Every BookingForm on these surfaces, with the booking object its value resolves to. `unbound` (T-0449): its value is
 *  a path that reads nothing although the surface's data model holds other keys, so the booking was written somewhere the
 *  form does not look and every field renders blank. */
function* bookingForms(
  views: readonly SurfaceView[],
): Generator<{ view: SurfaceView; node: Record<string, unknown>; fields: unknown[]; booking: unknown; unbound: boolean }> {
  for (const view of views) {
    for (const node of view.components.values()) {
      const n = node as Record<string, unknown>
      if (n['component'] !== 'BookingForm' || !Array.isArray(n['fields'])) continue
      const value = n['value']
      const booking = isRecord(value) && typeof value['path'] === 'string' ? readPointer(view.dataModel, value['path']) : value
      const unbound = isRecord(value) && typeof value['path'] === 'string' && booking === undefined && isRecord(view.dataModel) && Object.keys(view.dataModel).length > 0
      yield { view, node: n, fields: n['fields'], booking, unbound }
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

/** Each path a field writes with the label it shows: its `path`, and a `dateRange`'s string `endPath` (T-0197), labelled
 *  as the factory labels the end date. */
function fieldPaths(field: Record<string, unknown>): { path: string; label: string | undefined }[] {
  if (typeof field['path'] !== 'string') return []
  const paths = [{ path: field['path'], label: typeof field['label'] === 'string' ? field['label'] : undefined }]
  if (field['kind'] === 'dateRange' && typeof field['endPath'] === 'string') {
    paths.push({ path: field['endPath'], label: typeof field['endLabel'] === 'string' ? field['endLabel'] : 'End date' })
  }
  return paths
}

/** T-0278: the label (or path) of the first required BookingForm field an open surface leaves blank, or undefined. A
 *  mis-pathed field (T-0293) renders blank only because of its path; its value is there, so it holds nothing open. T-0449:
 *  neither does a form bound to a path the surface never wrote; the guest did not leave it blank. */
export function blankRequiredField(open: readonly SurfaceView[]): string | undefined {
  for (const { fields, booking, unbound } of bookingForms(open)) {
    if (unbound) continue
    for (const field of fields) {
      if (!isRecord(field) || field['required'] !== true) continue
      for (const { path, label } of fieldPaths(field)) {
        const key = path.replace(/^\//, '')
        if (isBlank(readPointer(booking, `/${key}`)) && misPathedKey(booking, key) === undefined) return label ?? key
      }
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
    for (const { view, node, fields, booking, unbound } of bookingForms(surfaces)) {
      if (unbound) {
        const bound = (node['value'] as { path: string }).path
        const written = Object.keys(view.dataModel as Record<string, unknown>).join(', ')
        findings.push({
          code: 'BOOKING_VALUE_UNBOUND',
          path: `${view.surfaceId}:${String(node['id'])}`,
          message:
            `${view.surfaceId}'s BookingForm binds its value to ${bound}, and no updateDataModel writes anything there (the data model holds ${written}), ` +
            `so every field renders blank. Write the booking object at ${bound} (an updateDataModel with path "${bound}" and the booking as its value) and keep everything else.`,
        })
        continue
      }
      const fixes = fields.flatMap((field) =>
        (isRecord(field) ? fieldPaths(field) : []).flatMap(({ path }) => {
          const key = misPathedKey(booking, path)
          return key === undefined ? [] : [`"${path}" to "${key}"`]
        }),
      )
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

/** T-0265: an ask for one of `moments` answered with no surface is SURFACE_MISSING. The ask is read once
 *  (`askedMoment`), so a turn whose words match two moments draws one finding from one check. */
function surfaceRequired(
  id: string,
  requires: readonly string[],
  moments: readonly string[],
  confirm?: (open: readonly SurfaceView[] | undefined, surface: string) => string,
): SemanticCheck {
  return {
    id,
    requires,
    check(input): SemanticFinding[] {
      const { surfaces, action, intent } = input
      if (action !== undefined || intent === undefined || surfaces.length > 0 || confirmHeldOpen(input)) return []
      const asked = askedMoment(intent)
      if (asked === undefined || !moments.includes(asked.moment)) return []
      const call = asked.moment === 'confirm' && confirm !== undefined ? confirm(input.open, asked.surface) : `a createSurface holding ${asked.surface}`
      return [
        {
          code: 'SURFACE_MISSING',
          path: `intent:${asked.moment}`,
          message:
            `The guest asked "${intent.trim()}" and this turn shows no surface, so the ${asked.moment} step exists only in prose. ` +
            `Call render_surface with ${call}, and keep the reply to one short sentence.`,
        },
      ]
    },
  }
}

/** T-0401: the confirm the open BookingForm owes, settled in place (grammar.md, booking-flow, table-reservation): one update
 *  on the form's surface turns the root wrapper's child into `receipt`. A form or StepFlow at the root cannot change type
 *  in an update, so that surface is re-created under the same id; with no open form known, the surface goes unnamed. */
function settleInPlace(open: readonly SurfaceView[] | undefined, receipt: string): string {
  const view = (open ?? []).filter((v) => [...v.components.values()].some((c) => c.component === 'BookingForm')).at(-1)
  if (view === undefined) return `one updateComponents on the open BookingForm's surface that turns the root wrapper's child (the form or its StepFlow) into ${receipt}`
  const root = view.components.get('root')?.component
  if (root === 'BookingForm' || root === 'StepFlow')
    return `a createSurface re-creating surface "${view.surfaceId}" (the same surfaceId, then its data model and the complete tree) whose root is ${receipt}`
  return `one updateComponents on surface "${view.surfaceId}" that turns the root wrapper's child (the BookingForm or its StepFlow) into ${receipt}`
}

/** T-0289, kept for a2ui-basic--hospitality (T-0401): that catalog holds no ConfirmReceipt, so a confirm there is a read-back. */
const BASIC_CONFIRM_SURFACE =
  "a BookingConfirmation reading back the values on the open BookingForm (the guest's confirm in chat is their submission, so nothing waits on the form button; add no reference number)"

/** T-0265: a booking or confirm ask answered with no surface is SURFACE_MISSING. T-0401: on a catalog with ConfirmReceipt,
 *  a confirm is asked for as the settle in place. */
export const conciergeSurfaceRequired: SemanticCheck = {
  ...surfaceRequired('concierge-surface-required', ['BookingForm', 'BookingConfirmation', 'ConfirmReceipt'], ['booking', 'confirm'], settleInPlace),
  holdsFlowOpen: confirmHeldOpen,
}

/** T-0401: the same check on a catalog with no ConfirmReceipt (a2ui-basic--hospitality), where a confirm is the T-0289 read-back. */
export const conciergeBasicSurfaceRequired: SemanticCheck = {
  ...surfaceRequired('concierge-basic-surface-required', ['BookingForm', 'BookingConfirmation'], ['booking', 'confirm'], () => `a createSurface holding ${BASIC_CONFIRM_SURFACE}`),
  unless: ['ConfirmReceipt'],
  holdsFlowOpen: confirmHeldOpen,
}

/** T-0316 (D2): a services or facility ask answered with no surface is SURFACE_MISSING, on a catalog that holds the
 *  ProductCard Grid and the Card with a DescriptionList those asks name; a2ui-basic--hospitality holds neither, so it
 *  never asks there for types it cannot emit (T-0202 D4). */
export const conciergeListingSurfaceRequired: SemanticCheck = surfaceRequired(
  'concierge-listing-surface-required',
  ['ProductCard', 'Grid', 'Card', 'DescriptionList'],
  ['services', 'facility'],
)

/** T-0322 C2 (round 8 :166, Haiku 5.5): "Make it 16:00 instead, same day." declared spa-booking its target and sent it
 *  no update, so the form kept 15:00. ACTION_NOT_APPLIED: a say turn whose meta-line targets an open BookingForm sends
 *  that surface no update and opens no fresh BookingForm, BookingConfirmation or ConfirmReceipt. A booking or confirm ask is left to
 *  the surface-required check (one finding per turn), a confirm the form cannot honor is held open (T-0278), and a
 *  question may stay prose. */
export const conciergeEditApplied: SemanticCheck = {
  id: 'concierge-edit-applied',
  requires: ['BookingForm'],
  check(input): SemanticFinding[] {
    const { surfaces, action, intent, target, open } = input
    if (action !== undefined || intent === undefined || target === undefined || open === undefined || /\?\s*$/.test(intent.trim())) return []
    if (askedMoment(intent) !== undefined || confirmHeldOpen(input)) return []
    const form = [...bookingForms(open.filter((v) => v.surfaceId === target))][0]
    if (form === undefined) return []
    const answers = (v: SurfaceView): boolean =>
      v.surfaceId === target || (v.priorDataModel === undefined && [...v.components.values()].some((c) => c.component === 'BookingForm' || c.component === 'BookingConfirmation' || c.component === 'ConfirmReceipt'))
    if (surfaces.some(answers)) return []
    return [
      {
        code: 'ACTION_NOT_APPLIED',
        path: `${target}:${String(form.node['id'])}`,
        message:
          `The guest asked "${intent.trim()}" of the open BookingForm on ${target}, and this turn sends it no update, so the form still shows the old details. ` +
          `Call render_surface with an updateDataModel for ${target} that writes the changed values into the booking the form is bound to, and keep the reply to one short sentence.`,
      },
    ]
  },
}

/** Every hospitality semantic check, in the order `produce()` runs them. */
export const hospitalitySemanticChecks: readonly SemanticCheck[] = [
  conciergeSurfaceRequired,
  conciergeBasicSurfaceRequired,
  conciergeListingSurfaceRequired,
  conciergeBookingFieldPaths,
  conciergeEditApplied,
]
