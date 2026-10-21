// checks.test.ts: the concierge surface-required check (T-0265), on the recorded Haiku 5.5 spa booking turns (round 3
// regress-concierge-spa-booking-haiku-1), each answered in prose with no surface.

import { describe, expect, it } from 'vitest'
import type { A2uiOutput } from '../../../protocol.ts'
import { semanticSurfaceViews, sessionSurfaceViews } from '../../semantic-check.ts'
import { blankRequiredField, conciergeBookingFieldPaths, conciergeEditApplied, conciergeListingSurfaceRequired, hospitalitySemanticChecks, conciergeSurfaceRequired } from './checks.ts'
import { hospitalityManifest } from './manifest.ts'

// The two surface-required checks as agent-ui--hospitality runs them (T-0316: the services and facility asks ride their own).
const said = (intent: string, out: A2uiOutput = []) =>
  [conciergeSurfaceRequired, conciergeListingSurfaceRequired].flatMap((c) => c.check({ surfaces: semanticSurfaceViews({ turns: [] }, out), intent }))
const card: A2uiOutput = [
  { version: 'v1.0', createSurface: { surfaceId: 'spa', catalogId: 'agent-ui--hospitality' } },
  { version: 'v1.0', updateComponents: { surfaceId: 'spa', components: [{ id: 'root', component: 'Text', text: 'Spa' }] } },
] as A2uiOutput

describe('concierge-surface-required (T-0265)', () => {
  it('rides the concierge manifest, gated on the booking composites', () => {
    expect(hospitalityManifest.semanticChecks).toBe(hospitalitySemanticChecks)
    expect(hospitalitySemanticChecks.map((c) => c.id)).toEqual(['concierge-surface-required', 'concierge-listing-surface-required', 'concierge-booking-field-paths', 'concierge-edit-applied'])
    expect(conciergeSurfaceRequired.requires).toEqual(['BookingForm', 'BookingConfirmation'])
    expect(conciergeListingSurfaceRequired.requires).toEqual(['ProductCard', 'Grid', 'Card', 'DescriptionList'])
  })

  it('the recorded services ask, booking and confirm turns with no surface are SURFACE_MISSING', () => {
    const paths = (intent: string) => said(intent).map((f) => [f.code, f.path])
    expect(paths('What spa services can I book during my stay?')).toEqual([['SURFACE_MISSING', 'intent:services']])
    expect(paths('Book a 60-minute massage at the spa on Thursday 19 November 2026 at 15:00 for one guest, name Alex Moreau.')).toEqual([['SURFACE_MISSING', 'intent:booking']])
    expect(paths('Those details are right, please confirm the booking.')).toEqual([['SURFACE_MISSING', 'intent:confirm']])
    expect(said('Book a massage.')[0]!.message).toMatch(/BookingForm/)
    expect(said('Please confirm the reservation.')[0]!.message).toMatch(/BookingConfirmation/)
    expect(said('What treatments do you offer?')[0]!.message).toMatch(/ProductCard/)
  })

  it('a turn that ships a surface, a question with no services, facility, booking or confirm word, and a client turn pass', () => {
    expect(said('What spa services can I book during my stay?', card)).toEqual([])
    expect(said('When do the pool and gym close?', card)).toEqual([])
    expect(said('Is late check-out possible?')).toEqual([])
    expect(said('Thanks, that is all.')).toEqual([])
    expect(conciergeSurfaceRequired.check({ surfaces: [], action: { name: 'book', surfaceId: 'spa', context: {}, dataModel: undefined } })).toEqual([])
  })

  // T-0195: the booking settle is ONE ConfirmReceipt, so a confirm ask answered by one passes.
  it('a confirm ask answered by a ConfirmReceipt passes', () => {
    const receipt: A2uiOutput = [
      { version: 'v1.0', createSurface: { surfaceId: 'spa-receipt', catalogId: 'agent-ui--hospitality' } },
      { version: 'v1.0', updateDataModel: { surfaceId: 'spa-receipt', value: { booking: { treatment: 'Swedish massage', status: 'pending' } } } },
      {
        version: 'v1.0',
        updateComponents: {
          surfaceId: 'spa-receipt',
          components: [{ id: 'root', component: 'ConfirmReceipt', title: 'Your spa booking', data: { path: '/booking' }, rows: [{ label: 'Treatment', path: 'treatment' }], status: { path: '/booking/status' } }],
        },
      },
    ] as A2uiOutput
    expect(said('Those details are right, please confirm the booking.')).not.toEqual([])
    expect(said('Those details are right, please confirm the booking.', receipt)).toEqual([])
  })
})

