import { describe, it, expect } from 'vitest'
import { page, server } from 'vitest/browser'

// T-0196: the deliberately minted visual goldens for ui-amount-picker's birth (the ADR-0110 harness; the
// result-card.visual.browser.test.ts precedent). Pins the six states the approved mockup draws (chips on and off,
// slider on and off, currency and unit, at min and at max), each on an A2UI canvas at widget / md, two columns,
// in the light and the dark scheme. Dark is set on the stage's own `color-scheme` (the super-shell.visual
// precedent), and the leg asserts the dark arm resolved before it compares a pixel. Chromium-only. Baselines
// commit under `__baselines__/amount-picker.visual.browser.test.ts/<name>-chromium-darwin.png`; re-baseline only
// via `npm run test:visual:update` (a deliberate act, ADR-0223's R5 golden-regen law).
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/base-styles.css' // the fleet sans body, so the golden reads like the mockup, not the UA serif
import '@agent-ui/components/all.css'
import '@agent-ui/components/all'

const STATES = [
  `<ui-amount-picker label="Quantity" min="1" max="20" value="4" presets="[1,2,4,8]" action-name="add_to_cart" action-label="Add to cart"></ui-amount-picker>`,
  `<ui-amount-picker label="Your offer" min="200" max="600" step="10" value="420" currency="USD" slider action-name="send_offer" action-label="Send offer"></ui-amount-picker>`,
  `<ui-amount-picker label="Guests" min="1" max="8" value="2"></ui-amount-picker>`,
  `<ui-amount-picker label="Distance" min="1" max="42" value="12" unit="kilometer" presets="[5,10,21,42]" slider action-name="set_distance" action-label="Set distance"></ui-amount-picker>`,
  `<ui-amount-picker label="Quantity" min="1" max="20" value="1" presets="[1,2,4,8]" action-name="add_to_cart" action-label="Add to cart"></ui-amount-picker>`,
  `<ui-amount-picker label="Bet" min="5" max="250" step="5" value="250" currency="USD" presets="[25,50,100,250]" slider action-name="place_bet" action-label="Place bet"></ui-amount-picker>`,
]

const stage = (scheme: 'light' | 'dark'): HTMLElement => {
  const wrap = document.createElement('div')
  wrap.style.cssText = `inline-size:832px; padding:16px; display:grid; gap:16px; align-items:start; grid-template-columns:repeat(2, minmax(0, 1fr)); box-sizing:border-box; color-scheme:${scheme}; background:var(--md-sys-color-neutral-surface);`
  wrap.innerHTML = STATES.map(
    (markup) => `<section data-tier="widget" data-scale="md" style="background:var(--md-sys-color-neutral-surface-bright); border-radius:var(--md-sys-widget-radius); padding:var(--md-sys-widget-margin);">${markup}</section>`,
  ).join('')
  document.body.append(wrap)
  return wrap
}

const settle = async (wrap: HTMLElement): Promise<void> => {
  for (const el of wrap.querySelectorAll('ui-amount-picker, ui-slider, ui-glyph')) {
    await (el as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete
  }
  await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
}

/** The mean RGB channel of the stage's surface role, read through a probe: low means the dark arm resolved. */
const surfaceLuma = (wrap: HTMLElement): number => {
  const probe = document.createElement('div')
  probe.style.backgroundColor = 'var(--md-sys-color-neutral-surface)'
  wrap.append(probe)
  const canvas = document.createElement('canvas').getContext('2d')!
  canvas.fillStyle = getComputedStyle(probe).backgroundColor
  canvas.fillRect(0, 0, 1, 1)
  const [r, g, b] = canvas.getImageData(0, 0, 1, 1).data
  probe.remove()
  return (r! + g! + b!) / 3
}

describe('ui-amount-picker: visual regression (the six mockup states, light and dark)', () => {
  for (const scheme of ['light', 'dark'] as const) {
    it.skipIf(server.browser !== 'chromium')(`the six states on the widget md canvas, ${scheme}`, async () => {
      await page.viewport(900, 900)
      const wrap = stage(scheme)
      await settle(wrap)
      const luma = surfaceLuma(wrap)
      if (scheme === 'dark') expect(luma).toBeLessThan(96)
      else expect(luma).toBeGreaterThan(160)
      await expect.element(page.elementLocator(wrap)).toMatchScreenshot(`amount-picker-states-${scheme}`)
      wrap.remove()
      await page.viewport(414, 896) // restore the fleet default viewport for the next test
    })
  }
})
