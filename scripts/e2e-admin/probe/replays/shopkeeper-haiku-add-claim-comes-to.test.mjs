// T-0470 (round `.sdlc/evals/rounds/2026-10-26-r14-pattern/`, reach-shopkeeper-cart-amount-haiku-2, 2026-10-26.jsonl:137,138):
// Haiku 5.5 answered "Add two of the first one to my order and show me my cart." with a note-only reply targeting
// storefront-1, "Added two Brass Arc Floor Lamps at $189 each, so your order comes to $378.", no surface line and no tool
// call, so the cart stayed as it was. CHANGE_CLAIM_IN_REPLY had no "added" or "comes to", so the reply shipped on round 1.
// Turn 1's round 1 is that recorded round verbatim; the add claim now keeps the full repair (CHANGE_CLAIMED, render_surface
// offered and forced), and round 2 is AUTHORED as a data-only order write.
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { parseProbeFixture } from '../model.ts'
import { offlineReplay } from '../trace.ts'

const trace = (record) => record.lines.map((l) => JSON.parse(l).a2uiMeta?.trace).find((t) => t !== undefined)
const orderWrites = (record) =>
  record.lines.map((l) => JSON.parse(l)).filter((m) => m.updateDataModel?.surfaceId === 'storefront-1').map((m) => [m.updateDataModel.path, m.updateDataModel.value])

it('shopkeeper-haiku-add-claim-comes-to: an add claimed in prose alone ("Added ... comes to") is repaired and the order write lands', async () => {
  const fixture = parseProbeFixture(readFileSync(new URL('./shopkeeper-haiku-add-claim-comes-to.json', import.meta.url), 'utf8'))
  const report = await offlineReplay(fixture, process.cwd())
  expect(report.failed.map((c) => [c.check, c.turn ?? null])).toEqual([])
  expect(trace(report.records[1])).toMatchObject({ rounds: 2, failureCodes: ['CHANGE_CLAIMED'] })
  expect(orderWrites(report.records[1])).toEqual([['/order', { total: '$378' }]])
})
