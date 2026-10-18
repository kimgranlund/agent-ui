// scripts/e2e-admin/probe/scenarios/alchemist.ts: The Alchemist's smoke scenario (T-0343), two turns on its signature
// composite. The `color-duel` skill shows the target as a Swatch and the reveal as a Ramp, the score on ONE GameHud;
// each step's `expect` becomes `--expect-turn`. `plan.ts --tag smoke` plans it; `plan.test.mjs` checks every expected
// type is in the preset's catalog.

import type { ProbeStep } from '../model.ts'
import type { RoundScenario } from './round.ts'

const say = (text: string, ...expect: string[]): ProbeStep => (expect.length ? { say: text, expect } : { say: text })

export const ALCHEMIST_SCENARIOS: readonly RoundScenario[] = [
  {
    name: 'first-round',
    tags: ['smoke'],
    steps: [say("Let's have a color duel.", 'Swatch'), say('My mix is a deep teal.', 'Ramp', 'Swatch')],
    expectComponents: ['Swatch', 'GameHud'],
  },
]
