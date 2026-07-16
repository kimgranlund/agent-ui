---
# table.md frontmatter — the attributes-as-API descriptor for ui-table (ADR-0004; LLD-C9,
# report-family.lld.md §5). The machine-checkable public surface lives HERE (frontmatter); the prose below
# the fence is the /site doc. The `attributes[]` block MUST mirror table.ts `static props` (columns/rows/
# label) — the contract<->props trip-wire (table-descriptor.test.ts) targets this fence.
tag: ui-table
description: A static data table with typed columns and record rows, rendered as a real native HTML table.
tier: display          # geometry size-class (Display band — NO control frame/height/[size]/[scale]; SPEC-R17)
extends: UIElement     # a non-interactive, non-form-associated display LEAF (SPEC-R1)
# marginal: NOT measured this wave — `npm run size` is LLD-C10's shared-file integration slice (the ONE
# writer wiring controls/index.ts + component-styles.css + the package exports map); this folder ships
# standalone as Wave M1-a. Re-measure at LLD-C10 against the 26 KB (26624 B gz) family ceiling
# (ADR-0107 Amendment; ADR-0111's Consequences flag this control as the likely heaviest of the three new
# report controls — DOM building + Intl formatting).

attributes:            # attributes-as-API — mirrors table.ts `static props` (columns, rows, label)
  - name: columns
    type: json          # {key:string, label:string, type?:'string'|'number'}[], JSON-string attribute form (SPEC-R1)
    default: ''         # the LIVE default is `[]` — `String([])===''` is what the contract<->props trip-wire
                         # (compareDescriptorToProps) actually compares against (reads `String(config.default)`)
    reflect: false      # NOT reflected — a JSON-string attribute round-trips through the codec, not setAttribute
    # the live codec is the SPEC-R1 safe codec — `from(null) = []` (never `null`); malformed JSON also falls
    # back to `[]` — no throw ever reaches the render path. `cleanColumns` (table-model.ts) hardens every
    # entry: a non-string key/label drops the column; an unknown/absent `type` normalizes to 'string', never
    # dropping the column (SPEC-R3 rows 1/3/4).
  - name: rows
    type: json          # Record<string, string|number>[] — open records keyed by column key (fork F1), JSON-string form
    default: ''         # the LIVE default is `[]` — same String([])==='' bijection as `columns`
    reflect: false      # NOT reflected — a JSON-string attribute round-trips through the codec, not setAttribute
    # `cleanRows` (table-model.ts) hardens structurally (a non-object/null/array entry drops the row); cell
    # VALUES are judged per-cell by `resolveCell` at render time, never here (SPEC-R3 rows 5-11).
  - name: label
    type: string
    default: ''
    reflect: true       # TKT-0069 item 2 ruling: label reflects fleet-wide

properties: []         # no manual accessors beyond the three typed props

events: []             # display-only — emits nothing (SPEC-R1: no events, no keyboard contract)

slots: []              # no light-DOM content model — render() stays the inherited no-op; every node
                        # (caption/thead/tbody rows) is component-built (replaceChildren/insertBefore), never
                        # author-slotted

parts:                  # the light-DOM anatomy this control stamps (native table elements + one data-part node)
  - name: scroll
    description: The `<div data-part="scroll" role="region" tabindex="0">` — the component's OWN overflow container (SPEC-R5). Created once per connection and never replaced by a data update (SPEC-R4.1); no code path ever writes its `scrollLeft`/`scrollTop`. `aria-labelledby` points at the caption's id when `label` is non-empty (SPEC-R5 AC2) — an unlabeled table yields an unnamed region, an accepted residual.
  - name: table
    description: The real, stamped `<table>` (ADR-0111 cl.3 — the ADR-0078 cl.4 stamp doctrine scaled up). Attached to `scroll` only when at least one valid column exists (SPEC-R3 row 1); its node identity — and its `thead`/`tbody` children's — persists across every `rows`-only update (SPEC-R4.3).
  - name: caption
    description: The real `<caption>`, present exactly when `label` is non-empty (SPEC-R2 AC3) — the table's accessible name (SPEC-R6). Mounted as `table`'s first child; a `label` change touches only this node.
  - name: thead
    description: The real `<thead>` holding one `<tr>` of `<th scope="col">` per rendered column (SPEC-R2 AC1). Rebuilt only by the columns effect — never by a `rows`-only update (SPEC-R4.3).
  - name: tbody
    description: The real `<tbody>` holding one `<tr>` of `<td>` per rendered row × column (SPEC-R2 AC1). Rebuilt (whole-array swap) by the rows effect; `scroll`/`table`/`thead` are untouched by this rebuild (SPEC-R4.2/R4.3).

customStates: []       # NO interaction state and NO motion gate — a display leaf has neither (no :state(); nothing to transition)

face:
  formAssociated: false  # a display leaf — extends UIElement, no value/validity participation

