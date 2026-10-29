// T-0582 (live round 19 cluster P4b, `.sdlc/evals/rounds/2026-10-29-r19-pattern/`, smoke-shopkeeper-browse-and-add-haiku-2,
// traces 2026-10-29.jsonl:42 and :43, converted with `npm run chat:probe -- --from-trace`): on "Add the first one to my
// order." round 1 answers a note claiming the add (CHANGE_CLAIMED), and the repair round resends shop-1 with an `order`
// Card holding a DescriptionList line, an AmountPicker "Brass Desk Lamp quantity" and a "Total: $68" Text, no
// ConfirmReceipt. No surface word names an order (only ids and the reply, "Your order summary is below the shelf"), so it
// shipped. The fixture is the recorded run verbatim; the ConfirmReceipt row now reads the reply's words and sends round 2
// back (CONFIRM_RECEIPT_MISSING), and round 3 is AUTHORED as round 2 with the Card replaced by one ConfirmReceipt whose
// quantity binds `/order/qty`, beside the AmountPicker bound to it.
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { parseProbeFixture } from '../model.ts'
import { offlineReplay } from '../trace.ts'
import { shipped, trace } from './unclosed-array.mjs'

const fixture = parseProbeFixture(readFileSync(new URL('./shopkeeper-haiku-order-card-reply-words.json', import.meta.url), 'utf8'))
const [round1, round2] = fixture.turns[1].rounds

it('shopkeeper-haiku-order-card-reply-words: a hand-built order Card whose reply names the order draws CONFIRM_RECEIPT_MISSING', async () => {
  expect(round2.tools[0].input.reply).toContain('Your order summary')
  const report = await offlineReplay(fixture, process.cwd())
  expect(trace(report.records[1]).failureCodes).toContain('CONFIRM_RECEIPT_MISSING')
})

it('shopkeeper-haiku-order-card-reply-words: a round 3 with one ConfirmReceipt beside the AmountPicker ships clean', async () => {
  const input = round2.tools[0].input
  const dropped = new Set(['order_content', 'order_lines', 'order_total'])
  const components = input.messages[0].updateComponents.components
    .filter((c) => !dropped.has(c.id))
    .map((c) => {
      if (c.id === 'root') return { ...c, children: [...c.children, 'order_picker'] }
      if (c.id === 'order') return { id: 'order', component: 'ConfirmReceipt', title: 'Your order', items: [{ label: 'Brass Desk Lamp', quantity: { path: '/order/qty' }, amount: '$68' }], totalLabel: 'Total', totalPath: '/order/total', status: 'pending', confirmAction: { action: 'confirm_order' }, backAction: { action: 'back' } }
      if (c.id === 'order_picker') return { id: c.id, component: 'AmountPicker', label: c.label, value: { path: '/order/qty' }, min: 1, step: 1 }
      return c
    })
  const data = { version: 'v1.0', updateDataModel: { surfaceId: 'shop-1', path: '/order', value: { qty: 1, total: '$68' } } }
  const messages = [{ ...input.messages[0], updateComponents: { ...input.messages[0].updateComponents, components } }, data]
  const authored = { text: '', tools: [{ name: 'render_surface', input: { ...input, messages } }] }
  const turn = { ...fixture.turns[1], rounds: [round1, round2, authored] }
  const report = await offlineReplay({ ...fixture, turns: [fixture.turns[0], turn] }, process.cwd())
  expect(report.failed.map((c) => [c.check, c.turn ?? null])).toEqual([])
  expect(trace(report.records[1])).toMatchObject({ rounds: 3 })
  expect(trace(report.records[1]).failureCodes).toContain('CONFIRM_RECEIPT_MISSING')
  expect(trace(report.records[1]).failureCodes).not.toContain('SEMANTIC_UNCORRECTED')
  expect(shipped(report.records[1])).toContain('ConfirmReceipt')
})
