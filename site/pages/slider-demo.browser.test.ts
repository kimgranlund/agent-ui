import { describe, it, expect, vi } from 'vitest'
// Side-effect import: the demo page mounts the app shell + the live ui-slider specimens into document.body
// (mountPage appends to `#app ?? document.body`; the modal-demo.browser.test.ts precedent).
import './slider-demo.ts'

// GH #347 — REAL-TIMING HEADROOM (rAF settles under concurrent host load).
vi.setConfig({ testTimeout: 30_000 })

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

describe('slider-demo — the real ui-slider mounts as a volume control with a live readout + event log', () => {
  it('mounts the volume slider with its authored range and the page readout mirroring the value', async () => {
    await raf()
    expect(customElements.get('ui-slider'), 'ui-slider must be a defined custom element').toBeDefined()
    const volume = document.querySelector('ui-slider[name="volume"]') as HTMLElement & { value: number }
    expect(volume, 'the volume ui-slider should be on the page').not.toBeNull()
    expect(volume.value).toBe(40)
    expect(document.querySelector('output[for="volume"]')?.textContent).toBe('40 %')
  })

  it('renders the event log + at least two example sections', () => {
    const log = document.querySelector('ul.event-log')
    expect(log, 'the input/change event log should be on the page').not.toBeNull()
    expect(log!.getAttribute('aria-live')).toBe('polite')
    expect(document.querySelectorAll('section > h2').length).toBeGreaterThanOrEqual(2)
  })

  it('a keyboard step emits input: the readout follows and the log records it', async () => {
    await raf()
    const volume = document.querySelector('ui-slider[name="volume"]') as HTMLElement & { value: number }
    const log = document.querySelector('ul.event-log') as HTMLElement
    const before = log.children.length
    volume.focus()
    volume.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }))
    await raf()
    expect(volume.value, 'ArrowRight steps by the authored step (5)').toBe(45)
    expect(document.querySelector('output[for="volume"]')?.textContent).toBe('45 %')
    expect(log.children.length).toBeGreaterThan(before)
    expect(log.textContent).toContain('volume  input  value=45')
  })

  it('a model-driven write (Mute) updates the value silently — no new log line', async () => {
    await raf()
    const log = document.querySelector('ul.event-log') as HTMLElement
    const before = log.children.length
    const mute = [...document.querySelectorAll('ui-button')].find((b) => b.textContent?.startsWith('Mute')) as HTMLElement
    mute.click()
    await raf()
    const volume = document.querySelector('ui-slider[name="volume"]') as HTMLElement & { value: number }
    expect(volume.value).toBe(0)
    expect(document.querySelector('output[for="volume"]')?.textContent).toBe('0 %')
    expect(log.children.length, 'a programmatic value write must not emit input/change').toBe(before)
  })
})