aria:
  role: none              # the HOST mints no role at all — the stamped <table> IS the table (SPEC-R6)
  roleSource: native-table # header association / th scope / SR table navigation come from the PLATFORM, not internals
  labelSource: caption     # the real <caption> (from `label`) is the table's accessible name — never a host aria-label
  interiorRegion: The `[data-part='scroll']` container carries `role="region" tabindex="0"` + `aria-labelledby` (the caption's id, when present) — the WAI-ARIA APG accessible-overflow pattern on an INTERIOR node (the Option/MenuItem interior-attribute sanction; only HOST aria rides internals, SPEC-R5 AC2).

keyboard:              # NOT a component keyboard contract — platform scroll affordance only (SPEC-R5 AC2)
  - note: the scroll region's `tabindex="0"` makes it a native tab stop + native-scrollable target (arrow keys / Page Up-Down scroll it in engines with keyboard-focusable scrollers) — this is PLATFORM behavior, not a component-defined binding (no roving tabindex, no arrow-key row navigation, no activation/selection)
  - note: table cells/rows are never focusable and carry no keyboard contract of their own — a static data table (SPEC-R1)

geometry:
  sizeClass: display
  minInlineSize: var(--ui-table-min-inline-size)  # 16em default — the whole-shape floor (SPEC-R14/R17 AC1); NO [size] ramp, NO --ui-height-*
  cellPadInline: var(--ui-table-cell-pad-inline)  # rhythm — rides [density] for free (ADR-0103)
  cellPadBlock: var(--ui-table-cell-pad-block)

forcedColors: No dedicated `@media (forced-colors: active)` block — every row/header separator is a real `border` (repainted in system inks, never removed under `forced-colors: active`, unlike a background-drawn mark); all content is real text and survives untouched (SPEC-R15).
---

# ui-table

`ui-table` is the **Display**-class static data table (ADR-0111, report family v1) — typed `columns` +
record `rows` rendered as a **real native `<table>`** in light DOM (the `ui-text` `as`-stamp doctrine scaled
up, ADR-0078 cl.4). It is **not** interactive and **not** form-associated: no sorting, no selection, no
pagination, no cell renderers, no keyboard contract of its own.

```html
<ui-table
  label="Revenue by region"
  columns='[{"key":"region","label":"Region"},{"key":"revenue","label":"Revenue","type":"number"}]'
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

## The re-render contract (scroll preservation)

Setting `columns`, `rows`, or `label` re-renders — a whole-array swap (A2UI `updateDataModel` semantics), not
an incremental append. The component's own scroll container is built **once per connection** and never
replaced; no code path ever writes its `scrollLeft`/`scrollTop`, so a scrolled table's offset survives a
`rows` update. The rebuild is scoped: a `rows`-only change rebuilds only `<tbody>`'s content — `<table>`/
`<caption>`/`<thead>` node identity holds across it; a `columns` change may rebuild `<thead>` + `<tbody>`; a
`label` change touches only the `<caption>`. In-cell text selection is not guaranteed to survive a `rows`
update (an accepted residual for a display-only v1 with no focusable cells).

## Overflow

A wide table scrolls **inside the component's own container**, never the page (`overflow-x: auto` on the
interior scroll node) — number columns never wrap (`white-space: nowrap`), so a wide numeric table forces
the scroll container rather than clipping a digit invisibly. A table narrower than its host fills the host's
inline size (`inline-size: 100%`) — no orphaned gutter.

## Accessibility

Native semantics carry it (SPEC-R6): the stamped `<table>` IS the table — header association, `th scope`,
and screen-reader table navigation come from the platform, for free. The host mints **no** ARIA at all — no
`role`, no `aria-label` — the `<caption>` (from `label`) is the table's accessible name. The interior scroll
container additionally carries `role="region" tabindex="0"` (+ `aria-labelledby` the caption when present) —
the WAI-ARIA APG accessible-overflow pattern, so keyboard-only users can reach overflowed columns even in
engines without keyboard-focusable scrollers by default. This is platform scroll affordance, not a
component-defined keyboard contract: no roving tabindex, no arrow-key row navigation. An unlabeled table
(`label` absent) yields an unnamed scroll region — an accepted residual, not a violation; provide `label`
when the table needs an accessible name.

## Sizing

`ui-table` is **Display**-class (`geometry.md`): no `[size]`/`[scale]` attribute, no control height, no
`--ui-height-*` lever — cell text rides the `--md-sys-typescale-body-medium-*` row directly, and interior
rhythm (`--ui-table-cell-pad-inline`/`-block`) rides the `--ui-space` ladder, responding to an ancestor
`[density]` for free. The host defaults to a `16em` `min-inline-size` floor — a bare, unstyled table in a
flex row still paints a visible, non-collapsed box with zero consumer CSS.

## RTL

Logical CSS throughout (`text-align: start/end`, `border-block-end`, block/inline padding pairs) — the
native `<table>` handles column order under `dir="rtl"` for free, and `text-align: end` flips number-column
alignment to the physical left.

## Forced colors (WHCM)

No dedicated override block: every row/header separator is a real `border`, which forced-colors repaints in
system inks and never removes (unlike a background-drawn mark); all cell/caption content is real text and
survives untouched.
