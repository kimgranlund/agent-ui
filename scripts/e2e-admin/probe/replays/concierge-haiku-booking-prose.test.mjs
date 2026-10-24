// Built from the round 3 run regress-concierge-spa-booking-haiku-1 (T-0261), turns 0 to 2 (catalog agent-ui--hospitality).
// Keyless: the recorded model rounds replay through the real produce(), then the probe checks run with
// no browser. The browser leg is `npm run chat:probe -- --replay concierge-haiku-booking-prose.json` from this folder.
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { parseProbeFixture } from '../model.ts'
import { offlineReplay } from '../trace.ts'

// T-0265: Haiku 5.5 answers the spa services ask, the booking and its confirmation in prose with no surface. Each
// turn now gets SURFACE_MISSING. The fixture records no repaired round, so each ships tallied here; the confirm turn
// spends no FLOW_END_MISSING round (T-0309), and an uncorrected finding is never inferred closed.
// T-0442: the booking turn's recorded round declares ask-1 and nothing creates it (SURFACE_CLAIMED), so with no
// repaired round recorded the last round refuses it and that turn halts (live, the repair round is forced to render_surface).
it('concierge-haiku-booking-prose: the services and confirm turns answered in prose get SURFACE_MISSING, the booking ask halts', async () => {
  const fixture = parseProbeFixture(readFileSync(new URL('./concierge-haiku-booking-prose.json', import.meta.url), 'utf8'))
  const report = await offlineReplay(fixture, process.cwd())
  const codes = report.records.map((r) => r.lines.map((l) => JSON.parse(l).a2uiMeta?.trace).find((t) => t !== undefined)?.failureCodes)
  expect(codes).toEqual([['SURFACE_MISSING', 'SEMANTIC_UNCORRECTED'], undefined, ['SURFACE_MISSING', 'SEMANTIC_UNCORRECTED']])
  expect(report.failed.map((c) => [c.check, c.turn ?? null])).toEqual([['no-halt', 1]])
  expect(report.failed[0].detail).toContain('SURFACE_CLAIMED')
})
