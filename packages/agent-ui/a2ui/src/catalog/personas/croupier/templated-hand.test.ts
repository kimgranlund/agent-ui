// templated-hand.test.ts: the data-driven Croupier hand (GH #1795, T-0016) renders through the REAL
// renderer in jsdom with exactly one `ui-playing-card` per list item, so the card count IS the hand length
// by construction; a draw appended to the list adds a card with no component change. The fixture is the
// shape `card-layout`/`game-table-chrome` teach (`hands.fixture.ts`).

import { describe, it, expect } from 'vitest'
import '@agent-ui/components/all' // ADR-0233: the catalog factories import no control; the test defines the fleet
import { whenFlushed } from '@agent-ui/components'
import { createRenderer } from '../../../renderer/renderer.ts'
import type { A2uiClientMessage } from '../../../renderer/renderer.ts'
import { validateA2ui } from '../../../renderer/validate.ts'
import { composeCatalog } from '../../compose.ts'
import { defaultCatalog } from '../../default/index.ts'
import { croupierFragment } from './manifest.ts'
import { DATA_DRIVEN_TURN } from './hands.fixture.ts'

const isError = (m: A2uiClientMessage): boolean => 'error' in m

interface CardEl {
  rank: string
  suit: string
  faceDown: boolean
}

function render(): { mount: HTMLElement; ingest: (line: string) => void; errors: () => A2uiClientMessage[]; cleanup: () => void } {
  const sent: A2uiClientMessage[] = []
  const r = createRenderer()
  r.onClientMessage((m) => void sent.push(m))
  const mount = document.createElement('div')
  document.body.appendChild(mount)
  r.mount(mount)
  for (const msg of DATA_DRIVEN_TURN) r.ingest(JSON.stringify(msg))
  return {
    mount,
    ingest: (line) => r.ingest(line),
    errors: () => sent.filter(isError),
    cleanup: () => {
      r.dispose()
      mount.remove()
    },
  }
}

describe('Croupier templated hand (GH #1795): card count equals hand length by construction', () => {
  it('the fixture is structurally valid against the derived croupier catalog (the precondition)', () => {
    const verdict = validateA2ui(DATA_DRIVEN_TURN, composeCatalog(defaultCatalog, croupierFragment, 'croupier'), undefined, { atFinalize: true })
    expect(verdict).toEqual({ valid: true, failures: [] })
  })

  it('renders one ui-playing-card per /dealerHand and /playerHand item, bound relatively, in list order', () => {
    const { mount, errors, cleanup } = render()
    expect(errors()).toEqual([])
    const cards = [...mount.querySelectorAll('ui-playing-card')] as unknown as CardEl[]
    expect(cards).toHaveLength(4) // dealerHand (2) + playerHand (2)
    expect(cards.map((c) => `${c.rank}${c.suit[0]}${c.faceDown ? '*' : ''}`)).toEqual(['9h', 'Kc*', 'As', '7d'])
    cleanup()
  })

  it('a draw is a data-model append: one more list item, one more card, no component resent', async () => {
    const { mount, ingest, errors, cleanup } = render()
    ingest(JSON.stringify({ version: 'v1.0', updateDataModel: { surfaceId: 'table-4', path: '/playerHand/2', value: { rank: '3', suit: 'clubs' } } }))
    await whenFlushed() // the list re-renders on the reactive flush, as in renderer/list.test.ts
    expect(errors()).toEqual([])
    const cards = [...mount.querySelectorAll('ui-playing-card')] as unknown as CardEl[]
    expect(cards).toHaveLength(5)
    expect(cards[4]!.rank).toBe('3')
    cleanup()
  })
})
