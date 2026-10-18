// scripts/e2e-admin/probe/scenarios/stylist.ts: The Stylist's smoke scenario (T-0343), one turn on its signature
// composite. The `palette-presentation` skill renders anchors as Swatches and each family as one Ramp; each step's
// `expect` becomes `--expect-turn`. `plan.ts --tag smoke` plans it; `plan.test.mjs` checks every expected type is in
// the preset's catalog.

import type { ProbeStep } from '../model.ts'
import type { RoundScenario } from './round.ts'

const say = (text: string, ...expect: string[]): ProbeStep => (expect.length ? { say: text, expect } : { say: text })

export const STYLIST_SCENARIOS: readonly RoundScenario[] = [
  {
    name: 'palette',
    tags: ['smoke'],
    steps: [say('Propose a calm blue palette for a banking app.', 'Swatch', 'Ramp')],
    expectComponents: ['Swatch'],
  },
]
