// card-table.test.ts: the CardTable composite (ADR-0243) through the REAL renderer in jsdom, driven by the
// agent-ui CardTable seed. The hands are whole-array bindings, so the card count is the list length; a draw
// appends one element and a hole card turned up flips the same element (ADR-0225 cl.6). The action Buttons
// are the producer's own children, appended after the readout. The derived croupier id is a lazy record
// (ADR-0241), so `render()` awaits its load before ingesting. The hand lifecycle (ADR-0243 Amendment 3) runs
// on the betting and settled seeds of both bases: the bet row, the two-way bet, the Deal gate, the result line.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import '@agent-ui/components/all' // ADR-0233: the catalog factories import no control; the test defines the fleet
import { whenFlushed } from '@agent-ui/components'
import { createRenderer } from '../../../renderer/renderer.ts'
import type { A2uiClientMessage } from '../../../renderer/renderer.ts'
import type { A2uiOutput, A2uiServerMessage } from '../../../protocol.ts'
import {
  personaBasicCroupierCardTableBettingSeed,
  personaBasicCroupierCardTableSettledSeed,
  personaCroupierCardTableBettingSeed,
  personaCroupierCardTableSeed,
  personaCroupierCardTableSettledSeed,
} from '../../../examples/persona-exemplars.ts'

// jsdom has no `ElementInternals.setFormValue`/`setValidity`, which the bet row's form-associated `ui-text-field`
// calls on connect (the question-card.test.ts precedent): stubbed on the shared prototype for this file only.
let savedSetFormValue: unknown
let savedSetValidity: unknown
beforeAll(() => {
  savedSetFormValue = ElementInternals.prototype.setFormValue
  savedSetValidity = ElementInternals.prototype.setValidity
  if (typeof ElementInternals.prototype.setFormValue !== 'function') ElementInternals.prototype.setFormValue = function (): void {}
  if (typeof ElementInternals.prototype.setValidity !== 'function') ElementInternals.prototype.setValidity = function (): void {}
})
afterAll(() => {
  ElementInternals.prototype.setFormValue = savedSetFormValue as typeof ElementInternals.prototype.setFormValue
  ElementInternals.prototype.setValidity = savedSetValidity as typeof ElementInternals.prototype.setValidity
})

const SID = personaCroupierCardTableSeed.surfaceId
const isError = (m: A2uiClientMessage): boolean => 'error' in m

interface CardEl extends HTMLElement {
  rank: string
  suit: string
  faceDown: boolean
  size: string
}

interface Mounted {
  table: HTMLElement
  ingest: (msg: unknown) => Promise<void>
  errors: () => A2uiClientMessage[]
  /** Each emitted action's name and resolved context. */
  actions: () => { name: string; context: Record<string, unknown> }[]
  sent: () => number
  cleanup: () => void
}

async function render(messages: readonly A2uiServerMessage[] = personaCroupierCardTableSeed.messages): Promise<Mounted> {
  const out: A2uiClientMessage[] = []
  const r = createRenderer()
  for (const m of messages) if ('createSurface' in m) await r.preload(m.createSurface.catalogId)
  r.onClientMessage((m) => void out.push(m))
  const mount = document.createElement('div')
  document.body.appendChild(mount)
  r.mount(mount)
  for (const msg of messages) r.ingest(JSON.stringify(msg))
  await whenFlushed()
  return {
    table: mount.querySelector('ui-card')!,
    ingest: async (msg) => {
      r.ingest(JSON.stringify(msg))
      await whenFlushed()
    },
    errors: () => out.filter(isError),
    actions: () => out.flatMap((m) => ('action' in m ? [{ name: m.action.name, context: m.action.context }] : [])),
    sent: () => out.length,
    cleanup: () => {
      r.dispose()
      mount.remove()
    },
  }
}

const cardsIn = (table: HTMLElement, zone: 'dealer' | 'player'): CardEl[] =>
  [...table.querySelectorAll(`[data-zone="${zone}"] [data-part="felt"] ui-playing-card`)] as CardEl[]
const face = (c: CardEl): string => `${c.rank}${c.suit[0]}${c.faceDown ? '*' : ''}`
const dataLine = (path: string, value: unknown): unknown => ({ version: 'v1.0', updateDataModel: { surfaceId: SID, path, value } })

