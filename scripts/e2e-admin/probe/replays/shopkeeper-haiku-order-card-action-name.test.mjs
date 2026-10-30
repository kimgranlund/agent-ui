// T-0590 (live round 21 cluster P4c, `.sdlc/evals/rounds/2026-10-29-r21-pattern/`, smoke-shopkeeper-browse-and-add-haiku-3,
// traces 2026-10-29.jsonl:79 and :80, converted with `npm run chat:probe -- --from-trace`): on "Add the first one to my
// order." round 1 answers a note claiming the add (CHANGE_CLAIMED), and the repair round resends storefront-lamps with an
// `order` Card around an AmountPicker labelled "Brass Desk Lamp" (actionName `set_quantity`, currency "$") and a total
// Text, no ConfirmReceipt. The quantity cue read only the label, name and bound path, so it shipped. The fixture is the
// recorded run verbatim; the CHANGE_CLAIMED repair now names the ConfirmReceipt, the ConfirmReceipt row reads the
// picker's actionName and currency and sends round 2 back (CONFIRM_RECEIPT_MISSING), and round 3 is AUTHORED as round 2
// with the Card replaced by one ConfirmReceipt whose quantity binds `/order/qty`, beside the AmountPicker bound to it.
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { parseProbeFixture } from '../model.ts'
import { offlineReplay } from '../trace.ts'
import { repairRequests, shipped, trace } from './unclosed-array.mjs'

const fixture = parseProbeFixture(readFileSync(new URL('./shopkeeper-haiku-order-card-action-name.json', import.meta.url), 'utf8'))
const [round1, round2] = fixture.turns[1].rounds

it('shopkeeper-haiku-order-card-action-name: the order Card picker named by its actionName and currency draws CONFIRM_RECEIPT_MISSING', async () => {
  const picker = round2.tools[0].input.messages[0].updateComponents.components.find((c) => c.id === 'line_desk')
  expect(picker).toMatchObject({ component: 'AmountPicker', label: 'Brass Desk Lamp', actionName: 'set_quantity', currency: '$' })
  const report = await offlineReplay(fixture, process.cwd())
  expect(trace(report.records[1]).failureCodes).toContain('CONFIRM_RECEIPT_MISSING')
})

it('shopkeeper-haiku-order-card-action-name: the CHANGE_CLAIMED repair on the add turn names ONE ConfirmReceipt', async () => {
  const report = await offlineReplay(fixture, process.cwd())
  const requests = await repairRequests(fixture, report, 1, 'agent-ui')
  expect(requests[1].messages.at(-1).content).toContain('CHANGE_CLAIMED at storefront-lamps')
  expect(requests[1].messages.at(-1).content).toContain('read the order back as ONE ConfirmReceipt')
})

it('shopkeeper-haiku-order-card-action-name: a round 3 with one ConfirmReceipt beside the AmountPicker ships clean', async () => {
  const input = round2.tools[0].input
  const dropped = new Set(['order_content', 'order_list', 'order_total'])
  const components = input.messages[0].updateComponents.components
    .filter((c) => !dropped.has(c.id))
    .map((c) => {
      if (c.id === 'root') return { ...c, children: [...c.children, 'line_desk'] }
      if (c.id === 'order') return { id: 'order', component: 'ConfirmReceipt', title: 'Your order', items: [{ label: 'Brass Desk Lamp', quantity: { path: '/order/qty' }, amount: '$68' }], totalLabel: 'Total', totalPath: '/order/total', status: 'pending', confirmAction: { action: 'confirm_order' }, backAction: { action: 'back' } }
      if (c.id === 'line_desk') return { id: c.id, component: 'AmountPicker', label: 'Brass Desk Lamp quantity', value: { path: '/order/qty' }, min: 1, step: 1 }
      return c
    })
  const data = { version: 'v1.0', updateDataModel: { surfaceId: 'storefront-lamps', path: '/order', value: { qty: 1, total: '$68' } } }
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
