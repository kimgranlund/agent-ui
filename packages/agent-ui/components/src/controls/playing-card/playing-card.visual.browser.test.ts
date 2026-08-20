import { describe, it, expect } from 'vitest'
import { page, server } from 'vitest/browser'

// ADR-0225 (GH #1478) — the DELIBERATELY minted visual goldens for ui-playing-card's first ship: the
// true face (corner indices + pip field/letter treatment, red/black pigment inks) and the CSS-painted
// back lattice, pinned as pixels (the ADR-0110 harness; the checkbox/ADR-0223 slice-2 precedent).
// Baselines commit under `__baselines__/playing-card.visual.browser.test.ts/<name>-chromium-darwin.png`;
// re-baseline only via `npm run test:visual:update` (a deliberate act).
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
import '@agent-ui/components/components'

const mount = (attrs = ''): { wrap: HTMLElement; host: HTMLElement } => {
  const wrap = document.createElement('div')
  wrap.style.padding = '16px'
  wrap.innerHTML = `<ui-playing-card ${attrs}></ui-playing-card>`
  document.body.append(wrap)
  return { wrap, host: wrap.querySelector('ui-playing-card') as HTMLElement }
}

describe('ui-playing-card — visual regression (the true face/back, ADR-0225)', () => {
  it.skipIf(server.browser !== 'chromium')('face: rank="A" suit="spades" — the single center pip, black ink', async () => {
    const { wrap, host } = mount('rank="A" suit="spades"')
    await (host as HTMLElement & { updateComplete?: Promise<unknown> }).updateComplete
    await expect.element(page.elementLocator(wrap)).toMatchScreenshot('playing-card-face-ace-spades')
    wrap.remove()
  })

  it.skipIf(server.browser !== 'chromium')('face: rank="10" suit="hearts" — the dense 10-pip layout, red ink', async () => {
    const { wrap, host } = mount('rank="10" suit="hearts"')
    await (host as HTMLElement & { updateComplete?: Promise<unknown> }).updateComplete
    await expect.element(page.elementLocator(wrap)).toMatchScreenshot('playing-card-face-ten-hearts')
    wrap.remove()
  })

  it.skipIf(server.browser !== 'chromium')('face: rank="Q" suit="diamonds" — the large center-letter treatment', async () => {
    const { wrap, host } = mount('rank="Q" suit="diamonds"')
    await (host as HTMLElement & { updateComplete?: Promise<unknown> }).updateComplete
    await expect.element(page.elementLocator(wrap)).toMatchScreenshot('playing-card-face-queen-diamonds')
    wrap.remove()
  })

  it.skipIf(server.browser !== 'chromium')('back: face-down — the CSS-painted cross-hatch lattice, no glyph', async () => {
    const { wrap, host } = mount('rank="A" suit="spades" face-down')
    await (host as HTMLElement & { updateComplete?: Promise<unknown> }).updateComplete
    await expect.element(page.elementLocator(wrap)).toMatchScreenshot('playing-card-back-face-down')
    wrap.remove()
  })

  it.skipIf(server.browser !== 'chromium')('size="lg" — the em-keyed box ramp at its largest tier', async () => {
    const { wrap, host } = mount('rank="A" suit="clubs" size="lg"')
    await (host as HTMLElement & { updateComplete?: Promise<unknown> }).updateComplete
    await expect.element(page.elementLocator(wrap)).toMatchScreenshot('playing-card-size-lg')
    wrap.remove()
  })
})
