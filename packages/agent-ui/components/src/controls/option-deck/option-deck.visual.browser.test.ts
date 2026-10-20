import { describe, it, expect } from 'vitest'
import { page, server } from 'vitest/browser'

// T-0193: the deliberately minted visual goldens for ui-option-deck's birth (the ADR-0110 harness, the
// service-card.visual.browser.test.ts precedent). Pins the approved playful direction on the A2UI canvas register
// (widget / md): the two-track deck with a picked card and the dashed Surprise me card, and the one-column row
// form at the 400px column. Chromium-only. Baselines commit under
// `__baselines__/option-deck.visual.browser.test.ts/<name>-chromium-darwin.png`; re-baseline only via
// `npm run test:visual:update` (a deliberate act).
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/base-styles.css' // the fleet sans body, so the golden reads like the mockup, not the UA serif
import '@agent-ui/components/all.css'
import '@agent-ui/components/all'
import '@agent-ui/icons/phosphor' // registers the Phosphor pack so each disc resolves a real glyph

const OPTIONS = [
  { value: 'blackjack', title: 'Blackjack', description: 'Beat the dealer to 21 without going bust.', icon: 'star', tone: 'primary', index: 'A', meta: ['1 to 6 players', '5 min', 'Easy'] },
  { value: 'holdem', title: "Texas Hold'em", description: 'Two hole cards, five on the board, best hand wins.', icon: 'heart', tone: 'accent', index: 'K', meta: ['2 to 9 players', '15 min', 'Medium'] },
  { value: 'draw', title: 'Five-card draw', description: 'Swap up to three cards once, then show down.', icon: 'sparkle', tone: 'info', index: '5', meta: ['2 to 6 players', '10 min', 'Easy'] },
]

const mount = (width: string): { wrap: HTMLElement; host: HTMLElement } => {
  const wrap = document.createElement('div')
  wrap.dataset.tier = 'widget'
  wrap.dataset.scale = 'md'
  wrap.style.inlineSize = width // a fixed block container so the grid tracks are a stable pixel truth
  wrap.style.padding = '12px'
  const host = document.createElement('ui-option-deck')
  Object.assign(host, {
    heading: 'Pick your table',
    subheading: 'Every table starts you with 1,000 chips.',
    allowRandom: true,
    value: 'blackjack',
    options: OPTIONS,
  })
  wrap.append(host)
  document.body.append(wrap)
  return { wrap, host }
}

describe('ui-option-deck: visual regression (T-0193 approved playful direction)', () => {
  it.skipIf(server.browser !== 'chromium')('two tracks: tone bands, corner index, picked card pill, dashed Surprise me', async () => {
    const { wrap, host } = mount('704px')
    await (host as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete
    await expect.element(page.elementLocator(wrap)).toMatchScreenshot('option-deck-two-track')
    wrap.remove()
  })

  it.skipIf(server.browser !== 'chromium')('the 400px column: one track, each card a horizontal row', async () => {
    const { wrap, host } = mount('400px')
    await (host as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete
    await expect.element(page.elementLocator(wrap)).toMatchScreenshot('option-deck-400')
    wrap.remove()
  })
})
