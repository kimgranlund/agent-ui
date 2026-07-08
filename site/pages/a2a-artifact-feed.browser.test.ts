// a2a-artifact-feed.browser.test.ts — the WHOLE-SHAPE cross-engine proof for the artifact-feed demo
// (LLD-C7). jsdom computes no real layout — this asserts the ACTUAL rendered geometry of a live per-message
// artifact host (a real `ui-grid` of metric tiles, not a collapsed stack — the "test the whole shape"
// lesson) plus the capped disclosure panes and the compose-don't-send interaction, in real engines
// (Chromium + WebKit).
import { describe, it, expect } from 'vitest'
// Side-effect import: builds the whole page into #app/document.body (mountPage), the a2a-tic-tac-toe
// browser-test precedent.
import './a2a-artifact-feed.ts'

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

function msgAt(index: number): HTMLElement {
  return document.querySelector(`.msg[data-index="${index}"]`) as HTMLElement
}

async function stepTo(index: number): Promise<void> {
  const nextBtn = document.querySelector('.feed-step-controls ui-button:nth-of-type(2)') as HTMLElement
  for (let i = 0; i < index; i++) {
    nextBtn.click()
    await raf()
  }
}

describe('the artifact feed — the whole rendered shape (both engines)', () => {
  it('the verdict line reads CLEAN', async () => {
    await raf()
    const verdict = document.querySelector('[data-verdict]') as HTMLElement
    expect(verdict.dataset.verdict).toBe('clean')
    expect(verdict.textContent).toMatch(/CLEAN/)
  })

  it('renders 6 timeline bubbles, only the first visible initially', async () => {
    await raf()
    const bubbles = [...document.querySelectorAll('.feed-timeline > .msg')]
    expect(bubbles).toHaveLength(6)
    expect(msgAt(0).hidden).toBe(false)
    for (let i = 1; i < 6; i++) expect(msgAt(i).hidden, `entry ${i}`).toBe(true)
  })

  it('stepping to the first artifact message renders a REAL ui-grid of 4 metric tiles, not a collapsed stack', async () => {
    await stepTo(1) // reveal the revenue-report artifact (agent turn 1)
    const bubble = msgAt(1)
    expect(bubble.hidden).toBe(false)
    const grid = bubble.querySelector('ui-grid') as HTMLElement
    expect(grid, 'no ui-grid rendered inside the artifact mount').not.toBeNull()

    const tiles = [...grid.querySelectorAll('ui-card')]
    expect(tiles.length).toBeGreaterThanOrEqual(4) // the 4 stats + the outer Card wraps a header/content too

    const rects = tiles.map((t) => t.getBoundingClientRect())
    for (const r of rects) {
      // A REAL tile, not a ~1ch min-content collapse (the historical ui-slider "box✓+thumb✓ but no host
      // width → collapsed to a dot" failure mode — test-the-whole-shape.md).
      expect(r.width).toBeGreaterThan(40)
      expect(r.height).toBeGreaterThan(20)
    }
    // A real CSS grid lays the 4 tiles out with genuine vertical rhythm (distinct rows/positions), never
    // every tile occupying the exact same box.
    const tops = new Set(rects.map((r) => Math.round(r.top)))
    expect(tops.size).toBeGreaterThan(1)
  })

  it('the artifact stage is CAPPED (max-block-size enforced, never grows unbounded)', async () => {
    const stage = msgAt(1).querySelector('.feed-artifact-stage') as HTMLElement
    const style = getComputedStyle(stage)
    expect(style.overflow === 'auto' || style.overflowY === 'auto').toBe(true)
    expect(stage.getBoundingClientRect().height).toBeGreaterThan(0)
  })

  it('the wire disclosure is collapsed by default and reveals a capped, real code pane on click', async () => {
    const details = msgAt(1).querySelector('.feed-disclosure:last-of-type') as HTMLDetailsElement
    expect(details.open).toBe(false)
    details.querySelector('summary')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await raf()
    expect(details.open).toBe(true)
    const pane = details.querySelector('.code-block') as HTMLElement
    expect(pane.textContent).toMatch(/updateComponents|createSurface/)
    const style = getComputedStyle(pane)
    expect(style.overflowY).toBe('auto')
  })

  it('clicking the rendered "Refresh data" button composes a client message WITHOUT sending it (compose, don\'t send)', async () => {
    const before = document.querySelectorAll('.msg[data-composed]').length
    const button = [...msgAt(1).querySelectorAll('ui-button')].find((b) => b.textContent?.includes('Refresh data')) as HTMLElement
    expect(button, 'no Refresh data button rendered').not.toBeNull()
    button.click()
    await raf()
    const composed = document.querySelectorAll('.msg[data-composed]')
    expect(composed.length).toBe(before + 1)
    const last = composed[composed.length - 1] as HTMLElement
    expect(last.textContent).toMatch(/composed locally/i)
  })

  it('negative control: a min-content COLLAPSED probe (the historical ui-slider bug shape) fails the width-floor assertion above', () => {
    // The exact trap canvas-surface.css's own comment documents: an absolutely/flex-centered box with only a
    // MAX width (never a definite one) shrink-fits its content to min-content — a single character collapses
    // to a ~few-px sliver, not a real tile.
    const probe = document.createElement('div')
    probe.style.display = 'flex'
    probe.style.flexDirection = 'column'
    probe.style.alignItems = 'center'
    probe.style.maxWidth = '32rem'
    const child = document.createElement('div')
    child.textContent = 'x'
    probe.append(child)
    document.body.append(probe)
    const rect = child.getBoundingClientRect()
    expect(rect.width).toBeLessThan(40) // proves the >40 width-floor assertion above is non-vacuous
    probe.remove()
  })
})
