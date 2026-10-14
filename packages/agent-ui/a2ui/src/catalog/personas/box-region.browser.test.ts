// box-region.browser.test.ts: the real-engine half of `box-region.ts` (ADR-0046 Amendment 7, T-0084). The two
// region-less ui-card composites, CardTable and QuestionCard, render from their persona exemplar seeds and their
// painted spacing matches a stock card region: ink 19px inline and 13px block from the outer edge (border 1px,
// the 6px box inset, the region padding), the card's loose-child margin gone, and the composite's own rhythm
// (CardTable one region apart, 18px; QuestionCard one 8px gap). jsdom cannot see a computed box, so this is
// the geometry proof; card-table.test.ts and question-card.test.ts own the DOM shape. The CardTable betting seed
// (ADR-0243 Amendment 3, T-0088) adds the bet row: its chips, stepper and Clear at 28px (the lg step on the canvas register, widget
// at scale md, ADR-0245 Amendment 2), 8px apart,
// one region between the felt and the Deal row.

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

  it('CardTable betting (Amendment 3): the bet row sits one region (18px) between the felt and the Deal row; chips, stepper and Clear at 28px (lg on the canvas register), 8px apart', async () => {
    const card = await renderSeed('persona-croupier-card-table-betting')
    const host = rect(card)
    const player = rect(card.querySelectorAll('[data-part="zone"]')[1]!)
    const bet = rect(part(card, 'bet'))
    const chips = [...card.querySelectorAll('[data-part="chip"]')].map(rect)
    const stake = rect(part(card, 'stake'))
    const clear = rect(part(card, 'clear'))
    const dealBtn = rect(card.querySelector(':scope > ui-button') as HTMLElement)
    expect(chips).toHaveLength(4)
    for (const r of [...chips, stake, clear, dealBtn]) expect(r.height).toBeCloseTo(resolve('widget', 'md', 'lg').h, 0) // 28: the lg step at the canvas register
    // The chips on the first line, 8px apart; the stepper and Clear on the second, 8px below and 8px apart.
    for (let i = 1; i < chips.length; i++) {
      expect(chips[i]!.left - chips[i - 1]!.right).toBeCloseTo(8, 0)
      expect(chips[i]!.top).toBeCloseTo(chips[0]!.top, 0)
    }
    expect(chips[0]!.left - host.left).toBeCloseTo(19, 0)
    expect(stake.top - chips[0]!.bottom).toBeCloseTo(8, 0)
    expect(stake.left - host.left).toBeCloseTo(19, 0)
    expect(clear.left - stake.right).toBeCloseTo(8, 0)
    expect(clear.top).toBeCloseTo(stake.top, 0)
    expect(host.right - clear.right).toBeCloseTo(19, 0) // the stepper takes the line's slack
    expect(bet.top - player.bottom).toBeCloseTo(18, 0)
    expect(dealBtn.top - bet.bottom).toBeCloseTo(18, 0)
    expect(host.right - dealBtn.right).toBeCloseTo(19, 0)
    expect(host.bottom - dealBtn.bottom).toBeCloseTo(13, 0)
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
