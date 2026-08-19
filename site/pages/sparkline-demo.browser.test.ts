import { describe, it, expect, vi } from 'vitest'
// Side-effect import: the demo page mounts the app shell + every live ui-sparkline specimen into
// document.body (mountPage appends to `#app ?? document.body`; the modal-demo.browser.test.ts precedent).
import './sparkline-demo.ts'

// GH #347 — REAL-TIMING HEADROOM (rAF settles under concurrent host load).
vi.setConfig({ testTimeout: 30_000 })

// sparkline-demo.browser.test.ts — proves the demo page mounts the REAL control (its component-built SVG
// polyline, not a mock), renders the demo sections, and that the live re-render button performs a real
// `values` prop write the control re-renders under.

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

describe('sparkline-demo — the real ui-sparkline mounted, sections rendered, live re-render wired', () => {
  it('mounts real ui-sparkline controls with component-built SVG marks and generated accessible names', async () => {
    await raf()
    const sparks = [...document.querySelectorAll('ui-sparkline')]
    expect(sparks.length, 'expected many live sparkline specimens').toBeGreaterThanOrEqual(8)
    const kpi = sparks[0]
    expect(kpi.querySelector('svg polyline[data-part="line"]'), 'the real control renders its own polyline').not.toBeNull()
    // the empty-series degenerate specimen still exists and paints no polyline
    const empty = sparks.find((s) => s.getAttribute('values') === '[]')
    expect(empty, 'the degenerate empty specimen is present').toBeTruthy()
    expect(empty?.querySelector('polyline')).toBeNull()
  })

  it('renders the demo sections (>= 2 exampleSections with headings)', async () => {
    await raf()
    const headings = [...document.querySelectorAll('section > h2')].map((h) => h.textContent ?? '')
    expect(headings.length).toBeGreaterThanOrEqual(2)
    expect(headings.some((t) => t.includes('KPI strip'))).toBe(true)
    expect(headings.some((t) => t.includes('Live re-render'))).toBe(true)
  })

  it('the "Push a new sample" button performs a real values write (the mark re-renders)', async () => {
    await raf()
    const button = [...document.querySelectorAll('ui-button')].find((b) => b.textContent?.includes('Push a new sample'))
    expect(button, 'the live re-render button exists').toBeTruthy()
    const live = [...document.querySelectorAll('ui-sparkline')].find((s) =>
      (s.getAttribute('label') ?? '').includes('rolling 24 h'))
    expect(live, 'the live rolling specimen exists').toBeTruthy()
    const before = live!.querySelector('polyline[data-part="line"]')?.getAttribute('points')
    ;(button as HTMLElement).click()
    await raf()
    const after = live!.querySelector('polyline[data-part="line"]')?.getAttribute('points')
    expect(after, 'the polyline survives the rebuild').toBeTruthy()
    expect(after, 'a real values write re-renders the mark with new points').not.toBe(before)
  })
})
