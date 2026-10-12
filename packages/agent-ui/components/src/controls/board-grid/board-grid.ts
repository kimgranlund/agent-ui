// board-grid.ts: ui-board-grid, a board of cells to target or mark (ADR-0243, the BoardGrid fork sheet).
// A display primitive with data-props: extends UIElement, light DOM, ARIA via ElementInternals (host
// role=grid, ariaLabel from `label`), never host attributes.
//
// Anatomy: one `[data-part="row"]` (role=row, display: contents) per board row, each holding that row's
// `[data-part="cell"]` parts (role=gridcell) on ONE CSS grid of `cols` columns. All cells render in one
// pass with no per-cell custom element (the GH #144 reason this control exists). With `actionName` set a
// cell is a `<button data-part="cell">` (the sanctioned internal activation class); without it, a `<div>`.
//
// Updates: ONE effect reads rows, cols, actionName and cells. It rebuilds the board only when the shape
// (rows, cols, interactive) changed; otherwise it patches mark, intent, disabled and the accessible name
// on the SAME cell elements, so a `cells` write never re-mounts the board.
//
// Keyboard: a two-axis roving tabindex lives here (traits/roving-focus.ts moves on one axis only). Exactly
// one cell holds tabindex 0. Arrows move one cell or one row, skip disabled cells, and stop at the edge.
// Activation follows the press-activation trait's timing: Enter on keydown, Space on keyup, each with
// preventDefault so the native button never fires a second click. `action` is emitted from the delegated
// click handler only, so a click, Enter and Space each emit exactly once.

import { UIElement, type ReactiveProps } from '../../dom/index.ts'
import { props } from './board-grid.props.gen.ts'
import { INTENT_GLYPH, boardDim, cellLabel, cleanCells, placeCells, type BoardCell } from './board-grid-model.ts'

const isSpace = (key: string): boolean => key === ' ' || key === 'Spacebar'

/** Arrow key to a (row, col) step. */
const STEPS: Readonly<Record<string, readonly [number, number]>> = {
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
}

export interface UIBoardGridElement extends ReactiveProps<typeof props> {}
export class UIBoardGridElement extends UIElement {
  static props = props

  #cells: HTMLElement[] = [] // row-major, index = row * cols + col
  #disabled: boolean[] = []
  #rows = -1
  #cols = -1
  #interactive: boolean | null = null
  #focus = 0 // the roving tab stop's index

