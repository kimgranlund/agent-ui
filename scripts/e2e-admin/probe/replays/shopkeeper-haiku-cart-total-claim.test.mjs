// T-0583 (round `.sdlc/evals/rounds/2026-10-29-r19-pattern/`, cluster Z, reach-shopkeeper-cart-amount-haiku-1,
// 2026-10-29.jsonl:123,124, converted with `npm run chat:probe -- --from-trace`): Haiku 5.5 answered "Add two of the
// first one to my order and show me my cart." with a meta line targeting storefront-1, the prose "You've got two Brass
// Desk Lamps in your order, at $68 each. Your cart total is $136." and no tool call. CHANGE_CLAIM_IN_REPLY had neither
// "'ve got ... in your order" nor "total is $N", so the reply shipped note-only on round 1 and action-updates-surface
// failed. Turn 1's round 1 is that recorded round verbatim; the claim now keeps the full repair (CHANGE_CLAIMED,
// render_surface offered and forced), and round 2 is AUTHORED as the cart opened as one ConfirmReceipt with an
// AmountPicker line, the shape shopkeeper-haiku-in-your-order-claim's repair sends.
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { parseProbeFixture } from '../model.ts'
import { offlineReplay } from '../trace.ts'
import { shipped, trace } from './unclosed-array.mjs'

it('shopkeeper-haiku-cart-total-claim: "you\'ve got ... in your order" and "total is $136" with no update is CHANGE_CLAIMED, and the repair opens a ConfirmReceipt', async () => {
  const fixture = parseProbeFixture(readFileSync(new URL('./shopkeeper-haiku-cart-total-claim.json', import.meta.url), 'utf8'))
  expect(fixture.turns[1].rounds[0].text).toContain("You've got two Brass Desk Lamps in your order, at $68 each. Your cart total is $136.")
  const report = await offlineReplay(fixture, process.cwd())
  expect(report.failed.map((c) => [c.check, c.turn ?? null])).toEqual([])
  expect(trace(report.records[1])).toMatchObject({ rounds: 2, failureCodes: ['CHANGE_CLAIMED'] })
  expect(shipped(report.records[1])).toContain('ConfirmReceipt')
})
