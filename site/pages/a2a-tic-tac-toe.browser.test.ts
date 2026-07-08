// a2a-tic-tac-toe.browser.test.ts — the WHOLE-SHAPE cross-engine proof for the A2A tic-tac-toe board
// (LLD-C11). jsdom (a2a-tic-tac-toe.test.ts) proves the per-part DOM/attribute state (9 cells exist, marks
// update, the isolation verdict flips) but computes no real layout — a board can pass every per-cell
// assertion and still render as a collapsed single column (the "test the whole shape" lesson: ui-slider
// once shipped box✓+thumb✓ with no host width, collapsing to a dot). This asserts the ACTUAL rendered
// bounding boxes form a genuine 3×3 grid — real computed geometry, both Chromium and WebKit.
import { describe, it, expect } from 'vitest'
// Side-effect import: builds the whole page into #app/document.body (mountPage), same precedent as
// a2ui-catalog.browser.test.ts.
import './a2a-tic-tac-toe.ts'

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

describe('the A2A tic-tac-toe board — a REAL 3x3 grid, not a collapsed stack (both engines)', () => {
  it('renders 9 non-zero cells arranged in 3 rows x 3 columns, each roughly square and same-sized', async () => {
    await raf()
    const grid = document.querySelector('[data-board]') as HTMLElement
    expect(grid, 'no board grid found').not.toBeNull()
    const cells = [...grid.querySelectorAll<HTMLElement>('.board-cell')]
    expect(cells).toHaveLength(9)

    const rects = cells.map((c) => c.getBoundingClientRect())
    // anti-vacuous: every cell actually occupies real space
    for (const r of rects) {
      expect(r.width).toBeGreaterThan(0)
      expect(r.height).toBeGreaterThan(0)
    }

    // Row grouping: cells 0-2 share (roughly) the same top; 3-5 sit strictly below them; 6-8 below that —
    // the genuine "3 rows" shape, not a single-column stack (which would put every cell at increasing top
    // with matching left, or a single row, which would put every cell at the same top).
    const top = (i: number) => rects[i]!.top
    const left = (i: number) => rects[i]!.left
    expect(Math.abs(top(0) - top(1))).toBeLessThan(2)
    expect(Math.abs(top(1) - top(2))).toBeLessThan(2)
    expect(top(3)).toBeGreaterThan(top(0) + rects[0]!.height / 2)
    expect(top(6)).toBeGreaterThan(top(3) + rects[3]!.height / 2)

    // Column grouping: within a row, left strictly increases left-to-right.
    expect(left(0)).toBeLessThan(left(1))
    expect(left(1)).toBeLessThan(left(2))
    expect(Math.abs(left(0) - left(3))).toBeLessThan(2) // column 0 stays aligned across rows
    expect(Math.abs(left(0) - left(6))).toBeLessThan(2)

    // Cells are roughly square (aspect-ratio: 1/1 in the page CSS) and uniformly sized — a real grid, not
    // arbitrary boxes that merely happen to occupy 9 DOM nodes.
    for (const r of rects) expect(Math.abs(r.width - r.height)).toBeLessThan(3)
    const widths = rects.map((r) => r.width)
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(2)
  })

  it('negative control: a single-column stack (no grid-template-columns) would NOT satisfy the column-alignment assertions above', () => {
    const probe = document.createElement('div')
    probe.style.display = 'block' // deliberately NOT the page's grid — the shape this test would catch
    for (let i = 0; i < 9; i++) {
      const cell = document.createElement('div')
      cell.style.width = '40px'
      cell.style.height = '40px'
      probe.append(cell)
    }
    document.body.append(probe)
    const rects = [...probe.children].map((c) => (c as HTMLElement).getBoundingClientRect())
    // every cell shares the SAME left (a stack), so "left(0) < left(1)" — the real grid's column assertion — is false here.
    expect(rects[0]!.left).toBe(rects[1]!.left)
    probe.remove()
  })

  it('clicking through the replay actually mutates the rendered cell text in a real engine (not just a jsdom-only listener wire)', async () => {
    await raf()
    const nextBtn = document.querySelector('[data-action="next"]') as HTMLElement
    nextBtn.click()
    await raf()
    const cell4 = document.querySelector('[data-cell="4"]') as HTMLElement
    expect(cell4.textContent).toBe('X')
  })
})
