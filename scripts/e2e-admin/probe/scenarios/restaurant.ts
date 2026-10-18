// scripts/e2e-admin/probe/scenarios/restaurant.ts: The Maître d’'s smoke scenario (T-0343), one turn on its signature
// composite. The `table-reservation` workflow and `hotel-booking-form` skill turn a reservation ask into a compact
// booking form (the date, the seating, the covers, dietary notes); each step's `expect` becomes `--expect-turn`. The
// preset has no catalog composite of its own (BookingForm is the Concierge's), so the turn expects the form's
// distinctive part, the labelled Field each input sits in: the inputs vary (the 2026-10-18 smoke run drew a Calendar,
// a RadioGroup, a TextField and a Textarea), the Field rows do not. `plan.ts --tag smoke` plans it; `plan.test.mjs`
// checks every expected type is in the preset's catalog.

import { say } from '../model.ts'
import type { RoundScenario } from './round.ts'


export const RESTAURANT_SCENARIOS: readonly RoundScenario[] = [
  {
    name: 'reserve-table',
    tags: ['smoke'],
    steps: [say("I'd like to reserve a table for dinner.", 'Field')],
    expectComponents: ['Field'],
  },
]
