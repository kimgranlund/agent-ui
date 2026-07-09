# LLD — Report Family (`ui-table` + `ui-stat` + `ui-badge`, catalog rows, feed dispositions, teaching wave)

> Refines: [`../spec/report-family.spec.md`](../spec/report-family.spec.md) (SPEC-R1…R20, SPEC-N1…N5) under
> [ADR-0111](../adr/0111-report-family-v1-scope.md) (accepted; forks F1–F4 as recommended). Build plan:
> [`../decompositions/report-family-build.decomp.json`](../decompositions/report-family-build.decomp.json)
> (coverage-clean, plan mode). · proposed · 2026-07-09 · planner
>
> **Composes on:** `UIElement` (`dom/element.ts`) + the props/signal system (`dom/props.ts`). **No new
> package** (ADR-0111 cl.8): three ordinary control folders — `controls/table/`, `controls/stat/`,
> `controls/badge/`; pure formatting/resolution math is co-located per control (the in-folder pure-core
> split, the `sparkline-math.ts` precedent). Catalog work lands in
> `packages/agent-ui/a2ui/src/catalog/default/`; the feed dispositions in
> `packages/agent-ui/a2ui/tools/agent/feed-catalog.ts`; exemplars in `a2ui/src/examples/`.
>
> **Freeze discipline.** §2–§4 interfaces are the fan-out contract. A builder who cannot satisfy a frozen
> interface STOPS and escalates — the fix is a coordinated LLD/decomp repair, never a local deviation.

## 1 · Intent

Implement the display-only v1 report family: a **real native `<table>`** stamped in light DOM from typed
columns + record rows (header association, `th` scope, and SR table navigation from the platform — the
ADR-0078 cl.4 stamp doctrine scaled up), with a scroll-preserving re-render contract and
overflow-in-own-container; a **metric tile** of real token-typed text with direction-as-text delta and no
heading stamp; and the **compact realm's first shipped widget** — a non-interactive intent badge whose
per-intent glyph is component-drawn (the checkbox clip-path precedent). Then catalog-reach all three in
the same wave (`Table`, `Stat`, `Badge`), pay the ADR-0097 partition bookkeeping, and re-teach the §5.2
four-way guidance. Everything is derived, display-only state — no events, no focus contract, no form
participation.

## 2 · `ui-table` (SPEC-R1…R6)

### LLD-C1 — the pure model (`controls/table/table-model.ts`, DOM-free)

```ts
import type { PropConfig } from '../../dom/props.ts'

export interface TableColumn { key: string; label: string; type: 'string' | 'number' }
export type TableRow = Record<string, unknown>   // structurally valid row; cells resolve per-cell (SPEC-R3)

/** Hardening (SPEC-R3 rows 3/4): non-array → []; an entry survives only as a plain object with string
 *  `key` AND string `label`; `type` normalized — 'number' kept, anything else (incl. unknown strings,
 *  SPEC-R3 row 4) → 'string'. Drop, never coerce. */
export function cleanColumns(input: unknown): TableColumn[]

/** Hardening (SPEC-R3 row 5): non-array → []; an entry survives only as a plain object (non-null,
 *  non-array). Cell VALUES are not judged here — that is resolveCell's per-cell job. */
export function cleanRows(input: unknown): TableRow[]

/** The SPEC-R3 cell-resolution table, rows 6–11, as one pure function:
 *  absent/undefined/null → '' · finite number → formatNumber (value-driven, any column type) ·
 *  non-finite number → '—' (U+2014, the placeholder) · string → verbatim · anything else → ''.
 *  NEVER throws; alignment is NOT decided here (column-driven, LLD-C3). */
export function resolveCell(column: TableColumn, row: TableRow): string

/** Default-locale Intl.NumberFormat, module-memoized (the chart-family formatter discipline). */
export function formatNumber(v: number): string

/** Safe JSON codecs (SPEC-R1): `from(attr)` = null → [], JSON.parse in try/catch → [] on throw, then
 *  cleanColumns/cleanRows; `to` = JSON.stringify. dom/props.ts jsonType is NOT used — its bare JSON.parse
 *  throws on malformed attributes and maps a removed attribute to `null`, both of which SPEC-R1 forbids
 *  reaching the render path (the chart-family codec construction, verified at that wave). `kindOf`
 *  classifies both as 'json' via the existing Array.isArray(from(null)) branch — no new descriptor infra. */
export const tableColumnsProp: PropConfig<TableColumn[]>
export const tableRowsProp: PropConfig<TableRow[]>
```

### LLD-C2 — the element (`controls/table/table.ts`)

```ts
const props = {
  columns: tableColumnsProp,   // TableColumn[] · safe JSON codec (LLD-C1)
  rows: tableRowsProp,         // TableRow[]    · safe JSON codec (LLD-C1)
  label: prop.string(''),      // the rendered <caption> text (SPEC-R2/R6)
} satisfies PropsSchema

export interface UITableElement extends ReactiveProps<typeof props> {}
export class UITableElement extends UIElement { static props = props /* … */ }
```

`connected()` builds the **stable skeleton once** — this is the whole SPEC-R4 mechanism: the nodes that
carry user state (scroll offsets) are created once and never replaced by a data update.

