// T-0591 (round `.sdlc/evals/rounds/2026-10-29-r21-pattern/`, reach-shopkeeper-cart-amount-haiku-2,
// 2026-10-29.jsonl:138 and :139): on "Add two of the first one to my order and show me my cart." Haiku 5.5 sent
// render_surface rounds 2 and 3 as the same JSON string, one `}` too many after the ConfirmReceipt's backAction where
// the `]` of `components` belongs, so both were PARSE and the cart never shipped. A string whose only defect is one
// surplus closer drops it, so recorded rounds 2 and 3 decode and the turn ships the ConfirmReceipt.
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { parseProbeFixture } from '../model.ts'
import { offlineReplay } from '../trace.ts'
import { shipped, trace } from './unclosed-array.mjs'

const fixture = parseProbeFixture(readFileSync(new URL('./shopkeeper-haiku-cart-string-surplus.json', import.meta.url), 'utf8'))

it('shopkeeper-haiku-cart-string-surplus: the surplus closer is dropped and the add turn ships the ConfirmReceipt', async () => {
  const report = await offlineReplay(fixture, process.cwd())
  expect(report.failed.map((c) => [c.check, c.turn ?? null])).toEqual([])
  expect(trace(report.records[1]).failureCodes).toContain('MESSAGES_STRING_DECODED')
  expect(trace(report.records[1]).failureCodes).not.toContain('PARSE')
  expect(shipped(report.records[1])).toContain('ConfirmReceipt')
})