// T-0278: round 4 (2026-10-15-r4-fixes :114-:115, Haiku 5.5). The pre-filled spa BookingForm, as recorded, with the
// treatment left blank, then the same form with a treatment chosen.
const spaForm = (treatment: string) =>
  [
    { version: 'v1.0', createSurface: { surfaceId: 'spa-booking', catalogId: 'agent-ui--hospitality', sendDataModel: true } },
    { version: 'v1.0', updateDataModel: { surfaceId: 'spa-booking', value: { booking: { treatment, date: '2026-11-19', time: '15:00', guestName: 'Alex Moreau', guests: 1 } } } },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: 'spa-booking',
        components: [
          {
            id: 'root',
            component: 'BookingForm',
            title: 'Book your spa treatment',
            value: { path: '/booking' },
            fields: [
              { kind: 'select', label: 'Treatment (60 min)', path: 'treatment', required: true, options: [{ label: 'Swedish massage, 60 min, €120', value: 'swedish-60' }] },
              { kind: 'dateSingle', label: 'Date', path: 'date', required: true },
              { kind: 'text', label: 'Guest name', path: 'guestName', required: true },
            ],
          },
        ],
      },
    },
  ]
    .map((m) => JSON.stringify(m))
    .join('\n')
const openAfter = (content: string) => sessionSurfaceViews({ turns: [{ role: 'assistant', content }] })
const CONFIRM_ASK = 'Those details are right, please confirm the booking.'

describe('a confirm the open booking cannot honor (T-0278)', () => {
  const confirm = (treatment: string) => ({ surfaces: [], intent: CONFIRM_ASK, open: openAfter(spaForm(treatment)) })

  it('a confirm while the BookingForm has a blank required field raises no SURFACE_MISSING and holds the flow open', () => {
    expect(blankRequiredField(confirm('').open)).toBe('Treatment (60 min)')
    expect(conciergeSurfaceRequired.check(confirm(''))).toEqual([])
    expect(conciergeSurfaceRequired.holdsFlowOpen!(confirm(''))).toBe(true)
  })

  it('a confirm on a complete form is still SURFACE_MISSING and does not hold the flow open', () => {
    expect(blankRequiredField(confirm('swedish-60').open)).toBeUndefined()
    expect(conciergeSurfaceRequired.check(confirm('swedish-60')).map((f) => [f.code, f.path])).toEqual([['SURFACE_MISSING', 'intent:confirm']])
    expect(conciergeSurfaceRequired.holdsFlowOpen!(confirm('swedish-60'))).toBe(false)
  })

  it('T-0289: the confirm repair asks for a read-back of the open form and treats the chat confirm as the submission', () => {
    const [finding] = conciergeSurfaceRequired.check(confirm('swedish-60'))
    expect(finding!.message).toContain('a BookingConfirmation reading back the values on the open BookingForm')
    expect(finding!.message).toContain("the guest's confirm in chat is their submission")
    expect(finding!.message).not.toMatch(/with the confirmed details and a reference/)
    expect(finding!.message).toContain('add no reference number')
  })

  it('only a confirm ask is held: a booking ask on the blank form, or no open surface, is judged as before', () => {
    const open = openAfter(spaForm(''))
    expect(conciergeSurfaceRequired.holdsFlowOpen!({ surfaces: [], intent: 'Book a 60-minute Swedish massage.', open })).toBe(false)
    expect(conciergeSurfaceRequired.holdsFlowOpen!({ surfaces: [], intent: CONFIRM_ASK })).toBe(false)
    expect(said(CONFIRM_ASK).map((f) => f.code)).toEqual(['SURFACE_MISSING'])
  })
})

