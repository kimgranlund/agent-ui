// T-0478 (round `.sdlc/evals/rounds/2026-10-26-r15-pattern/`, cluster P4, reach-shopkeeper-cart-amount-haiku-2,
// 2026-10-27.jsonl:139,140): Haiku 5.5 answered "Add two of the first one to my order and show me my cart." with a
// note-only add claim (CHANGE_CLAIMED, round 1), and the repair round updated storefront-1 with an order Column of one AmountPicker
// line and a total Text, no ConfirmReceipt, which shipped: no check named the missing receipt. Turn 1's rounds 1 and 2 are
// those recorded rounds verbatim; the ConfirmReceipt composite-moment row now sends round 2 back (CONFIRM_RECEIPT_MISSING),
// and round 3 is AUTHORED as the order column remade as one ConfirmReceipt with its AmountPicker line. The trace carries
// the codes the shipping round was sent back with, so it reads CONFIRM_RECEIPT_MISSING alone.
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { parseProbeFixture } from '../model.ts'
import { offlineReplay } from '../trace.ts'

const trace = (record) => record.lines.map((l) => JSON.parse(l).a2uiMeta?.trace).find((t) => t !== undefined)

it('shopkeeper-haiku-add-no-receipt: an order column with no ConfirmReceipt draws CONFIRM_RECEIPT_MISSING, and the repair builds one', async () => {
  const fixture = parseProbeFixture(readFileSync(new URL('./shopkeeper-haiku-add-no-receipt.json', import.meta.url), 'utf8'))
  const report = await offlineReplay(fixture, process.cwd())
  expect(report.failed.map((c) => [c.check, c.turn ?? null])).toEqual([])
  expect(trace(report.records[1])).toMatchObject({ rounds: 3, failureCodes: ['CONFIRM_RECEIPT_MISSING'] })
})
