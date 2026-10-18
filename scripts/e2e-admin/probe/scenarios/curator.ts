// scripts/e2e-admin/probe/scenarios/curator.ts: The Curator's smoke scenario (T-0343), one turn on its signature
// composite. The `collection-carousel` skill puts one SwiperItem per option in ONE Swiper; each step's `expect` becomes
// `--expect-turn`. `plan.ts --tag smoke` plans it; `plan.test.mjs` checks every expected type is in the preset's
// catalog.

import { say } from '../model.ts'
import type { RoundScenario } from './round.ts'


export const CURATOR_SCENARIOS: readonly RoundScenario[] = [
  {
    name: 'collection',
    tags: ['smoke'],
    steps: [say('Show me five museums worth visiting in Lisbon.', 'Swiper')],
    expectComponents: ['Swiper'],
  },
]
