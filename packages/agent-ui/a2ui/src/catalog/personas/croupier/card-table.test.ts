// card-table.test.ts: the CardTable composite (ADR-0243) through the REAL renderer in jsdom, driven by the
// agent-ui CardTable seed. The hands are whole-array bindings, so the card count is the list length; a draw
// appends one element and a hole card turned up flips the same element (ADR-0225 cl.6). The action Buttons
// are the producer's own children, appended after the readout. The derived croupier id is a lazy record
// (ADR-0241), so `render()` awaits its load before ingesting. The hand lifecycle (ADR-0243 Amendment 3) runs
// on the betting and settled seeds of both bases: the bet strip (T-0172: one press places the bet and deals), the
// result line.

import { readFileSync } from 'node:fs'
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

// jsdom has no `ElementInternals.setFormValue`/`setValidity`, which a form-associated control calls on connect (the
// question-card.test.ts precedent): stubbed on the shared prototype for this file only.
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

  it('T-0172: the Haiku hit trace\'s hands render face up except the one faceDown:true hole card (no face-down attribute on the rest)', async () => {
    const { table, ingest, errors, cleanup } = await render()
    await ingest(dataLine('/dealerHand', [{ rank: '10', suit: 'spades' }, { rank: '6', suit: 'diamonds', faceDown: true }]))
    await ingest(dataLine('/playerHand', [{ rank: '8', suit: 'hearts' }, { rank: '5', suit: 'clubs' }, { rank: '4', suit: 'diamonds' }]))
    expect(errors()).toEqual([])
    expect(cardsIn(table, 'dealer').map(face)).toEqual(['10s', '6d*'])
    expect(cardsIn(table, 'player').map(face)).toEqual(['8h', '5c', '4d'])
    expect([...table.querySelectorAll('ui-playing-card')].map((c) => c.hasAttribute('face-down'))).toEqual([false, true, false, false, false])
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

  it('CardTable: Hit, Stand and Double sit at the button lg step (32px on the canvas register), and a Button that arrives later does too (ADR-0243 Amendment 2, ADR-0245 Amendment 2)', async () => {
    const late = withRoot((root) => {
      root['children'] = ['hitBtn', 'standBtn', 'doubleBtn', 'splitBtn'] // splitBtn is a forward ref, sent below
    })
    const { table, ingest, errors, cleanup } = await render(late)
    const sizes = (): (string | null)[] => [...table.querySelectorAll(':scope > ui-button')].map((b) => b.getAttribute('size'))
    expect(sizes()).toEqual(['lg', 'lg', 'lg'])
    await ingest({
      version: 'v1.0',
      updateComponents: { surfaceId: SID, components: [{ id: 'splitBtn', component: 'Button', variant: 'soft', label: 'Split', action: { action: 'split' } }] },
    })
    expect(errors()).toEqual([])
    expect(sizes()).toEqual(['lg', 'lg', 'lg', 'lg'])
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

  it('CardTable: the root order stays head, zones, result, bet, readout, then the producer Buttons (none while betting)', async () => {
    const { table, cleanup } = await render(personaCroupierCardTableBettingSeed.messages)
    expect([...table.children].map((k) => k.getAttribute('data-part') ?? k.tagName.toLowerCase())).toEqual([
      'head', 'zone', 'zone', 'result', 'bet', 'readout',
    ])
    cleanup()
  })
})

const part = (table: HTMLElement, name: string): HTMLElement => table.querySelector<HTMLElement>(`[data-part="${name}"]`)!
const visibleCards = (table: HTMLElement, zone: 'dealer' | 'player'): CardEl[] => cardsIn(table, zone).filter((c) => c.style.display !== 'none')
const deal = (table: HTMLElement): HTMLElement & { disabled: boolean } => table.querySelector(':scope > ui-button') as HTMLElement & { disabled: boolean }
const betOptions = (table: HTMLElement): (HTMLElement & { disabled: boolean; size: string })[] =>
  [...table.querySelectorAll('[data-part="bet-option"]')] as (HTMLElement & { disabled: boolean; size: string })[]
const betOption = (table: HTMLElement, amount: number): HTMLElement => table.querySelector(`[data-part="bet-option"][data-amount="${amount}"]`)!
const readout = (table: HTMLElement): string => part(table, 'readout').textContent ?? ''

/** Click, then let the bind effects and the async action emit settle. */
async function press(el: HTMLElement): Promise<void> {
  el.click()
  await whenFlushed()
  await new Promise((resolve) => setTimeout(resolve, 0))
}

describe('CardTable: the hand lifecycle (ADR-0243 Amendment 3)', () => {
  it('betting: the felt is empty and the bet strip shows 25, 50, 75, 100 and 250 at the button lg step, with no other control (T-0172)', async () => {
    const { table, errors, cleanup } = await render(personaCroupierCardTableBettingSeed.messages)
    expect(errors()).toEqual([])
    expect(part(table, 'bet').style.display).toBe('flex')
    expect(visibleCards(table, 'dealer')).toHaveLength(0)
    expect(visibleCards(table, 'player')).toHaveLength(0)
    expect([...table.querySelectorAll<HTMLElement>('[data-part="zone"]')].map((z) => z.style.display)).toEqual(['none', 'none'])
    expect(betOptions(table).map((c) => c.textContent)).toEqual(['25', '50', '75', '100', '250'])
    expect(betOptions(table).map((c) => c.size)).toEqual(['lg', 'lg', 'lg', 'lg', 'lg'])
    expect(betOptions(table).some((c) => c.disabled)).toBe(false)
    expect(part(table, 'bet').querySelector('ui-text-field, ui-slider')).toBeNull()
    expect(deal(table)).toBeNull() // the strip is the whole bet phase: no Deal Button
    expect(readout(table)).toBe('Bankroll 1,000 · Bet 50')
    cleanup()
  })

  it('betting: one press places that bet, writes it to the data model and sends deal with it and the debited bankroll in the context (T-0216)', async () => {
    const { table, errors, actions, cleanup } = await render(personaCroupierCardTableBettingSeed.messages)
    await press(betOption(table, 75))
    expect(errors()).toEqual([])
    expect(readout(table)).toBe('Bankroll 1,000 · Bet 75')
    expect(actions()).toEqual([{ name: 'deal', context: { bet: 75, bankrollAfterBet: 925 } }])
    cleanup()
  })

  it('betting: the bankroll caps the strip, an amount above it is disabled and sends nothing', async () => {
    const { table, ingest, actions, cleanup } = await render(personaCroupierCardTableBettingSeed.messages)
    await ingest(dataLine('/bankroll', 90))
    expect(betOptions(table).map((c) => c.disabled)).toEqual([false, false, false, true, true])
    await press(betOption(table, 100))
    expect(actions()).toEqual([])
    await ingest(dataLine('/bankroll', 1000))
    expect(betOptions(table).some((c) => c.disabled)).toBe(false)
    cleanup()
  })

  it('betting with no betAction: a press only writes the bet (the croupier-bet-controls check flags the missing action)', async () => {
    const custom = JSON.parse(JSON.stringify(personaCroupierCardTableBettingSeed.messages)) as A2uiOutput
    delete (custom[1] as { updateComponents: { components: Record<string, unknown>[] } }).updateComponents.components[0]!['betAction']
    const { table, actions, cleanup } = await render(custom)
    await press(betOption(table, 50))
    expect(actions()).toEqual([])
    expect(readout(table)).toBe('Bankroll 1,000 · Bet 50')
    cleanup()
  })

  it('betting to playing: the deal fills the felt, the strip retires, and the bet reads only in the readout', async () => {
    const { table, ingest, errors, cleanup } = await render(personaCroupierCardTableBettingSeed.messages)
    await ingest(dataLine('/playerHand', [{ rank: 'K', suit: 'hearts' }, { rank: '7', suit: 'spades' }]))
    expect(visibleCards(table, 'player')).toHaveLength(0) // dealt while betting: held off the felt
    await ingest(dataLine('/phase', 'playing'))
    expect(errors()).toEqual([])
    expect(part(table, 'bet').style.display).toBe('none')
    expect([...table.querySelectorAll<HTMLElement>('[data-part="zone"]')].map((z) => z.style.display)).toEqual(['', ''])
    expect(visibleCards(table, 'player').map(face)).toEqual(['Kh', '7s'])
    expect(readout(table)).toBe('Bankroll 1,000 · Bet 50')
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

  it('a2ui-basic: the same betting table places the bet and sends deal from its strip', async () => {
    const { table, errors, actions, cleanup } = await render(personaBasicCroupierCardTableBettingSeed.messages)
    expect(errors()).toEqual([])
    expect(deal(table)).toBeNull()
    await press(betOption(table, 50))
    expect(actions()).toEqual([{ name: 'deal', context: { bet: 50, bankrollAfterBet: 950 } }])
    cleanup()
  })

  it('a2ui-basic: the settled table shows its result line and the Basic Deal again Button', async () => {
    const { table, errors, cleanup } = await render(personaBasicCroupierCardTableSettledSeed.messages)
    expect(errors()).toEqual([])
    expect(part(table, 'result').style.display).toBe('flex')
    expect(deal(table).textContent?.trim()).toBe('Deal again')
    cleanup()
  })

  it('bets: the amounts are the fixed 25 to 250 set; a model-supplied list is not a catalog prop and fails validation (T-0172)', async () => {
    const custom = JSON.parse(JSON.stringify(personaCroupierCardTableBettingSeed.messages)) as A2uiOutput
    ;(custom[1] as { updateComponents: { components: Record<string, unknown>[] } }).updateComponents.components[0]!['bets'] = [10, 25, 50, 100]
    const { table, cleanup } = await render(custom)
    expect(betOptions(table).map((c) => c.textContent)).toEqual(['25', '50', '75', '100', '250'])
    const row = JSON.parse(readFileSync('packages/agent-ui/a2ui/src/catalog/personas/croupier/catalog.json', 'utf8')) as { components: { CardTable: { properties: Record<string, unknown> } } }
    expect(Object.keys(row.components.CardTable.properties)).not.toContain('bets') // the validator rejects a model's own list (CATALOG)
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
