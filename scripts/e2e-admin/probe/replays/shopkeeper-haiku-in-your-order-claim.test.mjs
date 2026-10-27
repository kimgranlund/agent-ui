// T-0478 (round `.sdlc/evals/rounds/2026-10-26-r15-pattern/`, cluster P4, smoke-shopkeeper-browse-and-add-haiku-1,
// 2026-10-27.jsonl:6,7): Haiku 5.5 answered "Add the first one to my order." with a meta line targeting shop-1, the prose
// "The Brass Arc Floor Lamp is in your order at $189." and no tool call, so the order never reached a surface.
// CHANGE_CLAIM_IN_REPLY had no "is in your order", so the reply shipped on round 1. Turn 1's round 1 is that recorded
// round verbatim; the claim now keeps the full repair (CHANGE_CLAIMED, render_surface offered and forced), and round 2
// is AUTHORED as the order opened as one ConfirmReceipt with an AmountPicker line, the shape the -1 run of the cart cell sent.
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { parseProbeFixture } from '../model.ts'
import { offlineReplay } from '../trace.ts'

const trace = (record) => record.lines.map((l) => JSON.parse(l).a2uiMeta?.trace).find((t) => t !== undefined)

it('shopkeeper-haiku-in-your-order-claim: "is in your order" with no update is CHANGE_CLAIMED, and the repair opens a ConfirmReceipt', async () => {
  const fixture = parseProbeFixture(readFileSync(new URL('./shopkeeper-haiku-in-your-order-claim.json', import.meta.url), 'utf8'))
  const report = await offlineReplay(fixture, process.cwd())
  expect(report.failed.map((c) => [c.check, c.turn ?? null])).toEqual([])
  expect(trace(report.records[1])).toMatchObject({ rounds: 2, failureCodes: ['CHANGE_CLAIMED'] })
})
