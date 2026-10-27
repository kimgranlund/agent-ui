// T-0448 (round `.sdlc/evals/rounds/2026-10-24-r13-pattern/`, reach-concierge-day-itinerary-haiku-3, 2026-10-24.jsonl:149):
// Haiku 5.5 planned a Saturday in prose and ended with a meta-line whose target names trip-saturday, a surface nothing ever
// created, and the producer shipped the prose clean on round 1. Round 1 is that recorded round verbatim (its weather call
// replays as text alone); SURFACE_CLAIMED now reads the meta target too, so it keeps the full repair (render_surface
// offered and forced), and round 2 is AUTHORED from the -1 run's (:120) Itinerary call, its surface renamed trip-saturday.
// T-0480: the say turn plans three timed stops, so the Itinerary row now sends round 1 back first (ITINERARY_MISSING, a
// semantic finding judged ahead of SURFACE_CLAIMED), with the same forced repair; T-0448's own cases stay in
// produce-narration.test.ts.
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { parseProbeFixture } from '../model.ts'
import { offlineReplay } from '../trace.ts'

const trace = (record) => record.lines.map((l) => JSON.parse(l).a2uiMeta?.trace).find((t) => t !== undefined)
const componentsOn = (lines, sid) =>
  lines.map((l) => JSON.parse(l)).filter((m) => m.updateComponents?.surfaceId === sid).flatMap((m) => m.updateComponents.components.map((c) => c.component))

it('concierge-haiku-itinerary-target-claim: a reply targeting a surface it never creates is repaired and the Itinerary lands', async () => {
  const fixture = parseProbeFixture(readFileSync(new URL('./concierge-haiku-itinerary-target-claim.json', import.meta.url), 'utf8'))
  const report = await offlineReplay(fixture, process.cwd())
  expect(report.failed.map((c) => [c.check, c.turn ?? null])).toEqual([])
  expect(trace(report.records[0])).toMatchObject({ rounds: 2, failureCodes: ['ITINERARY_MISSING'] })
  expect(componentsOn(report.records[0].lines, 'trip-saturday')).toEqual(['Itinerary'])
})