1. **Skeleton (once, not in an effect):** `#scroll = <div data-part="scroll" role="region"
   tabindex="0">` › `#table = <table>` › `#thead = <thead>` + `#tbody = <tbody>`;
   `this.replaceChildren(#scroll)`. Held as private fields; `render()` stays the inherited no-op (the
   sparkline imperative-injection idiom). The host mints NO ARIA via internals (SPEC-R6 — native table
   semantics carry it). The scroll container's `role="region"` + `tabindex="0"` is the canonical
   accessible-overflow pattern on an INTERIOR node (the `Option`/`MenuItem` interior-attribute sanction;
   only HOST aria must ride internals): without it, keyboard users cannot reach overflowed columns in
   engines without keyboard-focusable scrollers — SPEC-R5's destructive branch. This is platform scroll,
   not a component keyboard contract (`keyboard: []` stands; documented in `table.md`).
2. **Columns effect** (reads `columns`): `cols = cleanColumns(this.columns)`. `cols.length === 0` ⇒
   `#scroll.replaceChildren()` — **no table is stamped** (SPEC-R3 row 1); the host box paints via the
   CSS floor. Else ensure `#table` is attached (`#scroll.replaceChildren(#table)` only when detached —
   attach churn only on the empty↔non-empty transition) and rebuild the header row:
   `#thead.replaceChildren(<tr> of cols.map(col => <th scope="col" data-type?>))` — `data-type="number"`
   set when `col.type === 'number'` (LLD-C3 keys alignment on it). The `#table`/`#thead` NODES are never
   replaced — SPEC-R4.3's identity clause holds by construction.
3. **Body effect** (reads `columns` + `rows`): `#tbody.replaceChildren(...cleanRows(this.rows).map(row =>
   <tr> of cols.map(col => <td data-type?>{resolveCell(col, row)}</td>)))`. A **rows-only** update
   triggers ONLY this effect (the columns signal did not change — fine-grained waking), so exactly
   `<tbody>` content rebuilds (SPEC-R4.3) and `#scroll`'s offsets are untouched (SPEC-R4.1/2 — nothing
   ever writes `scrollLeft`). Whole-array swap semantics; deliberately NOT the ADR-0024 positional
   reconcile — inert text rows hold no per-node state worth reconciling (the bar-chart precedent).
4. **Label effect** (reads `label`): non-empty ⇒ ensure `#caption = <caption id="{uid}">` exists as
   `#table.firstChild`, set its text, and set `#scroll.aria-labelledby = uid` (the region is named by
   the caption — one text, two consumers); empty ⇒ remove both. `uid` = a module-scoped counter suffix
   (`ui-table-caption-{n}`, collision-free in light DOM). Touches nothing else (SPEC-R2 AC3).

### LLD-C3 — the stylesheet (`controls/table/table.css`)

```css
:where(ui-table) {
  --ui-table-min-inline-size: 16em;                          /* the whole-shape floor (SPEC-R14) */
  --ui-table-cell-pad-inline: var(--ui-space-sm);            /* rhythm — rides [density] free (ADR-0103) */
  --ui-table-cell-pad-block: var(--ui-space-xs);
  --ui-table-rule-ink: var(--md-sys-color-neutral-outline-variant);      /* row separator hairline */
  --ui-table-header-rule-ink: var(--md-sys-color-neutral-outline);       /* thead underline, stronger */
  --ui-table-caption-ink: var(--md-sys-color-neutral-on-surface-variant);
}
@scope (ui-table) {
  :scope { display: block; min-inline-size: var(--ui-table-min-inline-size); }
  :scope [data-part='scroll'] { overflow-x: auto; }          /* SPEC-R5: the component's own container */
  :scope table {                                             /* the UA/page-cascade reset (SPEC-R2 AC2) */
    border-collapse: collapse; inline-size: 100%;            /* narrow tables fill the host (SPEC-R5) */
    font: inherit; text-align: start;
    font-size: var(--md-sys-typescale-body-medium-size);
    line-height: var(--md-sys-typescale-body-medium-line-height); }
    /* typescale row names verified at build: the fleet's rows are -small/-medium/-large (dimensions.css)
       — the chart-family M1-a corrected-names lesson, applied up front this time */
  :scope caption { text-align: start; color: var(--ui-table-caption-ink);
                   padding-block-end: var(--ui-table-cell-pad-block); }
  :scope th, :scope td { padding: var(--ui-table-cell-pad-block) var(--ui-table-cell-pad-inline);
                         text-align: start; overflow-wrap: anywhere; }   /* huge strings wrap (SPEC-R3 row 14) */
  :scope th { font-weight: var(--md-sys-typescale-label-large-weight);
              border-block-end: 1px solid var(--ui-table-header-rule-ink); }
  :scope tbody tr { border-block-end: 1px solid var(--ui-table-rule-ink); }
  :scope [data-type='number'] { text-align: end; font-variant-numeric: tabular-nums;
                                white-space: nowrap; }       /* numbers never wrap — they force the scroll
                                                                container instead (SPEC-R5), keeping every
                                                                digit scannable */
}
```

