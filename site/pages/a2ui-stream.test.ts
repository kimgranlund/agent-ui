// a2ui-stream.test.ts: jsdom page-level leg for the streaming page (T-0040, ADR-0241). Drives the REAL page module
// (a side-effect import into a fresh #app) on fake timers, so the paced feed advances deterministically and a pending
// dynamic import can NOT land mid-run. Demo 1 streams the form seed root-early and reads the live surface after every
// line to publish "First paint after line K of N." On a COLD default catalog (the lazy record of ADR-0241, first
// renderer on the page) the surface stays empty while the feed runs, so the readout is wrong or missing; the page's
// `import '../lib/warm-catalog.ts'` keeps the first renderer warm. This file is its own module graph (vitest isolates per
// file), so nothing else warms the catalog before the page does: dropping that import turns this test red, since the
// default is lazy (ADR-0241 Amendment 1; lib/warm-catalog.test.ts is the leg that bites on any tree).
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { generativeFormSeed } from '@agent-ui/a2ui/examples'

const N = generativeFormSeed.messages.length
// The 1-based line that first defines the root: derived here from the shelf seed, independently of the page's own helper.
const EXPECTED_FIRST_PAINT_LINE =
  generativeFormSeed.messages.findIndex((m) => 'updateComponents' in m && m.updateComponents.components.some((c) => c.id === 'root')) + 1

beforeAll(async () => {
  if (typeof ElementInternals.prototype.setFormValue !== 'function') {
    ;(ElementInternals.prototype as unknown as Record<string, unknown>).setFormValue = function (): void {}
    ;(ElementInternals.prototype as unknown as Record<string, unknown>).setValidity = function (): void {}
  }
  const appRoot = document.createElement('div')
  appRoot.id = 'app'
  document.body.append(appRoot)
  vi.useFakeTimers()
  await import('./a2ui-stream.ts') // mounts on import; each demo auto-runs ONCE on first paint, one line per tick
  // The page paces one line per ~300 ms; run well past the last line of the longest demo (N lines + the finalize tick).
  vi.advanceTimersByTime(300 * (N + 2))
})

afterAll(() => {
  vi.useRealTimers()
})

describe('the streaming page: demo 1 paints early and says so', () => {
  it('found the premise (anti-vacuous): the seed defines its root before the last line', () => {
    expect(EXPECTED_FIRST_PAINT_LINE).toBeGreaterThan(0)
    expect(EXPECTED_FIRST_PAINT_LINE).toBeLessThan(N)
  })

  it('the live surface holds the rendered form root after the stream completes', () => {
    const surface = document.querySelector('.surface') as HTMLElement
    expect(surface.childElementCount).toBeGreaterThan(0)
  })

  it('the first-paint readout names the root line, not a later one', () => {
    const readout = document.querySelector('.status-first-paint') as HTMLElement
    expect(readout.hidden).toBe(false)
    expect(readout.textContent).toBe(`First paint after line ${EXPECTED_FIRST_PAINT_LINE} of ${N}.`)
  })
})
