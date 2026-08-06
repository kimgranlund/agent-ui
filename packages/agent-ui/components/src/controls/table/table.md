---
# table.md frontmatter — the GENERATION SOURCE for ui-table's `static props` block (ADR-0173, converting
# ADR-0004's mirror to a source; LLD-C9, report-family.lld.md §5; ADR-0163 the interactive widening). The
# machine-checkable public surface lives HERE (frontmatter); the prose below the fence is the /site doc.
# `table.props.gen.ts` is GENERATED from `attributes[]` below (`node scripts/generate-props.mjs table`);
# table.ts imports it — never hand-edit the generated file. Five attributes (columns/rows/selected/sort/
# filter) are ADR-0173 OF1 `codec:` references — table is ONE of the 7 bespoke-codec controls (table-model.ts's
# `safeJsonCodec`-backed PropConfigs), proving the codec field for real. `rowKey`/`pageSize` are the ADR's own
# named `attribute:` override specimens. The fleet drift gate (descriptor/props-gen-driftwire.test.ts) keeps
# the descriptor and the generated file byte-identical.
tag: ui-table
description: A data table with typed columns and record rows, rendered as a real native HTML table — with opt-in row selection, per-column sort, filter/search state, and pagination (all default OFF).
tier: display          # geometry size-class (Display band — NO control frame/height/[size]/[scale]; SPEC-R17) — UNCHANGED by the widening: the four capabilities stamp native controls inside the existing anatomy, they do not add a control-height row of their own
extends: UIElement     # NOT form-associated (ADR-0163 cl.8/F5 — a table's selection is transient view state, not a submittable value)
# marginal: re-measured at the ADR-0163 build wave (`npm run size`) against the 26 KB (26624 B gz) family
# ceiling (ADR-0107 Amendment) — the widening's Consequences section pre-records the likely re-base.