- **Overflow mechanics** (SPEC-R5 AC1): string cells wrap (`overflow-wrap: anywhere`), so min-content
  stays small; number columns are `nowrap`, so a many-column numeric table's min-content exceeds a narrow
  host and `[data-part=scroll]` scrolls — the page never does. `inline-size: 100%` keeps a narrow table
  filling the host (no orphaned gutter).
- **RTL is free** (SPEC-R16): logical properties throughout (`text-align: start/end`,
  `border-block-end`, `padding` block/inline pairs); native `<table>` handles column order under
  `dir="rtl"`; `text-align: end` flips number alignment — the browser leg measures it.
- **WHCM: no dedicated block** (SPEC-R15): every separator is a real `border` (repainted in system inks,
  never removed — unlike backgrounds); all content is real text. Documented in `table.md`'s
  `forcedColors:` line.

## 3 · `ui-stat` (SPEC-R7…R10)

### LLD-C4 — the pure model (`controls/stat/stat-model.ts`, DOM-free)

```ts
/** SPEC-R7: finite number → formatNumber (module-memoized Intl); non-finite number → '—'; string →
 *  verbatim passthrough. Never throws. */
export function formatStatValue(value: string | number): string

export interface DeltaParts {
  dir: 'up' | 'down' | 'flat'   // sign class (SPEC §2 Direction); 'flat' ⇔ delta === 0
  word: 'up' | 'down' | 'unchanged'   // the announced direction word (SPEC-R9)
  text: string                  // Intl.NumberFormat({ signDisplay: 'exceptZero' }) — '+12' / '-3' / '0'
}
/** null for non-number / non-finite input (the delta region is not rendered — SPEC-R7). */
export function deltaParts(delta: unknown): DeltaParts | null

/** Codecs: `statValueProp` — from(attr): null → ''; a trimmed attribute that parses to a FINITE number
 *  → that number (so `value="48200"` formats); anything else → the verbatim string (so `value="$1.2M"`
 *  passes through). Property writes keep their runtime type. `statDeltaProp` — from(attr): null → null;
 *  parseFloat; non-finite → null. */
export const statValueProp: PropConfig<string | number>
export const statDeltaProp: PropConfig<number | null>
```

### LLD-C5 — the element (`controls/stat/stat.ts`)

