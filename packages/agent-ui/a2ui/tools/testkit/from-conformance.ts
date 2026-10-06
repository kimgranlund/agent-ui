// from-conformance.ts: run a `conformance/fixtures.jsonl` row through the kit's judge (T-0011). A field
// copy: `name`, `description`, `catalogId`, `intent: row.name`, and one `lines` turn with the payload's
// messages as lines, `atFinalize`, and `expect.verdict: row.expectedVerdict`.
//
// The suite's one raw-text row (`parse-failure`, payload `"{not valid json"`) is not an array. A string
// payload becomes one raw line, and its turn carries `expect.heal.ok`, false exactly when the expected
// verdict holds a `PARSE` failure (the suite's code for "the text did not parse", which is the heal stage
// here). The verdict then reaches that line through the validator's own text arm, so the row's
// `PARSE` at `""` is judged natively, never synthesized. Browser-safe.

import type { A2uiScenario, ScenarioTurn } from './scenario.ts'

/** One row of `packages/agent-ui/a2ui/conformance/fixtures.jsonl` (`tools/conformance/run.ts` `Fixture`). */
export interface ConformanceRow {
  name: string
  description: string
  catalogId: string
  payload: unknown
  expectedVerdict: { valid: boolean; failures: { code: string; path: string }[] }
  atFinalize?: boolean
}

export function fromConformanceFixture(row: ConformanceRow): A2uiScenario {
  const turn: ScenarioTurn = { respond: { lines: [] }, expect: { verdict: row.expectedVerdict } }
  if (Array.isArray(row.payload)) {
    turn.respond = { lines: row.payload.map((m) => (typeof m === 'string' ? m : JSON.stringify(m))) }
  } else if (typeof row.payload === 'string') {
    turn.respond = { lines: [row.payload] }
    turn.expect!.heal = { ok: !row.expectedVerdict.failures.some((f) => f.code === 'PARSE') }
  } else {
    turn.respond = { lines: [JSON.stringify(row.payload)] }
  }
  if (row.atFinalize === true) turn.atFinalize = true
  return {
    kind: 'agent-ui-a2ui-scenario',
    version: 1,
    name: row.name,
    description: row.description,
    catalogId: row.catalogId,
    intent: row.name,
    turns: [turn],
  }
}
