// checks.test.ts: the concierge surface-required check (T-0265), on the recorded Haiku 5.5 spa booking turns (round 3
// regress-concierge-spa-booking-haiku-1), each answered in prose with no surface.

import { describe, expect, it } from 'vitest'
import type { A2uiOutput } from '../../../protocol.ts'
import { semanticSurfaceViews, sessionSurfaceViews } from '../../semantic-check.ts'
import { blankRequiredField, conciergeSemanticChecks, conciergeSurfaceRequired } from './checks.ts'
import { conciergeManifest } from './manifest.ts'

const said = (intent: string, out: A2uiOutput = []) => conciergeSurfaceRequired.check({ surfaces: semanticSurfaceViews({ turns: [] }, out), intent })
const card: A2uiOutput = [
  { version: 'v1.0', createSurface: { surfaceId: 'spa', catalogId: 'agent-ui--concierge' } },
  { version: 'v1.0', updateComponents: { surfaceId: 'spa', components: [{ id: 'root', component: 'Text', text: 'Spa' }] } },
] as A2uiOutput

describe('concierge-surface-required (T-0265)', () => {
  it('rides the concierge manifest, gated on the booking composites', () => {
    expect(conciergeManifest.semanticChecks).toBe(conciergeSemanticChecks)
    expect(conciergeSemanticChecks.map((c) => c.id)).toEqual(['concierge-surface-required'])
    expect(conciergeSurfaceRequired.requires).toEqual(['BookingForm', 'BookingConfirmation'])
  })

  it('the recorded services ask, booking and confirm turns with no surface are SURFACE_MISSING', () => {
    const paths = (intent: string) => said(intent).map((f) => [f.code, f.path])
    expect(paths('What spa services can I book during my stay?')).toEqual([['SURFACE_MISSING', 'intent:services']])
    expect(paths('Book a 60-minute massage at the spa on Thursday 19 November 2026 at 15:00 for one guest, name Alex Moreau.')).toEqual([['SURFACE_MISSING', 'intent:booking']])
    expect(paths('Those details are right, please confirm the booking.')).toEqual([['SURFACE_MISSING', 'intent:confirm']])
    expect(said('Book a massage.')[0]!.message).toMatch(/BookingForm/)
    expect(said('Please confirm the reservation.')[0]!.message).toMatch(/BookingConfirmation/)
    expect(said('What treatments do you offer?')[0]!.message).toMatch(/ServiceCard/)
  })

  it('a turn that ships a surface, a question with no services, booking or confirm word, and a client turn pass', () => {
    expect(said('What spa services can I book during my stay?', card)).toEqual([])
    expect(said('When do the pool and gym close?')).toEqual([])
    expect(said('Thanks, that is all.')).toEqual([])
    expect(conciergeSurfaceRequired.check({ surfaces: [], action: { name: 'book', surfaceId: 'spa', context: {}, dataModel: undefined } })).toEqual([])
  })
})

// T-0278: round 4 (2026-10-15-r4-fixes :114-:115, Haiku 5.5). The pre-filled spa BookingForm, as recorded, with the
// treatment left blank, then the same form with a treatment chosen.
const spaForm = (treatment: string) =>
  [
    { version: 'v1.0', createSurface: { surfaceId: 'spa-booking', catalogId: 'agent-ui--concierge', sendDataModel: true } },
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

  it('only a confirm ask is held: a booking ask on the blank form, or no open surface, is judged as before', () => {
    const open = openAfter(spaForm(''))
    expect(conciergeSurfaceRequired.holdsFlowOpen!({ surfaces: [], intent: 'Book a 60-minute Swedish massage.', open })).toBe(false)
    expect(conciergeSurfaceRequired.holdsFlowOpen!({ surfaces: [], intent: CONFIRM_ASK })).toBe(false)
    expect(said(CONFIRM_ASK).map((f) => f.code)).toEqual(['SURFACE_MISSING'])
  })
})