Props: `{ label: prop.string(''), value: statValueProp, delta: statDeltaProp, caption: prop.string('') }`.
`connected()` installs ONE render effect (reads all four): full `replaceChildren` rebuild per change —
unlike LLD-C2 there is no interior user state (no scroll, no selection worth keeping on a four-span
tile), so the simple whole-swap is correct. No internals ARIA (real text carries it); no heading element
is ever created (SPEC-R8 — the tile's DOM is spans only):

```html
<span data-part="label">{label}</span>
<span data-part="value">{formatStatValue(value)}</span>
<span data-part="delta" data-dir="{dir}">          <!-- only when deltaParts(delta) !== null -->
  <span data-part="delta-glyph" aria-hidden="true"></span>   <!-- omitted when dir === 'flat' -->
  <span data-part="delta-word">{word} </span>      <!-- visually hidden, announced (SPEC-R9) -->
  {text}</span>
<span data-part="caption">{caption}</span>         <!-- only when caption is non-empty -->
```

Reading order label → value → delta → caption is DOM order (SPEC-R8). The delta's accessible reading is
`{word} {text}` ("up +12") — the glyph contributes nothing (aria-hidden, text-free; SPEC-R9 AC1).

### LLD-C6 — the stylesheet (`controls/stat/stat.css`)

```css
:where(ui-stat) {
  --ui-stat-min-inline-size: 8em;                            /* the whole-shape floor (SPEC-R10) */
  --ui-stat-gap: var(--ui-space-xs);                         /* interior rhythm — rides [density] */
  --ui-stat-label-ink: var(--md-sys-color-neutral-on-surface-variant);
  --ui-stat-caption-ink: var(--md-sys-color-neutral-on-surface-variant);
  --ui-stat-delta-glyph-size: 0.6em;                         /* density-invariant mark geometry */
}
@scope (ui-stat) {
  :scope { display: inline-grid; gap: var(--ui-stat-gap);
           min-inline-size: var(--ui-stat-min-inline-size); }
  :scope [data-part='label']   { color: var(--ui-stat-label-ink);
                                 font-size: var(--md-sys-typescale-label-medium-size);
                                 line-height: var(--md-sys-typescale-label-medium-line-height); }
  :scope [data-part='value']   { font-size: var(--md-sys-typescale-headline-small-size);
                                 line-height: var(--md-sys-typescale-headline-small-line-height);
                                 font-weight: var(--md-sys-typescale-headline-small-weight);
                                 font-variant-numeric: tabular-nums; }
                                 /* the tile register the fake-h3 idiom faked — style WITHOUT semantics
                                    (ADR-0078's split honored; row names verified at build) */
  :scope [data-part='delta']   { font-size: var(--md-sys-typescale-body-medium-size); }
  :scope [data-part='caption'] { color: var(--ui-stat-caption-ink);
                                 font-size: var(--md-sys-typescale-body-small-size); }
  :scope [data-part='delta-glyph'] { display: inline-block; background: currentColor;
                                     inline-size: var(--ui-stat-delta-glyph-size);
                                     block-size: var(--ui-stat-delta-glyph-size); }
  :scope [data-dir='up']   [data-part='delta-glyph'] { clip-path: polygon(50% 0, 100% 100%, 0 100%); }
  :scope [data-dir='down'] [data-part='delta-glyph'] { clip-path: polygon(0 0, 100% 0, 50% 100%); }
  :scope [data-part='delta-word'] {                          /* visually hidden, announced (SPEC-R9) */
    position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden;
    clip-path: inset(50%); white-space: nowrap; }
  @media (forced-colors: active) {
    :scope [data-part='delta-glyph'] { background: CanvasText; }   /* SPEC-R15 — the bar-fill lesson */
  }
}
```

- **No valence channel exists to remove** (SPEC-R9 AC2): the delta inherits ink; no `[data-dir]` rule
  touches color — direction lives in clip-path orientation + sign + the hidden word only.

## 4 · `ui-badge` (SPEC-R11…R13)

### LLD-C7 — the element (`controls/badge/badge.ts`)

```ts
const props = {
  label: prop.string(''),
  // Bindable status data (fork F3): enumType SNAPS unknown/bound-garbage values to 'neutral' — the
  // component-hardening half of the ADR-0098 split (the validator sees literals only, ADR-0111 cl.2).
  // REFLECTS so [intent] CSS keys on JS-set/bound values (the ui-text variant/size precedent).
  intent: { ...prop.enum(['neutral', 'info', 'success', 'warning', 'danger'] as const, 'neutral'),
            reflect: true },
} satisfies PropsSchema
```

`connected()` builds two children once — `<span data-part="glyph" aria-hidden="true"></span><span
data-part="label"></span>` — plus one label effect (`labelSpan.textContent = this.label`). The glyph
node is CONSTANT DOM; every per-intent difference (shape, visibility, roles) is CSS keyed on the
reflected `[intent]` attribute — zero DOM churn on an intent change (a bound `intent` update is an
attribute flip). No internals ARIA (announced content = the label text, SPEC-R12 AC3); no focus, no
events, no form participation (SPEC-R11).

### LLD-C8 — the stylesheet (`controls/badge/badge.css`)

```css
:where(ui-badge) {
  --ui-badge-box: var(--ui-compact-lg);        /* 18px @ default scale; [scale] re-tables ride free (ADR-0041) */
  --ui-badge-pad: calc(2px + var(--ui-badge-box) * 0.375 * var(--ui-density, 1));
                                               /* the compact pad law — 2px + box·ratio·density
                                                  (dimensional-standard §2.4 ratio 0.375; the realm KEEPS
                                                  this formula per geometry.md — verify the shipped ratio
                                                  against dimensional-standard at build) */
  --ui-badge-font: var(--ui-font-sm);          /* the fleet font ramp — ADR-0111 cl.5: text = font ramp */
  --ui-badge-gap: var(--ui-gap-sm);            /* rhythm (font/2 × density, the token as shipped) */
  --ui-badge-glyph: calc(var(--ui-badge-box) * 0.5);
  --ui-badge-fill: var(--md-sys-color-neutral-container);
  --ui-badge-ink: var(--md-sys-color-neutral-on-surface);
  --ui-badge-outline: var(--md-sys-color-neutral-outline-variant);
}
@scope (ui-badge) {
  :scope { display: inline-flex; align-items: center; gap: var(--ui-badge-gap);
           box-sizing: border-box; block-size: var(--ui-badge-box);
           min-inline-size: var(--ui-badge-box);             /* empty-label floor → a filled dot (SPEC-R13 AC2) */
           padding-inline: var(--ui-badge-pad);
           border-radius: calc(var(--ui-badge-box) / 2);     /* the pill = box/2 (the realm's count-pill case) */
           border: 1px solid var(--ui-badge-outline);
           background: var(--ui-badge-fill); color: var(--ui-badge-ink);
           font-size: var(--ui-badge-font); line-height: 1;  /* single-line token centers like a glyph */
           white-space: nowrap; }
  :scope [data-part='glyph'] { background: currentColor; flex: none;
                               inline-size: var(--ui-badge-glyph); block-size: var(--ui-badge-glyph); }
  /* Per-intent glyph SHAPES — pairwise distinct clip-paths (SPEC-R12 AC1; the checkbox tick precedent).
     Shape is the meaning channel; the role repoints below are the REDUNDANT hue channel (ADR-0057). */
  :scope[intent='neutral'] [data-part='glyph'] { display: none; }        /* absence IS neutral's signifier */
  :scope[intent='success'] [data-part='glyph'] { clip-path: polygon(14% 44%, 0 65%, 50% 100%, 100% 16%, 80% 0, 43% 62%); }  /* tick (checkbox.css) */
  :scope[intent='danger']  [data-part='glyph'] { clip-path: polygon(20% 8%, 8% 20%, 38% 50%, 8% 80%, 20% 92%, 50% 62%, 80% 92%, 92% 80%, 62% 50%, 92% 20%, 80% 8%, 50% 38%); }  /* cross */
  :scope[intent='warning'] [data-part='glyph'] { clip-path: polygon(50% 0, 100% 100%, 0 100%); }  /* triangle */
  :scope[intent='info']    [data-part='glyph'] { clip-path: circle(50%); }                        /* disc */
  /* Per-intent roles — DEFAULTS, gated by the SPEC-R14 AC3 AA probe at build (fallback = a token
     repoint, never a mechanism change — the chart LLD §7 row-9 pattern). First live consumers of
     --md-sys-color-warning/-info (ADR-0057 "in scope at first consumer"). PREDICTED PROBE CASUALTY
     (doc-review F4): the -on-surface-variant ink is a supporting-text role, not a text-grade role,
     paired here against the -container fill — this pairing is the one most likely to miss 4.5:1 on
     some intent × light/dark. Expect the probe to fail it and repoint toward an -on-container /
     text-grade role; this is not a surprise, it's the reason the AC exists. */
  :scope[intent='info']    { --ui-badge-fill: var(--md-sys-color-info-container);
                             --ui-badge-ink: var(--md-sys-color-info-on-surface-variant);
                             --ui-badge-outline: var(--md-sys-color-info-outline-variant); }
  :scope[intent='success'] { --ui-badge-fill: var(--md-sys-color-success-container);
                             --ui-badge-ink: var(--md-sys-color-success-on-surface-variant);
                             --ui-badge-outline: var(--md-sys-color-success-outline-variant); }
  :scope[intent='warning'] { --ui-badge-fill: var(--md-sys-color-warning-container);
                             --ui-badge-ink: var(--md-sys-color-warning-on-surface-variant);
                             --ui-badge-outline: var(--md-sys-color-warning-outline-variant); }
  :scope[intent='danger']  { --ui-badge-fill: var(--md-sys-color-danger-container);
                             --ui-badge-ink: var(--md-sys-color-danger-on-surface-variant);
                             --ui-badge-outline: var(--md-sys-color-danger-outline-variant); }
  @media (forced-colors: active) {                           /* SPEC-R15: boxed identity + glyph survive */
    :scope { background: Canvas; color: CanvasText; border-color: CanvasText; }
    :scope [data-part='glyph'] { background: CanvasText; }
  }
}
```

- **Geometry probes** (SPEC-R13 AC1): block-size == `--ui-badge-box`; border-radius == box/2;
  `[density]` moves the pad, never the box/glyph — the geometry trip-wire per `geometry.md`
  §Mechanization.
- **The `geometry.md` dual-listing repair** (ADR-0111 cl.5 Repairs) lands in the SAME change as this
  folder: the Display-class examples row drops `badge`; the compact-realm roster note gains "(badge —
  first shipped consumer; box = compact law, text = the fleet font ramp)".

