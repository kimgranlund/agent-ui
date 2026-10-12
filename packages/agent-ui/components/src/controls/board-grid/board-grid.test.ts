import { describe, it, expect, afterEach } from 'vitest'
import { UIBoardGridElement } from './board-grid.ts'
import { cleanCells, placeCells, cellsProp } from './board-grid-model.ts'

// board-grid.test.ts: jsdom behaviour for ui-board-grid (ADR-0243, the BoardGrid fork sheet). One probe
// subclass exposes the protected `internals` handle (the service-card.test.ts precedent).

class ProbeBoardGrid extends UIBoardGridElement {
  get probeInternals(): ElementInternals {
    return this.internals
  }
}
customElements.define('ui-board-grid-probe', ProbeBoardGrid)

const mounted: HTMLElement[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

type CellInput = { row: number; col: number; mark?: string; intent?: string; disabled?: boolean }

function make(opts: { rows: number; cols: number; cells?: CellInput[]; actionName?: string; label?: string }): ProbeBoardGrid {
  const el = new ProbeBoardGrid()
  el.rows = opts.rows
  el.cols = opts.cols
  if (opts.cells) el.cells = opts.cells as never
  if (opts.actionName) el.actionName = opts.actionName
  if (opts.label) el.label = opts.label
  document.body.append(el)
  mounted.push(el)
  return el
}

const cells = (el: Element): HTMLElement[] => Array.from(el.querySelectorAll<HTMLElement>('[data-part="cell"]'))
const cellAt = (el: Element, row: number, col: number, cols: number): HTMLElement => cells(el)[row * cols + col]!
const key = (target: Element, k: string, type: 'keydown' | 'keyup' = 'keydown'): void => {
  target.dispatchEvent(new KeyboardEvent(type, { key: k, bubbles: true, cancelable: true }))
}
const actions = (el: Element): CustomEvent[] => {
  const log: CustomEvent[] = []
  el.addEventListener('action', (e) => log.push(e as CustomEvent))
  return log
}
const tabStops = (el: Element): HTMLElement[] => cells(el).filter((c) => c.getAttribute('tabindex') === '0')

describe('UIBoardGridElement: render', () => {
  it('self-defines as ui-board-grid', () => {
    expect(customElements.get('ui-board-grid')).toBe(UIBoardGridElement)
  })

  it('renders rows x cols cell parts in one pass with no per-cell custom element', () => {
    const el = make({ rows: 8, cols: 9 })
    expect(cells(el)).toHaveLength(72)
    expect(el.querySelectorAll('[data-part="row"]')).toHaveLength(8)
    for (const node of el.querySelectorAll('*')) expect(node.tagName.includes('-'), node.tagName).toBe(false)
  })

  it('empty cells renders the blank board', () => {
    const el = make({ rows: 3, cols: 4, cells: [] })
    expect(cells(el)).toHaveLength(12)
    for (const c of cells(el)) {
      expect(c.querySelector('[data-part="mark"]')?.textContent).toBe('')
      expect(c.querySelector('[data-part="intent"]')).toBeNull()
    }
  })

  it('host role grid and aria-label come from internals, never host attributes', async () => {
    const el = make({ rows: 2, cols: 2, label: 'Enemy waters' })
    expect(el.probeInternals.role).toBe('grid')
    expect(el.probeInternals.ariaLabel).toBe('Enemy waters')
    expect(el.hasAttribute('role')).toBe(false)
    expect(el.hasAttribute('aria-label')).toBe(false)
    el.label = ''
    await el.updateComplete
    expect(el.probeInternals.ariaLabel).toBeNull()
  })

  it('cells are owned by role=row parts and carry role=gridcell', () => {
    const el = make({ rows: 2, cols: 3 })
    const rows = Array.from(el.querySelectorAll('[data-part="row"]'))
    expect(rows).toHaveLength(2)
    for (const row of rows) {
      expect(row.parentElement).toBe(el)
      expect(row.getAttribute('role')).toBe('row')
      const owned = row.querySelectorAll(':scope > [data-part="cell"]')
      expect(owned).toHaveLength(3)
      for (const c of owned) expect(c.getAttribute('role')).toBe('gridcell')
    }
  })

  it('with actionName each enabled cell is a button part; without it there are no button parts', () => {
    const live = make({ rows: 2, cols: 2, actionName: 'fire', cells: [{ row: 0, col: 0, mark: 'x', disabled: true }] })
    expect(cells(live).every((c) => c.tagName === 'BUTTON')).toBe(true)
    expect((cellAt(live, 0, 0, 2) as HTMLButtonElement).disabled).toBe(true)
    expect((cellAt(live, 0, 1, 2) as HTMLButtonElement).disabled).toBe(false)
    const readOnly = make({ rows: 2, cols: 2, cells: [{ row: 0, col: 0, disabled: true }] })
    expect(readOnly.querySelector('button')).toBeNull()
    expect(cells(readOnly).every((c) => c.tagName === 'DIV')).toBe(true)
    expect(cellAt(readOnly, 0, 0, 2).getAttribute('aria-disabled')).toBe('true')
  })
})

describe('UIBoardGridElement: action', () => {
  it('activating an enabled cell emits one action event with {action, context: {row, col}}', () => {
    const el = make({ rows: 3, cols: 3, actionName: 'fire' })
    const log = actions(el)
    cellAt(el, 1, 2, 3).click()
    expect(log).toHaveLength(1)
    expect(log[0]!.detail).toEqual({ action: 'fire', context: { row: 1, col: 2 } })

    key(cellAt(el, 2, 0, 3), 'Enter')
    expect(log).toHaveLength(2)
    expect(log[1]!.detail).toEqual({ action: 'fire', context: { row: 2, col: 0 } })

    const space = cellAt(el, 0, 1, 3)
    key(space, ' ')
    expect(log).toHaveLength(2) // Space activates on keyup
    key(space, ' ', 'keyup')
    expect(log).toHaveLength(3)
    expect(log[2]!.detail).toEqual({ action: 'fire', context: { row: 0, col: 1 } })
  })

  it('disabled cells and read-only boards never emit action', () => {
    const el = make({ rows: 2, cols: 2, actionName: 'fire', cells: [{ row: 0, col: 0, disabled: true }] })
    const log = actions(el)
    const off = cellAt(el, 0, 0, 2)
    off.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    key(off, 'Enter')
    key(off, ' ')
    key(off, ' ', 'keyup')
    expect(log).toHaveLength(0)

    const readOnly = make({ rows: 2, cols: 2 })
    const roLog = actions(readOnly)
    const c = cellAt(readOnly, 1, 1, 2)
    c.click()
    key(c, 'Enter')
    key(c, ' ')
    key(c, ' ', 'keyup')
    expect(roLog).toHaveLength(0)
  })

  it('never emits on render or on a cells update', async () => {
    const el = new ProbeBoardGrid()
    const log = actions(el)
    el.rows = 2
    el.cols = 2
    el.actionName = 'fire'
    document.body.append(el)
    mounted.push(el)
    el.cells = [{ row: 0, col: 0, mark: 'x', intent: 'danger', disabled: false }]
    await el.updateComplete
    expect(log).toHaveLength(0)
  })
})

describe('UIBoardGridElement: keyboard', () => {
  it('exactly one tabindex=0; arrows move by cell and row, skip disabled cells, do not wrap', () => {
    const el = make({
      rows: 3,
      cols: 3,
      actionName: 'fire',
      cells: [
        { row: 0, col: 1, disabled: true },
        { row: 1, col: 0, disabled: true },
      ],
    })
    expect(tabStops(el)).toEqual([cellAt(el, 0, 0, 3)])
    for (const c of cells(el)) expect(['0', '-1']).toContain(c.getAttribute('tabindex'))

    cellAt(el, 0, 0, 3).focus()
    key(cellAt(el, 0, 0, 3), 'ArrowRight') // skips the disabled (0,1)
    expect(document.activeElement).toBe(cellAt(el, 0, 2, 3))
    expect(tabStops(el)).toEqual([cellAt(el, 0, 2, 3)])

    key(cellAt(el, 0, 2, 3), 'ArrowRight') // edge: stays put, no wrap
    expect(document.activeElement).toBe(cellAt(el, 0, 2, 3))

    key(cellAt(el, 0, 2, 3), 'ArrowDown')
    expect(document.activeElement).toBe(cellAt(el, 1, 2, 3))

    key(cellAt(el, 1, 2, 3), 'ArrowLeft')
    expect(document.activeElement).toBe(cellAt(el, 1, 1, 3))
    key(cellAt(el, 1, 1, 3), 'ArrowLeft') // (1,0) is disabled and is the last cell that way: stays put
    expect(document.activeElement).toBe(cellAt(el, 1, 1, 3))

    key(cellAt(el, 1, 1, 3), 'ArrowUp') // (0,1) is disabled and is the last cell that way: stays put
    expect(document.activeElement).toBe(cellAt(el, 1, 1, 3))
    expect(tabStops(el)).toHaveLength(1)
  })

  it('a read-only board keeps the roving tab stop', () => {
    const el = make({ rows: 2, cols: 2 })
    expect(tabStops(el)).toEqual([cellAt(el, 0, 0, 2)])
    cellAt(el, 0, 0, 2).focus()
    key(cellAt(el, 0, 0, 2), 'ArrowDown')
    expect(document.activeElement).toBe(cellAt(el, 1, 0, 2))
    expect(tabStops(el)).toEqual([cellAt(el, 1, 0, 2)])
  })

  it('the roving position survives a cells update', async () => {
    const el = make({ rows: 2, cols: 2, actionName: 'fire' })
    cellAt(el, 0, 0, 2).focus()
    key(cellAt(el, 0, 0, 2), 'ArrowDown')
    el.cells = [{ row: 0, col: 0, mark: 'o', intent: 'neutral', disabled: true }]
    await el.updateComplete
    expect(tabStops(el)).toEqual([cellAt(el, 1, 0, 2)])
  })
})

describe('UIBoardGridElement: updates and content', () => {
  it('a cells update patches marks in place and keeps the same cell elements', async () => {
    const el = make({ rows: 2, cols: 2, actionName: 'fire' })
    const before = cells(el)
    const rowsBefore = Array.from(el.querySelectorAll('[data-part="row"]'))
    el.cells = [{ row: 1, col: 1, mark: 'X', intent: 'danger', disabled: true }]
    await el.updateComplete
    const after = cells(el)
    expect(after).toHaveLength(4)
    after.forEach((c, i) => expect(c).toBe(before[i]))
    expect(Array.from(el.querySelectorAll('[data-part="row"]'))).toEqual(rowsBefore)
    expect(cellAt(el, 1, 1, 2).querySelector('[data-part="mark"]')?.textContent).toBe('X')

    el.cols = 3 // a shape change rebuilds
    await el.updateComplete
    expect(cells(el)).toHaveLength(6)
    expect(cells(el)[0]).not.toBe(before[0])
  })

  it('cell accessible name is mark, intent, row n, column m (1-based)', () => {
    const el = make({ rows: 2, cols: 3, cells: [{ row: 0, col: 1, mark: 'C', intent: 'success' }, { row: 1, col: 2, mark: 'E' }] })
    expect(cellAt(el, 0, 1, 3).getAttribute('aria-label')).toBe('C, success, row 1, column 2')
    expect(cellAt(el, 1, 2, 3).getAttribute('aria-label')).toBe('E, row 2, column 3')
    expect(cellAt(el, 1, 0, 3).getAttribute('aria-label')).toBe('row 2, column 1')
  })

  it('the corner glyph renders only when intent is set; an out-of-set intent is dropped', () => {
    const el = make({
      rows: 1,
      cols: 6,
      cells: [
        { row: 0, col: 0, mark: 'a', intent: 'success' },
        { row: 0, col: 1, mark: 'b', intent: 'warning' },
        { row: 0, col: 2, mark: 'c', intent: 'neutral' },
        { row: 0, col: 3, mark: 'd', intent: 'danger' },
        { row: 0, col: 4, mark: 'e', intent: 'info' },
        { row: 0, col: 5, mark: 'f', intent: 'bogus' },
      ],
    })
    const glyphs = cells(el).map((c) => c.querySelector('[data-part="intent"]'))
    expect(glyphs.slice(0, 5).map((g) => g?.textContent)).toEqual(['+', '?', '-', '!', 'i'])
    for (const g of glyphs.slice(0, 5)) expect(g?.getAttribute('aria-hidden')).toBe('true')
    expect(glyphs[5]).toBeNull()
    expect(cells(el)[5]!.hasAttribute('data-intent')).toBe(false)
    expect(cells(el)[5]!.getAttribute('aria-label')).toBe('f, row 1, column 6')
  })

  it('cells outside rows x cols are dropped', () => {
    const el = make({ rows: 2, cols: 2, cells: [{ row: 2, col: 0, mark: 'X' }, { row: 0, col: 5, mark: 'Y' }, { row: 1, col: 1, mark: 'Z' }] })
    expect(cells(el).map((c) => c.querySelector('[data-part="mark"]')?.textContent)).toEqual(['', '', '', 'Z'])
  })

  it('when two entries share one position, the later entry wins', () => {
    const placed = placeCells(cleanCells([{ row: 0, col: 0, mark: 'A' }, { row: 0, col: 0, mark: 'B' }]), 1, 1)
    expect(placed.get(0)?.mark).toBe('B')
  })

  it('cleanCells drops malformed entries; the codec never throws', () => {
    expect(cleanCells('nope')).toEqual([])
    expect(cleanCells([null, 3, { row: -1, col: 0 }, { row: 0.5, col: 0 }, { row: 0, col: 0, mark: 7, disabled: 'yes' }])).toEqual([
      { row: 0, col: 0, mark: '', disabled: false },
    ])
    expect(cellsProp.type.from(null)).toEqual([])
    expect(cellsProp.type.from('{bad json')).toEqual([])
  })

  it('inline reflects as boolean presence (ADR-0223 R2)', async () => {
    const el = make({ rows: 1, cols: 1 })
    el.inline = true
    await el.updateComplete
    expect(el.hasAttribute('inline')).toBe(true)
  })
})
