// T-0550 (round `.sdlc/evals/rounds/2026-10-29-r17-pattern/`, cluster P5, reach-shopkeeper-cart-amount-haiku-3,
// 2026-10-29.jsonl:153,154): Haiku 5.5 answered "Add two of the first one to my order and show me my cart." with a
// note-only add claim (CHANGE_CLAIMED, round 1), and the repair round resent shop-lamps-1 with an `order` ConfirmReceipt
// whose item quantity binds `/lamp/qty` and no AmountPicker writing it, while the reply said "Adjust the quantity below".
// It shipped: only the scenario oracle missed the AmountPicker. Turn 1's rounds 1 and 2 are those recorded rounds
// verbatim, re-derived with `--from-trace`; the AmountPicker composite-moment row now sends round 2 back
// (SURFACE_MISSING), and round 3 is AUTHORED as round 2 with one AmountPicker bound to `/lamp/qty` beside the receipt.
// The trace carries the codes the shipping round was sent back with, so it reads SURFACE_MISSING alone.
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { parseProbeFixture } from '../model.ts'
import { offlineReplay } from '../trace.ts'

const trace = (record) => record.lines.map((l) => JSON.parse(l).a2uiMeta?.trace).find((t) => t !== undefined)

it('shopkeeper-haiku-receipt-no-picker: a cart ConfirmReceipt with an unpicked bound quantity draws SURFACE_MISSING, and the repair adds the AmountPicker', async () => {
  const fixture = parseProbeFixture(readFileSync(new URL('./shopkeeper-haiku-receipt-no-picker.json', import.meta.url), 'utf8'))
  const report = await offlineReplay(fixture, process.cwd())
  expect(report.failed.map((c) => [c.check, c.turn ?? null])).toEqual([])
  expect(trace(report.records[1])).toMatchObject({ rounds: 3, failureCodes: ['SURFACE_MISSING'] })
  const shipped = report.records[1].lines.flatMap((l) => JSON.parse(l).updateComponents?.components ?? [])
  expect(shipped.find((c) => c.component === 'AmountPicker')?.value).toEqual({ path: '/lamp/qty' })
})