## 5 · Descriptors + fleet integration (SPEC-R17, SPEC-N3)

**LLD-C9 — descriptors.** `table.md` / `stat.md` / `badge.md` per the `sparkline.md` display-leaf shape:
`tag`, `tier: display`, `extends: UIElement`, the `attributes[]` block mirroring `static props` —
table: columns/rows (`type: json`, `reflect: false`, the safe-codec note) + label; stat:
label/value/delta/caption (value's number-or-string codec documented; delta `type: number`-ish per
`kindOf`'s verdict on a null-defaulting numeric codec — **build-verify**: assert what `kindOf` yields
for `statValueProp`/`statDeltaProp` in the descriptor trip-wire before writing the cells); badge:
label + intent (`type: enum`, `values: [neutral, info, success, warning, danger]`, **`reflect: true`**).
`properties: []`, `events: []`, `slots: []` (all children component-built), `parts:` documenting
scroll/caption-adjacent structure (table), label/value/delta/delta-glyph/delta-word/caption (stat),
glyph/label (badge), `customStates: []`, `face.formAssociated: false`, `aria:` blocks (table: host
role NONE — native `<table>` semantics + the interior `role=region` scroll node documented; stat: real
text + the aria-hidden glyph; badge: label text + aria-hidden glyph), `keyboard: []` (table.md notes
the scroll region's `tabindex=0` = platform scrolling, not a component contract), a `geometry:` block
(table/stat: Display posture, NO `size`, no control-ramp tokens — SPEC-R17 AC2; badge: the compact
ramp + pad law + pill), a `forcedColors:` line each, and the `marginal:` size note (measured at
LLD-C10, not guessed). Each folder ships `{name}-descriptor.test.ts` (contract↔props trip-wire).

**LLD-C10 — the serial integration slice** (ONE writer; after all three folders land — the fan-out law):
- `controls/index.ts` — export all three (family-coherence C1).
- `descriptor/component-styles.css` — import all three sheets (C3).
- `descriptor/site-coverage.test.ts` — display-tier membership becomes
  `['badge', 'bar-chart', 'icon', 'sparkline', 'stat', 'table', 'text']` (sorted). Gate edit — negative
  control: reverting it must fail `npm test`.
- components `package.json` — per-control `exports` entries ×3 (the ADR-0080 three-way gate).
- **Enumerated up front** (the chart wave's as-built lesson — these seeds are part of THIS slice, not
  surprises): `site-toc.test.ts` `PENDING_TOC_GROUPS` + `site-coverage.test.ts` `KNOWN_UNDOCUMENTED`
  seeds (drained by LLD-C11) · the a2ui catalog `index.test.ts` `EXCLUSION_ALLOWLIST` seeds ×3 (drained
  by LLD-C12, which also owes the residue-guard assertion) · `site/lib/component-preview.ts`
  `NO_SLOT_TEXT` + `COMPONENT_SAMPLE_ATTRS` specimen entries ×3.
- `npm run size` by hand (ADR-0040): the 26 KB family ceiling (ADR-0107 Amendment) is expected to
  re-base — three controls, the table heaviest (DOM building + Intl); the re-base is its own recorded
  note (SPEC-N4), per-control marginal ≤ ~2 KB gz the real gate.

**LLD-C11 — site pages.** `site/table-doc.html` + `site/stat-doc.html` + `site/badge-doc.html`
(tier=display ⇒ `doc` page only, PAGES_BY_TIER) + toc/nav rows. Pages mount the live controls; the
degenerate strips double as visual fixtures (a table with every SPEC-R3 row; a five-intent badge strip;
up/down/flat stats).

## 6 · Catalog wave (SPEC-R18, SPEC-R19)

**LLD-C12 — rows + factories** (`a2ui/src/catalog/default/`):

```jsonc
// catalog.json → components
"Table": { "properties": {
  "columns": { "type": { "type": "array", "items": { "type": "object",
               "properties": { "key": { "type": "string" }, "label": { "type": "string" },
                               "type": { "type": "string", "enum": ["string", "number"] } },
               "required": ["key", "label"] } }, "bindable": true, "mapsTo": "columns" },
  "rows":    { "type": { "type": "array", "items": { "type": "object" } },   // open records (fork F1)
               "bindable": true, "mapsTo": "rows" },
  "label":   { "type": { "type": "string" }, "bindable": true, "mapsTo": "label" } } },
"Stat": { "properties": {
  "label":   { "type": { "type": "string" }, "bindable": true, "mapsTo": "label" },
  "value":   { "type": { "type": ["string", "number"] }, "bindable": true, "mapsTo": "value" },
               // the union via the type-ARRAY form — conformance.ts matchesSchemaType's types.some
               // accepts it (verified against source at design time, not assumed)
  "delta":   { "type": { "type": "number" }, "bindable": true, "mapsTo": "delta" },
  "caption": { "type": { "type": "string" }, "bindable": true, "mapsTo": "caption" } } },
"Badge": { "properties": {
  "label":   { "type": { "type": "string" }, "bindable": true, "mapsTo": "label" },
  "intent":  { "type": { "type": "string", "enum": ["neutral", "info", "success", "warning", "danger"] },
               "bindable": true, "mapsTo": "intent" } } }
               // BINDABLE enum (ADR-0111 cl.2): literals validated per ADR-0098; a {path} bind passes
               // the validator (deferred resolution) and hardens at the component (SPEC-R11 AC2)
```

```ts
// factories.ts — display-only leaves: plain accessor factories, no value mark, no children, no submitGate.
export const tableFactory: WidgetFactory = accessorFactory('ui-table')
export const statFactory: WidgetFactory = accessorFactory('ui-stat')
export const badgeFactory: WidgetFactory = accessorFactory('ui-badge')
```

Build-verify items (named, not guessed): (a) tag→PascalCase over single-word tags (`table → Table` etc.)
is the trivial case of the `combo-box → ComboBox` util — assert in the gate run; (b) the shared
validator accepts literal arrays at top-level `type` depth (SPEC-R18's posture; the declared item
schemas stay for future depth); (c) `factories.test.ts` gains all three (count + binding);
`index.test.ts`'s fleet-derived gate drains the LLD-C10 allowlist seeds to zero residue + keeps the
residue-guard assertion (SPEC-R18 AC1).

**LLD-C13 — feed dispositions** (`a2ui/tools/agent/feed-catalog.ts` + its gate; SPEC-R19; ADR-0111
cl.7, fork F4 standing): `FEED_SURFACE_TYPES` gains `'Badge'` (light ask furniture — the `Text`/`Icon`
class; e.g. marking one option "recommended" in a choice ask). `FEED_EXCLUDED` gains
`{ type: 'Stat', reason: 'report content with no ask affordance — the atomic unit of the dashboard idiom
the partition exists to keep out of ask bubbles; an ask that needs a number in prose has Text.' }` and
`{ type: 'Table', reason: 'dashboard/canvas-scale content — the recorded List/Grid exclusion reasoning
applies a fortiori to a data table.' }`. The header-comment counts (23 IN / 13 OUT → 24 / 15) update in
the same edit; `feed-catalog.test.ts`'s TOTAL-partition closure goes green with zero other changes
(ask-policy semantics untouched).

**LLD-C14 — catalog SPEC repair.** `a2ui-catalog.spec.md` §5.2 gains the three rows (cells per
SPEC-R18's table + landed factory facts) in the same change as LLD-C12 — the coverage table stays the
one normative home; this family's SPEC is cited as the behavior contract.

## 7 · Teaching wave (SPEC-R20, M2)

**LLD-C15 — guidance re-base + exemplars.** (a) The §5.2 four-way Notes re-base: *`Stat` for a latest
value · `Sparkline` for the shape of a series · `BarChart` for comparing magnitudes · `Table` when exact
values must be scanned row-by-row* — the "metric tile" and "`List` table" idiom wordings leave the
guidance (SPEC-R20 AC1). (b) The report-card exemplar's hand tile (caption-`Text` + `h3`-`Text` in a
Column) becomes ONE `Stat` (`label: "Revenue"`, `value: {path:/latest}`, `caption`) — the chart-wave
exemplar upgraded in place. (c) NEW exemplar `ops-report` (`a2ui/src/examples/catalog-coverage.ts`
sibling): data model `{ checks: {…}[], uptime, deployments }`; components:
`Card > CardContent > Column [ Text(title), Row [ Stat(uptime, delta), Stat(deployments) ],
Row [ Badge("2 failing", intent: danger), Badge("11 passing", intent: success) ],
Table(label: "Failing checks", columns: name/env/latency(number), rows: {path:/checks}) ]` — ONE seed
exercising all three types (the PRD-G3 target), the table's number column exercising Intl + alignment.
Both seeds join `allSeeds`, validate 0-`CATALOG`, render in the gallery (browser-verified).
**LLD-C16 — corpus/prompt re-validation**: re-run corpus admission + derived-prompt/coverage gates over
the widened catalog (the ADR-0087 consequence pattern); repair drift in the same change.

## 8 · Failure modes & edge handling (the per-case ledger)

| # | Case | Handling | Where |
|---|---|---|---|
| 1 | malformed `columns`/`rows` attribute JSON | try/catch codec → `[]`; no throw reaches `attributeChangedCallback` | LLD-C1 codecs (SPEC-R1 AC3) |
| 2 | attribute removed (`from(null)`) | `[]` (table) / `''`/`null` (stat) — never a null array on the render path | LLD-C1/C4 |
| 3 | property write of garbage (non-array, mixed junk, unknown intent) | `cleanColumns`/`cleanRows` at the render boundary; `resolveCell` per cell; enum snap → `neutral` | LLD-C2/C7 (SPEC-R3/R11) |
| 4 | every column/row dropped | no table stamped / honest empty tbody; host box paints via floor | LLD-C2 (SPEC-R3 rows 1–2) |
| 5 | value-degenerate cells (missing/null/NaN/mismatch/foreign) | the `resolveCell` table — each pinned by a unit row | LLD-C1 (SPEC-R3 rows 6–11) |
| 6 | bound `rows` swap resets scroll | structurally impossible: scroll node created once, never replaced, never written — browser leg pins it | LLD-C2 (SPEC-R4 AC1) |
| 7 | rows-only update rebuilds thead | prevented by the two-effect split (columns effect does not read `rows`) | LLD-C2 (SPEC-R4.3) |
| 8 | huge table (1 000 rows) | O(rows×cols) rebuild, no per-row reconcile, no cap (SPEC-N5); revisit only on a measured complaint | LLD-C2 |
| 9 | shrinking update leaves stale scroll offset | platform clamps; no component action (SPEC-R4.2's stated subject-to-clamping) | LLD-C2 |
| 10 | unlabeled table ⇒ unnamed scroll region | accepted residual, recorded: the region is named exactly when `label` exists; descriptor guidance says provide `label` | LLD-C2/C9 |
| 11 | keyboard reach of overflowed columns | interior `tabindex=0` scroll region (canonical pattern; Chromium's keyboard-focusable scrollers make it engine-consistent) | LLD-C2 (SPEC-R5) |
| 12 | in-cell selection dropped on rows swap | accepted residual per SPEC-R4.4 (display-only v1); re-opens with any interactive cell | LLD-C2 |
| 13 | intent role fails the AA probe on some surface × mode | repoint the token default (`-container`/`-on-surface-variant` picks are defaults, not law) — a token edit, never a mechanism change | LLD-C8 (SPEC-R14 AC3) |
| 14 | WHCM flattens badge fill / glyph / delta glyph | explicit `forced-colors` blocks: border + CanvasText glyph (the bar-fill lesson); table needs none (borders survive) | LLD-C3/C6/C8 (SPEC-R15) |
| 15 | typescale/role token names drift from the sheet | build-verify against `dimensions.css`/`tokens.css` before commit (the chart M1-a corrected-names lesson) | LLD-C3/C6/C8 |
| 16 | compact pad ratio wrong | verify 0.375 against `dimensional-standard.md` §2.4 at build; the formula, not the constant, is the law | LLD-C8 (SPEC-R13) |
| 17 | `kindOf` misclassifies stat's union/nullable codecs | build-verify in the descriptor trip-wire BEFORE writing descriptor cells; if a new `kindOf` branch is needed it is shared infra with fleet blast-radius named (the chart M1-b precedent) | LLD-C9 |
| 18 | validator shallow on array items | conformant per SPEC-R18 (top-level depth); component hardening is the safety net | LLD-C12 |
| 19 | partition gate red on catalog widening | by design (TOTAL partition); LLD-C13 lands in the same wave — never waved off | LLD-C13 (SPEC-R19) |

## 9 · Test plan (per slice) & gates

- **Model units** (`table-model.test.ts`, `stat-model.test.ts`, DOM-free): every SPEC-R3 row (1–14) as
  table-driven cases; `resolveCell` never throws (fuzz the value space); codec round-trips incl.
  malformed JSON + `from(null)`; `formatStatValue`/`deltaParts` incl. `0`, negatives, `NaN`,
  `Infinity`, strings; the exact placeholder `—` and direction words pinned verbatim.
- **jsdom** (`table.test.ts`, `stat.test.ts`, `badge.test.ts`): stamped DOM shape (caption/thead
  th[scope]/tbody counts; the SPEC-R3 AC2 four-cell strip); node-identity assertions across rows-only /
  columns / label updates (SPEC-R4.3, SPEC-R2 AC3); no-heading probe (SPEC-R8 AC1); delta
  word/glyph/aria-hidden (SPEC-R9 AC1); intent snap + reflection (SPEC-R11 AC2); descriptor trip-wires
  ×3; NO host-ARIA assertions (SPEC-R6 AC2).
- **Browser, Chromium + WebKit** (`*.browser.test.ts` — SPEC-N2): scroll-preservation across a bound
  rows swap (SPEC-R4 AC1 — THE mandatory leg the ADR named); overflow-in-own-container while the page
  stays still (SPEC-R5 AC1); computed AX roles (table/columnheader/caption-name, SPEC-R6 AC1);
  whole-shape floors ×3 (SPEC-R10/R13/R14 AC1); badge pairwise clip-path distinctness + grayscale
  distinctness (SPEC-R12 AC1/AC2); compact geometry + density split (SPEC-R13 AC1, SPEC-R17 AC1);
  forced-colors computed-style legs (SPEC-R15 AC1); RTL measured positions (SPEC-R16 AC1).
  Computed-style is the sanctioned visual proof (ADR-0102) — no pixel-diff harness.
- **Probes at build:** the AA probe (badge ink:fill ≥ 4.5:1 × 5 intents × light/dark, SPEC-R14 AC3);
  the geometry trip-wire (badge box/pad/pill, SPEC-R13).
- **Gates**: `npm run check && npm test` green at every slice boundary; `npm run test:browser` before
  each wave commit (the component-reviewer DoD — jsdom-green ≠ done; the component-reviewer pass is
  NON-optional before each control-wave commit); `npm run size` by hand at LLD-C10; catalog gates at
  LLD-C12; partition gate at LLD-C13; examples/corpus gates at LLD-C15/C16. Negative controls: the
  site-coverage display-tier edit, the fleet-derived catalog gate, and the partition gate must each
  FAIL when their new entry is reverted.

## 10 · Build sequence (checkpointed; = the decomp's edge order)

1. **Wave M1-a (parallel):** LLD-C1 → LLD-C2/C3 (table folder) ∥ LLD-C4 → LLD-C5/C6 (stat folder) ∥
   LLD-C7/C8 (badge folder) — one writer per folder; table model frozen first within its folder.
   *Checkpoint:* folder-local tests green; component-reviewer pass per folder.
2. **Wave M1-b (serial):** LLD-C9 descriptors finalized in-folder (+ the `geometry.md` cl.5 repair in
   the badge change), then LLD-C10 (barrel/styles/gate edits/exports/size) — the ONE shared-file
   writer. *Checkpoint:* repo-wide check + test + browser green; size reported.
3. **Wave M1-c:** LLD-C11 site pages. *Checkpoint:* site-coverage/toc/nav green; site builds.
4. **Wave M1-d (same wave as the descriptors — SPEC-R18/N2):** LLD-C12 catalog rows + factories, then
   LLD-C13 feed dispositions, then LLD-C14 catalog-SPEC repair. *Checkpoint:* fleet-derived gate green
   with zero allowlist residue; partition gate green; ADR-0111 cl.2 payloads validate clean.
5. **Wave M2:** LLD-C15 guidance re-base + exemplars, then LLD-C16 corpus/prompt re-validation.
   *Checkpoint:* SPEC-R20 ACs; exemplars render in the gallery.

## Component IDs (trace)

`LLD-C1` table model ← SPEC-R1/R3 · `LLD-C2` UITableElement ← SPEC-R1/R2/R3/R4/R5/R6 · `LLD-C3`
table.css ← SPEC-R2/R3/R5/R14/R15/R16/R17 · `LLD-C4` stat model ← SPEC-R7/R9 · `LLD-C5` UIStatElement ←
SPEC-R7/R8/R9 · `LLD-C6` stat.css ← SPEC-R8/R9/R10/R14/R15/R16/R17 · `LLD-C7` UIBadgeElement ←
SPEC-R11/R12 · `LLD-C8` badge.css ← SPEC-R12/R13/R14/R15/R16/R17 · `LLD-C9` descriptors ←
SPEC-R1/R7/R11/R13/R17 · `LLD-C10` integration ← SPEC-N3/N4 · `LLD-C11` site pages ← SPEC-N3 ·
`LLD-C12` catalog rows/factories ← SPEC-R18 · `LLD-C13` feed dispositions ← SPEC-R19 · `LLD-C14`
catalog-SPEC repair ← SPEC-R18 · `LLD-C15` exemplars + guidance ← SPEC-R20 · `LLD-C16` corpus
re-validation ← SPEC-R20. (`LLD-C#` IDs per-doc-scoped — the house convention.)