/** The seed with `edit` applied to its CardTable root node. */
function withRoot(edit: (root: Record<string, unknown>) => void): A2uiOutput {
  const out = JSON.parse(JSON.stringify(personaCroupierCardTableSeed.messages)) as A2uiOutput
  const comps = (out[1] as { updateComponents: { components: Record<string, unknown>[] } }).updateComponents.components
  edit(comps.find((c) => c['id'] === 'root')!)
  return out
}

describe('CardTable renders through the real renderer (ADR-0243)', () => {
  it('CardTable renders one ui-playing-card per bound item, at size md, in list order', async () => {
    const { table, errors, cleanup } = await render()
    expect(errors()).toEqual([])
    expect(table).not.toBeNull()
    expect(cardsIn(table, 'dealer').map(face)).toEqual(['9c', '4d*'])
    expect(cardsIn(table, 'player').map(face)).toEqual(['Kh', '7s'])
    for (const c of table.querySelectorAll('ui-playing-card')) expect((c as CardEl).size).toBe('md')
    cleanup()
  })

  it('CardTable: a draw at /playerHand/2 adds one card in place, with no component resent', async () => {
    const { table, ingest, errors, cleanup } = await render()
    const before = cardsIn(table, 'player')
    await ingest(dataLine('/playerHand/2', { rank: '3', suit: 'clubs' }))
    expect(errors()).toEqual([])
    const after = cardsIn(table, 'player')
    expect(after.map(face)).toEqual(['Kh', '7s', '3c'])
    expect(after[0]).toBe(before[0])
    expect(after[1]).toBe(before[1])
    expect(cardsIn(table, 'dealer')).toHaveLength(2)
    cleanup()
  })

  it('CardTable: turning the hole card face up flips the same element', async () => {
    const { table, ingest, errors, cleanup } = await render()
    const hole = cardsIn(table, 'dealer')[1]!
    expect(hole.faceDown).toBe(true)
    await ingest(dataLine('/dealerHand/1', { rank: '4', suit: 'diamonds', faceDown: false }))
    expect(errors()).toEqual([])
    expect(cardsIn(table, 'dealer')[1]).toBe(hole)
    expect(hole.faceDown).toBe(false)
    cleanup()
  })

  it('CardTable: the Buttons are root children after [data-part="readout"], in declared order', async () => {
    const { table, cleanup } = await render()
    const kids = [...table.children]
    const readout = kids.findIndex((k) => k.getAttribute('data-part') === 'readout')
    expect(kids.slice(0, readout + 1).map((k) => k.getAttribute('data-part'))).toEqual(['head', 'zone', 'zone', 'result', 'bet', 'readout'])
    const after = kids.slice(readout + 1)
    expect(after.map((k) => k.tagName.toLowerCase())).toEqual(['ui-button', 'ui-button', 'ui-button'])
    expect(after.map((k) => k.textContent?.trim())).toEqual(['Hit', 'Stand', 'Double'])
    cleanup()
  })

  it('CardTable: Hit, Stand and Double sit at the 36px action step (md on the canvas register), and a Button that arrives later does too (ADR-0243 Amendment 2, ADR-0245)', async () => {
    const late = withRoot((root) => {
      root['children'] = ['hitBtn', 'standBtn', 'doubleBtn', 'splitBtn'] // splitBtn is a forward ref, sent below
    })
    const { table, ingest, errors, cleanup } = await render(late)
    const sizes = (): (string | null)[] => [...table.querySelectorAll(':scope > ui-button')].map((b) => b.getAttribute('size'))
    expect(sizes()).toEqual(['md', 'md', 'md'])
    await ingest({
      version: 'v1.0',
      updateComponents: { surfaceId: SID, components: [{ id: 'splitBtn', component: 'Button', variant: 'soft', label: 'Split', action: { action: 'split' } }] },
    })
    expect(errors()).toEqual([])
    expect(sizes()).toEqual(['md', 'md', 'md', 'md'])
    cleanup()
  })

  it('CardTable: totals, readout and status repaint from the data model', async () => {
    const bound = withRoot((root) => {
      root['status'] = { path: '/status' }
      root['statusIntent'] = { path: '/statusIntent' }
    })
    const { table, ingest, errors, cleanup } = await render(bound)
    const total = (z: string): string => table.querySelector(`[data-zone="${z}"] [data-part="total"]`)!.textContent ?? ''
    const readout = table.querySelector<HTMLElement>('[data-part="readout"]')!
    const status = table.querySelector<HTMLElement>('[data-part="status"]')! as HTMLElement & { label: string; intent: string }
    expect(total('dealer')).toBe('showing 9') // a string total reads as given (the seed's face-down deal)
    expect(total('player')).toBe('Total 17')
    expect(readout.textContent).toBe('Bankroll 1,000 · Bet 50')
    expect(status.style.display).toBe('none') // /status is not written yet
    await ingest(dataLine('/playerTotal', 20))
    await ingest(dataLine('/dealerTotal', 'Dealer shows 9'))
    await ingest(dataLine('/bankroll', 1250))
    await ingest(dataLine('/status', 'You win'))
    await ingest(dataLine('/statusIntent', 'success'))
    expect(errors()).toEqual([])
    expect(total('player')).toBe('Total 20')
    expect(total('dealer')).toBe('Dealer shows 9')
    expect(readout.textContent).toBe('Bankroll 1,250 · Bet 50')
    expect(readout.style.display).toBe('')
    expect(status.label).toBe('You win')
    expect(status.intent).toBe('success')
    expect(status.style.display).toBe('')
    cleanup()
  })

  it('CardTable with no phase is the playing table: cards and totals shown, the bet row and the result line hidden', async () => {
    const { table, ingest, errors, cleanup } = await render()
    await ingest(dataLine('/result', 'You win')) // a result outside `settled` stays hidden
    expect(errors()).toEqual([])
    expect(part(table, 'bet').style.display).toBe('none')
    expect(part(table, 'result').style.display).toBe('none')
    expect(visibleCards(table, 'player')).toHaveLength(2)
    expect(part(table, 'total').style.display).toBe('')
    expect(deal(table).disabled).toBe(false) // Hit: the bet gate acts in `betting` only
    cleanup()
  })

  it('CardTable: the root order stays head, zones, result, bet, readout, then the producer Buttons', async () => {
    const { table, cleanup } = await render(personaCroupierCardTableBettingSeed.messages)
    expect([...table.children].map((k) => k.getAttribute('data-part') ?? k.tagName.toLowerCase())).toEqual([
      'head', 'zone', 'zone', 'result', 'bet', 'readout', 'ui-button',
    ])
    cleanup()
  })
})

