// option-compare.ts: UIOptionCompareElement, two to four options as columns over aligned attribute rows, with a
// best mark, where the whole column is the pick (T-0393; the Option compare forks 10 to 16 and Direction A approved
// by Kim 2026-10-21 in .sdlc/tickets/.0199-itinerary-compare/). Behaviour, props, internals ARIA and the
// control-built parts only; the hardening lives in option-compare-model.ts and every visual rule in
// option-compare.css.
//
// Composition: the ui-option-deck pick contract (fork 10). `UIElement` composing `rovingFocus` + `selectionCommit`
// (mode 'single') from `connected()`. The columns are light-DOM `[data-part="option"]` parts built from `options`
// and patched in place by index, so a re-render never drops focus mid-roving. A part has no ElementInternals, so
// its `role`, `aria-selected`, `aria-labelledby` and `aria-describedby` are attributes on the part; the host
// carries only internals (`role=listbox`).
//
// Layout (fork 13): a `scroller` holding a `grid` whose first column is the pinned `labels` column and whose other
// columns are the options. The labels column and every option span all the grid rows through subgrid, so the
// row count (the head row plus one per attribute row) and the column count are written on the grid as the two
// custom properties the sheet reads. The labels column is `aria-hidden`; each cell carries a visually hidden copy
// of its row label instead, so the column's description reads "Duration 2h 50m".
//
// The event channel (the OptionDeck shape): the trait emits `select` with the picked value after `onSelect` has
// set `this.value`; a separate `action` follows only when `actionName` is set, carrying `{action, context:
// {value}}`. One pick is exactly one `select` and at most one `action`.
//
// Selected paint follows `value`, not only a commit: the render effect reads `this.value` and paints every
// column, and the trait's `reflectSelected` seam routes through the same painter.

import { UIElement, type ReactiveProps } from '../../dom/index.ts'
import { rovingFocus } from '../../traits/roving-focus.ts'
import { selectionCommit } from '../../traits/selection-commit.ts'
import { cleanOptions, cleanRows, type CleanOption, type CleanRow } from './option-compare-model.ts'
// Generated from option-compare.md's `attributes[]` (ADR-0173): `node scripts/generate-props.mjs option-compare`.
import { props } from './option-compare.props.gen.ts'

const SVG_NS = 'http://www.w3.org/2000/svg'

/** The pill glyphs of the approved mockup, on a 16-unit box, stroked (the option-deck.ts shuffle-glyph idiom). */
const STAR_D = 'M8 2l1.8 3.8 4.2.5-3.1 2.9.8 4.1L8 11.3 4.3 13.3l.8-4.1L2 6.3l4.2-.5z'
const CHECK_D = 'M3 8.5l3.2 3.2L13 5'

interface CellParts {
  root: HTMLElement
  label: HTMLElement
  value: Text
}

interface ColumnParts {
  id: string
  root: HTMLElement
  headRow: HTMLElement
  pill: HTMLElement
  glyph: SVGPathElement
  pillText: Text
  title: HTMLElement
  subtitle: HTMLElement
  cells: CellParts[]
  described: string[] // the subtitle and non-empty cell ids; the painter adds the Best pill's
}

const part = <T extends HTMLElement = HTMLElement>(tag: string, name: string): T => {
  const node = document.createElement(tag) as T
  node.dataset.part = name
  return node
}

const setText = (node: Node, text: string): void => {
  if (node.textContent !== text) node.textContent = text
}

const setAttr = (node: Element, name: string, value: string | null): void => {
  if (value === null) {
    if (node.hasAttribute(name)) node.removeAttribute(name)
  } else if (node.getAttribute(name) !== value) {
    node.setAttribute(name, value)
  }
}

/** Put `node` in `parent` when `present`, before the first of `later` already attached; remove it otherwise. */
const place = (parent: Element, node: Element, present: boolean, later: readonly Element[] = []): void => {
  if (!present) {
    if (node.parentNode === parent) node.remove()
    return
  }
  if (node.parentNode === parent) return
  parent.insertBefore(node, later.find((n) => n.parentNode === parent) ?? null)
}

let compareCount = 0

export interface UIOptionCompareElement extends ReactiveProps<typeof props> {}
export class UIOptionCompareElement extends UIElement {
  static props = props

