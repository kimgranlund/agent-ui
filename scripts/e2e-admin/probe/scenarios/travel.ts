// scripts/e2e-admin/probe/scenarios/travel.ts: The Travel Agent's smoke scenario (T-0343), one turn on its signature
// composite. The `trip-plan` workflow compares 2-3 legs as ONE Grid of ProductCard tiles (4 or more as a Table), so
// the two-leg ask expects ProductCard; each step's `expect` becomes `--expect-turn`. `plan.ts --tag smoke` plans it; `plan.test.mjs` checks every expected type
// is in the preset's catalog.

import { say } from '../model.ts'
import type { RoundScenario } from './round.ts'


export const TRAVEL_SCENARIOS: readonly RoundScenario[] = [
  {
    name: 'compare-legs',
    tags: ['smoke'],
    steps: [say('Compare the train and a flight from London to Paris on Friday 20 November 2026.', 'ProductCard')],
    expectComponents: ['ProductCard'],
  },
]
