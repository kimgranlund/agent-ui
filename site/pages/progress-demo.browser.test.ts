import { describe, it, expect, vi } from 'vitest'
// Side-effect import: the demo page mounts the app shell + the live ui-progress specimens into document.body
// (mountPage appends to `#app ?? document.body`; the modal-demo.browser.test.ts precedent).
import './progress-demo.ts'

vi.setConfig({ testTimeout: 30_000 }) // REAL-TIMING HEADROOM (GH #347): rAF settles stretch under host load

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

const clickByText = (text: string): void => {
  const btn = [...document.querySelectorAll('ui-button')].find((b) => b.textContent?.trim() === text)
  if (!btn) throw new Error(`no ui-button found with text "${text}"`)
  ;(btn as HTMLElement).click()
}
const barByLabel = (label: string): HTMLElement => {
  const bar = [...document.querySelectorAll('ui-progress')].find((b) => b.getAttribute('label') === label)
  if (!bar) throw new Error(`no ui-progress found with label "${label}"`)
  return bar as HTMLElement
}

describe('progress-demo — the upload/indexing/stepper scenarios drive the REAL control and the log records it', () => {
  it('mounts the live ui-progress bars (each with a track part) across ≥2 example sections, plus the log', async () => {
    await raf()
    const bars = [...document.querySelectorAll('ui-progress')]
    expect(bars.length).toBeGreaterThanOrEqual(8)
    for (const b of bars) expect(b.querySelector('[data-part="track"]'), 'a bar without its track part').not.toBeNull()
    expect(document.querySelectorAll('section > h2').length).toBeGreaterThanOrEqual(2)
    expect(document.querySelector('ul.event-log[aria-live="polite"]')).not.toBeNull()
  })

  it('the Back/Next buttons step the segments readout and the log records each write', async () => {
    await raf()
    const log = document.querySelector('ul.event-log') as HTMLUListElement
    const before = log.querySelectorAll('li').length
    const stepper = barByLabel('Step 2 of 5')
    expect(stepper.getAttribute('segments')).toBe('5')
    clickByText('Next')
    await raf()
    expect(stepper.getAttribute('current')).toBe('3')
    expect(stepper.getAttribute('label')).toBe('Step 3 of 5')
    expect(stepper.querySelectorAll('[data-part="cell"]').length).toBe(5)
    clickByText('Back')
    await raf()
    expect(stepper.getAttribute('current')).toBe('2')
    expect(log.querySelectorAll('li').length).toBe(before + 2)
  })

  it('Start upload advances current on a timer toward max and logs the file boundaries', async () => {
    await raf()
    const upload = barByLabel('Uploading 3 attachments')
    const max = Number(upload.getAttribute('max'))
    expect(max).toBeGreaterThan(0)
    clickByText('Start upload')
    await wait(700)
    const mid = Number(upload.getAttribute('current'))
    expect(mid).toBeGreaterThan(0)
    expect(mid).toBeLessThanOrEqual(max)
    const log = document.querySelector('ul.event-log') as HTMLUListElement
    expect([...log.querySelectorAll('li')].some((li) => li.textContent?.includes('upload  start'))).toBe(true)
    clickByText('Reset')
    await raf()
    expect(upload.getAttribute('current')).toBe('0')
  })

  it('Index knowledge base starts indeterminate (no current) and later turns determinate against max', async () => {
    await raf()
    const indexer = barByLabel('Indexer idle')
    clickByText('Index knowledge base')
    await raf()
    expect(indexer.hasAttribute('current')).toBe(false)
    expect(indexer.getAttribute('label')).toBe('Counting documents')
    await wait(2000)
    expect(indexer.hasAttribute('current')).toBe(true)
    expect(indexer.getAttribute('max')).toBe('48')
    expect(Number(indexer.getAttribute('current'))).toBeGreaterThan(0)
  })
})
