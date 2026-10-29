// T-0582 (live round 19 cluster P5b, `.sdlc/evals/rounds/2026-10-29-r19-pattern/`, reach-shopkeeper-cart-amount-haiku-3,
// traces 2026-10-29.jsonl:153 and :154, converted with `npm run chat:probe -- --from-trace`): round 1 answers a note
// claiming the add (CHANGE_CLAIMED), round 2 an unparseable render_surface string (CHANGE_CLAIMED plus PARSE, still
// forced under T-0578), and round 3, the last, resends storefront-1 with an `order` ConfirmReceipt whose quantity is a
// `rows` line at `/order/brass` (2 in the data) and no AmountPicker, while the reply says "Adjust the quantity below".
// The verbatim fixture now ships round 3 with SEMANTIC_UNCORRECTED, since a finding on the last round never halts (the
// composite-moments unit test on the same payload and reply names the row). The
// recovery leg drops the PARSE round, so recorded round 3 is round 2 and draws SURFACE_MISSING, and its round 3 is AUTHORED
// as recorded round 3 with one AmountPicker bound to `/order/brass` beside the receipt.
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { parseProbeFixture } from '../model.ts'
import { offlineReplay } from '../trace.ts'
import { trace } from './unclosed-array.mjs'

const fixture = parseProbeFixture(readFileSync(new URL('./shopkeeper-haiku-receipt-rows-qty.json', import.meta.url), 'utf8'))
const [round1, , round3] = fixture.turns[1].rounds
const shippedComponents = (record) => record.lines.flatMap((l) => JSON.parse(l).updateComponents?.components ?? [])

it('shopkeeper-haiku-receipt-rows-qty: the recorded last round, a rows quantity with no picker, is tallied SEMANTIC_UNCORRECTED', async () => {
  expect(round3.tools[0].input.reply).toContain('Adjust the quantity below')
  const report = await offlineReplay(fixture, process.cwd())
  expect(trace(report.records[1]).failureCodes).toEqual(['CHANGE_CLAIMED', 'PARSE', 'SEMANTIC_UNCORRECTED'])
})

it('shopkeeper-haiku-receipt-rows-qty: with the PARSE round dropped, the rows receipt draws SURFACE_MISSING and a picker beside it ships clean', async () => {
  const input = round3.tools[0].input
  const components = input.messages[0].updateComponents.components.map((c) => (c.id === 'root' ? { ...c, children: [...c.children, 'qty_brass'] } : c))
  components.push({ id: 'qty_brass', component: 'AmountPicker', label: 'Brass Arc Floor Lamp quantity', value: { path: '/order/brass' }, min: 1, step: 1 })
  const messages = [{ ...input.messages[0], updateComponents: { ...input.messages[0].updateComponents, components } }, ...input.messages.slice(1)]
  const authored = { text: '', tools: [{ name: 'render_surface', input: { ...input, messages } }] }
  const turn = { ...fixture.turns[1], rounds: [round1, round3, authored] }
  const report = await offlineReplay({ ...fixture, turns: [fixture.turns[0], turn] }, process.cwd())
  expect(report.failed.map((c) => [c.check, c.turn ?? null])).toEqual([])
  expect(trace(report.records[1])).toMatchObject({ rounds: 3 })
  expect(trace(report.records[1]).failureCodes).toContain('SURFACE_MISSING')
  expect(trace(report.records[1]).failureCodes).not.toContain('SEMANTIC_UNCORRECTED')
  expect(shippedComponents(report.records[1]).find((c) => c.component === 'AmountPicker')?.value).toEqual({ path: '/order/brass' })
})
