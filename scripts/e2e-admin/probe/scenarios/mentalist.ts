// scripts/e2e-admin/probe/scenarios/mentalist.ts: The Mentalist's smoke scenario (T-0343), two turns on its signature
// composite. The `guess-hud` skill keeps the score on ONE GameHud beside a Timeline of asked questions; each step's
// `expect` becomes `--expect-turn`. `plan.ts --tag smoke` plans it; `plan.test.mjs` checks every expected type is in
// the preset's catalog.

import type { ProbeStep } from '../model.ts'
import type { RoundScenario } from './round.ts'

const say = (text: string, ...expect: string[]): ProbeStep => (expect.length ? { say: text, expect } : { say: text })

export const MENTALIST_SCENARIOS: readonly RoundScenario[] = [
  {
    name: 'first-answer',
    tags: ['smoke'],
    steps: [say("Let's play Twenty Questions. I'm thinking of something.", 'GameHud'), say('Yes.', 'GameHud')],
    expectComponents: ['GameHud'],
  },
]
