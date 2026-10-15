// checks.test.ts: the concierge surface-required check (T-0265), on the recorded Haiku 5.5 spa booking turns (round 3
// regress-concierge-spa-booking-haiku-1), each answered in prose with no surface.

import { describe, expect, it } from 'vitest'
import type { A2uiOutput } from '../../../protocol.ts'
import { semanticSurfaceViews } from '../../semantic-check.ts'
import { conciergeSemanticChecks, conciergeSurfaceRequired } from './checks.ts'
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
