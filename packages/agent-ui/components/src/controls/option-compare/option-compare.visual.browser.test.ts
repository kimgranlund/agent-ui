import { describe, it, expect } from 'vitest'
import { page, server } from 'vitest/browser'

// T-0393: the deliberately minted visual goldens for ui-option-compare's birth (the ADR-0110 harness; the
// step-flow.visual.browser.test.ts precedent). Pins Direction A as the approved mockup
// (.sdlc/tickets/.0199-itinerary-compare/mockup/option-compare.html) draws it: three options with the best mark and
// no pick, the picked state (Bus), and four options at the 400px column scrolling inside the control with the
// label column pinned. Each tile is an A2UI canvas (`data-tier="widget" data-scale="md"`, the surface-bright plane
// with the widget margin) in a 400px column, in the light scheme and the dark scheme. Dark is set on the column's
// own `color-scheme` (the super-shell.visual precedent), and each dark leg asserts the dark arm resolved before it
// compares a pixel. Chromium-only. Baselines commit under
// `__baselines__/option-compare.visual.browser.test.ts/<name>-chromium-darwin.png`; re-baseline only via
// `--update` on this file (a deliberate act, per ADR-0223's R5 golden-regen law).
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/base-styles.css' // the fleet sans body, so the golden reads like the mockup, not the UA serif
import '@agent-ui/components/all.css'
import '@agent-ui/components/all'

const ROWS = [
  { key: 'duration', label: 'Duration' },
  { key: 'price', label: 'Price' },
  { key: 'departs', label: 'Departs' },
  { key: 'changes', label: 'Changes' },
]
const TRAIN = { value: 'train', title: 'Train', subtitle: 'Alfa Pendular', values: { duration: '2h 50m', price: 'EUR 32', departs: '09:09', changes: 'None' } }
const BUS = { value: 'bus', title: 'Bus', subtitle: 'Rede Expressos', values: { duration: '3h 30m', price: 'EUR 19', departs: '08:30', changes: 'None' } }
const FLIGHT = { value: 'flight', title: 'Flight', subtitle: 'TP 1940', values: { duration: '55m', price: 'EUR 89', departs: '11:15', changes: 'None' } }
const CAR = { value: 'car', title: 'Car', subtitle: 'Rental, A1', values: { duration: '3h 10m', price: 'EUR 64', departs: 'Any', changes: 'None' } }

type Tile = { options: unknown[]; value?: string }
const BEST: Tile = { options: [TRAIN, BUS, FLIGHT] }
const PICKED: Tile = { options: [TRAIN, BUS, FLIGHT], value: 'bus' }
const FOUR: Tile = { options: [TRAIN, BUS, FLIGHT, CAR] }

/** One 400px column in `scheme`, holding one A2UI canvas per tile. */
const column = (tiles: readonly Tile[], scheme: 'light' | 'dark'): HTMLElement => {
  const col = document.createElement('div')
  col.dataset.scheme = scheme
  col.style.cssText = `inline-size:400px; box-sizing:border-box; padding:12px; display:grid; gap:12px; color-scheme:${scheme}; background:var(--md-sys-color-neutral-surface); color:var(--md-sys-color-neutral-on-surface);`
  for (const tile of tiles) {
    const canvas = document.createElement('div')
    canvas.setAttribute('data-tier', 'widget')
    canvas.setAttribute('data-scale', 'md')
    canvas.style.cssText = 'display:grid; min-inline-size:0; padding:var(--md-sys-widget-margin); border-radius:var(--md-sys-widget-radius); background:var(--md-sys-color-neutral-surface-bright);'
    const host = document.createElement('ui-option-compare')
    Object.assign(host, { heading: 'Lisbon to Porto', best: 'train', rows: ROWS, options: tile.options, value: tile.value ?? '' })
    canvas.append(host)
    col.append(canvas)
  }
  return col
}

