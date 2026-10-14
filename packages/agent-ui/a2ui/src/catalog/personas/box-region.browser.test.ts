// box-region.browser.test.ts: the real-engine half of `box-region.ts` (ADR-0046 Amendment 7, T-0084). The two
// region-less ui-card composites, CardTable and QuestionCard, render from their persona exemplar seeds and their
// painted spacing matches a stock card region: ink 19px inline and 13px block from the outer edge (border 1px,
// the 6px box inset, the region padding), the card's loose-child margin gone, and the composite's own rhythm
// (CardTable one region apart, 18px; QuestionCard one 8px gap). jsdom cannot see a computed box, so this is
// the geometry proof; card-table.test.ts and question-card.test.ts own the DOM shape. The CardTable betting seed
// (ADR-0243 Amendment 3, T-0088; T-0172 strip) folds the zones away and shows the bet strip, five bets at 28px (the lg
// step on the canvas register, widget at scale md, ADR-0245 Amendment 2), 8px apart, one region under the head. The
// T-0172 Haiku hit turn's own payload proves in both engines that a card with no faceDown paints its face.

import { describe, it, expect, afterEach } from 'vitest'
// Side-effect CSS first (foundation, then the shipped control sheets), then the self-defining controls.
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/all.css'
import '@agent-ui/components/all'
import { resolve } from '../../../../shared/src/tokens/scale.mjs'
import { createRenderer } from '../../renderer/renderer.ts'
import { personaExemplarSeeds } from '../../examples/persona-exemplars.ts'

