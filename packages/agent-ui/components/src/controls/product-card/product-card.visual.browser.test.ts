import { describe, it, expect } from 'vitest'
import { page, server } from 'vitest/browser'

// ADR-0243: the minted visual goldens for ui-product-card's birth (the ADR-0110 harness, the
// service-card precedent). Pins the offer and exhibit-tile modes and the two ADR-0223 sizing postures as
// pixels. Chromium-only. Baselines commit under
// `__baselines__/product-card.visual.browser.test.ts/<name>-chromium-darwin.png`; re-baseline this file
// alone with `--update` scoped to it (a deliberate act).
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/all.css'
import '@agent-ui/components/all'
import '@agent-ui/icons/phosphor' // registers the Phosphor pack so the icon header resolves a real glyph

// A solid 16x10 SVG so the image pixels are deterministic (no network, no decode race in the shot).
const IMAGE =
  'data:image/svg+xml,' +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="10"><rect width="16" height="10" fill="#6b8fb3"/></svg>')

const mount = async (markup: string): Promise<HTMLElement> => {
  const wrap = document.createElement('div')
  wrap.style.inlineSize = '320px'
  wrap.style.padding = '8px'
  wrap.innerHTML = markup
  document.body.append(wrap)
  const host = wrap.querySelector('ui-product-card') as HTMLElement & { updateComplete: Promise<unknown> }
  await host.updateComplete
  const img = host.querySelector('img')
  if (img) await img.decode().catch(() => undefined)
  return wrap
}

describe('ui-product-card: visual regression (ADR-0243 modes, ADR-0223 sizing postures)', () => {
  it.skipIf(server.browser !== 'chromium')('offer: image, badge, rating, price and action', async () => {
    const wrap = await mount(
      `<ui-product-card title="Harbour View Suite, king bed" subtitle="Sleeps 2, free cancellation" image="${IMAGE}" image-alt="" rating="4.8" badge="Best rate" badge-intent="success" price="$312" price-note="/ night" action-label="Book" action='{"action":"book"}'></ui-product-card>`,
    )
    await expect.element(page.elementLocator(wrap)).toMatchScreenshot('product-card-offer')
    wrap.remove()
  })

  it.skipIf(server.browser !== 'chromium')('exhibit tile: icon header, no price, no action', async () => {
    const wrap = await mount(
      `<ui-product-card title="Bronze astrolabe, 14th century" subtitle="Gallery 3, Islamic science" icon="star" badge="On loan" badge-intent="info"></ui-product-card>`,
    )
    await expect.element(page.elementLocator(wrap)).toMatchScreenshot('product-card-exhibit')
    wrap.remove()
  })

  it.skipIf(server.browser !== 'chromium')('FILL (default): a bare ui-product-card stretches to its block container', async () => {
    const wrap = await mount(`<ui-product-card title="Garden Room" price="$198" action='{"action":"book"}'></ui-product-card>`)
    await expect.element(page.elementLocator(wrap)).toMatchScreenshot('product-card-fill-default')
    wrap.remove()
  })

  it.skipIf(server.browser !== 'chromium')('[inline] hug: the ui-product-card hugs its own content width', async () => {
    const wrap = await mount(`<ui-product-card title="Garden Room" price="$198" action='{"action":"book"}' inline></ui-product-card>`)
    await expect.element(page.elementLocator(wrap)).toMatchScreenshot('product-card-inline-hug')
    wrap.remove()
  })
})
