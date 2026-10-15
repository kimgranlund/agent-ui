// scripts/e2e-admin/probe/scenarios/concierge.ts: the Hotel Concierge scenarios for live round 2 (T-0225). The
// T-0200 / T-0208 measurement: does the model draw the composite the catalog intends. A booking ask expects
// BookingForm (the concierge fragment's `selection.json`), its confirm BookingConfirmation, and a facility or
// service question ServiceCard (the `facility-info-card` and `amenity-service-card` skills).
//
// Every move is a `--say`: BookingForm's submit Button is model-authored, so its label is not fixed. The booking
// ask carries every detail, so a spoken "confirm" has the data to settle and never needs the form again.

import type { ProbeStep } from '../model.ts'
import type { RoundScenario } from './round.ts'

const say = (text: string, ...expect: string[]): ProbeStep => (expect.length ? { say: text, expect } : { say: text })

export const CONCIERGE_SCENARIOS: readonly RoundScenario[] = [
  {
    name: 'spa-booking',
    steps: [
      say('What spa services can I book during my stay?', 'ServiceCard'),
      say('Book a 60-minute massage at the spa tomorrow at 15:00 for one guest, name Alex Moreau.', 'BookingForm'),
      say('Those details are right, please confirm the booking.', 'BookingConfirmation'),
      say('Thanks. When do the pool and gym close?', 'ServiceCard'),
    ],
    expectComponents: ['ServiceCard', 'BookingForm', 'BookingConfirmation'],
  },
  {
    name: 'dinner-at-vela',
    steps: [
      say("I'd like a table at Vela this Friday at 20:00 for two, name Alex Moreau.", 'BookingForm'),
      say('Actually make it four people, same time.', 'BookingForm'),
      say('Yes, confirm the table for four.', 'BookingConfirmation'),
      say('Which restaurants and bars does the hotel have?', 'ServiceCard'),
      say("That's all, thank you."),
    ],
    expectComponents: ['BookingForm', 'BookingConfirmation', 'ServiceCard'],
  },
  {
    name: 'facilities-then-tour',
    steps: [
      say('What are the opening hours of the pool, gym and spa?', 'ServiceCard'),
      say('Is late check-out possible?'),
      say('Book the half-day coastal boat tour this Saturday for two guests, name Alex Moreau.', 'BookingForm'),
      say('Confirm it, the details are right.', 'BookingConfirmation'),
      say('What services could I add for the rest of my stay?', 'ServiceCard'),
    ],
    expectComponents: ['ServiceCard', 'BookingForm', 'BookingConfirmation'],
  },
]

export const CONCIERGE_MODELS: ReadonlyArray<{ id: string; short: string }> = [
  { id: 'claude-haiku-5-5', short: 'haiku' },
  { id: 'claude-sonnet-5-5', short: 'sonnet' },
]
