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
// EVENT DELEGATION, not a per-stamped-node listener (component-checker retained-listener finding): the
// sort-button click is handled by ONE listener on `#thead`; the select-all checkbox toggle AND every row's
// selection checkbox/radio toggle are handled by ONE `change` listener on `#table` (GH #455 size diet — a
// stable skeleton node itself, wrapping BOTH `#thead` and `#tbody`, so either input's `change` bubbles to it
// identically to delegating on each separately). Both registered ONCE in `connected()` (re-armed on
// reconnect, the `#scroll` scroll-listener's own precedent), never per stamped node. A stamped button/input
// dispatches by carrying a `data-key`/`data-row-id` attribute the delegated handler reads off `event.target`.
// Without this, a PER-NODE `this.listen` (the original shape) would strand a fresh closure+listener — riding
// the connection-lifetime AbortSignal, never released until disconnect — on every discarded rebuild; VIEW
// alone reruns on every search keystroke, every page turn, every selection toggle, so that shape grows
// UNBOUNDED on a long-lived, frequently-updating table. Delegation keeps the listener count fixed at two
// regardless of rebuild count.
//
// Five independent effects, split by which signal(s) each reads (unchanged fine-grained-waking discipline,
// widened):
//   • HEADER-BUILD (reads `columns` + `selectable` ONLY — `sort` is read via `untracked()`, see below)
//     rebuilds `#thead`'s one header row, incl. the leading selection column (multi ⇒ a select-all checkbox;
//     single ⇒ a bare header cell) and a real `<button>` inside every `sortable` column's `<th>`. It applies
//     the CURRENT `aria-sort` state to the freshly-built nodes immediately, via `this.#applyAriaSort(untracked(() =>
//     this.sort))` — `untracked` (component-checker finding, verified: the reactive kernel tracks EVERY signal
//     read during an effect body regardless of how deep the call stack, so a bare `this.sort` read here — even
//     buried inside a helper call — silently made HEADER-BUILD a dependent of `sort`, rebuilding the WHOLE
//     `<thead>` on every sort commit and stranding the just-clicked button's focus; a `<tr>`/button node-
//     identity probe proved it) makes this ONE read genuinely untracked, so a sort-only change never re-runs
//     this effect — correctness by construction, not by relying on effect-scheduling order.
//   • SORT-STATE (reads `sort` — TRACKED — plus `columns`/`selectable` for the offset math) — sets/clears
//     `aria-sort` on the ONE currently-sorted `<th>` ONLY. Never rebuilds a node — a sort click never loses
//     focus on the button that was just clicked (HEADER-BUILD is not a dependent of `sort` at all, per the
//     `untracked` fix above).
//   • VIEW (reads `columns` + `rows` + `selectable` + `rowKey` + `selected` + `filter` + `search` + `sort` +
//     `pageSize` + `page` — NEVER `label`, see below) — runs the cl.7 pipeline (`computeTableView`) and
//     rebuilds ONLY `#tbody`'s content (whole-array swap, unchanged from the display-only contract) plus
//     the select-all header checkbox's checked/indeterminate state (computed against the MATCHING SET) and
//     the `#footer`/`ui-pagination` attach/detach + prop sync. When it CREATES the footer's `ui-pagination`
//     for the first time, it seeds that composed control's OWN `label` via `untracked(() => this.label)` —
//     a ONE-TIME creation-time read (the text-field.ts `swatchPreview.color = untracked(() => this.value)`
//     precedent) — component-checker finding: a bare `this.label` read there would silently make VIEW ALSO
//     a dependent of `label`, contradicting this very banner and rebuilding the whole `<tbody>` on a label-
//     only change. Every SUBSEQUENT `label` change is the LABEL effect's job, below — `footerLabel()` is the
//     one derivation both share, so the seed and the ongoing update can never drift apart. Captures/restores
//     focus across the rebuild when it was on a stamped selection input (cl.10/SPEC-R4.5 — the tbody-
//     rebuild-loses-focus mitigation).
//   • RECONCILE-SELECTED (reads `rows` + `rowKey` + `selected`) — drops `selected` identities that no
//     longer exist in the CURRENT `rows` (cl.7's "a rows swap reconciles `selected` by dropping identities
//     that no longer exist, never throws"); never fires `select` (not a user commit).
//   • LABEL (reads `label` — the ONLY effect that tracks it) — the `<caption>`/`aria-labelledby` pair
//     (SPEC-R2 AC3, unchanged from the display-only contract) PLUS, when a footer `ui-pagination` currently
//     exists, its `label`'s ongoing upkeep (`footerLabel()`, the SAME derivation VIEW seeds it with).
// `render()` stays the inherited no-op.
//
// Imports inward only (controls → dom): UIElement + prop + the typed-schema helpers from the dom barrel;
// the pure math + safe codecs from the co-located table-model.ts. `UIPaginationElement` is a sibling
// controls-family import (controls → controls is the established composition pattern — swiper-paddles.ts's
// `UIButtonElement` import, the identical shape).

