// Built from the round 3 run regress-admiral-row-sweep-haiku-1 (T-0261), turns 0 to 2 (catalog agent-ui).
// Keyless: the recorded model rounds replay through the real produce(), then the probe checks run with
// no browser. The browser leg is `npm run chat:probe -- --replay admiral-haiku-shot-prose.json` from this folder.
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { parseProbeFixture } from '../model.ts'
import { offlineReplay } from '../trace.ts'

// T-0265: turn 2 ("Fire at A2.") targets enemy-waters in its meta-line and resolves the shot in prose with no
// update, so the board keeps its old marks. The shot check now sends it back with ACTION_NOT_APPLIED, and the probe's
// action-updates-surface judges the targeted say turn. The fixture records no repaired round, so both stay red here.
it('admiral-haiku-shot-prose: the prose-only "Fire at A2." gets ACTION_NOT_APPLIED and fails action-updates-surface', async () => {
  const fixture = parseProbeFixture(readFileSync(new URL('./admiral-haiku-shot-prose.json', import.meta.url), 'utf8'))
  const report = await offlineReplay(fixture, process.cwd())
  expect(report.failed.map((c) => `${c.check}:${c.turn}`)).toEqual(['action-updates-surface:2'])
  const codes = report.records.map((r) => r.lines.map((l) => JSON.parse(l).a2uiMeta?.trace).find((t) => t !== undefined)?.failureCodes)
  expect(codes[1]).toEqual([]) // the shot that updated enemy-waters passes
  expect(codes[2]).toEqual(['ACTION_NOT_APPLIED', 'SEMANTIC_UNCORRECTED'])
})
