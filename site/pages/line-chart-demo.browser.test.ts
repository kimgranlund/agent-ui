import { describe, it, expect, vi } from 'vitest'
// Side-effect import: the demo page mounts the app shell + every live ui-line-chart specimen into
// document.body (mountPage appends to `#app ?? document.body`; the modal-demo.browser.test.ts precedent).
import './line-chart-demo.ts'

// GH #347 — REAL-TIMING HEADROOM (rAF settles under concurrent host load).
vi.setConfig({ testTimeout: 30_000 })

// line-chart-demo.browser.test.ts — proves the demo page mounts the REAL control (label-max/label-min rows,
// polyline + baseline parts), renders the demo sections, and that the incident-spike button performs a real
// `values` write the min/max labels re-derive under.

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

describe('line-chart-demo — the real ui-line-chart mounted, sections rendered, live writes wired', () => {
  it('mounts real ui-line-chart controls with baseline + always-shown min/max labels', async () => {
    await raf()
    const charts = [...document.querySelectorAll('ui-line-chart')]
    expect(charts.length, 'expected many live line-chart specimens').toBeGreaterThanOrEqual(6)
    const latency = charts[0]!
    expect(latency.querySelector('polyline[data-part="line"]'), 'the real control renders its series stroke').not.toBeNull()
    expect(latency.querySelector('line[data-part="baseline"]'), 'the baseline part is present').not.toBeNull()
    expect(latency.querySelector('[data-part="label-max"]')?.textContent, 'the max label prints the series high').toContain('402')
    expect(latency.querySelector('[data-part="label-min"]')?.textContent, 'the min label prints the series low').toContain('199')
    // the area variant closes a polygon to the baseline
    const area = charts.find((c) => c.getAttribute('variant') === 'area')
    expect(area?.querySelector('polygon[data-part="area"]'), 'an area specimen renders its fill').not.toBeNull()
  })

  it('renders the demo sections (>= 2 exampleSections with headings)', async () => {
    await raf()
    const headings = [...document.querySelectorAll('section > h2')].map((h) => h.textContent ?? '')
    expect(headings.length).toBeGreaterThanOrEqual(2)
    expect(headings.some((t) => t.includes('baseline branches'))).toBe(true)
    expect(headings.some((t) => t.includes('Live rolling window'))).toBe(true)
  })

  it('the incident-spike button performs a real values write — the max label re-derives to 1,240', async () => {
    await raf()
    const spike = [...document.querySelectorAll('ui-button')].find((b) => b.textContent?.includes('incident spike'))
    expect(spike, 'the spike button exists').toBeTruthy()
    const live = [...document.querySelectorAll('ui-line-chart')].find((c) =>
      (c.getAttribute('label') ?? '').includes('rolling 24 h'))
    expect(live, 'the live rolling specimen exists').toBeTruthy()
    ;(spike as HTMLElement).click()
    await raf()
    const max = live!.querySelector('[data-part="label-max"]')?.textContent ?? ''
    expect(max.replace(/[\s,.  ]/g, ''), 'the max label jumped to the 1240 spike').toContain('1240')
  })
})
