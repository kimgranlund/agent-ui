import { describe, it, expect } from 'vitest'
import { page, server } from 'vitest/browser'
import { whenFlushed } from '@agent-ui/components'
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/base-styles.css' // the fleet sans body, so the golden reads like the mockup, not the UA serif
import '@agent-ui/components/all.css'
import '@agent-ui/components/all'
import { createRenderer } from '../../../renderer/renderer.ts'

// T-0197: the first BookingForm goldens (the confirm-receipt.visual.browser.test.ts pattern, the ADR-0110 harness),
// rendered by the real renderer on the A2UI canvas register (widget md). Two forms: the Maitre d' table booking
// (dateSingle, radio, stepper, text) and the Concierge stay (dateRange, time, stepper, select). They pin the
// producer's Button under the card at the end edge (Kim 2026-10-20, ConfirmReceipt's action bar) and the option text
// at the field size, in the light scheme and the dark scheme, then both in the 400px column. Chromium-only. Baselines
// commit under `__baselines__/booking-form.visual.browser.test.ts/<name>-chromium-darwin.png`; re-baseline only via
// `npm run test:visual:update` (a deliberate act, per ADR-0223's R5 golden-regen law).

type Form = { id: string; title: string; fields: unknown[]; value: Record<string, unknown>; button: string }

const TABLE: Form = {
  id: 'table',
  title: 'Book a table at Vela',
  fields: [
    { kind: 'dateSingle', path: 'date', label: 'Date', required: true },
    { kind: 'radio', path: 'seating', label: 'Seating', required: true, options: [{ value: '18:00', label: '18:00' }, { value: '20:30', label: '20:30' }] },
    { kind: 'stepper', path: 'covers', label: 'Covers', required: true, min: 1, max: 12, step: 1 },
    { kind: 'text', path: 'notes', label: 'Dietary notes' },
  ],
  value: { date: '2026-10-24', seating: '20:30', covers: 2 },
  button: 'Confirm',
}

const STAY: Form = {
  id: 'stay',
  title: 'Your stay at the Grand Meridian',
  fields: [
    { kind: 'dateRange', path: 'checkIn', endPath: 'checkOut', label: 'Arrival', endLabel: 'Departure', required: true },
    { kind: 'time', path: 'arrivalTime', label: 'Arrival time' },
    { kind: 'stepper', path: 'guests', label: 'Guests', required: true, min: 1, max: 4, step: 1 },
    {
      kind: 'select',
      path: 'room',
      label: 'Room',
      required: true,
      options: [
        { value: 'garden-double', label: 'Garden double' },
        { value: 'sea-double', label: 'Sea-view double' },
        { value: 'junior-suite', label: 'Junior suite' },
      ],
    },
  ],
  value: { checkIn: '2026-11-06', checkOut: '2026-11-09', arrivalTime: '15:30', guests: 2, room: 'sea-double' },
  button: 'Book stay',
}

/** A stage of `columns` cells, each mounting one form through its own renderer. */
const mount = async (width: string, columns: number, scheme: 'light' | 'dark') => {
  const wrap = document.createElement('div')
  wrap.style.cssText = `inline-size:${width}; padding:16px; display:grid; gap:16px; align-items:start; grid-template-columns:repeat(${columns}, minmax(0, 1fr)); box-sizing:border-box; color-scheme:${scheme}; background:var(--md-sys-color-neutral-surface); color:var(--md-sys-color-neutral-on-surface);`
  document.body.append(wrap)
  const renderers: ReturnType<typeof createRenderer>[] = []
  for (const form of [TABLE, STAY]) {
    const cell = document.createElement('div')
    wrap.append(cell)
    const r = createRenderer()
    r.mount(cell)
    await r.preload('agent-ui--concierge')
    r.ingestMessage({ version: 'v1.0', createSurface: { surfaceId: form.id, catalogId: 'agent-ui--concierge' } })
    r.ingestMessage({ version: 'v1.0', updateDataModel: { surfaceId: form.id, path: '/booking', value: form.value } })
    r.ingestMessage({
      version: 'v1.0',
      updateComponents: {
        surfaceId: form.id,
        components: [
          { id: 'root', component: 'BookingForm', title: form.title, fields: form.fields, value: { path: '/booking' }, child: 'submit' },
          { id: 'submit', component: 'Button', variant: 'solid', label: form.button, action: { action: 'book', submit: true } },
        ],
      },
    })
    r.finalize(form.id)
    renderers.push(r)
  }
  await whenFlushed()
  for (const el of wrap.querySelectorAll('*')) {
    const pending = (el as HTMLElement & { updateComplete?: Promise<unknown> }).updateComplete
    if (pending !== undefined) await pending
  }
  await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
  const done = (): void => {
    for (const r of renderers) r.dispose()
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

/** Anti-vacuity: both forms rendered, each Button outside and below its card. */
const expectForms = (wrap: HTMLElement): void => {
  const forms = [...wrap.querySelectorAll('ui-form-provider')]
  expect(forms).toHaveLength(2)
  for (const form of forms) {
    const [card, button] = [form.querySelector('[data-part="card"]')!, form.querySelector(':scope > ui-button')!]
    expect(button.getBoundingClientRect().top).toBeGreaterThan(card.getBoundingClientRect().bottom)
  }
  expect(wrap.querySelectorAll('ui-amount-picker')).toHaveLength(2)
  expect(wrap.querySelectorAll('ui-radio')).toHaveLength(2)
}

describe('BookingForm: visual regression (T-0197)', () => {
  it.skipIf(server.browser !== 'chromium')('table booking and stay, light, two columns', async () => {
    await page.viewport(900, 1000)
    const { wrap, done } = await mount('860px', 2, 'light')
    expect(surfaceMean(wrap), 'the light stage resolved the dark arm').toBeGreaterThan(160)
    expectForms(wrap)
    await expect.element(page.elementLocator(wrap)).toMatchScreenshot('booking-form-light')
    done()
    await page.viewport(414, 896) // restore the fleet default viewport for the next test
  })

  it.skipIf(server.browser !== 'chromium')('table booking and stay, dark, two columns', async () => {
    await page.viewport(900, 1000)
    const { wrap, done } = await mount('860px', 2, 'dark')
    expect(surfaceMean(wrap), 'the stage did not resolve the DARK arm; this would be a light shot under a dark name').toBeLessThan(96)
    expectForms(wrap)
    await expect.element(page.elementLocator(wrap)).toMatchScreenshot('booking-form-dark')
    done()
    await page.viewport(414, 896)
  })

  it.skipIf(server.browser !== 'chromium')('both forms in the 400px column', async () => {
    await page.viewport(414, 1400)
    const { wrap, done } = await mount('400px', 1, 'light')
    expectForms(wrap)
    await expect.element(page.elementLocator(wrap)).toMatchScreenshot('booking-form-400')
    done()
    await page.viewport(414, 896)
  })
})
