import { describe, it, expect } from 'vitest'
import { page, server } from 'vitest/browser'

// T-0195: the deliberately minted visual goldens for ui-confirm-receipt's birth (the ADR-0110 harness; the
// result-card.visual.browser.test.ts precedent). Pins Direction A as the approved mockup draws it: a booking and an
// order, each read-back and settled, on the A2UI canvas register (`data-tier="widget" data-scale="md"`, so Back and
// Confirm are the 28px lg step), in the light scheme and the dark scheme, then the order in the 400px column.
// Dark is set on the stage's own `color-scheme` (the super-shell.visual precedent), and the dark leg asserts the dark
// arm resolved before it compares a pixel. Chromium-only. Baselines commit under
// `__baselines__/confirm-receipt.visual.browser.test.ts/<name>-chromium-darwin.png`; re-baseline only via
// `npm run test:visual:update` (a deliberate act, per ADR-0223's R5 golden-regen law).
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/base-styles.css' // the fleet sans body, so the golden reads like the mockup, not the UA serif
import '@agent-ui/components/all.css'
import '@agent-ui/components/all'

const BOOKING_ROWS = JSON.stringify([
  { label: 'Arrival', path: 'checkIn' },
  { label: 'Departure', path: 'checkOut' },
  { label: 'Guests', path: 'guests' },
  { label: 'Room', path: 'room', options: [{ value: 'garden', label: 'Garden suite, king' }] },
  { label: 'Extras', path: 'extras' },
])
const BOOKING_DATA = JSON.stringify({
  checkIn: '2026-10-12', checkOut: '2026-10-15', guests: '2', room: 'garden',
  extras: 'Breakfast, late check-out', total: '$1,140.00', ref: 'Booking HX-2214',
})
const ORDER_ITEMS = JSON.stringify([
  { label: 'Linen tea towel', quantity: 2, amount: '$24.00' },
  { label: 'Stoneware mug, sand', quantity: 1, amount: '$18.00' },
  { label: 'Beeswax candle', quantity: 3, amount: '$27.00' },
])
const ORDER_ROWS = JSON.stringify([
  { label: 'Subtotal', path: 'subtotal' },
  { label: 'Shipping', path: 'shipping' },
])
const ORDER_DATA = JSON.stringify({ subtotal: '$69.00', shipping: '$6.00', total: '$75.00', ref: 'Order #10482' })

const booking = (status: 'pending' | 'confirmed'): string =>
  `<ui-confirm-receipt receipt-title="Your stay" status="${status}" ref-path="ref"
    rows='${BOOKING_ROWS}' total='{"label":"Total, 3 nights","path":"total"}' data='${BOOKING_DATA}'
    confirm-action='{"action":"confirm_booking"}' back-action='{"action":"edit_booking"}'></ui-confirm-receipt>`

const order = (status: 'pending' | 'confirmed'): string =>
  `<ui-confirm-receipt receipt-title="Your order" status="${status}" ref-path="ref"
    items='${ORDER_ITEMS}' rows='${ORDER_ROWS}' total='{"label":"Total","path":"total"}' data='${ORDER_DATA}'
    confirm-action='{"action":"place_order"}' back-action='{"action":"edit_cart"}'></ui-confirm-receipt>`

const FOUR = [booking('pending'), booking('confirmed'), order('pending'), order('confirmed')].join('')

const mount = (width: string, markup: string, columns: number, scheme: 'light' | 'dark'): HTMLElement => {
  const wrap = document.createElement('div')
  wrap.setAttribute('data-tier', 'widget')
  wrap.setAttribute('data-scale', 'md')
  wrap.style.cssText = `inline-size:${width}; padding:16px; display:grid; gap:16px; align-items:start; grid-template-columns:repeat(${columns}, minmax(0, 1fr)); box-sizing:border-box; color-scheme:${scheme}; background:var(--md-sys-color-neutral-surface); color:var(--md-sys-color-neutral-on-surface);`
  wrap.innerHTML = markup
  document.body.append(wrap)
  return wrap
}

const settle = async (wrap: HTMLElement): Promise<void> => {
  for (const el of wrap.querySelectorAll('ui-confirm-receipt, ui-glyph')) {
    await (el as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete
  }
  await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
}

/** Mean sRGB channel of the surface role resolved inside `wrap`: near-white in light, near-black in dark. The
 *  computed colour may serialize as oklch(), so it is painted on a 1px canvas and read back as sRGB bytes. */
const surfaceMean = (wrap: HTMLElement): number => {
  const probe = document.createElement('div')
  probe.style.color = 'var(--md-sys-color-neutral-surface)'
  wrap.append(probe)
  const computed = getComputedStyle(probe).color
  probe.remove()
  const ctx = document.createElement('canvas').getContext('2d')!
  ctx.fillStyle = '#ff00ff' // a sentinel: an unparsed colour leaves it, and the mean lands mid-range on purpose
  ctx.fillStyle = computed
  ctx.fillRect(0, 0, 1, 1)
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
  expect(ctx.fillStyle, `the surface role must parse as a colour, got ${computed}`).not.toBe('#ff00ff')
  return (r! + g! + b!) / 3
}

/** Anti-vacuity: two receipts are settled (mark, no actions) and two ask (actions, no mark). */
const expectStates = (wrap: HTMLElement, settled: number, asking: number): void => {
  expect(wrap.querySelectorAll('ui-confirm-receipt [data-part="mark"]')).toHaveLength(settled)
  expect(wrap.querySelectorAll('ui-confirm-receipt [data-part="actions"]')).toHaveLength(asking)
}

describe('ui-confirm-receipt: visual regression (T-0195 Direction A)', () => {
  it.skipIf(server.browser !== 'chromium')('booking and order, read-back and settled, light, two columns', async () => {
    await page.viewport(900, 1000)
    const wrap = mount('860px', FOUR, 2, 'light')
    await settle(wrap)
    expect(surfaceMean(wrap), 'the light stage resolved the dark arm').toBeGreaterThan(160)
    expectStates(wrap, 2, 2)
    await expect.element(page.elementLocator(wrap)).toMatchScreenshot('confirm-receipt-light')
    wrap.remove()
    await page.viewport(414, 896) // restore the fleet default viewport for the next test
  })

  it.skipIf(server.browser !== 'chromium')('booking and order, read-back and settled, dark, two columns', async () => {
    await page.viewport(900, 1000)
    const wrap = mount('860px', FOUR, 2, 'dark')
    await settle(wrap)
    expect(surfaceMean(wrap), 'the stage did not resolve the DARK arm; this would be a light shot under a dark name').toBeLessThan(96)
    expectStates(wrap, 2, 2)
    await expect.element(page.elementLocator(wrap)).toMatchScreenshot('confirm-receipt-dark')
    wrap.remove()
    await page.viewport(414, 896)
  })

  it.skipIf(server.browser !== 'chromium')('the order in the 400px column, read-back over settled', async () => {
    const wrap = mount('400px', order('pending') + order('confirmed'), 1, 'light')
    await settle(wrap)
    expectStates(wrap, 1, 1)
    await expect.element(page.elementLocator(wrap)).toMatchScreenshot('confirm-receipt-400')
    wrap.remove()
  })
})
