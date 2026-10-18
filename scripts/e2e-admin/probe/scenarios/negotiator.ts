// scripts/e2e-admin/probe/scenarios/negotiator.ts: The Negotiator's smoke scenario (T-0343), two turns on its signature
// composite. The `deal-sheet` skill puts the asking price, the offer and the mood on ONE GameHud of one deal sheet;
// each step's `expect` becomes `--expect-turn`. `plan.ts --tag smoke` plans it; `plan.test.mjs` checks every expected
// type is in the preset's catalog.

import { say } from '../model.ts'
import type { RoundScenario } from './round.ts'


export const NEGOTIATOR_SCENARIOS: readonly RoundScenario[] = [
  {
    name: 'first-offer',
    tags: ['smoke'],
    steps: [say("I'd like to buy your brass lantern. What's your price?", 'GameHud'), say('I offer 20.', 'GameHud')],
    expectComponents: ['GameHud'],
  },
]
