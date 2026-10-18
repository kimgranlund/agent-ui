// scripts/e2e-admin/probe/scenarios/dungeon-master.ts: The Dungeon Master's smoke scenario (T-0343), two turns on its
// signature composite. The `quest-log` skill keeps HP and Gold on ONE GameHud beside a Timeline quest log; each step's
// `expect` becomes `--expect-turn`. `plan.ts --tag smoke` plans it; `plan.test.mjs` checks every expected type is in
// the preset's catalog.

import type { ProbeStep } from '../model.ts'
import type { RoundScenario } from './round.ts'

const say = (text: string, ...expect: string[]): ProbeStep => (expect.length ? { say: text, expect } : { say: text })

export const DUNGEON_MASTER_SCENARIOS: readonly RoundScenario[] = [
  {
    name: 'first-scene',
    tags: ['smoke'],
    steps: [say('Start the adventure.', 'GameHud'), say('I open the door and step inside.', 'GameHud')],
    expectComponents: ['GameHud', 'Timeline'],
  },
]