attributes:            # attributes-as-API — the GENERATION SOURCE for table.ts's `static props` (ADR-0173), in declaration order
  - name: columns
    type: json          # {key:string, label:string, type?:'string'|'number', sortable?:boolean, searchable?:boolean}[], JSON-string attribute form (SPEC-R1; ADR-0163 cl.5/cl.2 widen the per-column schema)
    default: ''         # the LIVE default is `[]` — `String([])===''` is what the (retired) contract<->props
                         # trip-wire used to compare against; the codec: reference below owns the real default now
    reflect: false      # NOT reflected — a JSON-string attribute round-trips through the codec, not setAttribute
    codec: { import: './table-model.ts', name: 'tableColumnsProp' }  # ADR-0173 OF1 — the SPEC-R1 safe codec (from(null)=[], malformed JSON also falls back to [], never throws); cleanColumns hardens every entry (a non-string key/label drops the column; an unknown/absent type normalizes to 'string', never dropping the column, SPEC-R3 rows 1/3/4)
    description: Typed column definitions — sortable/searchable opt columns into the per-column capabilities.
  - name: rows
    type: json          # Record<string, string|number>[] — open records keyed by column key (fork F1), JSON-string form
    default: ''         # the LIVE default is `[]` — same String([])==='' bijection as `columns`
    reflect: false      # NOT reflected — a JSON-string attribute round-trips through the codec, not setAttribute
    codec: { import: './table-model.ts', name: 'tableRowsProp' }  # ADR-0173 OF1 — cleanRows hardens structurally (a non-object/null/array entry drops the row); cell VALUES are judged per-cell by resolveCell at render time (SPEC-R3 rows 5-11). ADR-0163 cl.7: a rows swap reconciles selected by DROPPING identities that no longer exist, never throwing.
    description: The record rows, open objects keyed by each column's key.
  - name: label
    type: string
    default: ''
    reflect: true       # TKT-0069 item 2 ruling: label reflects fleet-wide
    description: The rendered caption text — the table's accessible name (SPEC-R2/R6).
  - name: selectable
    type: enum
    values: ['', single, multi]
    default: ''          # off — the ''-first inherit/off canon (ADR-0163 cl.4)
    reflect: true         # CSS repoints the selection column via `[selectable]`
    description: Off by default (no selection column); multi adds a checkbox column + select-all; single adds a radio column.
    # '' = no selection column. 'multi' stamps a leading `<input type=checkbox>` column + a header select-all
    # checkbox (indeterminate when the MATCHING SET is partially selected, cl.7). 'single' stamps a leading
    # `<input type=radio>` column, one shared `name` per table instance. These are the fleet's ONE sanctioned
    # exception to "no native form elements" (ADR-0163 cl.3 — native checkbox/radio checked state IS the
    # announced selection; no `aria-selected` on rows, rejected explicitly).
  - name: rowKey
    type: string
    default: ''
    reflect: false
    attribute: row-key  # ADR-0173's own named attribute: override specimen (kebab HTML attribute)
    description: Names the column whose cell values identify rows for selected (cl.4); absent ⇒ the row's data-order index.
    # Absent ⇒ the row's DATA-ORDER index (String-coerced) — stable across a view transform (filter/search/
    # sort/page) but fragile across a `rows` swap; `row-key` is the recommended posture for live data.
  - name: selected
    type: json           # string[] — row identities (cl.4), JSON-string attribute form
    default: ''          # the LIVE default is `[]` — same String([])==='' bijection as columns/rows
    reflect: false        # NOT reflected — bindable selection state, not an authored dimension
    codec: { import: './table-model.ts', name: 'tableSelectedProp' }  # ADR-0173 OF1 — the SAME safeJsonCodec shape as columns/rows (from(null)=[], never throws)
    description: Bindable row identities — commits via select, never by a programmatic write (the fleet commit law).
    # Identity is held against the WHOLE rendered set (cl.7) — a filtered-out selected row STAYS selected,
    # just not visible. A `rows` swap reconciles this by dropping stale identities (never throws, never emits).
  - name: sort
    type: json            # {key:string, direction:'ascending'|'descending'} | null (ADR-0163 cl.5), JSON-string form
    default: null         # String(null) = 'null' — the LIVE default; no sort applied
    reflect: false         # NOT reflected — bindable sort state
    codec: { import: './table-model.ts', name: 'tableSortProp' }  # ADR-0173 OF1 — the sandbox-frame cspConfigProp shape: from(null)=null, a well-formed value of ANY shape passes through unhardened (load-bearing for kindOf's json classification); cleanSort hardens downstream, at point of use
    description: The current sort column/direction, or null; commits via change (cycles ascending → descending).
    # Client-side comparator (table-model.ts's `makeRowComparator`): number columns compare numerically,
    # others via a numeric-aware `Intl.Collator`; degenerate/empty cells sort last in BOTH directions.
  - name: search
    type: string
    default: ''
    reflect: false        # NOT reflected — dynamic view state, control-owned (cl.2)
    description: A free-text filter over the rendered cell text of every searchable column ("search what you see").
    # Case- and diacritic-insensitive (NFKD fold). A column opts OUT via `columns[].searchable: false`
    # (default `true`). The table renders NO query UI of its own — the search surface COMPOSES (a bound
    # `ui-text-field`, the shared-path idiom). Not user-mutable from inside the table: no event, no value-mark slot (cl.9).
  - name: filter
    type: json             # {key:string, values:(string|number)[]}[] (cl.2's bounded FACET shape), JSON-string form
    default: ''            # the LIVE default is `[]` — same String([])==='' bijection as columns/rows/selected
    reflect: false          # NOT reflected — dynamic view state, control-owned (cl.2)
    codec: { import: './table-model.ts', name: 'tableFilterProp' }  # ADR-0173 OF1 — the SAME safeJsonCodec shape as columns/rows/selected
    description: The bounded facet filter — a row survives when every entry's raw cell value matches one of its values.
    # (AND across entries, OR within one entry). No operator grammar — ranges/comparisons stay fenced (cl.1).
    # Not user-mutable from inside the table: no event, no value-mark slot (cl.9).
  - name: pageSize
    type: number
    default: 0             # 0 (off, default) ⇒ no footer, no windowing — the honest off state (ADR-0163 cl.6)
    reflect: false
    attribute: page-size  # ADR-0173's own named attribute: override specimen (kebab HTML attribute)
    description: pageSize > 0 stamps a composed ui-pagination footer and windows the rendered set; 0 (default) is off.
  - name: page
    type: number
    default: 1              # 1-based
    reflect: false
    description: The 1-based current page; bindable, commits via change (forwarded from the internal ui-pagination).
    # RESIDUAL: `page` itself is never clamped by the table when the matching set shrinks below it (e.g. a
    # narrowing `filter`/`search` drops `pageCount` under the current `page`) — the RENDERED window clamps
    # (an out-of-range `page` windows the LAST valid page), but the `page` prop keeps its stale, now-out-
    # of-range value until the consumer or a real pagination click corrects it. A future wave could clamp
    # `page` itself on a matching-set shrink; not built here.

