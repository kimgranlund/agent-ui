// table.ts — UITableElement, the Display-class static data table WIDENED in place with four opt-in
// interactive capabilities (LLD-C2, report-family.lld.md §2; SPEC-R1…R6; ADR-0111 cl.1/3 — ADR-0163, the
// interactive widening: cl.2 filter/search, cl.3 ARIA, cl.4 selection, cl.5 sort, cl.6 pagination, cl.7 the
// view pipeline, cl.10 byte-identity at defaults). BEHAVIOUR + props + the stable-skeleton mechanism + the
// effect split + self-define ONLY; the pure cell-resolution/hardening/view-pipeline math lives in
// table-model.ts (DOM-free, unit-testable) and the CSS/token geometry lives in table.css.
//
// The mechanism is STILL a REAL native `<table>` stamped in light DOM (ADR-0078 cl.4; ADR-0111 cl.3): header
// association, `th scope`, and SR table navigation come free from the platform. ADR-0163 cl.3 (the
// correctness crux) keeps the host role NATIVE — `role=grid` is REJECTED — and adds exactly two sanctioned
// exceptions to the fleet's "no native form elements" law: a stamped real `<input type=checkbox>` /
// `<input type=radio>` selection column, and a real `<button>` inside a sortable `<th>` (the APG sortable-
// table example's own shape). All interactive elements sit in the NORMAL tab order — no roving tabindex, no
// `UIListboxElement`, no `aria-selected` on rows (checked state IS the announced selection).
//
// The SPEC-R4/cl.10 re-render contract is UNCHANGED at its core — a STABLE SKELETON built ONCE in
// `connected()`: `#scroll` › `#table` › `#thead` + `#tbody`, PLUS a new `#footer` sibling of `#scroll`
// (cl.6's `data-part="footer"`, OUTSIDE the scroll container) holding a composed `ui-pagination` when
// `pageSize > 0`. No code path ever writes `#scroll.scrollLeft`/`.scrollTop`.
//
// Five independent effects, split by which signal(s) each reads (unchanged fine-grained-waking discipline,
// widened):
//   • HEADER-BUILD (reads `columns` + `selectable`) — rebuilds `#thead`'s one header row, incl. the leading
//     selection column (multi ⇒ a select-all checkbox; single ⇒ a bare header cell) and a real `<button>`
//     inside every `sortable` column's `<th>`. Calls `#applyAriaSort()` SYNCHRONOUSLY at the end of its own
//     body (never as a separate reactive dependency) so a structure rebuild never races the aria-sort effect
//     below — correctness by construction, not by relying on effect-scheduling order.
//   • SORT-STATE (reads `sort` + `columns` + `selectable`, via `#applyAriaSort()`) — sets/clears `aria-sort`
//     on the ONE currently-sorted `<th>` ONLY. Never rebuilds a node — a sort click never loses focus on the
//     button that was just clicked (HEADER-BUILD is not a dependent of `sort` at all).
//   • VIEW (reads `columns` + `rows` + `selectable` + `rowKey` + `selected` + `filter` + `search` + `sort` +
//     `pageSize` + `page`) — runs the cl.7 pipeline (`computeTableView`) and rebuilds ONLY `#tbody`'s content
//     (whole-array swap, unchanged from the display-only contract) plus the select-all header checkbox's
//     checked/indeterminate state (computed against the MATCHING SET) and the `#footer`/`ui-pagination`
//     attach/detach + prop sync. Captures/restores focus across the rebuild when it was on a stamped
//     selection input (cl.10/SPEC-R4.5 — the tbody-rebuild-loses-focus mitigation).
//   • RECONCILE-SELECTED (reads `rows` + `rowKey` + `selected`) — drops `selected` identities that no
//     longer exist in the CURRENT `rows` (cl.7's "a rows swap reconciles `selected` by dropping identities
//     that no longer exist, never throws"); never fires `select` (not a user commit).
//   • LABEL (reads `label` only) — UNCHANGED from the display-only contract.
// `render()` stays the inherited no-op.
//
// Imports inward only (controls → dom): UIElement + prop + the typed-schema helpers from the dom barrel;
// the pure math + safe codecs from the co-located table-model.ts. `UIPaginationElement` is a sibling
// controls-family import (controls → controls is the established composition pattern — swiper-paddles.ts's
// `UIButtonElement` import, the identical shape).

