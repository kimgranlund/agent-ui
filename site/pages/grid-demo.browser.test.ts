import { describe, it, expect } from 'vitest'
// Side-effect import: the demo page mounts the app shell + the live ui-grid scenarios into document.body
// (mountPage appends to `#app ?? document.body`; the modal-demo.browser.test.ts precedent).
import './grid-demo.ts'

// grid-demo.browser.test.ts — the PAGE-LEVEL proof for the ui-grid demo: the REAL auto-fit track grid is mounted
// (not mocked) around real ui-card tiles, the featured tile spans two tracks through its OWN CSS (ui-grid has no
// span prop — children are the author's), the `min` knob writes the real attribute (threaded into --ui-grid-min by
// grid.ts) and the aria-live knob log records the flip; the page carries ≥2 exampleSections. `site` browser project.

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

const knobByText = (text: string): HTMLElement => {
  const btn = [...document.querySelectorAll('ui-button')].find((b) => b.textContent?.trim() === text)
  if (!btn) throw new Error(`no ui-button knob with text "${text}"`)
  return btn as HTMLElement
}

describe('grid-demo — the real ui-grid is mounted as a photo grid with live knobs', () => {
  it('mounts a real ui-grid of seven ui-card tiles laid out as a CSS grid, the featured tile spanning two tracks', async () => {
    await raf()
    expect(customElements.get('ui-grid')).toBeDefined()
    const photoGrid = [...document.querySelectorAll('ui-grid')].find((g) => g.querySelectorAll(':scope > ui-card').length === 7)
    expect(photoGrid, 'the photo grid is one ui-grid with seven direct ui-card tiles').toBeDefined()
    expect(getComputedStyle(photoGrid as HTMLElement).display).toBe('grid')
    const featured = (photoGrid as HTMLElement).querySelector(':scope > ui-card') as HTMLElement
    // `grid-column: span 2` (single value) fills the START longhand; the end longhand stays auto.
    expect(getComputedStyle(featured).gridColumnStart, 'the first tile spans two tracks via its own grid-column').toBe('span 2')
    // The auto-fit track model resolves to ≥2 columns at the demo's frame width — a real grid, not a stack.
    const tracks = getComputedStyle(photoGrid as HTMLElement).gridTemplateColumns.split(' ').filter(Boolean)
    expect(tracks.length).toBeGreaterThanOrEqual(2)
  })

  it('a min knob writes the attribute on the scenario grids, repoints --ui-grid-min, and the aria-live log records the flip', async () => {
    await raf()
    const log = document.querySelector('ul.event-log')
    expect(log?.getAttribute('aria-live')).toBe('polite')
    expect(log?.children.length).toBe(0)
    knobByText('6rem').click()
    await raf()
    const grids = [...document.querySelectorAll('ui-grid[min="6rem"]')] as HTMLElement[]
    expect(grids.length).toBeGreaterThanOrEqual(2)
    for (const grid of grids) expect(getComputedStyle(grid).getPropertyValue('--ui-grid-min').trim()).toBe('6rem')
    expect(log?.children.length).toBe(1)
    expect(log?.textContent).toContain('min = "6rem"')
  })

  it('a gap knob writes the attribute and the log grows by one line per flip', async () => {
    await raf()
    const log = document.querySelector('ul.event-log')
    const before = log?.children.length ?? 0
    knobByText('xs').click()
    await raf()
    expect(document.querySelectorAll('ui-grid[gap="xs"]').length).toBeGreaterThanOrEqual(2)
    expect(log?.children.length).toBe(before + 1)
    expect(log?.textContent).toContain('gap = "xs"')
  })

  it('carries at least two exampleSections with headings', () => {
    const sections = [...document.querySelectorAll('[data-page-content] > section')]
    expect(sections.length).toBeGreaterThanOrEqual(2)
    for (const s of sections) expect(s.querySelector('h2')).not.toBeNull()
  })
})