const mount = (columns: readonly HTMLElement[]): HTMLElement => {
  const stage = document.createElement('div')
  stage.style.cssText = 'display:flex; gap:16px; align-items:start; inline-size:max-content;'
  stage.append(...columns)
  document.body.append(stage)
  return stage
}

const settle = async (stage: HTMLElement): Promise<void> => {
  for (const el of stage.querySelectorAll('ui-option-compare')) await (el as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete
  ;(document.activeElement as HTMLElement | null)?.blur()
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(null))))
}

/** Mean sRGB channel of the surface role resolved inside `el`: near-white in light, near-black in dark. The
 *  computed colour may serialize as oklch(), so it is painted on a 1px canvas and read back as sRGB bytes. */
const surfaceMean = (el: HTMLElement): number => {
  const probe = document.createElement('div')
  probe.style.color = 'var(--md-sys-color-neutral-surface)'
  el.append(probe)
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

/** Anti-vacuity: the best mark, the pick and, for four options, the in-control overflow are all on screen. */
const expectStates = (col: HTMLElement, tiles: readonly Tile[]): void => {
  const hosts = Array.from(col.querySelectorAll('ui-option-compare'))
  expect(hosts).toHaveLength(tiles.length)
  hosts.forEach((host, i) => {
    const tile = tiles[i]!
    expect(host.querySelectorAll('[data-part="option"]')).toHaveLength(tile.options.length)
    expect(host.querySelector('[data-part="option"][data-key="train"]')?.hasAttribute('data-best')).toBe(true)
    expect(host.querySelectorAll('[aria-selected="true"]')).toHaveLength(tile.value ? 1 : 0)
    const scroller = host.querySelector<HTMLElement>('[data-part="scroller"]')!
    if (tile.options.length === 4) expect(scroller.scrollWidth).toBeGreaterThan(scroller.clientWidth)
    else expect(scroller.scrollWidth).toBeLessThanOrEqual(scroller.clientWidth)
  })
}

describe('ui-option-compare: visual regression (T-0393 Direction A)', () => {
  it.skipIf(server.browser !== 'chromium')('three options with the best mark, and the picked state, light', async () => {
    await page.viewport(900, 1000)
    const col = column([BEST, PICKED], 'light')
    const stage = mount([col])
    await settle(stage)
    expect(surfaceMean(col), 'the light column resolved the dark arm').toBeGreaterThan(160)
    expectStates(col, [BEST, PICKED])
    await expect.element(page.elementLocator(stage)).toMatchScreenshot('option-compare-light')
    stage.remove()
    await page.viewport(414, 896) // restore the fleet default viewport for the next test
  })

  it.skipIf(server.browser !== 'chromium')('three options with the best mark, and the picked state, dark', async () => {
    await page.viewport(900, 1000)
    const col = column([BEST, PICKED], 'dark')
    const stage = mount([col])
    await settle(stage)
    expect(surfaceMean(col), 'the column did not resolve the DARK arm; this would be a light shot under a dark name').toBeLessThan(96)
    expectStates(col, [BEST, PICKED])
    await expect.element(page.elementLocator(stage)).toMatchScreenshot('option-compare-dark')
    stage.remove()
    await page.viewport(414, 896)
  })

  it.skipIf(server.browser !== 'chromium')('four options at the 400px column, light and dark', async () => {
    await page.viewport(900, 1000)
    const light = column([FOUR], 'light')
    const dark = column([FOUR], 'dark')
    const stage = mount([light, dark])
    await settle(stage)
    expect(surfaceMean(light)).toBeGreaterThan(160)
    expect(surfaceMean(dark), 'the dark column did not resolve the DARK arm').toBeLessThan(96)
    expectStates(light, [FOUR])
    expectStates(dark, [FOUR])
    await expect.element(page.elementLocator(stage)).toMatchScreenshot('option-compare-400')
    stage.remove()
    await page.viewport(414, 896)
  })
})
