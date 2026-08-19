import { describe, it, expect } from 'vitest'
import { page, server } from 'vitest/browser'

// ADR-0224 — the DELIBERATELY minted visual goldens for ui-service-card's birth (the ADR-0110 harness;
// the textarea/text-field ADR-0223 slice precedent). Pins BOTH availability postures (the accent
// edge/dot/title-mute cascade, cl.4) and the two ADR-0223 sizing postures (fill default / [inline] hug)
// as pixels. Chromium-only. Baselines commit under
// `__baselines__/service-card.visual.browser.test.ts/<name>-chromium-darwin.png`; re-baseline only via
// `npm run test:visual:update` (a deliberate act, per ADR-0223's R5 golden-regen law).
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
import '@agent-ui/components/components'

const mount = (markup: string): { wrap: HTMLElement; host: HTMLElement } => {
  const wrap = document.createElement('div')
  wrap.style.inlineSize = '360px' // a fixed block container so the fill posture is a stable pixel truth
  wrap.style.padding = '8px'
  wrap.innerHTML = markup
  document.body.append(wrap)
  return { wrap, host: wrap.querySelector('ui-service-card') as HTMLElement }
}

describe('ui-service-card — visual regression (ADR-0224 availability postures + ADR-0223 sizing postures)', () => {
  it.skipIf(server.browser !== 'chromium')('available: the accent edge/dot/title read success-tinted', async () => {
    const { wrap, host } = mount(
      `<ui-service-card name="Claims Agent" path="/claims-agent-service" description="Handles first-notice-of-loss intake." available></ui-service-card>`,
    )
    await (host as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete
    await expect.element(page.elementLocator(wrap)).toMatchScreenshot('service-card-available')
    wrap.remove()
  })

  it.skipIf(server.browser !== 'chromium')('unavailable: the accent edge/dot/title mute + the chip reads "Unavailable"', async () => {
    const { wrap, host } = mount(
      `<ui-service-card name="Claims Agent" path="/claims-agent-service" description="Handles first-notice-of-loss intake."></ui-service-card>`,
    )
    // `available` defaults TRUE (the self-reflect-on-connect guard writes the attribute), so an
    // attribute-less mount is NOT the unavailable posture — flip it via the public property, the only
    // way to reach unavailable (caught at the desk 2026-08-19: this golden minted identical to the
    // available one before this line existed).
    ;(host as HTMLElement & { available: boolean }).available = false
    await (host as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete
    await expect.element(page.elementLocator(wrap)).toMatchScreenshot('service-card-unavailable')
    wrap.remove()
  })

  it.skipIf(server.browser !== 'chromium')('FILL (default): a bare ui-service-card stretches to its block container', async () => {
    const { wrap, host } = mount(`<ui-service-card name="Claims Agent" path="/svc" available></ui-service-card>`)
    await (host as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete
    await expect.element(page.elementLocator(wrap)).toMatchScreenshot('service-card-fill-default')
    wrap.remove()
  })

  it.skipIf(server.browser !== 'chromium')('[inline] hug: the ui-service-card hugs its own content width', async () => {
    const { wrap, host } = mount(`<ui-service-card name="Claims Agent" path="/svc" available inline></ui-service-card>`)
    await (host as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete
    await expect.element(page.elementLocator(wrap)).toMatchScreenshot('service-card-inline-hug')
    wrap.remove()
  })
})
