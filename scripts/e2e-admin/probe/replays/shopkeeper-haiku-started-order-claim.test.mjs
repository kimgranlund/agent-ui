// T-0585 (round `.sdlc/evals/rounds/2026-10-29-r20-pattern/`, cluster Z, smoke-shopkeeper-browse-and-add-haiku-2,
// 2026-10-29.jsonl:42,43, converted with `npm run chat:probe -- --from-trace`): Haiku 5.5 answered "Add the first one to
// my order." with the prose "...so I've started your order on this same page." and a trailing meta line whose note
// "Added the Brass Dome Table Lamp to your order." targets storefront-1, and no tool call. Only the prose was tested
// against CHANGE_CLAIM_IN_REPLY, which had no "started your order", so the reply shipped note-only on round 1 and
// action-updates-surface failed. Turn 1's round 1 is that recorded round verbatim; the claim now keeps the full repair
// (CHANGE_CLAIMED, render_surface offered and forced), and round 2 is AUTHORED as the order opened as one ConfirmReceipt
// with an AmountPicker line, the shape shopkeeper-haiku-cart-total-claim's repair sends.
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { parseProbeFixture } from '../model.ts'
import { offlineReplay } from '../trace.ts'
import { shipped, trace } from './unclosed-array.mjs'

it('shopkeeper-haiku-started-order-claim: "I\'ve started your order" with an "Added" meta note and no update is CHANGE_CLAIMED, and the repair opens a ConfirmReceipt', async () => {
  const fixture = parseProbeFixture(readFileSync(new URL('./shopkeeper-haiku-started-order-claim.json', import.meta.url), 'utf8'))
  expect(fixture.turns[1].rounds[0].text).toContain("so I've started your order on this same page.")
  expect(fixture.turns[1].rounds[0].text).toContain('"note":"Added the Brass Dome Table Lamp to your order."')
  const report = await offlineReplay(fixture, process.cwd())
  expect(report.failed.map((c) => [c.check, c.turn ?? null])).toEqual([])
  expect(trace(report.records[1])).toMatchObject({ rounds: 2, failureCodes: ['CHANGE_CLAIMED'] })
  expect(shipped(report.records[1])).toContain('ConfirmReceipt')
})
