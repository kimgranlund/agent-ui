import { describe, it, expect } from 'vitest'
import { page, server } from 'vitest/browser'
import { whenFlushed } from '@agent-ui/components'
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/base-styles.css' // the fleet sans body, so the golden reads like the mockup, not the UA serif
import '@agent-ui/components/all.css'
import '@agent-ui/components/all'
import { createRenderer } from '../../../renderer/renderer.ts'

// T-0199: the Itinerary goldens (the booking-form.visual.browser.test.ts pattern, the ADR-0110 harness), rendered by
// the real renderer on the A2UI canvas register (widget md). The approved mockup's three-day Lisbon trip (Kim
// 2026-10-21, direction A, days stacked): day 1 done, day 2 under way with a weather aside, day 3 pending with an FX
// aside, in the light scheme and the dark scheme, then in the 400px column. Chromium-only. Baselines commit under
// `__baselines__/itinerary.visual.browser.test.ts/<name>-chromium-darwin.png`; re-baseline only via
// `npm run test:visual:update` (a deliberate act, per ADR-0223's R5 golden-regen law).

const TRIP = [
  {
    label: 'Fri 14 Nov, arrival',
    stops: [
      { time: '10:40', label: 'Land at LIS', detail: 'TP 1351, terminal 1', status: 'done' },
      { time: '12:30', label: 'Check in, Alfama Patio', detail: 'Rua das Escolas Gerais 3', status: 'done' },
      { time: '19:30', label: 'Dinner, Taberna da Rua', status: 'done' },
    ],
  },
  {
    label: 'Sat 15 Nov, Belem',
    aside: '18°C, sun',
    stops: [
      { time: '09:00', label: 'Tram 15 to Belem', status: 'done' },
      { time: '10:00', label: 'Jeronimos Monastery', detail: 'Tickets on your phone', status: 'active' },
      { time: '12:30', label: 'Pasteis de Belem', status: 'pending' },
      { time: '15:00', label: 'MAAT riverside walk', status: 'pending' },
    ],
  },
  {
    label: 'Sun 16 Nov, Sintra',
    aside: '1 EUR = 1.08 USD',
    stops: [
      { time: '09:15', label: 'Train from Rossio', detail: 'Platform 3, every 20 minutes', status: 'pending' },
      { time: '11:00', label: 'Pena Palace', detail: 'Timed entry 11:00', status: 'pending' },
      { time: '17:30', label: 'Back to Lisbon', status: 'pending' },
    ],
  },
]

const mount = async (width: string, scheme: 'light' | 'dark') => {
  const wrap = document.createElement('div')
  wrap.style.cssText = `inline-size:${width}; padding:16px; box-sizing:border-box; color-scheme:${scheme}; background:var(--md-sys-color-neutral-surface); color:var(--md-sys-color-neutral-on-surface);`
  document.body.append(wrap)
  const cell = document.createElement('div')
  wrap.append(cell)
  const r = createRenderer()
  r.mount(cell)
  await r.preload('agent-ui--hospitality')
  r.ingestMessage({ version: 'v1.0', createSurface: { surfaceId: 'trip', catalogId: 'agent-ui--hospitality' } })
  r.ingestMessage({ version: 'v1.0', updateDataModel: { surfaceId: 'trip', path: '/trip/days', value: TRIP } })
  r.ingestMessage({
    version: 'v1.0',
    updateComponents: {
      surfaceId: 'trip',
      components: [{ id: 'root', component: 'Itinerary', title: 'Lisbon, 3 days', days: { path: '/trip/days' } }],
    },
  })
  r.finalize('trip')
  await whenFlushed()
  for (const el of wrap.querySelectorAll('*')) {
    const pending = (el as HTMLElement & { updateComplete?: Promise<unknown> }).updateComplete
    if (pending !== undefined) await pending
  }
  await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
  const done = (): void => {
    r.dispose()
    wrap.remove()
  }
  return { wrap, done }
}

/** Mean sRGB channel of the surface role resolved inside `wrap`: near-white in light, near-black in dark. */
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

/** Anti-vacuity: three days drawn, ten stops, two asides. */
const expectTrip = (wrap: HTMLElement): void => {
  const days = [...wrap.querySelectorAll('[data-part="day"]')]
  expect(days).toHaveLength(3)
  for (const day of days) expect(day.getBoundingClientRect().height).toBeGreaterThan(0)
  expect(wrap.querySelectorAll('ui-timeline-item')).toHaveLength(10)
  expect(wrap.querySelectorAll('[data-part="aside"]')).toHaveLength(2)
}

describe('Itinerary: visual regression (T-0199)', () => {
  it.skipIf(server.browser !== 'chromium')('three-day trip, light', async () => {
    await page.viewport(900, 1200)
    const { wrap, done } = await mount('560px', 'light')
    expect(surfaceMean(wrap), 'the light stage resolved the dark arm').toBeGreaterThan(160)
    expectTrip(wrap)
    await expect.element(page.elementLocator(wrap)).toMatchScreenshot('itinerary-light')
    done()
    await page.viewport(414, 896) // restore the fleet default viewport for the next test
  })

  it.skipIf(server.browser !== 'chromium')('three-day trip, dark', async () => {
    await page.viewport(900, 1200)
    const { wrap, done } = await mount('560px', 'dark')
    expect(surfaceMean(wrap), 'the stage did not resolve the DARK arm; this would be a light shot under a dark name').toBeLessThan(96)
    expectTrip(wrap)
    await expect.element(page.elementLocator(wrap)).toMatchScreenshot('itinerary-dark')
    done()
    await page.viewport(414, 896)
  })

  it.skipIf(server.browser !== 'chromium')('three-day trip in the 400px column', async () => {
    await page.viewport(414, 1400)
    const { wrap, done } = await mount('400px', 'light')
    expectTrip(wrap)
    await expect.element(page.elementLocator(wrap)).toMatchScreenshot('itinerary-400')
    done()
    await page.viewport(414, 896)
  })
})
