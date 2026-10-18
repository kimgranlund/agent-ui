// scripts/e2e-admin/probe/scenarios/restaurant.ts: The Maître d’'s smoke scenario (T-0343), one turn on its signature
// composite. The `table-reservation` workflow and `hotel-booking-form` skill turn a reservation ask into a compact
// booking form (a date TextField, a seating Select, the covers); each step's `expect` becomes `--expect-turn`. The
// preset has no catalog composite of its own (BookingForm is the Concierge's), so the turn expects the form's fields,
// any-of. `plan.ts --tag smoke` plans it; `plan.test.mjs` checks every expected type is in the preset's catalog.

import type { ProbeStep } from '../model.ts'
import type { RoundScenario } from './round.ts'

const say = (text: string, ...expect: string[]): ProbeStep => (expect.length ? { say: text, expect } : { say: text })

export const RESTAURANT_SCENARIOS: readonly RoundScenario[] = [
  {
    name: 'reserve-table',
    tags: ['smoke'],
    steps: [say("I'd like to reserve a table for dinner.", 'Select', 'TextField')],
    expectComponents: [],
  },
]