import { UIElement, prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import {
  cleanColumns,
  cleanFilter,
  cleanRows,
  cleanSelected,
  cleanSort,
  computeRowIdentities,
  computeTableView,
  resolveCell,
  tableColumnsProp,
  tableFilterProp,
  tableRowsProp,
  tableSelectedProp,
  tableSortProp,
  type TableColumn,
  type TableRow,
} from './table-model.ts'
// Runtime side-effect import (NOT `import type`) — table.ts creates `<ui-pagination>` elements imperatively
// (cl.6's footer), so the tag must be REGISTERED (self-defines on import, the fleet's standing rule) before
// `document.createElement('ui-pagination')` can upgrade — the exact reason swiper-paddles.ts's `UIButtonElement`
// import pulls in `../button/button.ts` at the family-barrel level rather than relying on a type-only import.
import '../pagination/pagination.ts'
import type { UIPaginationElement } from '../pagination/pagination.ts'

const props = {
  columns: tableColumnsProp, // TableColumn[] · safe JSON codec (table-model.ts) · default []
  rows: tableRowsProp, // TableRow[] · safe JSON codec (table-model.ts) · default []
  label: { ...prop.string(''), reflect: true }, // the rendered <caption> text — the table's accessible name (SPEC-R2/R6)

  // ADR-0163 cl.4 — selection. '' (default, off) — the ''-first inherit/off canon.
  selectable: { ...prop.enum(['', 'single', 'multi'] as const, ''), reflect: true },
  rowKey: { ...prop.string(''), attribute: 'row-key' }, // names the identity column; absent ⇒ data-order index
  selected: tableSelectedProp, // string[] · JSON codec · bindable, NOT reflected · commits via `select`

  // ADR-0163 cl.5 — sort. State prop only; the comparator lives in table-model.ts.
  sort: tableSortProp, // {key,direction} | null · JSON codec · bindable, NOT reflected · commits via `change`

  // ADR-0163 cl.2 — filter/search. Both control-owned, applied client-side; no query UI of their own.
  search: prop.string(''), // free-text filter over rendered cell text; NOT reflected (dynamic view state)
  filter: tableFilterProp, // {key,values}[] · JSON codec · bounded facet shape; NOT reflected

  // ADR-0163 cl.6 — pagination consumption.
  pageSize: { ...prop.number(0), attribute: 'page-size' }, // 0 (default, off) ⇒ no footer, no windowing
  page: prop.number(1), // 1-based, bindable; commits via `change` (forwarded from the internal ui-pagination)
} satisfies PropsSchema

export interface UITableElement extends ReactiveProps<typeof props> {}
export class UITableElement extends UIElement {
  static props = props

  // The stable skeleton (SPEC-R4.1) — built ONCE EVER behind the `#built` guard (TKT-0067), held
  // privately, NEVER replaced by any data-update effect below.
  #built = false
  #scroll!: HTMLDivElement
  #table!: HTMLTableElement
  #thead!: HTMLTableSectionElement
  #tbody!: HTMLTableSectionElement
  // The footer region (ADR-0163 cl.6) — a SIBLING of `#scroll` (both direct host children), OUTSIDE the
  // scroll container. Built once, attached to the host only while `pageSize > 0` (never destroyed — the
  // `#table` empty-columns attach/detach precedent, applied here).
  #footer!: HTMLDivElement
  #pagination: UIPaginationElement | null = null
  // The mounted `<caption>` — null while `label` is empty.
  #caption: HTMLTableCaptionElement | null = null
  #lastScrollLeft = 0
  #lastScrollTop = 0
  // A stable, per-instance radio `name` (ADR-0163 cl.4 — "one shared name") — minted once at construction,
  // never re-minted across reconnects (the caption-id counter precedent, module-scoped, collision-free).
  readonly #radioName = nextRadioName()

  protected connected(): void {
    if (!this.#built) {
      this.#built = true
      this.#scroll = document.createElement('div')
      this.#scroll.setAttribute('data-part', 'scroll')
      this.#scroll.setAttribute('role', 'region')
      this.#scroll.setAttribute('tabindex', '0')
      this.#table = document.createElement('table')
      this.#thead = document.createElement('thead')
      this.#tbody = document.createElement('tbody')
      this.#table.append(this.#thead, this.#tbody)
      this.#caption = null
      this.#footer = document.createElement('div')
      this.#footer.setAttribute('data-part', 'footer')
      this.replaceChildren(this.#scroll) // `#footer` is appended/removed later, ONLY while pageSize > 0
    }

    if (this.#lastScrollLeft !== 0 || this.#lastScrollTop !== 0) {
      this.#scroll.scrollLeft = this.#lastScrollLeft
      this.#scroll.scrollTop = this.#lastScrollTop
    }
    this.listen(this.#scroll, 'scroll', () => {
      this.#lastScrollLeft = this.#scroll.scrollLeft
      this.#lastScrollTop = this.#scroll.scrollTop
    })

    // HEADER-BUILD (SPEC-R4.3 identity clause, widened) — reads `columns` + `selectable`. A `rows`-only (or
    // `sort`/`selected`/`filter`/`search`/`page`) update never re-runs this, so `#table`/`#thead` node
    // identity holds across it.
    this.effect(() => {
      const cols = cleanColumns(this.columns)
      if (cols.length === 0) {
        this.#scroll.replaceChildren()
        return
      }
      if (this.#table.parentNode !== this.#scroll) this.#scroll.replaceChildren(this.#table)
      const selectable = this.selectable
      const headerRow = document.createElement('tr')
      if (selectable === 'multi') {
        headerRow.append(this.#selectAllHeaderCell())
      } else if (selectable === 'single') {
        const th = document.createElement('th')
        th.setAttribute('scope', 'col')
        th.setAttribute('data-part', 'select-header')
        headerRow.append(th)
      }
      for (const col of cols) headerRow.append(this.#headerCell(col))
      this.#thead.replaceChildren(headerRow)
      this.#applyAriaSort() // synchronous — never races the SORT-STATE effect below (see the file banner)
    })

    // SORT-STATE — sets/clears `aria-sort` on the sorted `<th>` ONLY (never rebuilds a node). Redundant
    // (harmless, idempotent) on a structure-changing run — HEADER-BUILD already applied it directly.
    this.effect(() => {
      this.#applyAriaSort()
    })

    // VIEW (SPEC-R4.3, cl.7's pipeline) — reads every state prop; rebuilds ONLY `#tbody`'s content (whole-
    // array swap) + the select-all checkbox state + the `#footer`/`ui-pagination` attach/sync. `#scroll`/
    // `#table`/`#thead` are never touched here.
    this.effect(() => {
      const cols = cleanColumns(this.columns)
      const rows = cleanRows(this.rows)
      const selectable = this.selectable
      const rowKey = this.rowKey
      const selectedList = cleanSelected(this.selected)
      const selectedSet = new Set(selectedList)
      const filter = cleanFilter(this.filter)
      const search = this.search
      const sort = cleanSort(this.sort)
      const rawPageSize = this.pageSize
      const pageSize = rawPageSize !== null && Number.isFinite(rawPageSize) ? Math.trunc(rawPageSize) : 0
      const rawPage = this.page
      const page = rawPage !== null && Number.isFinite(rawPage) ? Math.trunc(rawPage) : 1

      const view = computeTableView({ rows, columns: cols, rowKey, filter, search, sort, pageSize, page })

      // Focus restoration (cl.10 / SPEC-R4.5): capture the focused selection input's row identity BEFORE
      // the rebuild, restore it AFTER — the only stamped interactive control `#tbody` ever holds.
      const activeBefore = document.activeElement
      const focusedId =
        activeBefore instanceof HTMLElement && this.#tbody.contains(activeBefore)
          ? activeBefore.getAttribute('data-row-id')
          : null

      this.#tbody.replaceChildren(...view.paged.map((ir) => this.#bodyRow(cols, selectable, ir.row, ir.id, selectedSet)))

      if (focusedId !== null) {
        const restored = [...this.#tbody.querySelectorAll('[data-row-id]')].find(
          (el) => el.getAttribute('data-row-id') === focusedId,
        ) as HTMLElement | undefined
        restored?.focus()
      }

      // Select-all header checkbox state — computed against the MATCHING SET (cl.7).
      if (selectable === 'multi') {
        const selectAll = this.#thead.querySelector<HTMLInputElement>('[data-part="select-all"]')
        if (selectAll) {
          const matchingIds = view.matching.map((ir) => ir.id)
          const matchedSelected = matchingIds.filter((id) => selectedSet.has(id)).length
          selectAll.checked = matchingIds.length > 0 && matchedSelected === matchingIds.length
          selectAll.indeterminate = matchedSelected > 0 && matchedSelected < matchingIds.length
        }
      }

      // Footer / ui-pagination (cl.6) — stamped ONLY while pageSize > 0; never destroyed once created.
      if (pageSize > 0) {
        if (this.#footer.parentNode !== this) this.append(this.#footer)
        if (!this.#pagination) {
          const pagination = document.createElement('ui-pagination') as UIPaginationElement
          pagination.setAttribute('data-part', 'pagination')
          this.#pagination = pagination
          // Update the table's own `page` prop only — do NOT also call `this.emit('change')` here: `emit`
          // dispatches `{ bubbles: true, composed: true }` (element.ts), and `pagination` is a light-DOM
          // descendant of THIS host, so its own `change` event already bubbles up through `#footer` → the
          // table host — a table-level `change` listener receives it via that natural bubble. Re-emitting
          // would fire the SAME logical commit twice at any table-level listener (measured: a real click
          // drove a table `change` listener's counter to 2, not 1 — table-interactive.browser.test.ts).
          this.listen(pagination, 'change', () => {
            this.page = pagination.page
          })
          this.#footer.replaceChildren(pagination)
        }
        this.#pagination.pages = view.pageCount
        this.#pagination.page = Math.min(Math.max(1, page), Math.max(1, view.pageCount))
        this.#pagination.label = this.label !== '' ? `${this.label} pagination` : 'Table pagination'
      } else if (this.#footer.parentNode === this) {
        this.#footer.remove()
      }
    })

    // RECONCILE-SELECTED (cl.7) — a `rows`/`rowKey` swap drops `selected` identities that no longer exist;
    // never throws, never emits `select` (not a user commit). Converges in one extra pass when it writes.
    this.effect(() => {
      const ids = new Set(computeRowIdentities(cleanRows(this.rows), this.rowKey).map((ir) => ir.id))
      const current = cleanSelected(this.selected)
      const kept = current.filter((id) => ids.has(id))
      if (kept.length !== current.length) this.selected = kept
    })

    // LABEL — UNCHANGED from the display-only contract (SPEC-R2 AC3).
    this.effect(() => {
      const label = this.label
      if (label === '') {
        this.#caption?.remove()
        this.#caption = null
        this.#scroll.removeAttribute('aria-labelledby')
        return
      }
      if (!this.#caption) {
        this.#caption = document.createElement('caption')
        this.#caption.id = nextCaptionId()
        this.#table.insertBefore(this.#caption, this.#table.firstChild)
      }
      this.#caption.textContent = label
      this.#scroll.setAttribute('aria-labelledby', this.#caption.id)
    })
  }

  /** The leading `<th scope="col">` for `selectable='multi'` — a real, stamped select-all checkbox
   *  (ADR-0163 cl.4). Its checked/indeterminate state is maintained by the VIEW effect (computed against
   *  the matching set); the click handler here only toggles. */
  #selectAllHeaderCell(): HTMLTableCellElement {
    const th = document.createElement('th')
    th.setAttribute('scope', 'col')
    th.setAttribute('data-part', 'select-header')
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.setAttribute('data-part', 'select-all')
    input.setAttribute('aria-label', 'Select all rows')
    this.listen(input, 'change', () => this.#toggleSelectAll(input.checked))
    th.append(input)
    return th
  }

  /** One `<th scope="col">` — `data-type='number'` set from the column's type (SPEC-R2/R3 row 9,
   *  unchanged). ADR-0163 cl.5: a `sortable` column wraps its label in a real, stamped `<button>` (the APG
   *  sortable-table shape) instead of plain text — the ONLY structural difference; a non-sortable column's
   *  `<th>` is byte-for-byte identical to the pre-widening baseline (SPEC-R2/cl.10). */
  #headerCell(col: TableColumn): HTMLTableCellElement {
    const th = document.createElement('th')
    th.setAttribute('scope', 'col')
    if (col.type === 'number') th.setAttribute('data-type', 'number')
    if (col.sortable) {
      const button = document.createElement('button')
      button.type = 'button'
      button.setAttribute('data-part', 'sort-button')
      button.textContent = col.label
      this.listen(button, 'click', () => this.#commitSort(col.key))
      th.append(button)
    } else {
      th.textContent = col.label
    }
    return th
  }

  /** Set/clear `aria-sort` on the currently-sorted `<th>` ONLY — never touches node identity. The header's
   *  `<th>` order is [selection column?] + one per `columns` entry (in order); `offset` decodes which. */
  #applyAriaSort(): void {
    const cols = cleanColumns(this.columns)
    const sort = cleanSort(this.sort)
    const offset = this.selectable === '' ? 0 : 1
    const ths = [...this.#thead.querySelectorAll('tr > th')]
    cols.forEach((col, i) => {
      const th = ths[i + offset]
      if (!th) return
      if (col.sortable && sort !== null && sort.key === col.key) th.setAttribute('aria-sort', sort.direction)
      else th.removeAttribute('aria-sort')
    })
  }

  /** One `<tr>` of `<td>`s for `row` (SPEC-R3 row 9, unchanged cell resolution). ADR-0163 cl.4: a leading
   *  selection `<td>` with a real, stamped `<input type=checkbox|radio>` when `selectable` is active — the
   *  ONLY structural difference; at `selectable=''` this is byte-for-byte identical to the pre-widening
   *  baseline (SPEC-R2/cl.10). `data-selected` rides the `<tr>` for CSS (cl.4). */
  #bodyRow(cols: TableColumn[], selectable: string, row: TableRow, id: string, selectedSet: Set<string>): HTMLTableRowElement {
    const tr = document.createElement('tr')
    if (selectable === 'multi' || selectable === 'single') {
      const td = document.createElement('td')
      td.setAttribute('data-part', 'select-cell')
      const input = document.createElement('input')
      input.type = selectable === 'multi' ? 'checkbox' : 'radio'
      input.setAttribute('data-part', 'select')
      input.setAttribute('data-row-id', id)
      if (selectable === 'single') input.name = this.#radioName
      input.checked = selectedSet.has(id)
      const firstCellText = cols.length > 0 ? resolveCell(cols[0], row) : ''
      input.setAttribute('aria-label', firstCellText !== '' ? `Select row: ${firstCellText}` : 'Select row')
      this.listen(input, 'change', () => this.#toggleRowSelection(id, selectable, input.checked))
      td.append(input)
      tr.append(td)
    }
    for (const col of cols) {
      const td = document.createElement('td')
      if (col.type === 'number') td.setAttribute('data-type', 'number')
      td.textContent = resolveCell(col, row)
      tr.append(td)
    }
    if (selectedSet.has(id)) tr.setAttribute('data-selected', '')
    return tr
  }

  /** The MATCHING SET's identities (cl.7) — filter + search applied, sort/page irrelevant (computed BEFORE
   *  either stage). Recomputed fresh at click time (never a stale closure over a prior render). */
  #matchingIds(): string[] {
    const view = computeTableView({
      rows: cleanRows(this.rows),
      columns: cleanColumns(this.columns),
      rowKey: this.rowKey,
      filter: cleanFilter(this.filter),
      search: this.search,
      sort: null,
      pageSize: 0,
      page: 1,
    })
    return view.matching.map((ir) => ir.id)
  }

  /** ADR-0163 cl.4 commit — a single row's selection toggle. `single` REPLACES `selected` with `[id]` when
   *  checked (native radio parity: a click cannot uncheck a radio without checking another). `multi` adds/
   *  removes `id`. Never fired by a programmatic `selected` write (the fleet commit law) — only from the
   *  real `change` listener on the stamped input. */
  #toggleRowSelection(id: string, selectable: string, checked: boolean): void {
    const current = cleanSelected(this.selected)
    const next =
      selectable === 'single'
        ? checked
          ? [id]
          : []
        : checked
          ? current.includes(id)
            ? current
            : [...current, id]
          : current.filter((x) => x !== id)
    this.selected = next
    this.emit('select')
  }

  /** ADR-0163 cl.4/cl.7 commit — the header select-all checkbox. Operates on the MATCHING SET only:
   *  checking selects every currently-matching identity (union with whatever else was already selected but
   *  filtered out); unchecking removes every matching identity (leaving an out-of-view selection intact). */
  #toggleSelectAll(checked: boolean): void {
    const matchingIds = this.#matchingIds()
    const current = cleanSelected(this.selected)
    const next = checked
      ? [...current, ...matchingIds.filter((id) => !current.includes(id))]
      : current.filter((id) => !matchingIds.includes(id))
    this.selected = next
    this.emit('select')
  }

  /** ADR-0163 cl.5 commit — cycles ascending → descending on the SAME column; switching to a different
   *  sortable column starts fresh at ascending. */
  #commitSort(key: string): void {
    const current = cleanSort(this.sort)
    const direction = current !== null && current.key === key && current.direction === 'ascending' ? 'descending' : 'ascending'
    this.sort = { key, direction }
    this.emit('change')
  }
}

// The caption `id` mint — a module-scoped counter suffix, collision-free in light DOM (no crypto/uuid dep).
let captionCounter = 0
function nextCaptionId(): string {
  captionCounter += 1
  return `ui-table-caption-${captionCounter}`
}

// The radio-group `name` mint (ADR-0163 cl.4) — one per `selectable='single'` table instance, module-scoped,
// collision-free (the caption-id counter's own shape).
let radioNameCounter = 0
function nextRadioName(): string {
  radioNameCounter += 1
  return `ui-table-radio-${radioNameCounter}`
}

if (!customElements.get('ui-table')) customElements.define('ui-table', UITableElement) // idempotent self-define
