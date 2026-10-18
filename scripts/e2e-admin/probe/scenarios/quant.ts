// scripts/e2e-admin/probe/scenarios/quant.ts: The Quant's smoke scenario (T-0343), one turn on its signature composite.
// The `dashboard-kpi-grid` skill teaches a row of Stat tiles, then the chart, then the table, on ONE dashboard surface;
// each step's `expect` becomes `--expect-turn`. `plan.ts --tag smoke` plans it; `plan.test.mjs` checks every expected
// type is in the preset's catalog.

import type { ProbeStep } from '../model.ts'
import type { RoundScenario } from './round.ts'

const say = (text: string, ...expect: string[]): ProbeStep => (expect.length ? { say: text, expect } : { say: text })

export const QUANT_SCENARIOS: readonly RoundScenario[] = [
  {
    name: 'kpi-dashboard',
    tags: ['smoke'],
    steps: [say("Show me last quarter's revenue, active users and churn.", 'Stat')],
    expectComponents: ['Stat'],
  },
]
