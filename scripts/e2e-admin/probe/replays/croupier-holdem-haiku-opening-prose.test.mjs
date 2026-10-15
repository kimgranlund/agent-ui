// Built from the round 3 run regress-croupier-texas-holdem-haiku-1 (T-0261), turn 0 (catalog agent-ui--croupier).
// Keyless: the recorded model rounds replay through the real produce(), then the probe checks run with
// no browser. The browser leg is `npm run chat:probe -- --replay croupier-holdem-haiku-opening-prose.json` from this folder.
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { parseProbeFixture } from '../model.ts'
import { offlineReplay } from '../trace.ts'

// T-0265: "Let's play Texas hold'em." was dealt in prose ("Your hole cards are A♥ K♦") with no table. The opening
// check now sends it back with SURFACE_MISSING. The fixture records no repaired round, so it ships tallied here.
it('croupier-holdem-haiku-opening-prose: the opening dealt in prose gets SURFACE_MISSING', async () => {
  const fixture = parseProbeFixture(readFileSync(new URL('./croupier-holdem-haiku-opening-prose.json', import.meta.url), 'utf8'))
  const report = await offlineReplay(fixture, process.cwd())
  const trace = report.records[0].lines.map((l) => JSON.parse(l).a2uiMeta?.trace).find((t) => t !== undefined)
  expect(trace.failureCodes).toEqual(['SURFACE_MISSING', 'SEMANTIC_UNCORRECTED'])
})
