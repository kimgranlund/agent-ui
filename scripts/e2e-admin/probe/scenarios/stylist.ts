// scripts/e2e-admin/probe/scenarios/stylist.ts: The Stylist's smoke scenario (T-0343), one turn on its signature
// composite. The `palette-presentation` skill renders anchors as Swatches and each family as one Ramp; each step's
// `expect` becomes `--expect-turn`. The oracle is the step's any-of, Swatch or Ramp: a run-level `--expect-component`
// requires every type it lists, so the run names none. `plan.ts --tag smoke` plans it; `plan.test.mjs` checks every
// expected type is in the preset's catalog.

import { say } from '../model.ts'
import type { RoundScenario } from './round.ts'


export const STYLIST_SCENARIOS: readonly RoundScenario[] = [
  {
    name: 'palette',
    tags: ['smoke'],
    steps: [say('Propose a calm blue palette for a banking app.', 'Swatch', 'Ramp')],
    expectComponents: [],
  },
]
