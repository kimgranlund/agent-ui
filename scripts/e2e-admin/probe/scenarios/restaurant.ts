// scripts/e2e-admin/probe/scenarios/restaurant.ts: The Maître d’'s smoke scenario (T-0343), one turn on its signature
// composite. The `table-reservation` workflow turns a reservation ask into ONE BookingForm from the hospitality domain
// (the date, the seating, the covers, dietary notes; persona rule 6, T-0197), so each step's `expect` (which becomes
// `--expect-turn`) is BookingForm, the persona's shipped booking surface (T-0443; the 2026-10-18 smoke run drew
// bare Field rows, the stale oracle the T-0440 live sweep flagged). `plan.ts --tag smoke` plans it; `plan.test.mjs`
// checks every expected type is in the preset's catalog.

import { say } from '../model.ts'
import type { RoundScenario } from './round.ts'


export const RESTAURANT_SCENARIOS: readonly RoundScenario[] = [
  {
    name: 'reserve-table',
    tags: ['smoke'],
    steps: [say("I'd like to reserve a table for dinner.", 'BookingForm')],
    expectComponents: ['BookingForm'],
  },
]