const part = (table: HTMLElement, name: string): HTMLElement => table.querySelector<HTMLElement>(`[data-part="${name}"]`)!
const visibleCards = (table: HTMLElement, zone: 'dealer' | 'player'): CardEl[] => cardsIn(table, zone).filter((c) => c.style.display !== 'none')
const deal = (table: HTMLElement): HTMLElement & { disabled: boolean } => table.querySelector(':scope > ui-button') as HTMLElement & { disabled: boolean }
const chips = (table: HTMLElement): (HTMLElement & { disabled: boolean; size: string })[] =>
  [...table.querySelectorAll('[data-part="chip"]')] as (HTMLElement & { disabled: boolean; size: string })[]
const chip = (table: HTMLElement, amount: number): HTMLElement => table.querySelector(`[data-part="chip"][data-amount="${amount}"]`)!
const stake = (table: HTMLElement): HTMLElement & { type: string; min: string; max: string; step: number; value: string; size: string } =>
  part(table, 'stake') as HTMLElement & { type: string; min: string; max: string; step: number; value: string; size: string }
const readout = (table: HTMLElement): string => part(table, 'readout').textContent ?? ''

/** Click, then let the bind effects and the async action emit settle. */
async function press(el: HTMLElement): Promise<void> {
  el.click()
  await whenFlushed()
  await new Promise((resolve) => setTimeout(resolve, 0))
}