// T-0282: round 4 (2026-10-15-r4-fixes :84, :12, :24, :14). The confirm and booking asks the round scenarios use, which
// the T-0265 vocabulary missed: at :84 Haiku answered "Your half-day coastal boat tour is booked" with no surface.
describe('the round scenarios\' confirm and booking asks (T-0282)', () => {
  it('"Confirm it", "confirm the table" and "I\'d like a table" with no surface are SURFACE_MISSING', () => {
    const paths = (intent: string) => said(intent).map((f) => [f.code, f.path])
    expect(paths('Confirm it, the details are right.')).toEqual([['SURFACE_MISSING', 'intent:confirm']])
    expect(paths('Yes, confirm the table for four.')).toEqual([['SURFACE_MISSING', 'intent:confirm']])
    expect(paths("I'd like a table at Vela on Friday 20 November 2026 at 20:00 for two, name Alex Moreau.")).toEqual([['SURFACE_MISSING', 'intent:booking']])
  })

})

// T-0285 (Kim's ruling): a facility or hours ask is its own moment, repaired toward a compact info card (ONE Card holding
// a DescriptionList), never a ServiceCard; a services ask keeps T-0279's ProductCard.
describe('facility and services asks repair toward their ruled composites (T-0285)', () => {
  it('"When do the pool and gym close?" with no surface asks for one compact info card listing each facility with its hours', () => {
    const [f, ...rest] = said('When do the pool and gym close?')
    expect(rest).toEqual([])
    expect([f!.code, f!.path]).toEqual(['SURFACE_MISSING', 'intent:facility'])
    expect(f!.message).toContain('one compact info card: ONE Card holding a DescriptionList, one row per facility with its hours and location')
    expect(f!.message).not.toMatch(/ServiceCard|ProductCard/)
  })

  it('"What spa services can I book during my stay?" with no surface asks for one ProductCard per service', () => {
    const [f, ...rest] = said('What spa services can I book during my stay?')
    expect(rest).toEqual([])
    expect([f!.code, f!.path]).toEqual(['SURFACE_MISSING', 'intent:services'])
    expect(f!.message).toContain('one ProductCard per service the guest can book, templated in a Grid, each with its price and book action')
    expect(f!.message).not.toMatch(/ServiceCard|DescriptionList/)
  })

  it('the round facility asks are the facility moment; a museum or policy question is not', () => {
    const paths = (intent: string) => said(intent).map((f) => f.path)
    expect(paths('What are the opening hours of the pool, gym and spa? Check the property-knowledge-base.')).toEqual(['intent:facility'])
    expect(paths('Which restaurants and bars does the hotel have?')).toEqual(['intent:facility'])
    expect(paths('What time does the pool open tomorrow?')).toEqual(['intent:facility'])
    expect(said('Is the Maritime Museum open on Monday?')).toEqual([])
    expect(said('Is late check-out possible?')).toEqual([])
  })
})

// T-0293: round 5 (2026-10-15-r5-fixes :60-:61, Haiku 5.5). The boat tour BookingForm bound its value to /booking and
// named its fields "booking.tour" and so on; the factory reads value[field.path], so every field rendered blank.
describe('a BookingForm whose field paths miss its bound value (T-0293)', () => {
  const tourForm = (paths: readonly string[]): A2uiOutput =>
    [
      { version: 'v1.0', createSurface: { surfaceId: 'tour-booking', catalogId: 'agent-ui--hospitality', sendDataModel: true } },
      { version: 'v1.0', updateDataModel: { surfaceId: 'tour-booking', value: { booking: { tour: 'coastal-boat', date: '2026-11-21', guests: '2', name: 'Alex Moreau' } } } },
      {
        version: 'v1.0',
        updateComponents: {
          surfaceId: 'tour-booking',
          components: [
            {
              id: 'root',
              component: 'BookingForm',
              title: 'Book your tour',
              value: { path: '/booking' },
              fields: paths.map((path) => ({ kind: 'text', label: path, path, required: true })),
            },
          ],
        },
      },
    ] as A2uiOutput
  const DOTTED = ['booking.tour', 'booking.date', 'booking.guests', 'booking.name']
  const KEYS = ['tour', 'date', 'guests', 'name']
  const fieldPaths = (out: A2uiOutput) => conciergeBookingFieldPaths.check({ surfaces: semanticSurfaceViews({ turns: [] }, out) })

  it('the recorded dotted paths are BOOKING_FIELD_PATH, naming each key-only path', () => {
    const findings = fieldPaths(tourForm(DOTTED))
    expect(findings.map((f) => [f.code, f.path])).toEqual([['BOOKING_FIELD_PATH', 'tour-booking:root']])
    expect(findings[0]!.message).toContain('binds its value to /booking')
    expect(findings[0]!.message).toContain('Change "booking.tour" to "tour", "booking.date" to "date", "booking.guests" to "guests", "booking.name" to "name"')
  })

  it('negative control: key-only paths, and a blank field the value never held, raise none', () => {
    expect(fieldPaths(tourForm(KEYS))).toEqual([])
    expect(fieldPaths(tourForm([...KEYS, 'notes']))).toEqual([])
    expect(fieldPaths(tourForm(['booking.notes']))).toEqual([])
  })

  it('a confirm on the mis-pathed form is not held open: SURFACE_MISSING still fires', () => {
    const open = sessionSurfaceViews({ turns: [{ role: 'assistant', content: tourForm(DOTTED).map((m) => JSON.stringify(m)).join('\n') }] })
    const input = { surfaces: [], intent: 'Confirm it, the details are right.', open }
    expect(blankRequiredField(open)).toBeUndefined()
    expect(conciergeSurfaceRequired.holdsFlowOpen!(input)).toBe(false)
    expect(conciergeSurfaceRequired.check(input).map((f) => f.code)).toEqual(['SURFACE_MISSING'])
  })
})

