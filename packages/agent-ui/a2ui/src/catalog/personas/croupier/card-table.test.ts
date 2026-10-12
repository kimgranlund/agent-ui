// card-table.test.ts: the CardTable composite (ADR-0243) through the REAL renderer in jsdom, driven by the
// agent-ui CardTable seed. The hands are whole-array bindings, so the card count is the list length; a draw
// appends one element and a hole card turned up flips the same element (ADR-0225 cl.6). The action Buttons
// are the producer's own children, appended after the readout. The derived croupier id is a lazy record
// (ADR-0241), so `render()` awaits its load before ingesting.

import { describe, it, expect } from 'vitest'
import '@agent-ui/components/all' // ADR-0233: the catalog factories import no control; the test defines the fleet
import { whenFlushed } from '@agent-ui/components'
import { createRenderer } from '../../../renderer/renderer.ts'
import type { A2uiClientMessage } from '../../../renderer/renderer.ts'
import type { A2uiOutput, A2uiServerMessage } from '../../../protocol.ts'
import { personaCroupierCardTableSeed } from '../../../examples/persona-exemplars.ts'

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
  sent: () => number
  cleanup: () => void
}

async function render(messages: readonly A2uiServerMessage[] = personaCroupierCardTableSeed.messages): Promise<Mounted> {
  const out: A2uiClientMessage[] = []
  const r = createRenderer()
  await r.preload(personaCroupierCardTableSeed.catalogId)
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
  it('CardTable renders one ui-playing-card per bound item, at size sm, in list order', async () => {
    const { table, errors, cleanup } = await render()
    expect(errors()).toEqual([])
    expect(table).not.toBeNull()
    expect(cardsIn(table, 'dealer').map(face)).toEqual(['9c', '4d*'])
    expect(cardsIn(table, 'player').map(face)).toEqual(['Kh', '7s'])
    for (const c of table.querySelectorAll('ui-playing-card')) expect((c as CardEl).size).toBe('sm')
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
    expect(kids.slice(0, readout + 1).map((k) => k.getAttribute('data-part'))).toEqual(['head', 'zone', 'zone', 'readout'])
    const after = kids.slice(readout + 1)
    expect(after.map((k) => k.tagName.toLowerCase())).toEqual(['ui-button', 'ui-button', 'ui-button'])
    expect(after.map((k) => k.textContent?.trim())).toEqual(['Hit', 'Stand', 'Double'])
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
    expect(total('dealer')).toBe('Total 9')
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
