import { describe, it, expect, afterEach } from 'vitest'
import { userEvent } from 'vitest/browser'

import '@agent-ui/components/foundation-styles.css'
import './board-grid.css'
import './board-grid.ts'

// board-grid.browser.test.ts: real-engine truth for ui-board-grid (ADR-0243), Chromium + WebKit. The
// whole-shape law: the board's own bounding box in a realistic container, square cells at least 34px,
// fill by default versus `inline` hug, and the two-axis roving with REAL focus and real key events (the one
// thing jsdom cannot prove: a native button must not fire a second click on Enter or Space).

const mounted: HTMLElement[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

/** A realistic container: a 360px-wide column, the phone-width panel a chat surface gives a board. */
function mount(markup: string): HTMLElement {
  const wrap = document.createElement('div')
  wrap.style.cssText = 'inline-size:360px; padding:16px; box-sizing:border-box;'
  wrap.innerHTML = markup
  document.body.append(wrap)
  mounted.push(wrap)
  return wrap.firstElementChild as HTMLElement
}

type Board = HTMLElement & { cells: unknown; updateComplete: Promise<void> }

const cells = (el: Element): HTMLElement[] => Array.from(el.querySelectorAll<HTMLElement>('[data-part="cell"]'))
const rect = (el: Element): DOMRect => el.getBoundingClientRect()

describe('ui-board-grid: whole shape', () => {
  it('a 6x6 board paints a real square board inside its container', () => {
    const el = mount('<ui-board-grid rows="6" cols="6" label="Enemy waters" action-name="fire"></ui-board-grid>')
    const all = cells(el)
    expect(all).toHaveLength(36)
    const first = rect(all[0]!)
    const last = rect(all[35]!)
    const boardW = last.right - first.left
    const boardH = last.bottom - first.top
    expect(boardW).toBeGreaterThanOrEqual(6 * 34)
    expect(Math.abs(boardW - boardH)).toBeLessThan(1) // a square board of square cells
    const host = rect(el)
    expect(first.left).toBeGreaterThanOrEqual(host.left)
    expect(last.right).toBeLessThanOrEqual(host.right + 0.5)
    expect(last.bottom).toBeLessThanOrEqual(host.bottom + 0.5)
    expect(host.height).toBeGreaterThan(boardH) // the frame wraps the board
  })

  it('each cell is square with a side of at least 34px at the default size', () => {
    const el = mount('<ui-board-grid rows="8" cols="9"></ui-board-grid>')
    const all = cells(el)
    expect(all).toHaveLength(72)
    for (const c of all) {
      const r = rect(c)
      expect(r.width).toBeGreaterThanOrEqual(34)
      expect(Math.abs(r.width - r.height)).toBeLessThan(0.5)
    }
    // the rows sit on separate lines: the first cell of row 2 is below the first cell of row 1
    expect(rect(all[9]!).top).toBeGreaterThan(rect(all[0]!).bottom - 0.5)
  })

  it('fills its container by default; inline hugs the board', () => {
    const fill = mount('<ui-board-grid rows="3" cols="3"></ui-board-grid>')
    const container = fill.parentElement!
    const inner = container.clientWidth - 32 // the wrap's 16px padding each side
    expect(Math.abs(rect(fill).width - inner)).toBeLessThan(1)

    const hug = mount('<ui-board-grid rows="3" cols="3" inline></ui-board-grid>')
    const all = cells(hug)
    const boardW = rect(all[2]!).right - rect(all[0]!).left
    expect(rect(hug).width).toBeLessThan(inner)
    expect(rect(hug).width - boardW).toBeLessThan(24) // only the frame padding around the board
  })
})

describe('ui-board-grid: keyboard with real focus', () => {
  it('one tab stop; arrows rove by cell and row, skipping disabled cells; Enter and Space emit exactly once', async () => {
    const before = document.createElement('button')
    before.textContent = 'before'
    document.body.prepend(before)
    mounted.push(before)
    const el = mount('<ui-board-grid rows="3" cols="3" action-name="fire"></ui-board-grid>') as Board
    el.cells = [{ row: 0, col: 1, mark: 'x', intent: 'danger', disabled: true }]
    await el.updateComplete
    const all = cells(el)
    const log: unknown[] = []
    el.addEventListener('action', (e) => log.push((e as CustomEvent).detail))

    before.focus()
    await userEvent.tab()
    expect(document.activeElement).toBe(all[0])

    await userEvent.keyboard('{ArrowRight}') // skips the disabled (0,1)
    expect(document.activeElement).toBe(all[2])
    await userEvent.keyboard('{ArrowRight}') // edge, no wrap
    expect(document.activeElement).toBe(all[2])
    await userEvent.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(all[5])
    expect(all.filter((c) => c.getAttribute('tabindex') === '0')).toEqual([all[5]])

    await userEvent.keyboard('{Enter}')
    expect(log).toEqual([{ action: 'fire', context: { row: 1, col: 2 } }])
    await userEvent.keyboard(' ')
    expect(log).toHaveLength(2)
    expect(log[1]).toEqual({ action: 'fire', context: { row: 1, col: 2 } })

    await userEvent.tab() // one tab stop: Tab leaves the board
    expect(el.contains(document.activeElement)).toBe(false)
  })

  it('a read-only board roves with real focus and never emits', async () => {
    const el = mount('<ui-board-grid rows="2" cols="2"></ui-board-grid>')
    const all = cells(el)
    const log: unknown[] = []
    el.addEventListener('action', (e) => log.push(e))
    all[0]!.focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(all[2])
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard(' ')
    expect(log).toHaveLength(0)
  })
})