  readonly #uid = `ui-option-compare-${++compareCount}`
  #heading: HTMLElement | undefined
  #scroller!: HTMLElement
  #grid!: HTMLElement
  #labels!: HTMLElement
  #rowLabels: HTMLElement[] = []
  #columns: ColumnParts[] = []

  protected override connected(): void {
    this.internals.role = 'listbox'
    this.#ensureParts()

    this.effect(() => {
      const heading = typeof this.heading === 'string' ? this.heading.trim() : ''
      this.internals.ariaLabel = heading === '' ? 'Options' : heading
    })
    this.effect(() => this.#renderHead())
    this.effect(() => this.#renderColumns())

    const items = (): HTMLElement[] => this.#columns.map((column) => column.root)
    const keyOf = (el: HTMLElement): string => el.dataset.key ?? ''
    const roving = {
      items,
      typeAhead: false,
      initialIndex: () => items().findIndex((column) => keyOf(column) === this.value),
      syncIndex: () => items().indexOf(document.activeElement as HTMLElement),
    }
    rovingFocus(this, { ...roving, orientation: 'horizontal' })
    rovingFocus(this, { ...roving, orientation: 'vertical' })

    selectionCommit(this, {
      mode: 'single',
      items,
      keyOf,
      itemFromTarget: (target) => {
        if (!(target instanceof Element)) return null
        const column = target.closest('[data-part="option"]')
        return column instanceof HTMLElement && column.parentElement === this.#grid ? column : null
      },
      reflectSelected: (el, selected) => this.#paint(el, selected),
      onSelect: (selection) => {
        this.value = selection as string
      },
    })

    // The action rides its own event after `select` (the OptionDeck emit). Registered after the trait, so a
    // two-way bind on `value` wired before connect has already committed when the action goes out.
    this.listen(this, 'select', (event) => {
      if (event.target !== this) return
      const value = (event as CustomEvent<unknown>).detail
      if (typeof value !== 'string' || this.actionName === '') return
      this.emit('action', { action: this.actionName, context: { value } })
    })

    // Space picks the focused column (selectionCommit wires click and Enter only); `.click()` rides its click path.
    this.listen(this, 'keydown', (event) => {
      const e = event as KeyboardEvent
      if (e.key !== ' ') return
      const active = document.activeElement
      if (!(active instanceof HTMLElement) || active.parentElement !== this.#grid || active === this.#labels) return
      e.preventDefault() // no page scroll
      active.click()
    })
  }

  #ensureParts(): void {
    if (this.#heading) return // parts persist across reconnects; built once ever
    this.#heading = part('div', 'heading')
    this.#scroller = part('div', 'scroller')
    this.#grid = part('div', 'grid')
    this.#labels = part('div', 'labels')
    this.#labels.setAttribute('aria-hidden', 'true')
    this.#labels.append(document.createElement('span')) // the head row's empty label slot
    this.#grid.append(this.#labels)
    this.#scroller.append(this.#grid)
    this.append(this.#heading, this.#scroller)
  }

  #buildColumn(id: string): ColumnParts {
    const root = part('div', 'option')
    root.setAttribute('role', 'option')
    root.setAttribute('aria-selected', 'false')
    root.tabIndex = -1
    const headRow = part('div', 'head-row')
    const pill = part('span', 'pill')
    pill.id = `${id}-pill`
    const svg = document.createElementNS(SVG_NS, 'svg')
    svg.setAttribute('viewBox', '0 0 16 16')
    svg.setAttribute('aria-hidden', 'true')
    const glyph = document.createElementNS(SVG_NS, 'path')
    for (const [k, v] of [['fill', 'none'], ['stroke', 'currentColor'], ['stroke-width', '2'], ['stroke-linecap', 'round'], ['stroke-linejoin', 'round']]) glyph.setAttribute(k!, v!)
    svg.append(glyph)
    const pillText = document.createTextNode('')
    pill.append(svg, pillText)
    const title = part('span', 'title')
    title.id = `${id}-title`
    const subtitle = part('span', 'subtitle')
    subtitle.id = `${id}-subtitle`
    headRow.append(title)
    root.setAttribute('aria-labelledby', title.id)
    root.append(headRow)
    return { id, root, headRow, pill, glyph, pillText, title, subtitle, cells: [], described: [] }
  }

  #renderHead(): void {
    const heading = typeof this.heading === 'string' ? this.heading : ''
    setText(this.#heading!, heading)
    place(this, this.#heading!, heading.trim() !== '', [this.#scroller])
  }

  /** Build or patch the labels and every column from `rows` and `options`, then paint the pick, the best mark
   *  and the tab stop from `value` and `best`. */
  #renderColumns(): void {
    const rows = cleanRows(this.rows)
    const options = cleanOptions(this.options)

    const labels = this.#rowLabels
    while (labels.length > rows.length) labels.pop()!.remove()
    while (labels.length < rows.length) {
      const label = part('span', 'label')
      this.#labels.append(label)
      labels.push(label)
    }
    rows.forEach((row, i) => setText(labels[i]!, row.label))

    const columns = this.#columns
    while (columns.length > options.length) columns.pop()!.root.remove()
    while (columns.length < options.length) {
      const column = this.#buildColumn(`${this.#uid}-${columns.length}`)
      this.#grid.append(column.root)
      columns.push(column)
    }
    options.forEach((option, i) => this.#renderColumn(columns[i]!, option, rows))

    this.#grid.style.setProperty('--ui-option-compare-columns', String(options.length))
    this.#grid.style.setProperty('--ui-option-compare-rows', String(rows.length + 1))

    const value = typeof this.value === 'string' ? this.value : ''
    const best = typeof this.best === 'string' ? this.best : ''
    for (const column of columns) {
      setAttr(column.root, 'data-best', best !== '' && column.root.dataset.key === best ? '' : null)
      this.#paint(column.root, value !== '' && column.root.dataset.key === value)
    }
    // The roving tab stop: keep the one rovingFocus placed, or seed the picked column (or the first) when no
    // column holds it, such as a fresh render.
    const all = columns.map((column) => column.root)
    if (all.length > 0 && !all.some((root) => root.tabIndex === 0)) {
      const seed = Math.max(0, all.findIndex((root) => root.dataset.key === value))
      all.forEach((root, i) => { root.tabIndex = i === seed ? 0 : -1 })
    }
  }

  #renderColumn(parts: ColumnParts, option: CleanOption, rows: readonly CleanRow[]): void {
    const { root, headRow } = parts
    root.dataset.key = option.value
    setText(parts.title, option.title)
    const subtitle = option.subtitle ?? ''
    setText(parts.subtitle, subtitle)
    place(headRow, parts.subtitle, subtitle !== '')

    const cells = parts.cells
    while (cells.length > rows.length) cells.pop()!.root.remove()
    while (cells.length < rows.length) {
      const cell = part('span', 'cell')
      cell.id = `${parts.id}-cell-${cells.length}`
      const label = part('span', 'cell-label')
      const value = document.createTextNode('')
      cell.append(label, value)
      root.append(cell)
      cells.push({ root: cell, label, value })
    }
    const described = subtitle !== '' ? [parts.subtitle.id] : []
    rows.forEach((row, i) => {
      const cell = cells[i]!
      const text = option.values[row.key] ?? ''
      setText(cell.label, row.label)
      // A leading space separates the value from its hidden label in the description; it collapses on screen.
      setText(cell.value, text === '' ? '' : ` ${text}`)
      if (text !== '') described.push(cell.root.id)
    })
    parts.described = described
  }

  /** The one state painter: `aria-selected`, then the pill (Your pick over Best, absent otherwise) and the
   *  description, which names the pill only while it says Best (`aria-selected` already carries the pick). */
  #paint(root: HTMLElement, selected: boolean): void {
    setAttr(root, 'aria-selected', String(selected))
    const parts = this.#columns.find((column) => column.root === root)
    if (!parts) return
    const isBest = root.hasAttribute('data-best')
    const kind = selected ? 'pick' : isBest ? 'best' : ''
    if (kind !== '') {
      setAttr(parts.pill, 'data-kind', kind)
      setAttr(parts.glyph, 'd', kind === 'pick' ? CHECK_D : STAR_D)
      setText(parts.pillText, kind === 'pick' ? 'Your pick' : 'Best')
    }
    place(parts.headRow, parts.pill, kind !== '', [parts.title])
    const described = [...(kind === 'best' ? [parts.pill.id] : []), ...parts.described]
    setAttr(root, 'aria-describedby', described.length === 0 ? null : described.join(' '))
  }
}

if (!customElements.get('ui-option-compare')) customElements.define('ui-option-compare', UIOptionCompareElement)
