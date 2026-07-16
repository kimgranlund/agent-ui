// table.ts — UITableElement, the Display-class static data table (LLD-C2, report-family.lld.md §2;
// report-family.spec.md SPEC-R1…R6; ADR-0111 cl.1/3). BEHAVIOUR + props + the stable-skeleton mechanism +
// the three-effect split + self-define ONLY; the pure cell-resolution/hardening math lives in
// table-model.ts (DOM-free, unit-testable) and the CSS/token geometry lives in table.css.
//
// The mechanism is a REAL native `<table>` stamped in light DOM (the ui-text `as`-stamp doctrine scaled up
// — ADR-0078 cl.4; ADR-0111 cl.3): header association, `th scope`, and SR table navigation come free from
// the platform. The host mints NO ARIA via internals (SPEC-R6) — the stamped `<table>` IS the table.
//
// SPEC-R4's re-render contract — THE load-bearing mechanism (report-family.lld.md §2, LLD-C2's own framing)
// — is a STABLE SKELETON built ONCE in `connected()`, held in private fields, never replaced by any later
// data update: `#scroll` (the component's own overflow container — SPEC-R5) › `#table` › `#thead` + `#tbody`.
// No code path anywhere in this file ever writes `#scroll.scrollLeft`/`.scrollTop` — the scroll offset a
// user leaves behind survives a `rows` update by simple absence of any write, not by special-casing it.
// Three INDEPENDENT effects, split by which signal(s) each reads (the fine-grained-waking discipline):
//   • the COLUMNS effect (reads `columns` only) rebuilds `#thead`'s one header row; a `rows`-only update
//     never re-runs it (SPEC-R4.3's identity clause) — `#table`/`#thead` node identity is untouched.
//   • the BODY effect (reads `columns` AND `rows`) rebuilds ONLY `#tbody`'s content via `replaceChildren` —
//     whole-array swap semantics (A2UI `updateDataModel`), deliberately NOT the ADR-0024 positional
//     reconcile (inert text rows hold no per-node state worth reconciling, the bar-chart LLD §7 row 7
//     precedent). `#scroll`'s node identity and scroll offsets are UNTOUCHED by construction.
//   • the LABEL effect (reads `label` only) mints/removes exactly one `<caption>` and (un)sets the scroll
//     region's `aria-labelledby` — touches nothing else (SPEC-R2 AC3).
// `render()` stays the inherited no-op (host-as-grid is not this anatomy's shape; every node here is
// component-built, imperatively, the sparkline/bar-chart precedent for a data-driven Display leaf).
//
// The interior scroll region (SPEC-R5 AC2) — `role="region" tabindex="0"` on `#scroll` — is the WAI-ARIA
// APG accessible-overflow pattern on an INTERIOR node (the Option/MenuItem interior-attribute sanction; only
// HOST aria rides internals). This is platform scroll AFFORDANCE, not a component keyboard contract: zero
// component-defined key bindings are added (no roving tabindex, no arrow-key navigation) — `keyboard: []`
// stands in table.md.
//
// Imports inward only (controls → dom): UIElement + prop + the typed-schema helpers from the dom barrel;
// the pure math + safe codecs from the co-located table-model.ts (the ADR-0065 pure-core split, ADR-0111 cl.8).

