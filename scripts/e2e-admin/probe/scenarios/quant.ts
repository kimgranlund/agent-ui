// scripts/e2e-admin/probe/scenarios/quant.ts: The Quant's smoke scenario (T-0343), one turn on its signature composite.
// The `dashboard-kpi-grid` skill teaches a row of Stat tiles, then the chart, then the table, on ONE dashboard surface;
// each step's `expect` becomes `--expect-turn`. The ask carries its figures: the persona will not invent numbers, and
// Haiku 5.5 rightly asked for them on a bare ask (smoke round 2026-10-18, `traces/2026-10-18.jsonl:3`). `plan.ts --tag
// smoke` plans it; `plan.test.mjs` checks every expected type is in the preset's catalog.

import { say } from '../model.ts'
import type { RoundScenario } from './round.ts'


export const QUANT_SCENARIOS: readonly RoundScenario[] = [
  {
    name: 'kpi-dashboard',
    tags: ['smoke'],
    steps: [say("Last quarter: revenue $1.2M, up 8%; active users 48,000, up 3%; churn 2.1%, down 0.4 points. Put it on a dashboard.", 'Stat')],
    expectComponents: ['Stat'],
  },
]
