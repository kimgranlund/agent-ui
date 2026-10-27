// T-0480 (round `.sdlc/evals/rounds/2026-10-26-r15-pattern/`, cluster Y, reach-concierge-day-itinerary-haiku-3, report
// row :150): Haiku 5.5 answered "Plan my Saturday 21 November 2026: breakfast at 08:00, the half-day coastal boat tour at
// 10:00 and dinner at Vela at 20:00." with the plan as a prose list and a note asking the party size (round 1), and the
// repair round built only that ask, an OptionDeck of party sizes on ask-1, which shipped: the plan never reached a
// surface. Rounds 1 and 2 are those recorded rounds verbatim; the Itinerary composite-moment row now sends both back
// (ITINERARY_MISSING, naming ask-1 on round 2), and round 3 is AUTHORED as the day plan as one Itinerary on its own
// surface, plan-1, which retires the named ask-1 (SURFACE_REPLACED).
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { parseProbeFixture } from '../model.ts'
import { offlineReplay } from '../trace.ts'

const trace = (record) => record.lines.map((l) => JSON.parse(l).a2uiMeta?.trace).find((t) => t !== undefined)

it('concierge-haiku-day-plan-no-itinerary: a day plan of timed stops answered with no Itinerary draws ITINERARY_MISSING, and the repair builds one', async () => {
  const fixture = parseProbeFixture(readFileSync(new URL('./concierge-haiku-day-plan-no-itinerary.json', import.meta.url), 'utf8'))
  const report = await offlineReplay(fixture, process.cwd())
  expect(report.failed.map((c) => [c.check, c.turn ?? null])).toEqual([])
  expect(trace(report.records[0])).toMatchObject({ rounds: 3, failureCodes: ['ITINERARY_MISSING', 'SURFACE_REPLACED'], replaced: [{ surfaceId: 'ask-1', by: 'plan-1' }] })
})