import { UIElement, prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import { cleanColumns, cleanRows, resolveCell, tableColumnsProp, tableRowsProp, type TableColumn, type TableRow } from './table-model.ts'

const props = {
  columns: tableColumnsProp, // TableColumn[] · safe JSON codec (table-model.ts) · default []
  rows: tableRowsProp, // TableRow[] · safe JSON codec (table-model.ts) · default []
  label: { ...prop.string(''), reflect: true }, // the rendered <caption> text — the table's accessible name (SPEC-R2/R6)
} satisfies PropsSchema

export interface UITableElement extends ReactiveProps<typeof props> {}
export class UITableElement extends UIElement {
  static props = props

  // The stable skeleton (SPEC-R4.1) — built ONCE EVER behind the `#built` guard (TKT-0067), held
  // privately, NEVER replaced by any data-update effect below. `#`-private: nothing outside the host can
  // reach in and mutate scroll state.
  #built = false
  #scroll!: HTMLDivElement
  #table!: HTMLTableElement
  #thead!: HTMLTableSectionElement
  #tbody!: HTMLTableSectionElement
  // The mounted `<caption>` — null while `label` is empty (LLD-C2 step 4). Held so the label effect can
  // find/remove/reuse the SAME element across reruns instead of re-minting one on every `label` change.
  #caption: HTMLTableCaptionElement | null = null
  // Live scroll-offset shadow (TKT-0067, MEASURED): node identity alone does NOT preserve scroll across
  // a disconnect/reconnect — every engine resets a scroll container's offsets when it leaves the
  // document (scroll state lives in the LAYOUT tree, not the DOM node; the probe measured 40 → 0 in
  // Chromium AND WebKit even with the identical node reattached). Tracked by the scroll listener in
  // connected() and restored on reconnect. Reading scrollLeft in disconnected() is too late — the
  // element is already out of the document and reads 0 there.
  #lastScrollLeft = 0
  #lastScrollTop = 0

  protected connected(): void {
    // The skeleton — built ONCE EVER behind an idempotent guard (TKT-0067: previously rebuilt on every
    // connect, which discarded the prior skeleton — and with it the scroll offset SPEC-R4.1 says
    // "survives by omission" — on an ordinary disconnect/reconnect; the progress.ts field-guard shape,
    // the fleet parts-once canon). NOT inside an effect (SPEC-R4.1's identity clause). `#table` starts
    // with its `#thead`/`#tbody` already attached; `#scroll` starts EMPTY (the columns effect below
    // attaches `#table` only once real columns exist — SPEC-R3 row 1's "no table is stamped" empty
    // state). Light-DOM children persist across a disconnect, so a reconnect finds the prior skeleton —
    // including its live `scrollLeft`/`scrollTop` and any mounted `#caption` — intact.
    if (!this.#built) {
      this.#built = true
      this.#scroll = document.createElement('div')
      this.#scroll.setAttribute('data-part', 'scroll')
      this.#scroll.setAttribute('role', 'region') // SPEC-R5 AC2 — the accessible-overflow pattern
      this.#scroll.setAttribute('tabindex', '0') // platform scroll affordance, NOT a keyboard contract
      this.#table = document.createElement('table')
      this.#thead = document.createElement('thead')
      this.#tbody = document.createElement('tbody')
      this.#table.append(this.#thead, this.#tbody)
      this.#caption = null
      this.replaceChildren(this.#scroll)
    }

    // Restore the pre-disconnect scroll offsets (TKT-0067) — a no-op on first connect (0/0). The
    // synchronous write forces layout on the just-reinserted, already-populated skeleton so the value
    // clamps against real content. Rides the connection: the listener below re-arms every connect.
    if (this.#lastScrollLeft !== 0 || this.#lastScrollTop !== 0) {
      this.#scroll.scrollLeft = this.#lastScrollLeft
      this.#scroll.scrollTop = this.#lastScrollTop
    }
    this.listen(this.#scroll, 'scroll', () => {
      this.#lastScrollLeft = this.#scroll.scrollLeft
      this.#lastScrollTop = this.#scroll.scrollTop
    })

    // The COLUMNS effect (SPEC-R4.3) — reads ONLY `columns`. A `rows`-only update never re-runs this, so
    // `#table`/`#thead` node identity holds across it (the identity clause proper).
    this.effect(() => {
      const cols = cleanColumns(this.columns)
      if (cols.length === 0) {
        // SPEC-R3 row 1: no valid columns ⇒ no table is stamped (the empty scroll container; the host box
        // still paints via the CSS floor). `#table` itself is untouched — only detached, never destroyed —
        // so a later columns write reattaches the SAME node (never a fresh one).
        this.#scroll.replaceChildren()
        return
      }
      // Attach `#table` only on the detached→attached transition (attach churn only at that edge, never on
      // every columns change) — `#scroll.replaceChildren(#table)` when it is not already `#scroll`'s child.
      if (this.#table.parentNode !== this.#scroll) this.#scroll.replaceChildren(this.#table)
      const headerRow = document.createElement('tr')
      for (const col of cols) headerRow.append(this.#headerCell(col))
      this.#thead.replaceChildren(headerRow)
    })

    // The BODY effect (SPEC-R4.3) — reads `columns` AND `rows`; rebuilds ONLY `#tbody`'s content
    // (`replaceChildren`, whole-array swap). `#scroll`/`#table`/`#thead` are never touched here, and no
    // DATA-update path writes `#scroll.scrollLeft`/`.scrollTop` — across data updates the scroll offset
    // survives by omission. (Across a RECONNECT it cannot — the platform resets a removed container's
    // offsets — so connected() restores from the tracked shadow; TKT-0067.)
    this.effect(() => {
      const cols = cleanColumns(this.columns)
      const rows = cleanRows(this.rows)
      this.#tbody.replaceChildren(...rows.map((row) => this.#rowNode(cols, row)))
    })

    // The LABEL effect (SPEC-R2 AC3) — reads ONLY `label`; mints/removes exactly one `<caption>` as
    // `#table`'s first child and (un)sets `#scroll`'s `aria-labelledby` (the region is named by the SAME
    // text the caption gives the table — one text, two consumers). Touches nothing else.
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

  /** One `<th scope="col">` — `data-type='number'` set from the COLUMN's type (alignment is column-driven,
   *  table.css's `[data-type='number']` rule; SPEC-R2/R3 row 9). */
  #headerCell(col: TableColumn): HTMLTableCellElement {
    const th = document.createElement('th')
    th.setAttribute('scope', 'col')
    if (col.type === 'number') th.setAttribute('data-type', 'number')
    th.textContent = col.label
    return th
  }

  /** One `<tr>` of `<td>`s for `row` — cell text via the pure `resolveCell` (table-model.ts); alignment
   *  rides the SAME column-driven `data-type` attribute as the header cell, regardless of the cell's own
   *  resolved value (SPEC-R3 row 9 — a mismatched string in a number column keeps the column's alignment). */
  #rowNode(cols: TableColumn[], row: TableRow): HTMLTableRowElement {
    const tr = document.createElement('tr')
    for (const col of cols) {
      const td = document.createElement('td')
      if (col.type === 'number') td.setAttribute('data-type', 'number')
      td.textContent = resolveCell(col, row)
      tr.append(td)
    }
    return tr
  }
}

// The caption `id` mint — a module-scoped counter suffix, collision-free in light DOM (no crypto/uuid dep).
let captionCounter = 0
function nextCaptionId(): string {
  captionCounter += 1
  return `ui-table-caption-${captionCounter}`
}

if (!customElements.get('ui-table')) customElements.define('ui-table', UITableElement) // idempotent self-define
