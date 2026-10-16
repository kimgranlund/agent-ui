// Built from the round 4 live run `regress-croupier-omaha-haiku-1` (2026-10-15-r4-fixes, traces 2026-10-16.jsonl:51 to :55,
// catalog agent-ui--croupier), its turns 0 to 4 (the Deal again click recorded no rounds).
// Keyless: the recorded model rounds replay through the real produce(), then the probe checks run with no browser.
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { parseProbeFixture } from '../model.ts'
import { offlineReplay } from '../trace.ts'

// T-0286. Live round 4 (:51 to :55, Haiku 5.5). The flop, turn and river checks update table-1, but the last "Check, or
// call if there is a bet." is answered with the showdown in prose, no target and no surface. The croupier action check
// now finds table-1 still offering Check and sends it back with ACTION_NOT_APPLIED. The fixture records no repaired
// round, so it ships tallied here; the street turns that update the table stay quiet.
it('croupier-omaha-haiku-street-prose: the prose-only river check gets ACTION_NOT_APPLIED, the updating streets none', async () => {
  const fixture = parseProbeFixture(readFileSync(new URL('./croupier-omaha-haiku-street-prose.json', import.meta.url), 'utf8'))
  const report = await offlineReplay(fixture, process.cwd())
  expect(report.failed.map((c) => `${c.check}:${c.turn}`)).toEqual([])
  const traces = report.records.map((r) => r.lines.map((l) => JSON.parse(l).a2uiMeta?.trace).find((t) => t !== undefined))
  expect(traces.map((t) => t.failureCodes)).toEqual([['SURFACE_MISSING'], [], [], [], ['ACTION_NOT_APPLIED', 'SEMANTIC_UNCORRECTED']])
})
