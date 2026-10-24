// T-0448 (round `.sdlc/evals/rounds/2026-10-24-r13-pattern/`, smoke-shopkeeper-browse-and-add-haiku-2, 2026-10-24.jsonl:42,43):
// Haiku 5.5 answered "Add the first one to my order." with a note-only reply targeting storefront-lamps, "Your total is now
// $189.", no surface line and no surface id in the prose, so the order total on screen stayed $0. Turn 1's round 1 is that
// recorded round verbatim; a targeted say reply that claims a change it never sent now keeps the full repair
// (CHANGE_CLAIMED, render_surface offered and forced), and round 2 is AUTHORED as the data-only add the -3 run sent (:80).
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { parseProbeFixture } from '../model.ts'
import { offlineReplay } from '../trace.ts'

const trace = (record) => record.lines.map((l) => JSON.parse(l).a2uiMeta?.trace).find((t) => t !== undefined)
const orderWrites = (record) =>
  record.lines.map((l) => JSON.parse(l)).filter((m) => m.updateDataModel?.surfaceId === 'storefront-lamps').map((m) => [m.updateDataModel.path, m.updateDataModel.value])

it('shopkeeper-haiku-add-claim-no-id: an add claimed in prose alone is repaired and the order total lands', async () => {
  const fixture = parseProbeFixture(readFileSync(new URL('./shopkeeper-haiku-add-claim-no-id.json', import.meta.url), 'utf8'))
  const report = await offlineReplay(fixture, process.cwd())
  expect(report.failed.map((c) => [c.check, c.turn ?? null])).toEqual([])
  expect(trace(report.records[1])).toMatchObject({ rounds: 2, failureCodes: ['CHANGE_CLAIMED'] })
  expect(orderWrites(report.records[1])).toEqual([['/order', { total: '$189' }]])
})
