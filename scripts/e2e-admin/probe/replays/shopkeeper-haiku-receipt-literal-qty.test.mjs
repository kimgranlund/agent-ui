// T-0582 (live round 19 cluster P5b, `.sdlc/evals/rounds/2026-10-29-r19-pattern/`, reach-shopkeeper-cart-amount-haiku-2,
// traces 2026-10-29.jsonl:138 and :139, converted with `npm run chat:probe -- --from-trace`): on "Add two of the first one
// to my order and show me my cart." round 1 answers a note claiming the add (CHANGE_CLAIMED), and the repair round resends
// storefront-1 with an `order` ConfirmReceipt whose item quantity is the literal 2 and no AmountPicker, while the reply
// says "You can change the quantity below". It shipped. The fixture is the recorded run verbatim; the AmountPicker row now
// sends round 2 back (SURFACE_MISSING), and round 3 is AUTHORED as round 2 with the quantity bound to `/order/qty` and one
// AmountPicker bound to it beside the receipt.
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { parseProbeFixture } from '../model.ts'
import { offlineReplay } from '../trace.ts'
import { trace } from './unclosed-array.mjs'

const fixture = parseProbeFixture(readFileSync(new URL('./shopkeeper-haiku-receipt-literal-qty.json', import.meta.url), 'utf8'))
const [round1, round2] = fixture.turns[1].rounds
const shippedComponents = (record) => record.lines.flatMap((l) => JSON.parse(l).updateComponents?.components ?? [])

it('shopkeeper-haiku-receipt-literal-qty: the literal receipt quantity with a quantity-change reply draws SURFACE_MISSING', async () => {
  const input = round2.tools[0].input
  expect(input.reply).toContain('change the quantity below')
  expect(input.messages[0].updateComponents.components.find((c) => c.id === 'order').items[0].quantity).toBe(2)
  const report = await offlineReplay(fixture, process.cwd())
  expect(trace(report.records[1]).failureCodes).toContain('SURFACE_MISSING')
})

it('shopkeeper-haiku-receipt-literal-qty: a round 3 that binds the quantity and adds its AmountPicker ships clean', async () => {
  const input = round2.tools[0].input
  const components = input.messages[0].updateComponents.components.map((c) => {
    if (c.id === 'root') return { ...c, children: [...c.children, 'qty_arc'] }
    if (c.id === 'order') return { ...c, items: [{ ...c.items[0], quantity: { path: '/order/qty' } }], data: { order: { qty: 2, total: '$378' } } }
    return c
  })
  components.push({ id: 'qty_arc', component: 'AmountPicker', label: 'Brass Arc Floor Lamp quantity', value: { path: '/order/qty' }, min: 1, step: 1 })
  const messages = [{ ...input.messages[0], updateComponents: { ...input.messages[0].updateComponents, components } }]
  const authored = { text: '', tools: [{ name: 'render_surface', input: { ...input, messages } }] }
  const turn = { ...fixture.turns[1], rounds: [round1, round2, authored] }
  const report = await offlineReplay({ ...fixture, turns: [fixture.turns[0], turn] }, process.cwd())
  expect(report.failed.map((c) => [c.check, c.turn ?? null])).toEqual([])
  expect(trace(report.records[1])).toMatchObject({ rounds: 3 })
  expect(trace(report.records[1]).failureCodes).toContain('SURFACE_MISSING')
  expect(trace(report.records[1]).failureCodes).not.toContain('SEMANTIC_UNCORRECTED')
  expect(shippedComponents(report.records[1]).find((c) => c.component === 'AmountPicker')?.value).toEqual({ path: '/order/qty' })
})