// T-0322 C2 (live round 8 :166, Haiku 5.5, long-concierge-booking): "Make it 16:00 instead, same day." was answered with
// a meta-line targeting spa-booking and no update, so the form kept 15:00 and no check fired. The form is turn 0's, as recorded.
const SPA_BOOKING: A2uiOutput = [
  {"version": "v1.0", "createSurface": {"surfaceId": "spa-booking", "catalogId": "agent-ui--hospitality", "sendDataModel": true}},
  {"version": "v1.0", "updateDataModel": {"surfaceId": "spa-booking", "value": {"booking": {"treatment": "swedish-massage", "treatmentLabel": "Swedish massage, 60 min, €120", "date": "2026-11-19", "time": "15:00", "guests": 1, "guestName": "Alex Moreau"}}}},
  {"version": "v1.0", "updateComponents": {"surfaceId": "spa-booking", "components": [{"id": "root", "component": "BookingForm", "title": "Spa booking", "fields": [{"kind": "dateSingle", "label": "Date", "path": "date", "required": true}, {"kind": "select", "label": "Treatment", "options": [{"label": "Swedish massage, 60 min, €120", "value": "swedish-massage"}, {"label": "Deep-tissue massage, 60 min, €135", "value": "deep-tissue-massage"}, {"label": "Hot-stone massage, 90 min, €170", "value": "hot-stone-massage"}, {"label": "Sea-salt and lemon body scrub, 45 min, €95", "value": "sea-salt-lemon-scrub"}, {"label": "Hydrating facial, 50 min, €110", "value": "hydrating-facial"}, {"label": "Couples massage, 60 min, €230 for two", "value": "couples-massage"}], "path": "treatment", "required": true}, {"kind": "select", "label": "Time", "options": [{"label": "15:00", "value": "15:00"}], "path": "time", "required": true}, {"kind": "text", "label": "Guest name", "path": "guestName", "required": true}], "value": {"path": "/booking"}}, {"id": "bookBtn", "component": "Button", "label": "Book now", "variant": "solid", "action": {"action": "confirm_booking", "context": {"booking": {"path": "/booking"}}, "submit": true}}]}},
] as A2uiOutput
const spaBooking = SPA_BOOKING.map((m) => JSON.stringify(m)).join('\n')