properties: []         # no manual accessors beyond the eleven typed props

events:
  - name: select
    detail: 'null'
    description: Fired when a selection commits — a row checkbox/radio toggle, or the header select-all checkbox (operating on the MATCHING SET, cl.7). Never fired by a programmatic `selected` write, and never fired by the RECONCILE-SELECTED effect dropping stale identities on a `rows` swap (not a user commit). Callers read `el.selected`.
  - name: change
    detail: 'null'
    description: Fired when a sortable header's button commits a new sort direction/column — callers read `el.sort` (the ADR-0161 pull-renderer seam's own convention: listen on the event, read the prop). A page commit from the internal `ui-pagination` footer is NOT separately re-emitted here — its OWN `change` event (`{page:number}` detail) already bubbles up through the table host (every fleet event is `{bubbles:true, composed:true}`, `element.ts`), so a `change` listener on `ui-table` receives it via that natural bubble; re-emitting would double-fire the same commit. Never fired by a programmatic `sort`/`page` write.

slots: []              # no light-DOM content model — render() stays the inherited no-op; every node
                        # (caption/thead/tbody rows/selection inputs/sort buttons/footer) is component-built
                        # (replaceChildren/insertBefore), never author-slotted

parts:                  # the light-DOM anatomy this control stamps (native table elements + data-part nodes)
  - name: scroll
    description: The `<div data-part="scroll" role="region" tabindex="0">` — the component's OWN overflow container (SPEC-R5). Created once per connection and never replaced by a data update (SPEC-R4.1); no code path ever writes its `scrollLeft`/`scrollTop`. `aria-labelledby` points at the caption's id when `label` is non-empty (SPEC-R5 AC2) — an unlabeled table yields an unnamed region, an accepted residual.
  - name: table
    description: The real, stamped `<table>` (ADR-0111 cl.3 — the ADR-0078 cl.4 stamp doctrine scaled up; ADR-0163 cl.3 keeps this native role even with every capability enabled — `role=grid` is REJECTED). Attached to `scroll` only when at least one valid column exists (SPEC-R3 row 1); its node identity — and its `thead`/`tbody` children's — persists across every `rows`-only update (SPEC-R4.3).
  - name: caption
    description: The real `<caption>`, present exactly when `label` is non-empty (SPEC-R2 AC3) — the table's accessible name (SPEC-R6). Mounted as `table`'s first child; a `label` change touches only this node.
  - name: thead
    description: The real `<thead>` holding one `<tr>` of `<th scope="col">` per rendered column (SPEC-R2 AC1), plus a leading selection `<th>` when `selectable` is active. Rebuilt only by the HEADER-BUILD effect (reads `columns`+`selectable`) — never by a `rows`/`selected`/`sort`/`filter`/`search`/`page` update (SPEC-R4.3, widened).
  - name: select-header
    description: The leading `<th scope="col" data-part="select-header">` stamped when `selectable` is active (ADR-0163 cl.4). Holds the select-all checkbox when `selectable='multi'`; an empty header cell when `selectable='single'` (a radio column has no "select all" concept).
  - name: select-all
    description: The real `<input type="checkbox" data-part="select-all">` inside `select-header` (`selectable='multi'` only). `aria-label="Select all rows"`. Checked/indeterminate is computed against the MATCHING SET (cl.7) by the VIEW effect; a click toggles every matching identity's membership in `selected` and commits `select`.
  - name: sort-button
    description: The real `<button type="button" data-part="sort-button">` inside a `sortable` column's `<th>` (the APG sortable-table shape, ADR-0163 cl.3). Activation cycles ascending→descending on that column (a different column starts fresh at ascending) and commits `change`. A non-sortable column's `<th>` carries plain text instead — byte-identical to the pre-widening baseline.
  - name: tbody
    description: The real `<tbody>` holding one `<tr>` of `<td>` per PAGED row × column (SPEC-R2 AC1; ADR-0163 cl.7 — the view pipeline's final stage), plus a leading selection `<td>` when `selectable` is active. Rebuilt (whole-array swap) by the VIEW effect whenever `columns`/`rows`/`selectable`/`rowKey`/`selected`/`filter`/`search`/`sort`/`pageSize`/`page` changes; `scroll`/`table`/`thead` are untouched by this rebuild (SPEC-R4.2/R4.3). Focus on a stamped `select` input is captured before and restored after the rebuild by row identity, when it still exists (cl.10/SPEC-R4.5).
  - name: select-cell
    description: The leading `<td data-part="select-cell">` stamped per row when `selectable` is active, holding the `select` input.
  - name: select
    description: The real `<input type="checkbox">` (`selectable='multi'`) or `<input type="radio">` (`selectable='single'`, one shared `name` per table instance) per row — ADR-0163 cl.3's sanctioned "no native form elements" exception. `data-row-id` carries the row's selection identity (cl.4) — the focus-restoration anchor. `aria-label` names the row via its first column's rendered text when available. A click toggles `selected` and commits `select`.
  - name: footer
    description: The `<div data-part="footer">` — a SIBLING of `scroll` (OUTSIDE the scroll container, cl.6), built once and attached to the host ONLY while `pageSize > 0`; never destroyed once created (the `table`/empty-columns attach-detach precedent, applied here). Holds the `pagination` part.
  - name: pagination
    description: A composed `<ui-pagination data-part="pagination">` inside `footer` (cl.6) — its `pages` is the MATCHING SET's page count (cl.7), its `page` mirrors the table's own `page` prop. A click there writes the table's `page` prop; its own `change` event is NOT separately re-emitted by the table — it already bubbles up through the table host (every fleet event is `{bubbles:true, composed:true}`) — so a `change` listener on `ui-table` receives it via that natural bubble.

customStates: []       # NO interaction/motion state on the HOST — a Display-tier leaf has neither; every interactive part's OWN state (checked/indeterminate/aria-sort/disabled) lives on that part, not as a host :state()

face:
  formAssociated: false  # NOT a FACE form control — ADR-0163 cl.8/F5: a table's selection is transient view state, no name/value pair, no validity/reset semantics apply; ADR-0161's two-way seam needs only {prop,event}

aria:
  role: none              # the HOST mints no role at all — the stamped <table> IS the table (SPEC-R6; ADR-0163 cl.3 — role=grid REJECTED, this stays true with every capability enabled, the correctness crux)
  roleSource: native-table # header association / th scope / SR table navigation come from the PLATFORM, not internals
  labelSource: caption     # the real <caption> (from `label`) is the table's accessible name — never a host aria-label
  interiorRegion: The `[data-part='scroll']` container carries `role="region" tabindex="0"` + `aria-labelledby` (the caption's id, when present) — the WAI-ARIA APG accessible-overflow pattern on an INTERIOR node (the Option/MenuItem interior-attribute sanction; only HOST aria rides internals, SPEC-R5 AC2).
  selectionSource: The native checkbox/radio CHECKED state IS the announced selection (ADR-0163 cl.3) — no `aria-selected` on rows (rejected; selection-widget vocabulary ATs do not convey on plain-table rows).

keyboard:
  - note: Every interactive part (a `select` checkbox/radio, the `select-all` checkbox, a `sort-button`) is a REAL native/stamped element in the NORMAL tab order (ADR-0163 cl.3 — the APG's own "all focusable elements contained in a table are included in the page tab sequence"). NO roving tabindex, NO composite-widget keyboard contract, NO `UIListboxElement` — this is deliberately NOT a composite widget. A 50-row selectable table has 50 checkbox tab stops, native-honest, same as a form of 50 checkboxes.
  - note: Each `select`/`select-all` input activates via the platform's own native Space toggle; each `sort-button` activates via the platform's own native Space/Enter button activation. No component-defined key binding is added for any of these — they are real elements, not simulated widgets.
  - note: the scroll region's `tabindex="0"` makes it a native tab stop + native-scrollable target (arrow keys / Page Up-Down scroll it in engines with keyboard-focusable scrollers) — this is PLATFORM behavior, not a component-defined binding.
  - note: A non-interactive table cell/row (every cell when `selectable=''`, and every non-select/non-sort cell always) is never focusable and carries no keyboard contract of its own.

geometry:
  sizeClass: display
  minInlineSize: var(--ui-table-min-inline-size)  # 16em default — the whole-shape floor (SPEC-R14/R17 AC1); NO [size] ramp, NO --md-sys-height-*
  cellPadInline: var(--ui-table-cell-pad-inline)  # rhythm — rides [density] for free (ADR-0103)
  cellPadBlock: var(--ui-table-cell-pad-block)
  note: The stamped selection inputs/sort buttons/footer pagination each carry their OWN geometry (native input sizing; the composed `ui-pagination`'s own §1 control-height buttons) — this control mints no new geometry row of its own for them (ADR-0163 cl.6's "the novelty is zero", applied fleet-wide to every stamped interactive part here).

forcedColors: No dedicated `@media (forced-colors: active)` block — every row/header separator is a real `border` (repainted in system inks, never removed under `forced-colors: active`, unlike a background-drawn mark); all content is real text. The stamped native `<input>` selection cells carry their own UA forced-colors treatment, unstyled by this file. The stamped sort `<button>` is styled DIFFERENTLY (verified, not merely intended): `table.css`'s `all: unset` reset strips its native UA button chrome, so under forced-colors it has no background/border of its own to lose — it survives as real, inherited (`color: inherit`) header text plus a real `:focus-visible` outline on the shared focus-ring token (which itself already maps to `Highlight` under forced-colors).
---

# ui-table

`ui-table` is the **Display**-class data table (ADR-0111, report family v1; widened in place by ADR-0163) —
typed `columns` + record `rows` rendered as a **real native `<table>`** in light DOM (the `ui-text` `as`-stamp
doctrine scaled up, ADR-0078 cl.4), with FOUR opt-in interactive capabilities layered on top, **all default
OFF**: row **selection**, per-column **sort**, control-owned **filter/search** state, and **pagination**. At
every capability's default (off) value the rendered DOM is **byte-identical** to the pre-widening control
(ADR-0163 cl.10) — one control, one descriptor, still not form-associated, still no cell renderers, still no
`role=grid`.

```html
<ui-table
  label="Revenue by region"
  selectable="multi"
  row-key="region"
  selected='["EMEA"]'
  sort='{"key":"revenue","direction":"descending"}'
  page-size="10"
  columns='[{"key":"region","label":"Region","sortable":true},{"key":"revenue","label":"Revenue","type":"number","sortable":true}]'
  rows='[{"region":"EMEA","revenue":42000},{"region":"APAC","revenue":31000}]'
></ui-table>
```

## Rendering

A stamped native `<table>` inside the component's own scroll container: `<caption>` (from `label`, present
exactly when non-empty) · `<thead>` with one `<th scope="col">` per rendered column · `<tbody>` with one
`<tr>` per rendered row, one `<td>` per rendered column. `type:"number"` columns render **end-aligned**
(logical — flips in RTL) with tabular numerals; every other column start-aligns and wraps long content. The
component owns the UA-default + page-cascade reset (`border-collapse`, cell padding, caption alignment) so a
page-global `td { padding: 40px }` rule or a bare page's UA defaults never leak through.

## Cell resolution & value degeneracy

Every cell resolves through one pure, never-throwing mapping (`table-model.ts`'s `resolveCell`):

| Case | Rendering |
|---|---|
| missing key / `undefined` / `null` | empty cell — a real `<td>` with no text |
| finite `number` (any column type) | `Intl.NumberFormat`-formatted (default locale) — value-driven, not column-gated |
| non-finite `number` (`NaN`/`±Infinity`) | the placeholder `—` (U+2014) — present but unrepresentable |
| `string` (incl. a mismatch in a `type:"number"` column) | rendered verbatim, never coerced — the column's end-alignment/nowrap still applies |
| a foreign value (`boolean`/`object`/`array`) | empty cell — the value is dropped, the row survives |

Structural hardening (`cleanColumns`/`cleanRows`) drops an invalid column (non-string `key`/`label`) or row
(non-object/`null`/array) entirely, preserving order; an unknown `type` string normalizes to `'string'`
rather than dropping the column. `columns: []`/absent/malformed-JSON ⇒ **no table is stamped** at all (the
empty scroll container; the host box still paints via the `min-inline-size` floor); valid columns with zero
rows render the caption + header with an honest empty `<tbody>`.

## Selection (ADR-0163 cl.4)

`selectable='multi'` stamps a leading checkbox column plus a header select-all checkbox (indeterminate when
the MATCHING SET — see below — is partially selected); `selectable='single'` stamps a leading radio column
(one shared `name`). Selection identity is the `row-key`-named column's cell value (String-coerced), or —
absent `row-key` — the row's data-order index (stable across a view transform, fragile across a `rows`
swap). `selected: string[]` is bindable; a real checkbox/radio click commits `select` — a programmatic
`selected` write never does (the fleet commit law). Selected rows carry `data-selected` for CSS. Selection
is held against the **whole** rendered set: a filtered-out selected row stays selected, just not visible.

## Sort (ADR-0163 cl.5)

Opt in per column: `columns[].sortable: true` wraps that column's header label in a real, stamped
`<button>` (the APG sortable-table shape). Activation cycles ascending → descending on the SAME column;
activating a DIFFERENT sortable column starts fresh at ascending. `aria-sort` rides the one currently-sorted
`<th>` only. `sort: {key, direction} | null` is bindable; a header-button click commits `change`. The
client-side comparator (`table-model.ts`'s `makeRowComparator`): number columns compare numerically, every
other column via a numeric-aware `Intl.Collator`; degenerate/empty cells sort last in BOTH directions.

## Filter & search (ADR-0163 cl.2)

`filter: {key, values}[]` (the bounded FACET shape — a row survives when its raw cell value for EVERY
entry's `key` String-coerced-equals one of that entry's `values`) and `search: string` (a free-text scan
over the RENDERED cell text of every `searchable` column — `columns[].searchable: false` opts a column out,
default `true` — case- and diacritic-insensitive) are both control-owned and applied client-side. **The
table renders no query UI of its own** — no in-table search input. Compose the query surface instead: bind
a `ui-text-field`'s `value` and the table's `search` to the SAME data-model path (the shared-path idiom),
or a facet picker's checked set into one `filter` entry. Neither prop is user-mutable from inside the
table — no event, no catalog value-mark slot. A filter/search that yields zero rows renders the honest
empty `<tbody>` — no live results-count announcement in v1 (a recorded residual; the composing recipe can
add a visible count).

## Pagination (ADR-0163 cl.6)

`page-size > 0` stamps a composed `ui-pagination` in the table's own `data-part="footer"` region (outside
the scroll container) and windows the rendered set; `page-size="0"` (default) is off — no footer, no
windowing. `pageCount` (the footer's `pages`) derives from the MATCHING SET's count (after filter+search,
before sort). `page` is bindable; the footer's own commit writes the table's `page` prop, and its `change`
event reaches a `ui-table`-level listener by natural bubbling (never re-emitted separately).

## The view pipeline (ADR-0163 cl.7)

Every capability composes through ONE normative order: the rendered set → the facet `filter` → `search` →
`sort` (when non-null) → the page window (when `page-size > 0`) → the stamped `<tbody>`. The **matching
set** — the SPEC-defined term for "after filter AND search, before sort/page" — is the universe select-all,
the header checkbox's checked/indeterminate state, and `pageCount` are all computed against.

## The re-render contract (scroll preservation)

Setting `columns`, `rows`, or `label` re-renders — a whole-array swap (A2UI `updateDataModel` semantics), not
an incremental append. The component's own scroll container is built **once per connection** and never
replaced; no code path ever writes its `scrollLeft`/`scrollTop`, so a scrolled table's offset survives a
`rows` update. The rebuild is scoped, WIDENED by ADR-0163: the HEADER-BUILD effect (reads `columns` +
`selectable`) rebuilds `<thead>`'s content — `<table>`/`<caption>`/`<thead>` node identity holds across every
OTHER state-prop change; the VIEW effect (reads every remaining state prop) rebuilds ONLY `<tbody>`'s content
(whole-array swap) — `scroll`/`table`/`thead` are untouched by it; a `label` change touches only the
`<caption>`. Focus restoration (cl.10/SPEC-R4.5): if focus was on a stamped `select` input when a `<tbody>`
rebuild fires, focus is restored to the same row-identity's control when it still exists afterward. A sort
button's own focus is never disturbed by a sort commit — sort state lives in a SEPARATE effect that only
toggles `aria-sort`, never rebuilding `<thead>`'s nodes.

## Overflow

A wide table scrolls **inside the component's own container**, never the page (`overflow-x: auto` on the
interior scroll node) — number columns never wrap (`white-space: nowrap`), so a wide numeric table forces
the scroll container rather than clipping a digit invisibly. A table narrower than its host fills the host's
inline size (`inline-size: 100%`) — no orphaned gutter.

## Accessibility

Native semantics carry it (SPEC-R6; ADR-0163 cl.3, the correctness crux): the stamped `<table>` IS the table
— header association, `th scope`, and screen-reader table navigation come from the platform, for free, WITH
EVERY CAPABILITY ENABLED — `role=grid` is explicitly REJECTED (it would forfeit exactly this rationale). The
host mints **no** ARIA at all — no `role`, no `aria-label` — the `<caption>` (from `label`) is the table's
accessible name. The interior scroll container additionally carries `role="region" tabindex="0"` (+
`aria-labelledby` the caption when present) — the WAI-ARIA APG accessible-overflow pattern, so keyboard-only
users can reach overflowed columns even in engines without keyboard-focusable scrollers by default. This is
platform scroll affordance, not a component-defined keyboard contract. Every interactive part (a selection
input, the select-all checkbox, a sort button) is a REAL native or stamped element in the **normal tab
order** — no roving tabindex, no composite-widget keyboard contract, no `UIListboxElement`; selection state
is conveyed ONLY by the native checkbox/radio checked state — **never `aria-selected` on rows** (rejected —
selection-widget vocabulary ATs do not convey it on plain-table rows). An unlabeled table (`label` absent)
yields an unnamed scroll region — an accepted residual, not a violation; provide `label` when the table
needs an accessible name.

## Sizing

`ui-table` is **Display**-class (`geometry.md`): no `[size]`/`[scale]` attribute, no control height, no
`--md-sys-height-*` lever — cell text rides the `--md-sys-typescale-body-medium-*` row directly, and interior
rhythm (`--ui-table-cell-pad-inline`/`-block`) rides the `--md-sys-space` ladder, responding to an ancestor
`[density]` for free. The host defaults to a `16em` `min-inline-size` floor — a bare, unstyled table in a
flex row still paints a visible, non-collapsed box with zero consumer CSS.

## RTL

Logical CSS throughout (`text-align: start/end`, `border-block-end`, block/inline padding pairs) — the
native `<table>` handles column order under `dir="rtl"` for free, and `text-align: end` flips number-column
alignment to the physical left.

## Forced colors (WHCM)

No dedicated override block: every row/header separator is a real `border`, which forced-colors repaints in
system inks and never removes (unlike a background-drawn mark); all cell/caption content is real text and
survives untouched. The stamped native `<input>` selection cells carry their own UA forced-colors treatment.
The stamped sort `<button>` is reset (`all: unset`, `table.css`) to read as part of the header rather than a
raw UA control — under forced-colors it has no background/border of its own to lose, surviving as real,
inherited header text plus a real `:focus-visible` outline on the shared focus-ring token (itself already
`Highlight` under forced-colors).