import { UIElement, type ReactiveProps } from '../../dom/index.ts'
// `untracked` — the ONE reactive-kernel import this control needs (controls MAY import `reactive` directly,
// the layering law's layer-0; `text-field.ts`'s `untracked(() => this.value)` one-time-seed read is the
// exact same-shape precedent). Load-bearing for the HEADER-BUILD/`#applyAriaSort` split above.
import { untracked } from '../../reactive/index.ts'
import {
  cleanColumns,
  cleanFilter,
  cleanRows,
  cleanSelected,
  cleanSort,
  computeRowIdentities,
  computeTableView,
  resolveCell,
  type TableColumn,
  type TableRow,
} from './table-model.ts'
// Generated from table.md's `attributes[]` (ADR-0173) — `node scripts/generate-props.mjs table` to
// regenerate; never hand-edit table.props.gen.ts. Five of the eleven props (columns/rows/selected/sort/
// filter) are `codec:` references to table-model.ts's own safeJsonCodec-backed PropConfigs (OF1) — this
// file imports the ASSEMBLED props object, not the individual codec exports, which now live only in the
// generated sibling + table-model.ts itself.
import { props } from './table.props.gen.ts'
// Runtime side-effect import (NOT `import type`) — table.ts creates `<ui-pagination>` elements imperatively
// (cl.6's footer), so the tag must be REGISTERED (self-defines on import, the fleet's standing rule) before
// `document.createElement('ui-pagination')` can upgrade — the exact reason swiper-paddles.ts's `UIButtonElement`
// import pulls in `../button/button.ts` at the family-barrel level rather than relying on a type-only import.
import '../pagination/pagination.ts'
import type { UIPaginationElement } from '../pagination/pagination.ts'

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

    // ONE delegated listener PER EVENT TYPE, on `#table` — a STABLE skeleton node itself (SPEC-R4.1, never
    // replaced) that wraps BOTH `#thead` and `#tbody`, so a `change` on either bubbles to it identically to
    // delegating on each separately (component-checker retained-listener finding, kept, one node fewer than
    // the original two-listener shape): HEADER-BUILD replaces the whole `<thead>` row on every columns/
    // selectable change, and VIEW replaces the whole `<tbody>` content on every state-prop change (every
    // search keystroke, every page turn, every selection toggle) — a PER-STAMPED-NODE `this.listen` (the
    // original shape) strands a fresh closure+listener, riding the connection-lifetime AbortSignal, on every
    // discarded rebuild: unbounded retention on a long-lived, frequently-updating table. Re-armed once per
    // connect exactly like the `#scroll` listener above, this keeps the listener COUNT at a fixed two
    // regardless of rebuild count.
    this.listen(this.#thead, 'click', (event) => {
      const button = (event.target as HTMLElement).closest<HTMLElement>('[data-part="sort-button"]')
      const key = button?.getAttribute('data-key')
      if (key) this.#commitSort(key)
    })
    this.listen(this.#table, 'change', (event) => {
      const target = event.target as HTMLElement
      const isSelectAll = target.matches('[data-part="select-all"]')
      if (!isSelectAll && !target.matches('[data-part="select"]')) return
      // stopPropagation: a native <input> `change` bubbles unstopped by default, and this host's OWN
      // `change` event is the sort/page commit channel (cl.5/cl.6) — without this, a selection toggle would
      // ALSO arrive at any table-level `change` listener, giving the same event name two unrelated meanings
      // on the same host (component-checker finding). Selection's own contract event stays `select` only.
      event.stopPropagation()
      if (isSelectAll) {
        this.#toggleSelectAll((target as HTMLInputElement).checked)
        return
      }
      const id = target.getAttribute('data-row-id')
      if (id !== null) this.#toggleRowSelection(id, this.selectable, (target as HTMLInputElement).checked)
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
        headerRow.append(this.#selectHeaderCell())
      }
      for (const col of cols) headerRow.append(this.#headerCell(col))
      this.#thead.replaceChildren(headerRow)
      // untracked — see the file banner: a bare `this.sort` read here would silently make HEADER-BUILD a
      // dependent of `sort`, rebuilding this whole effect (and every node it owns) on every sort commit.
      this.#applyAriaSort(untracked(() => this.sort))
    })

    // SORT-STATE — the ONE effect that TRACKS `sort` (plus `columns`/`selectable`, needed for the offset
    // math — redundant-but-harmless extra reruns on those, since this body only ever sets/clears an
    // attribute, never rebuilds a node). Never touches node identity — a sort click never loses focus on
    // the button that was just clicked.
    this.effect(() => {
      this.#applyAriaSort(this.sort)
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
      const pageSize = finiteInt(this.pageSize, 0)
      const page = finiteInt(this.page, 1)

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
          // untracked: a ONE-TIME creation-time seed (the text-field.ts `swatchPreview.color =
          // untracked(() => this.value)` precedent, banner-quoted there) — a plain read here would make
          // VIEW a dependent of `label` too (this call runs synchronously inside VIEW's own scope). ALL
          // SUBSEQUENT `label` changes are the LABEL effect's job (below) — it already owns every other
          // `label` consequence (the caption, `aria-labelledby`) and now owns this seed's upkeep too, so
          // there is exactly ONE effect genuinely tracking `label`, matching the file banner and table.md.
          // `footerLabel()` is the ONE derivation both this seed and LABEL's ongoing update share.
          pagination.label = footerLabel(untracked(() => this.label))
          this.#footer.replaceChildren(pagination)
        }
        this.#pagination.pages = view.pageCount
        this.#pagination.page = Math.min(Math.max(1, page), Math.max(1, view.pageCount))
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

    // LABEL — the ONE effect genuinely tracking `label` (component-checker finding: VIEW's footer-label
    // derivation used to read `this.label` live, silently making VIEW ALSO a dependent of `label` — the
    // SAME bug class as the sort-tracking fix, fixed by seeding the footer's pagination `label` ONCE at
    // creation time, `untracked`, in VIEW, and giving LABEL the ongoing-update half here). Owns every
    // consequence of a `label` change: the `<caption>`/`aria-labelledby` pair (SPEC-R2 AC3, unchanged from
    // the display-only contract) AND, when a `page-size > 0` footer currently exists, the SAME derived
    // string VIEW seeds it with at creation — kept in exactly ONE place (`#footerLabel`) so the two paths
    // (seed vs. ongoing update) can never drift apart.
    this.effect(() => {
      const label = this.label
      if (label === '') {
        this.#caption?.remove()
        this.#caption = null
        this.#scroll.removeAttribute('aria-labelledby')
      } else {
        if (!this.#caption) {
          this.#caption = document.createElement('caption')
          this.#caption.id = nextCaptionId()
          this.#table.insertBefore(this.#caption, this.#table.firstChild)
        }
        this.#caption.textContent = label
        this.#scroll.setAttribute('aria-labelledby', this.#caption.id)
      }
      if (this.#pagination) this.#pagination.label = footerLabel(label)
    })
  }

  /** The shared `<th scope="col">` base every header cell starts from (`#selectHeaderCell`/`#headerCell`
   *  below) — a plain-object-loop-style dedup of the one line all three header-cell shapes repeated. */
  #thCol(): HTMLTableCellElement {
    const th = document.createElement('th')
    th.setAttribute('scope', 'col')
    return th
  }

  /** The leading `<th scope="col" data-part="select-header">` shared by `selectable='single'` (bare) and
   *  `selectable='multi'` (`#selectAllHeaderCell`, which adds the checkbox) — the two select-header shapes
   *  differ ONLY in whether an `<input>` is appended. */
  #selectHeaderCell(): HTMLTableCellElement {
    const th = this.#thCol()
    th.setAttribute('data-part', 'select-header')
    return th
  }

  /** The leading `<th scope="col">` for `selectable='multi'` — a real, stamped select-all checkbox
   *  (ADR-0163 cl.4). Its checked/indeterminate state is maintained by the VIEW effect (computed against
   *  the matching set); the click/toggle itself is handled by the ONE delegated `#thead` `change` listener
   *  (`connected()`, the retained-listener fix) — this method only builds markup, no per-node listener. */
  #selectAllHeaderCell(): HTMLTableCellElement {
    const th = this.#selectHeaderCell()
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.setAttribute('data-part', 'select-all')
    input.setAttribute('aria-label', 'Select all rows')
    th.append(input)
    return th
  }

  /** One `<th scope="col">` — `data-type='number'` set from the column's type (SPEC-R2/R3 row 9,
   *  unchanged). ADR-0163 cl.5: a `sortable` column wraps its label in a real, stamped `<button>` (the APG
   *  sortable-table shape) instead of plain text — the ONLY structural difference; a non-sortable column's
   *  `<th>` is byte-for-byte identical to the pre-widening baseline (SPEC-R2/cl.10). `data-key` carries the
   *  column's `key` — read by the ONE delegated `#thead` `click` listener (`connected()`, the retained-
   *  listener fix); no per-button listener here. */
  #headerCell(col: TableColumn): HTMLTableCellElement {
    const th = this.#thCol()
    if (col.type === 'number') th.setAttribute('data-type', 'number')
    if (col.sortable) {
      const button = document.createElement('button')
      button.type = 'button'
      button.setAttribute('data-part', 'sort-button')
      button.setAttribute('data-key', col.key)
      button.textContent = col.label
      th.append(button)
    } else {
      th.textContent = col.label
    }
    return th
  }

  /** Set/clear `aria-sort` on the currently-sorted `<th>` ONLY — never touches node identity. The header's
   *  `<th>` order is [selection column?] + one per `columns` entry (in order); `offset` decodes which.
   *  `rawSort` is the CALLER-supplied value (hardened here via `cleanSort`) — passed in rather than read
   *  live so each call site controls whether that read is tracked (HEADER-BUILD passes an `untracked()`
   *  read; SORT-STATE passes a tracked one — see the file banner). */
  #applyAriaSort(rawSort: unknown): void {
    const cols = cleanColumns(this.columns)
    const sort = cleanSort(rawSort)
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
   *  baseline (SPEC-R2/cl.10). `data-selected` rides the `<tr>` for CSS (cl.4). The toggle itself is handled
   *  by the ONE delegated `#tbody` `change` listener (`connected()`, the retained-listener fix) — this
   *  method only builds markup, no per-node listener (this is the MOST frequently-rebuilt anatomy in the
   *  control, VIEW reruns on every search keystroke/page turn/selection toggle — the fix that mattered most). */
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
    this.#commitSelected(next)
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
    this.#commitSelected(next)
  }

  /** The `selected` write + `select` commit both toggle methods above share (never fired by a
   *  programmatic `selected` write — only from a real `change` listener, per the fleet commit law). */
  #commitSelected(next: string[]): void {
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

// A bindable number prop's hardened read (the VIEW effect's `pageSize`/`page` shared shape) — `null`/non-
// finite falls back to `fallback`, else truncated to an integer.
function finiteInt(raw: number | null, fallback: number): number {
  return raw !== null && Number.isFinite(raw) ? Math.trunc(raw) : fallback
}

// ADR-0163 cl.6 — the footer's composed `ui-pagination` accessible name, derived from the table's own
// `label` (empty ⇒ a generic fallback). ONE pure, single-sourced derivation — the VIEW effect's creation-
// time seed (`untracked`) and the LABEL effect's ongoing update both call this, so the two paths can never
// drift apart into two different label strings for the same table state.
function footerLabel(label: string): string {
  return label !== '' ? `${label} pagination` : 'Table pagination'
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