describe('a say turn that targets an open BookingForm and sends it no update (T-0322)', () => {
  const open = openAfter(spaBooking)
  const edit = (intent: string, out: A2uiOutput = [], target: string | null = 'spa-booking') =>
    conciergeEditApplied.check({ surfaces: semanticSurfaceViews({ turns: [{ role: 'assistant', content: spaBooking }] }, out), intent, open, ...(target !== null ? { target } : {}) })
  const moved = [{ version: 'v1.0', updateDataModel: { surfaceId: 'spa-booking', path: '/booking/time', value: '16:00' } }] as A2uiOutput
  const fresh = JSON.parse(JSON.stringify(SPA_BOOKING).replaceAll('spa-booking', 'spa-booking-2')) as A2uiOutput

  it('rides the concierge manifest last, gated on the BookingForm', () => {
    expect(hospitalitySemanticChecks.at(-1)).toBe(conciergeEditApplied)
    expect(conciergeEditApplied.requires).toEqual(['BookingForm'])
  })

  it('the recorded prose-only "Make it 16:00 instead, same day." is ACTION_NOT_APPLIED at spa-booking', () => {
    const findings = edit('Make it 16:00 instead, same day.')
    expect(findings.map((f) => [f.code, f.path])).toEqual([['ACTION_NOT_APPLIED', 'spa-booking:root']])
    expect(findings[0]!.message).toMatch(/updateDataModel for spa-booking/)
  })

  it('an update to the form, a fresh BookingForm, no target, a booking or confirm ask, or a question passes', () => {
    expect(edit('Make it 16:00 instead, same day.', moved)).toEqual([])
    expect(edit('Make it 16:00 instead, same day.', fresh)).toEqual([])
    expect(edit('Make it 16:00 instead, same day.', [], null)).toEqual([])
    expect(edit(CONFIRM_ASK)).toEqual([]) // the surface-required check owns a confirm
    expect(edit('Book a deep-tissue massage instead.')).toEqual([]) // and a booking ask
    expect(edit('Can I bring a friend?')).toEqual([])
  })
  // T-0359 code review: a palette word never shadows the edit (no palette row is an askedCompositeMoment row).
  it('an edit that mentions brand colours still reaches the edit check', () => {
    expect(edit('Make it 16:00 and use the brand colours for the table decor').map((f) => f.code)).toEqual(['ACTION_NOT_APPLIED'])
  })
})

// T-0197: a dateRange field holds two dates, its start at `path` and its end at `endPath`; both checks read the end too.
describe('a dateRange field reads its endPath as a second path (T-0197)', () => {
  const stayForm = (booking: Record<string, unknown>, endPath = 'checkOut'): A2uiOutput =>
    [
      { version: 'v1.0', createSurface: { surfaceId: 'stay', catalogId: 'agent-ui--hospitality', sendDataModel: true } },
      { version: 'v1.0', updateDataModel: { surfaceId: 'stay', value: { booking } } },
      {
        version: 'v1.0',
        updateComponents: {
          surfaceId: 'stay',
          components: [
            {
              id: 'root',
              component: 'BookingForm',
              title: 'Your stay',
              value: { path: '/booking' },
              fields: [{ kind: 'dateRange', path: 'checkIn', endPath, label: 'Arrival', endLabel: 'Departure', required: true }],
            },
          ],
        },
      },
    ] as A2uiOutput
  const openOf = (out: A2uiOutput) => openAfter(out.map((m) => JSON.stringify(m)).join('\n'))

  it('a blank end date holds a confirm open, named by its endLabel (T-0197)', () => {
    const open = openOf(stayForm({ checkIn: '2026-11-14', checkOut: '' }))
    expect(blankRequiredField(open)).toBe('Departure')
    expect(conciergeSurfaceRequired.holdsFlowOpen!({ surfaces: [], intent: CONFIRM_ASK, open })).toBe(true)
    expect(blankRequiredField(openOf(stayForm({ checkIn: '2026-11-14', checkOut: '2026-11-17' })))).toBeUndefined()
  })

  it('a mis-pathed endPath is BOOKING_FIELD_PATH, a key-only one is not (T-0197)', () => {
    const booking = { checkIn: '2026-11-14', checkOut: '2026-11-17' }
    const check = (out: A2uiOutput) => conciergeBookingFieldPaths.check({ surfaces: semanticSurfaceViews({ turns: [] }, out) })
    const findings = check(stayForm(booking, 'booking.checkOut'))
    expect(findings.map((f) => f.code)).toEqual(['BOOKING_FIELD_PATH'])
    expect(findings[0]!.message).toContain('Change "booking.checkOut" to "checkOut"')
    expect(check(stayForm(booking))).toEqual([])
  })
})