const mounted: HTMLElement[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

/** Render one persona exemplar seed into a 480px column (the canvas content width) and return its ui-card. */
async function renderSeed(name: string, width = 480): Promise<HTMLElement> {
  const seed = personaExemplarSeeds.find((s) => s.name === name)
  if (seed === undefined) throw new Error(`no persona seed ${name}`)
  const mount = document.createElement('div')
  mount.style.inlineSize = `${width}px`
  document.body.append(mount)
  mounted.push(mount)
  const host = createRenderer()
  host.mount(mount)
  await host.preload(seed.catalogId)
  for (const message of seed.messages) host.ingest(JSON.stringify(message))
  host.finalize(seed.surfaceId)
  await host.settled()
  await new Promise((resolve) => setTimeout(resolve, 50)) // the action-row observer stamps size="lg" after mount
  return mount.querySelector('ui-card') as HTMLElement
}

const rect = (el: Element): DOMRect => el.getBoundingClientRect()
const part = (root: Element, name: string): HTMLElement => root.querySelector(`[data-part="${name}"]`) as HTMLElement

describe('the persona composites on the ADR-0046 box model (Amendment 7)', () => {
  it('CardTable: ink 19px inline and 13px block; head, zones and readout row one region (18px) apart', async () => {
    const card = await renderSeed('persona-croupier-card-table')
    const host = rect(card)
    const head = rect(part(card, 'head'))
    const [dealer, player] = [...card.querySelectorAll('[data-part="zone"]')].map(rect)
    expect(head.left - host.left).toBeCloseTo(19, 0)
    expect(head.top - host.top).toBeCloseTo(13, 0)
    expect(host.right - head.right).toBeCloseTo(19, 0)
    expect(dealer!.top - head.bottom).toBeCloseTo(18, 0)
    expect(player!.top - dealer!.bottom).toBeCloseTo(18, 0)
    const buttons = [...card.querySelectorAll(':scope > ui-button')].map(rect)
    expect(buttons.length).toBeGreaterThan(0)
    expect(buttons[0]!.top - player!.bottom).toBeCloseTo(18, 0) // the readout row: the Buttons set its height
    expect(host.right - buttons.at(-1)!.right).toBeCloseTo(19, 0)
    expect(host.bottom - buttons.at(-1)!.bottom).toBeCloseTo(13, 0)
    expect(getComputedStyle(part(card, 'zone')).marginBlockStart).toBe('0px') // the card's loose-child margin is gone
  })

  it('T-0142: CardTable action Buttons wrap as one group: at every width they share one top edge', async () => {
    for (const width of [480, 440, 400, 360, 320]) {
      const card = await renderSeed('persona-croupier-card-table', width)
      const buttons = [...card.querySelectorAll(':scope > ui-button')].map(rect)
      expect(buttons.length, `${width}px`).toBeGreaterThan(1)
      for (const b of buttons) expect(b.top, `${width}px: a split action group`).toBeCloseTo(buttons[0]!.top, 0)
      const readout = rect(part(card, 'readout'))
      expect(readout.left - rect(card).left, `${width}px`).toBeCloseTo(19, 0)
    }
  })

  it('CardTable betting (T-0172 strip): the zones fold away, the strip sits one region (18px) under the head and over the readout; five bets at 28px (lg on the canvas register), 8px apart', async () => {
    const card = await renderSeed('persona-croupier-card-table-betting')
    const host = rect(card)
    const head = rect(part(card, 'head'))
    const bet = rect(part(card, 'bet'))
    const readout = rect(part(card, 'readout'))
    const bets = [...card.querySelectorAll('[data-part="bet-option"]')].map(rect)
    expect(bets).toHaveLength(5)
    for (const r of bets) expect(r.height).toBeCloseTo(resolve('widget', 'md', 'lg').h, 0) // 28: the lg step at the canvas register
    for (let i = 1; i < bets.length; i++) {
      expect(bets[i]!.left - bets[i - 1]!.right).toBeCloseTo(8, 0)
      expect(bets[i]!.top).toBeCloseTo(bets[0]!.top, 0)
    }
    expect(bets[0]!.left - host.left).toBeCloseTo(19, 0)
    for (const zone of card.querySelectorAll('[data-part="zone"]')) expect(rect(zone).height).toBe(0)
    expect(bet.top - head.bottom).toBeCloseTo(18, 0)
    expect(readout.top - bet.bottom).toBeCloseTo(18, 0)
    expect(card.querySelector(':scope > ui-button')).toBeNull()
  })

  it('QuestionCard: ink 19px inline and 13px block; one 8px gap between parts', async () => {
    const card = await renderSeed('persona-quizmaster-question')
    const host = rect(card)
    const head = rect(part(card, 'head'))
    const question = rect(part(card, 'question'))
    const options = rect(part(card, 'options'))
    expect(head.left - host.left).toBeCloseTo(19, 0)
    expect(head.top - host.top).toBeCloseTo(13, 0)
    expect(host.right - options.right).toBeCloseTo(19, 0)
    expect(question.top - head.bottom).toBeCloseTo(8, 0)
    expect(options.top - question.bottom).toBeCloseTo(8, 0)
    const button = rect(card.querySelector(':scope > ui-button') as HTMLElement)
    expect(button.top - options.bottom).toBeCloseTo(8, 0)
    expect(host.bottom - button.bottom).toBeCloseTo(13, 0)
  })
})

// T-0172: Kim saw every card of this Haiku 5.5 payload (2026-10-14 20:43 UTC trace, turn 2) painted as a back. The
// payload byte for byte, through the real renderer: only the faceDown:true hole card turns its rotor to 180deg.
describe('the Haiku hit turn paints its faces (T-0172)', () => {
  it('the dealer 10 and the player 8 and 5 show their faces, the hole card its back, in this engine', async () => {
    const mount = document.createElement('div')
    mount.style.inlineSize = '480px'
    document.body.append(mount)
    mounted.push(mount)
    const host = createRenderer()
    host.mount(mount)
    await host.preload('agent-ui--croupier')
    const payload = [
      { version: 'v1.0', createSurface: { surfaceId: 'table-1', catalogId: 'agent-ui--croupier', sendDataModel: true } },
      { version: 'v1.0', updateDataModel: { surfaceId: 'table-1', value: { bankroll: 1000, bet: 50, status: 'Your turn', dealerHand: [{ rank: '10', suit: 'spades' }, { rank: '6', suit: 'diamonds', faceDown: true }], playerHand: [{ rank: '8', suit: 'hearts' }, { rank: '5', suit: 'clubs' }], dealerTotal: '10 showing', playerTotal: '13' } } },
      { version: 'v1.0', updateComponents: { surfaceId: 'table-1', components: [
        { id: 'root', component: 'CardTable', title: 'Blackjack', dealerHand: { path: '/dealerHand' }, playerHand: { path: '/playerHand' }, dealerTotal: { path: '/dealerTotal' }, playerTotal: { path: '/playerTotal' }, bankroll: { path: '/bankroll' }, bet: { path: '/bet' }, status: { path: '/status' }, statusIntent: 'neutral', phase: 'playing', children: ['actions'] },
        { id: 'actions', component: 'Row', gap: 'md', justify: 'end', children: ['hit_btn', 'stand_btn', 'double_btn'] },
        { id: 'hit_btn', component: 'Button', label: 'Hit', variant: 'solid', action: { action: 'hit' } },
        { id: 'stand_btn', component: 'Button', label: 'Stand', variant: 'ghost', action: { action: 'stand' } },
        { id: 'double_btn', component: 'Button', label: 'Double', variant: 'ghost', action: { action: 'double' } },
      ] } },
    ]
    for (const message of payload) host.ingest(JSON.stringify(message))
    host.finalize('table-1')
    await host.settled()
    await new Promise((resolve) => setTimeout(resolve, 400)) // the deal entrance settles
    const cards = [...mount.querySelectorAll('ui-playing-card')]
    const turned = cards.map((c) => {
      const t = getComputedStyle(c.querySelector('[data-part="flipper"]')!).transform
      return t !== 'none' && new DOMMatrix(t).m11 < 0 // rotateY(180deg) puts -1 in m11
    })
    expect(turned).toEqual([false, true, false, false])
    // The face, not the back, is what a pointer at a face-up card's center hits.
    const r = cards[0]!.getBoundingClientRect()
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    expect(hit?.closest('[data-part="face"], [data-part="back"]')?.getAttribute('data-part')).toBe('face')
    // Hit, Stand and Double are live: none disabled on "Your turn".
    const actions = [...mount.querySelectorAll('ui-button')].filter((b) => !b.hasAttribute('data-part')) // not the hidden bet strip
    expect(actions.map((b) => [b.textContent?.trim(), (b as HTMLElement & { disabled: boolean }).disabled])).toEqual([['Hit', false], ['Stand', false], ['Double', false]])
  })
})
