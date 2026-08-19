import { describe, it, expect, vi } from 'vitest'
// Side-effect import: the demo page mounts the app shell + the live ui-slider-multi specimens into
// document.body (mountPage appends to `#app ?? document.body`; the modal-demo.browser.test.ts precedent).
import './slider-multi-demo.ts'

// GH #347 — REAL-TIMING HEADROOM (rAF settles under concurrent host load).
vi.setConfig({ testTimeout: 30_000 })

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

type RangeHost = HTMLElement & { valueLo: number; valueHi: number }

describe('slider-multi-demo — the real ui-slider-multi mounts as a price filter with a from–to readout + event log', () => {
  it('mounts the price filter with its authored pair and the page readout + results mirroring it', async () => {
    await raf()
    expect(customElements.get('ui-slider-multi'), 'ui-slider-multi must be a defined custom element').toBeDefined()
    const price = document.querySelector('ui-slider-multi[name="price"]') as RangeHost
    expect(price, 'the price ui-slider-multi should be on the page').not.toBeNull()
    expect(price.valueLo).toBe(50)
    expect(price.valueHi).toBe(300)
    expect(document.querySelector('output[for="price"]')?.textContent).toBe('$50 – $300')
    // $59, $129, $199, $249 fall inside 50..300 → 4 matches
    expect(document.querySelectorAll('ul[aria-label="Matching products"] > li').length).toBe(4)
  })

  it('renders the event log + at least two example sections', () => {
    const log = document.querySelector('ul.event-log')
    expect(log, 'the input/change event log should be on the page').not.toBeNull()
    expect(log!.getAttribute('aria-live')).toBe('polite')
    expect(document.querySelectorAll('section > h2').length).toBeGreaterThanOrEqual(2)
  })

  it('a keyboard step on the lo thumb emits input: readout, results, and log all follow', async () => {
    await raf()
    const price = document.querySelector('ui-slider-multi[name="price"]') as RangeHost
    const lo = price.querySelector('[data-thumb="lo"]') as HTMLElement
    expect(lo, 'the lo thumb part should exist').not.toBeNull()
    const log = document.querySelector('ul.event-log') as HTMLElement
    const before = log.children.length
    lo.focus()
    lo.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }))
    await raf()
    expect(price.valueLo, 'ArrowRight steps lo by the authored step (10)').toBe(60)
    expect(document.querySelector('output[for="price"]')?.textContent).toBe('$60 – $300')
    expect(document.querySelectorAll('ul[aria-label="Matching products"] > li').length, '$59 drops out').toBe(3)
    expect(log.children.length).toBeGreaterThan(before)
    expect(log.textContent).toContain('input  valueLo=60  valueHi=300')
  })

  it('the model-driven preset rewrites both ends silently — readout follows, no new log line', async () => {
    await raf()
    const log = document.querySelector('ul.event-log') as HTMLElement
    const before = log.children.length
    const preset = [...document.querySelectorAll('ui-button')].find((b) => b.textContent?.startsWith('Preset')) as HTMLElement
    preset.click()
    await raf()
    const price = document.querySelector('ui-slider-multi[name="price"]') as RangeHost
    expect(price.valueLo).toBe(0)
    expect(price.valueHi).toBe(150)
    expect(document.querySelector('output[for="price"]')?.textContent).toBe('$0 – $150')
    expect(log.children.length, 'a programmatic write must not emit input/change').toBe(before)
  })
})
