import { describe, it, expect } from 'vitest'
import { page, server } from 'vitest/browser'

// ADR-0244: the deliberately minted visual goldens for ui-result-card's birth (the ADR-0110 harness; the
// service-card.visual.browser.test.ts precedent). Pins the four outcomes as the approved mockup draws them
// (section #rcard, two columns at the mockup's 968px width, light theme), the empty-box law, and the win
// card at the 360px frame minimum. Chromium-only. Baselines commit under
// `__baselines__/result-card.visual.browser.test.ts/<name>-chromium-darwin.png`; re-baseline only via
// `npm run test:visual:update` (a deliberate act, per ADR-0223's R5 golden-regen law).
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/base-styles.css' // the fleet sans body, so the golden reads like the mockup, not the UA serif
import '@agent-ui/components/all.css'
import '@agent-ui/components/all'

const CARDS = [
  `<ui-result-card outcome="win" result-title="Blackjack, hand 12" summary="You beat the dealer 20 to 18. Your stack is up for the night."
    stats='[{"label":"Chips","value":1290,"delta":50,"intent":"success"},{"label":"Hands","value":12},{"label":"Win rate","value":"58%"}]'>
    <ui-button>Play again</ui-button><ui-button variant="soft">Change bet</ui-button></ui-result-card>`,
  `<ui-result-card outcome="lose" result-title="Admiral, battle over" summary="All five of your ships are sunk. The enemy fleet has two left."
    stats='[{"label":"Shots","value":23},{"label":"Hits","value":5,"delta":-3,"intent":"danger"},{"label":"Ships left","value":0}]'>
    <ui-button>Play again</ui-button><ui-button variant="soft">Show board</ui-button></ui-result-card>`,
  `<ui-result-card outcome="draw" result-title="Tic-tac-toe" summary="The board is full and nobody has three in a row."
    stats='[{"label":"Moves","value":9},{"label":"Rounds won","value":"1 / 1"}]'>
    <ui-button>Play again</ui-button></ui-result-card>`,
  `<ui-result-card outcome="done" result-title="Trip plan booked" summary="Lisbon, 4 nights, 12 to 16 March. Your confirmation was sent."
    stats='[{"label":"Nights","value":4},{"label":"Total","value":"$1,240"}]'>
    <ui-button variant="soft">View itinerary</ui-button><ui-button variant="soft">Share</ui-button></ui-result-card>`,
  `<ui-result-card outcome="done" result-title="Quiz complete" summary="You answered 8 of 10 correctly."></ui-result-card>`,
]

const mount = (width: string, markup: string, columns = 1): HTMLElement => {
  const wrap = document.createElement('div')
  wrap.style.cssText = `inline-size:${width}; padding:20px; display:grid; gap:20px; align-items:start; grid-template-columns:repeat(${columns}, minmax(0, 1fr)); box-sizing:border-box;`
  wrap.innerHTML = markup
  document.body.append(wrap)
  return wrap
}

const settle = async (wrap: HTMLElement): Promise<void> => {
  for (const el of wrap.querySelectorAll('ui-result-card, ui-button')) {
    await (el as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete
  }
  await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
}

describe('ui-result-card: visual regression (ADR-0244 outcomes, the empty-box law, the 360px minimum)', () => {
  it.skipIf(server.browser !== 'chromium')('the four outcomes and the empty-box card, two columns at 968px (the mockup section)', async () => {
    await page.viewport(1024, 900) // the mockup's 968px section needs a wider frame than the fleet default
    const wrap = mount('968px', CARDS.join(''), 2)
    await settle(wrap)
    await expect.element(page.elementLocator(wrap)).toMatchScreenshot('result-card-outcomes')
    wrap.remove()
    await page.viewport(414, 896) // restore the fleet default viewport for the next test
  })

  it.skipIf(server.browser !== 'chromium')('win at the 360px frame minimum: stats wrap, buttons keep 36px', async () => {
    const wrap = mount('400px', CARDS[0]!)
    await settle(wrap)
    await expect.element(page.elementLocator(wrap)).toMatchScreenshot('result-card-win-360')
    wrap.remove()
  })
})