  protected connected(): void {
    this.internals.role = 'grid'

    this.effect(() => {
      this.internals.ariaLabel = this.label === '' ? null : this.label
    })

    this.effect(() => {
      const rows = boardDim(this.rows)
      const cols = boardDim(this.cols)
      const interactive = this.actionName !== ''
      const cells = placeCells(cleanCells(this.cells), rows, cols) // re-harden a direct property write
      if (rows !== this.#rows || cols !== this.#cols || interactive !== this.#interactive) this.#build(rows, cols, interactive)
      this.#patch(cells)
      this.#syncTabStop()
    })

    this.listen(this, 'click', (event) => this.#onClick(event))
    this.listen(this, 'keydown', (event) => this.#onKeydown(event as KeyboardEvent))
    this.listen(this, 'keyup', (event) => this.#onKeyup(event as KeyboardEvent))
    this.listen(this, 'focusin', (event) => {
      const index = this.#indexOf(event.target)
      if (index !== -1 && !this.#disabled[index]) {
        this.#focus = index
        this.#syncTabStop()
      }
    })
  }

  /** Build the whole board in one pass: one row part per board row, one cell part per position. */
  #build(rows: number, cols: number, interactive: boolean): void {
    const rowParts: HTMLElement[] = []
    const cells: HTMLElement[] = []
    for (let r = 0; r < rows; r++) {
      const rowPart = document.createElement('div')
      rowPart.setAttribute('data-part', 'row')
      rowPart.setAttribute('role', 'row')
      for (let c = 0; c < cols; c++) {
        const cell = document.createElement(interactive ? 'button' : 'div')
        if (interactive) (cell as HTMLButtonElement).type = 'button'
        cell.setAttribute('data-part', 'cell')
        cell.setAttribute('role', 'gridcell')
        const mark = document.createElement('span')
        mark.setAttribute('data-part', 'mark')
        cell.append(mark)
        rowPart.append(cell)
        cells.push(cell)
      }
      rowParts.push(rowPart)
    }
    this.replaceChildren(...rowParts)
    this.style.setProperty('--ui-board-grid-cols', String(Math.max(cols, 1)))
    this.#cells = cells
    this.#disabled = cells.map(() => false)
    this.#rows = rows
    this.#cols = cols
    this.#interactive = interactive
    if (this.#focus >= cells.length) this.#focus = 0
  }

  /** Patch every cell in place from the placed cell map: mark, intent glyph, disabled and accessible name. */
  #patch(placed: Map<number, BoardCell>): void {
    for (let i = 0; i < this.#cells.length; i++) {
      const el = this.#cells[i]!
      const cell = placed.get(i)
      const mark = el.firstElementChild as HTMLElement
      const text = cell?.mark ?? ''
      if (mark.textContent !== text) mark.textContent = text

      let glyph = el.querySelector<HTMLElement>(':scope > [data-part="intent"]')
      if (cell?.intent) {
        if (!glyph) {
          glyph = document.createElement('span')
          glyph.setAttribute('data-part', 'intent')
          glyph.setAttribute('aria-hidden', 'true')
          el.append(glyph)
        }
        glyph.textContent = INTENT_GLYPH[cell.intent]
        el.setAttribute('data-intent', cell.intent)
      } else {
        glyph?.remove()
        el.removeAttribute('data-intent')
      }

      const disabled = cell?.disabled === true
      this.#disabled[i] = disabled
      if (el instanceof HTMLButtonElement) el.disabled = disabled
      else if (disabled) el.setAttribute('aria-disabled', 'true')
      else el.removeAttribute('aria-disabled')

      el.setAttribute('aria-label', cellLabel(cell, Math.floor(i / this.#cols), i % this.#cols))
    }
  }

  /** Keep exactly one tabindex=0: the roving cell while it is enabled, else the first enabled cell. */
  #syncTabStop(): void {
    if (this.#cells.length === 0) return
    if (this.#disabled[this.#focus]) {
      const firstEnabled = this.#disabled.indexOf(false)
      if (firstEnabled !== -1) this.#focus = firstEnabled
    }
    this.#cells.forEach((el, i) => el.setAttribute('tabindex', i === this.#focus ? '0' : '-1'))
  }

  #indexOf(target: EventTarget | null): number {
    const cell = target instanceof Element ? target.closest('[data-part="cell"]') : null
    return cell ? this.#cells.indexOf(cell as HTMLElement) : -1
  }

  /** The next enabled cell from `from` along (dr, dc), skipping disabled cells; `from` itself at the edge. */
  #step(from: number, dr: number, dc: number): number {
    let r = Math.floor(from / this.#cols) + dr
    let c = (from % this.#cols) + dc
    while (r >= 0 && r < this.#rows && c >= 0 && c < this.#cols) {
      const index = r * this.#cols + c
      if (!this.#disabled[index]) return index
      r += dr
      c += dc
    }
    return from
  }

  #onClick(event: Event): void {
    if (!this.#interactive) return
    const index = this.#indexOf(event.target)
    if (index === -1 || this.#disabled[index]) return // backstop: a disabled native button never dispatches click in a real engine
    this.emit('action', { action: this.actionName, context: { row: Math.floor(index / this.#cols), col: index % this.#cols } })
  }

  #onKeydown(event: KeyboardEvent): void {
    const index = this.#indexOf(event.target)
    if (index === -1) return
    const step = STEPS[event.key]
    if (step) {
      event.preventDefault()
      const next = this.#step(index, step[0], step[1])
      if (next !== index) {
        this.#focus = next
        this.#syncTabStop()
        this.#cells[next]!.focus()
      }
      return
    }
    if (!this.#interactive || this.#disabled[index]) return
    if (event.key === 'Enter') {
      event.preventDefault() // stops the native button's own Enter click
      this.#cells[index]!.click()
    } else if (isSpace(event.key)) {
      event.preventDefault() // stops page scroll; activation waits for keyup
    }
  }

  #onKeyup(event: KeyboardEvent): void {
    if (!this.#interactive || !isSpace(event.key)) return
    const index = this.#indexOf(event.target)
    if (index === -1 || this.#disabled[index]) return
    event.preventDefault() // stops the native button's own Space click
    this.#cells[index]!.click()
  }
}

if (!customElements.get('ui-board-grid')) customElements.define('ui-board-grid', UIBoardGridElement)