describe('CardTable: the hand lifecycle (ADR-0243 Amendment 3)', () => {
  it('betting: the felt is empty, the bet row shows md chips (36px on the canvas register), an exact-amount stepper and Clear, and Deal is live at bet 50', async () => {
    const { table, errors, cleanup } = await render(personaCroupierCardTableBettingSeed.messages)
    expect(errors()).toEqual([])
    expect(part(table, 'bet').style.display).toBe('flex')
    expect(visibleCards(table, 'dealer')).toHaveLength(0)
    expect(visibleCards(table, 'player')).toHaveLength(0)
    expect(chips(table).map((c) => c.textContent)).toEqual(['+10', '+25', '+50', '+100'])
    expect(chips(table).map((c) => c.size)).toEqual(['md', 'md', 'md', 'md'])
    const field = stake(table)
    expect(field.tagName.toLowerCase()).toBe('ui-text-field')
    expect([field.type, field.min, field.max, field.step, field.value, field.size]).toEqual(['number', '1', '1000', 5, '50', 'md'])
    expect(part(table, 'clear').textContent).toBe('Clear')
    expect(readout(table)).toBe('Bankroll 1,000 · Bet 50')
    expect(deal(table).disabled).toBe(false)
    cleanup()
  })

  it('betting: a chip adds to the bet, the bet reaches the data model, and Deal sends it', async () => {
    const { table, errors, actions, cleanup } = await render(personaCroupierCardTableBettingSeed.messages)
    await press(chip(table, 25))
    expect(readout(table)).toBe('Bankroll 1,000 · Bet 75')
    expect(stake(table).value).toBe('75')
    await press(deal(table))
    expect(errors()).toEqual([])
    expect(actions()).toEqual([{ name: 'deal', context: { bet: 75 } }])
    cleanup()
  })

  it('betting: chips stop at the bankroll and then go inert, and Clear zeroes the bet and shuts Deal', async () => {
    const { table, ingest, actions, cleanup } = await render(personaCroupierCardTableBettingSeed.messages)
    await ingest(dataLine('/bankroll', 120))
    await press(chip(table, 100))
    expect(readout(table)).toBe('Bankroll 120 · Bet 120') // 50 + 100 capped at the bankroll
    expect(chips(table).every((c) => c.disabled)).toBe(true)
    await press(part(table, 'clear'))
    expect(readout(table)).toBe('Bankroll 120 · Bet 0')
    expect(stake(table).value).toBe('')
    expect(chips(table).some((c) => c.disabled)).toBe(false)
    expect(deal(table).disabled).toBe(true)
    await press(deal(table))
    expect(actions()).toEqual([]) // a disabled Deal sends nothing
    await press(chip(table, 10))
    expect(deal(table).disabled).toBe(false)
    await press(deal(table))
    expect(actions()).toEqual([{ name: 'deal', context: { bet: 10 } }])
    cleanup()
  })

  it('betting: a stepper commit sets the exact bet, clamped to the bankroll, and writes it back', async () => {
    const { table, actions, cleanup } = await render(personaCroupierCardTableBettingSeed.messages)
    const field = stake(table)
    field.value = '2000'
    field.dispatchEvent(new Event('change', { bubbles: true }))
    await whenFlushed()
    expect(readout(table)).toBe('Bankroll 1,000 · Bet 1,000')
    expect(field.value).toBe('1000')
    field.value = '35'
    field.dispatchEvent(new Event('change', { bubbles: true }))
    await press(deal(table))
    expect(actions()).toEqual([{ name: 'deal', context: { bet: 35 } }])
    cleanup()
  })

  it('betting: Deal is disabled while the bet is below 1 or above the bankroll, from the data model too', async () => {
    const { table, ingest, cleanup } = await render(personaCroupierCardTableBettingSeed.messages)
    expect(deal(table).disabled).toBe(false)
    await ingest(dataLine('/bet', 0))
    expect(deal(table).disabled).toBe(true)
    await ingest(dataLine('/bet', 60))
    expect(deal(table).disabled).toBe(false)
    await ingest(dataLine('/bankroll', 40))
    expect(deal(table).disabled).toBe(true)
    await ingest(dataLine('/bankroll', 500))
    expect(deal(table).disabled).toBe(false)
    cleanup()
  })

  it('betting to playing: the deal fills the felt, the bet row hides, the bet reads only in the readout, and the gate lets go', async () => {
    const { table, ingest, errors, cleanup } = await render(personaCroupierCardTableBettingSeed.messages)
    await ingest(dataLine('/bet', 0))
    const gated = deal(table)
    expect(gated.disabled).toBe(true)
    await ingest(dataLine('/playerHand', [{ rank: 'K', suit: 'hearts' }, { rank: '7', suit: 'spades' }]))
    expect(visibleCards(table, 'player')).toHaveLength(0) // dealt while betting: held off the felt
    await ingest(dataLine('/bet', 50))
    await ingest(dataLine('/phase', 'playing'))
    expect(errors()).toEqual([])
    expect(part(table, 'bet').style.display).toBe('none')
    expect(visibleCards(table, 'player').map(face)).toEqual(['Kh', '7s'])
    expect(readout(table)).toBe('Bankroll 1,000 · Bet 50')
    expect(gated.disabled).toBe(false)
    await ingest(dataLine('/bet', 0))
    expect(gated.disabled).toBe(false) // outside `betting` the factory never touches a Button
    cleanup()
  })

  it('settled: both hands face up with totals, the result line tinted by statusIntent, and the Deal again child', async () => {
    const { table, errors, cleanup } = await render(personaCroupierCardTableSettledSeed.messages)
    expect(errors()).toEqual([])
    expect(visibleCards(table, 'dealer').map(face)).toEqual(['9c', '4d', '5s'])
    expect(visibleCards(table, 'player').map(face)).toEqual(['Kh', '7s', '3c'])
    const result = part(table, 'result')
    expect(result.style.display).toBe('flex')
    expect(result.textContent).toBe('You win, 20 against the dealer’s 18: +50')
    expect(result.style.background).toBe('var(--md-sys-color-success-container-low)')
    expect(part(table, 'bet').style.display).toBe('none')
    expect(readout(table)).toBe('Bankroll 1,050 · Bet 50')
    expect(deal(table).textContent?.trim()).toBe('Deal again')
    expect(deal(table).disabled).toBe(false)
    cleanup()
  })

  it('a2ui-basic: the same betting table gates the Basic Deal Button and its event carries the bound bet', async () => {
    const { table, ingest, errors, actions, cleanup } = await render(personaBasicCroupierCardTableBettingSeed.messages)
    expect(errors()).toEqual([])
    await ingest(dataLine('/bet', 0))
    expect(deal(table).disabled).toBe(true)
    await press(chip(table, 50))
    expect(deal(table).disabled).toBe(false)
    await press(deal(table))
    expect(actions()).toEqual([{ name: 'deal', context: { bet: 50 } }])
    cleanup()
  })

  it('a2ui-basic: the settled table shows its result line and the Basic Deal again Button', async () => {
    const { table, errors, cleanup } = await render(personaBasicCroupierCardTableSettledSeed.messages)
    expect(errors()).toEqual([])
    expect(part(table, 'result').style.display).toBe('flex')
    expect(deal(table).textContent?.trim()).toBe('Deal again')
    cleanup()
  })

  it('chips: a producer list replaces the defaults, and an empty or invalid one falls back to them', async () => {
    const custom = JSON.parse(JSON.stringify(personaCroupierCardTableBettingSeed.messages)) as A2uiOutput
    const root = (custom[1] as { updateComponents: { components: Record<string, unknown>[] } }).updateComponents.components[0]!
    root['chips'] = { path: '/chips' }
    ;(custom[2] as { updateDataModel: { value: Record<string, unknown> } }).updateDataModel.value['chips'] = [5, 500]
    const { table, ingest, errors, cleanup } = await render(custom)
    expect(errors()).toEqual([])
    expect(chips(table).map((c) => c.textContent)).toEqual(['+5', '+500'])
    await ingest(dataLine('/chips', []))
    expect(chips(table).map((c) => c.textContent)).toEqual(['+10', '+25', '+50', '+100'])
    cleanup()
  })
})

describe('CardTable renders through the real renderer (ADR-0243): the empty table', () => {
  it('CardTable with every prop absent mounts an empty table with no error message', async () => {
    const empty: A2uiOutput = [
      { version: 'v1.0', createSurface: { surfaceId: SID, catalogId: personaCroupierCardTableSeed.catalogId } },
      { version: 'v1.0', updateComponents: { surfaceId: SID, components: [{ id: 'root', component: 'CardTable' }] } },
    ]
    const { table, errors, sent, cleanup } = await render(empty)
    expect(errors()).toEqual([])
    expect(sent()).toBe(0)
    expect(table).not.toBeNull()
    expect(table.querySelectorAll('ui-playing-card')).toHaveLength(0)
    expect(table.querySelector<HTMLElement>('[data-part="readout"]')!.style.display).toBe('none')
    expect(table.querySelector<HTMLElement>('[data-part="status"]')!.style.display).toBe('none')
    cleanup()
  })
})
