// box-region.browser.test.ts: the real-engine half of `box-region.ts` (ADR-0046 Amendment 7, T-0084). The two
// region-less ui-card composites, CardTable and QuestionCard, render from their persona exemplar seeds and their
// painted spacing matches a stock card region: ink 19px inline and 13px block from the outer edge (border 1px,
// the 6px box inset, the region padding), the card's loose-child margin gone, and the composite's own rhythm
// (CardTable one region apart, 18px; QuestionCard one 8px gap). jsdom cannot see a computed box, so this is
// the geometry proof; card-table.test.ts and question-card.test.ts own the DOM shape.

import { describe, it, expect, afterEach } from 'vitest'
// Side-effect CSS first (foundation, then the shipped control sheets), then the self-defining controls.
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/all.css'
import '@agent-ui/components/all'
import { createRenderer } from '../../renderer/renderer.ts'
import { personaExemplarSeeds } from '../../examples/persona-exemplars.ts'

const mounted: HTMLElement[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

/** Render one persona exemplar seed into a 480px column (the canvas content width) and return its ui-card. */
async function renderSeed(name: string): Promise<HTMLElement> {
  const seed = personaExemplarSeeds.find((s) => s.name === name)
  if (seed === undefined) throw new Error(`no persona seed ${name}`)
  const mount = document.createElement('div')
  mount.style.inlineSize = '480px'
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
