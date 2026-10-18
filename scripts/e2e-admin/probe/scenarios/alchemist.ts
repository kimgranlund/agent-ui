// scripts/e2e-admin/probe/scenarios/alchemist.ts: The Alchemist's smoke scenario (T-0343), one turn on its signature
// composite. The `color-duel` skill shows the target as a Swatch and the reveal as a Ramp, the score on ONE GameHud;
// each step's `expect` becomes `--expect-turn`. A guess is submitted through the ColorPicker, whose submit label the
// model writes, so a spoken mix is rightly refused (smoke round 2026-10-18, `traces/2026-10-18.jsonl:22`) and the smoke
// stops at the round's opening. `plan.ts --tag smoke` plans it; `plan.test.mjs` checks every expected type is in the
// preset's catalog.

import { say } from '../model.ts'
import type { RoundScenario } from './round.ts'


export const ALCHEMIST_SCENARIOS: readonly RoundScenario[] = [
  {
    name: 'first-round',
    tags: ['smoke'],
    steps: [say("Let's have a color duel.", 'Swatch')],
    expectComponents: ['Swatch', 'GameHud'],
  },
]
