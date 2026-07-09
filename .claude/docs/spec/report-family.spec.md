# SPEC — Report Family (`ui-table` + `ui-stat` + `ui-badge` + catalog surface)

> Status: proposed · v0.1 · 2026-07-09 · Layer: SPEC (execution contract)
> Refines: [`../prd/report-family.prd.md`](../prd/report-family.prd.md) — **PRD-G1, PRD-G2, PRD-G3** — under the ratified scope + contract directions of [ADR-0111](../adr/0111-report-family-v1-scope.md) (accepted; forks F1–F4 as recommended). Every clause of ADR-0111 is binding here; this SPEC adds the behavior contract, it re-litigates nothing.
> Refined by: [`../lld/report-family.lld.md`](../lld/report-family.lld.md). Build plan: [`../decompositions/report-family-build.decomp.json`](../decompositions/report-family-build.decomp.json) (coverage-clean).
> Altitude: owns **what the three report controls do and how they behave at every boundary** + the report rows' catalog contract and feed dispositions. Implementation (stamp mechanics internals, CSS mechanics, file layout) is the LLD's. Filed in the charter home (`docs/spec/`, the chart-family precedent); the catalog surface (§5.2 of [`../specs/specs/a2ui-catalog.spec.md`](../specs/specs/a2ui-catalog.spec.md)) stays a first-class same-wave deliverable, cross-referenced.
> Requirement IDs file-scoped (`SPEC-R1…`); cross-document references qualify by doc name.

---

## 1. Purpose

Contract the v1 report/status family ADR-0111 admits: `ui-table` (a static data table — typed columns,
record rows, exact values scanned row-by-row, rendered as a **real native `<table>`** stamped in light
DOM), `ui-stat` (the metric tile — label + value + optional delta + optional caption, no heading stamp),
and `ui-badge` (a compact, non-interactive status/label token with intent roles — the compact realm's
first shipped consumer and the first live ADR-0057 intent-family consumer). All three are display-only
and enter the default catalog (`Table`, `Stat`, `Badge`) in the same wave they ship, with their ADR-0097
feed-partition dispositions recorded. The fence stands: everything in PRD §3's ruled-out list (sorting,
selection, pagination, virtualization, column resizing, cell renderers, interactive chips, anchored
count-dots, a stat child seam, delta valence coloring) is out of this SPEC's normative reach.

## 2. Definitions

- **Column** — one `{ key, label, type? }` entry; a **valid column** has a `string` key and a `string`
  label; `type` ∈ `'string' | 'number'`, default `'string'` (an unknown `type` string degrades to
  `'string'`, never throws).
- **Record row** — one `Record<string, string | number>` entry (fork F1: rows are records keyed by
  column key, never positional arrays); a **valid row** is a plain object (non-null, non-array). Row
  validity is *structural only* — a valid row may still hold degenerate cell values (SPEC-R3).
- **Rendered set** — the input after hardening: invalid columns/rows/datums dropped, order preserved.
  All rendering AND announcement derive from the rendered set, never the raw input (the chart-family
  SPEC §2 discipline).
- **Cell resolution** — the pure mapping `(column, row) → rendered cell text` pinned by SPEC-R3,
  including every value-degenerate case.
- **The placeholder** — the em dash `—` (U+2014): the defined rendering for a *present but
  unrepresentable* numeric value (non-finite). Distinct from the **empty cell** (absent/null/foreign
  value → no text).
- **Direction** — the sign class of a stat delta: `up` (> 0), `down` (< 0), `unchanged` (= 0). v1
  encodes direction only, never valence (ADR-0111 Consequences: "up is good" is false for churn-class
  metrics).
- **Intent** — the badge's status role: `'neutral' | 'info' | 'success' | 'warning' | 'danger'`
  (default `neutral`). Intent is status *data* (bindable), unlike Sparkline's structural `variant`
  (ADR-0111 cl.2).

## 3. Requirements

Normative per RFC 2119; each carries an ID, PRD trace, and acceptance criteria.

### 3.1 `ui-table`

**SPEC-R1 — Component contract.** `ui-table` MUST be a Display-class, non-interactive,
non-form-associated leaf (`UIElement`; no events, no keyboard contract, no author-slotted content model)
with exactly three props: `columns` (`{ key: string; label: string; type?: 'string' | 'number' }[]`,
default `[]`; attribute form = the JSON string), `rows` (`Record<string, string | number>[]`, default
`[]`; attribute form = the JSON string), and `label` (`string`, default `''` — the rendered
`<caption>` text). Malformed attribute JSON MUST NOT throw — the prop codecs fall back to `[]` (the
chart-family safe-codec discipline; `from(null)` = `[]`, never `null`). *(→ PRD-G1; ADR-0111 cl.1/2,
fork F1)*
- **AC1** *Given* the ADR-0111 cl.2 example (`columns` region/revenue, `rows` EMEA/APAC) set as
  properties or JSON attributes, *when* connected, *then* a two-row table renders and `el.columns` /
  `el.rows` are the typed arrays.
- **AC2** *Given* the descriptor (`table.md`), *then* `tier: display`, `extends: UIElement`,
  `events: []`, `slots: []`, and the `attributes[]` block mirrors `static props` (the descriptor↔props
  trip-wire).
- **AC3** *Given* `columns="not json"` as an attribute, *then* no exception escapes and the element
  renders the empty state (SPEC-R3 row 1).

**SPEC-R2 — Rendering: the native-`<table>` stamp.** The component MUST render a **real native
`<table>`** in light DOM from its data — the ui-text `as`-stamp doctrine scaled up (ADR-0078 cl.4: the
stamped element IS the element; ADR-0111 cl.3): inside a component-owned scroll container, a `<table>`
containing `<caption>` (present exactly when `label` is non-empty), `<thead>` with one `<th scope="col">`
per rendered column (text = `column.label`), and `<tbody>` with one `<tr>` per rendered row, one `<td>`
per rendered column (cell text per SPEC-R3). `type: "number"` columns render **end-aligned** (logical —
flips in RTL) with tabular numerals; other columns start-aligned. The component MUST own the UA-default
+ page-cascade reset in its `@scope` block (border-collapse, cell padding, caption alignment — the
ADR-0111 Consequences "light-DOM cascade" clause; the cl.4 `font: inherit`-reset precedent). No library,
no ARIA-on-divs. *(→ PRD-G1, PRD-G2; ADR-0111 cl.3)*
- **AC1** *Given* two columns (one `type:"number"`) and two rows, *then* the DOM is
  `caption? + thead > tr > th[scope=col]×2 + tbody > tr×2 > td×2`, the number cells are Intl-formatted
  and end-aligned (computed `text-align` resolves to the inline-end side), the string cells
  start-aligned.
- **AC2** *Given* a page-global rule (e.g. `td { padding: 40px }` or a UA-default-visible bare page),
  *then* the component's own cell padding/border tokens still govern (the `@scope` reset holds —
  computed-style assertion, browser leg).
- **AC3** *Given* `label` set then cleared, *then* the `<caption>` is added then removed; no other
  table node is rebuilt by the label change.

**SPEC-R3 — Cell resolution & value degeneracy.** All behavior derives from the rendered set; the ADR's
foreshadowed value-degeneracy is pinned here: degeneracy includes VALUES, not just structure. Required
handling, per case — none may throw, and every non-empty rendered set still paints (SPEC-R14's floors):

| # | Input case | Rendering |
|---|---|---|
| 1 | `columns`/`rows` `[]`, absent, malformed attribute JSON, or non-array | empty columns ⇒ **no table is stamped** (empty scroll container; the host box still paints via the token floor); empty rows with valid columns ⇒ row 2 |
| 2 | valid `columns`, zero valid rows | caption + `<thead>` render; `<tbody>` is empty — the honest empty state (headers describe what *would* be here) |
| 3 | invalid column entry (non-object, missing/non-string `key` or `label`) | that column dropped; remainder renders in order |
| 4 | unknown column `type` value | treated as `'string'` (default alignment/format), never dropped, never thrown |
| 5 | invalid row entry (non-object, `null`, array) | that row dropped; remainder renders in order |
| 6 | missing key in a row (`row[column.key]` absent/`undefined`) | **empty cell** — a real `<td>` with no text (the record shape's honest failure mode, fork F1) |
| 7 | `null` cell value | empty cell (same as row 6) |
| 8 | non-finite `number` cell (`NaN`, `±Infinity`) | **the placeholder `—`** — present-but-unrepresentable; never the strings `NaN`/`Infinity` |
| 9 | type-mismatched cell — a `string` in a `type:"number"` column | rendered **verbatim** as text (never coerced, never dropped); alignment stays the column's (end) — alignment is a column property, not a cell property |
| 10 | finite `number` cell (any column type) | Intl-formatted (default locale, the chart-family printed-value precedent) — formatting is value-driven; alignment is column-driven |
| 11 | foreign-typed cell value (boolean, object, array) | empty cell (the value is dropped, the row survives — dropping the whole record for one bad cell would silently lose data) |
| 12 | duplicate column keys | both columns render, both read the same field (the column list is positional, not keyed — the chart duplicate-labels precedent) |
| 13 | ragged records (extra keys no column names) | ignored — columns select; rows never widen the table |
| 14 | huge unbroken cell string | wraps within its cell (`overflow-wrap`) rather than forcing unbounded column width; the SPEC-R5 container scrolls if the table is still wide |

*(→ PRD-G2; ADR-0111 cl.2 + Consequences "degenerate data … all hand-gated")*
- **AC1** *Given* each row above (DOM-free unit + jsdom), *then* the stated rendering, no exception
  escapes.
- **AC2** *Given* a `type:"number"` column over cells `[42000, "n/a", NaN, null]`, *then* the four
  `<td>`s read `42,000` (en-US locale grouping observable), `n/a`, `—`, `` (empty) — all end-aligned.

**SPEC-R4 — The bound-`rows` update / re-render contract.** The ADR flagged this contract as owed; it
is pinned here (the stamp doctrine's known footgun scaled up — the ui-text `textContent`-clobber
lesson). Setting `columns`, `rows`, or `label` re-renders; the swap is whole-array (A2UI
`updateDataModel` semantics — no append API). The re-render MUST satisfy:

1. **Container identity is stable.** The component-owned scroll container element (SPEC-R5) is created
   once per connection and NEVER replaced by a data update — its node identity persists across any
   `columns`/`rows`/`label` change.
2. **Scroll survives a rows update.** After a `rows` update, the scroll container's `scrollLeft`/
   `scrollTop` MUST NOT be programmatically reset; residual offsets survive (subject only to the
   platform's own clamping when the new content is smaller).
3. **Rebuild is scoped below the container.** `<table>`/`<caption>`/`<thead>` node identity persists
   across a rows-only update; only `<tbody>` content is rebuilt. A `columns` change MAY rebuild
   `<thead>` + `<tbody>`; a `label` change touches only the `<caption>`.
4. **Stated residual (accepted, recorded):** in-cell text selection across a rows update is NOT
   guaranteed (the replaced `<tbody>` drops it) — acceptable for a display-only v1 with no focusable
   cells; the day any interactive cell lands (a fenced re-entry), this clause re-opens.

*(→ PRD-G2; ADR-0111 Consequences "a bound `rows` update's re-render semantics are a mandatory
SPEC/LLD design point")*
- **AC1** *Given* a wide table scrolled to `scrollLeft > 0` (browser leg, both engines), *when* `rows`
  is replaced with a same-shape array, *then* `scrollLeft` is unchanged and the scroll container +
  `<table>` + `<thead>` are the same nodes (identity assertion).
- **AC2** *Given* a `rows` update that grows/shrinks the row count, *then* `<tbody>` reflects it and
  criteria 1–3 still hold.

**SPEC-R5 — Overflow in the component's own container.** A wide table MUST scroll inline *inside the
component's own scroll container*, never the page (ADR-0102 Lane A — overflow is the component's own
identity concern; an unscrollable clipped table is the chooser's destructive branch). A table narrower
than the host fills the host's inline size (no orphaned gutter). Block overflow is not constrained in
v1 (no max-height machinery — a foreseen extension, not a token). *(→ PRD-G2; ADR-0111 cl.3;
ADR-0102)*
- **AC1** *Given* a table whose natural width exceeds a narrow flex/grid parent (browser leg, both
  engines), *then* the component's scroll container overflows (`scrollWidth > clientWidth`) and is
  scrollable, the page's `scrollingElement` does not gain horizontal scroll, and no cell content is
  clipped invisible.

**SPEC-R6 — A11y contract: native semantics carry it.** The stamped table IS the table: header
association, `th` scope, and SR table navigation come from the platform. The component MUST NOT mint
synthetic ARIA on the host — no host `role`, no `aria-label` (the `ElementInternals` fleet law governs
wherever ARIA *is* needed, and here it is not; the host stays a generic container wrapping a real
`<table>`). The `<caption>` is the table's accessible name — which is why `label` renders as a real
caption, not an attribute. *(→ PRD-G2; ADR-0111 cl.3/4)*
- **AC1** *Given* a rendered `ui-table` (browser leg), *then* the `<table>` exposes a computed role of
  `table`, the header cells expose `columnheader`, and the caption text is the table's accessible name.
- **AC2** *Given* the host element, *then* `internals.role` is unset/null and no `aria-*` attribute
  exists on the host.

### 3.2 `ui-stat`

**SPEC-R7 — Component contract.** `ui-stat` MUST be a Display-class, non-interactive,
non-form-associated leaf with exactly four props: `label` (`string`, default `''`), `value`
(`string | number`, default `''` — a finite number renders Intl-formatted; a string passes through
pre-formatted, e.g. `"$1.2M"`; a non-finite number renders the placeholder `—`), `delta` (`number`,
optional — absent/`null`/non-finite ⇒ the delta region is not rendered at all), and `caption`
(`string`, default `''` — absent/empty ⇒ not rendered). The attribute form of `value` resolves to a
`number` when the attribute string parses as one (trimmed, finite), else stays the verbatim string —
so `<ui-stat value="48200">` formats and `<ui-stat value="$1.2M">` passes through. *(→ PRD-G1;
ADR-0111 cl.1/2)*
- **AC1** *Given* `{ label: "Revenue", value: 48200, delta: 12, caption: "vs last month" }` (the
  ADR-0111 cl.2 example), *then* the tile renders all four parts, the value reading `48,200` (en-US
  grouping observable).
- **AC2** *Given* the descriptor (`stat.md`), *then* `tier: display`, `events: []`, attributes mirror
  `static props`.
- **AC3** *Given* `value = NaN` / `delta = NaN`, *then* the value renders `—`, no delta region exists,
  and no exception escapes.

**SPEC-R8 — Rendering: real text, no heading stamp.** The tile is component-built light DOM — label,
value, optional delta, optional caption as real, selectable, token-typed text in a small
component-owned grid (reading order: label → value → delta → caption). The component MUST NOT stamp
any heading element (`h1`–`h6`) — a stat's value is not a document heading; tile typography rides the
`--md-sys-typescale-*` matrix via `--ui-stat-*` tokens (the fake-`h3` idiom retires; ADR-0078's `as`
axis deliberately not consumed). Interior rhythm is component-owned (ADR-0102 Lane A — the tile's own
identity concern). *(→ PRD-G1, PRD-G2; ADR-0111 cl.3)*
- **AC1** *Given* a fully-populated stat, *then* `el.querySelector('h1,h2,h3,h4,h5,h6') === null`.
- **AC2** *Given* the tile in a document outline probe, *then* it contributes zero outline entries.

**SPEC-R9 — Delta: direction as text, never color, never valence.** The delta renders as **glyph +
signed number**: a component-drawn direction glyph (up/down; no glyph when `delta === 0`) that is
`aria-hidden`, plus the Intl-formatted delta with explicit sign (`signDisplay: 'exceptZero'`). The
**direction is announced as text**: the delta region's text content MUST include the direction word —
`up` / `down` / `unchanged` — rendered as visually-hidden-but-announced text preceding the number (a
bare `▲` codepoint is not an announcement; ADR-0111 cl.4). Direction travels by glyph + sign + word —
**never by color**: v1 delta ink is direction-invariant (no automatic green/red; valence is a fenced,
separately-argued extension), which satisfies ADR-0057 structurally — no intent role carries meaning
here. *(→ PRD-G2; ADR-0111 cl.4 + Consequences; ADR-0057)*
- **AC1** *Given* `delta: 12`, *then* the delta region's `textContent` contains `up` and the formatted
  `+12`; the glyph node carries `aria-hidden="true"` and no text. *Given* `delta: -3`, *then* `down`
  and `-3` (locale-formatted). *Given* `delta: 0`, *then* `unchanged`, the formatted `0`, and no glyph.
- **AC2** *Given* the two directions rendered side by side, *then* they differ by glyph orientation +
  sign + word — a computed-style diff of ink colors between them is empty (the ADR-0057 predicate,
  inverted: color is not even a redundant differentiator in v1).

**SPEC-R10 — Whole-shape & rhythm floor.** A bare `ui-stat` in any container (including an unstyled
flex row) MUST paint a visible, non-collapsed tile with zero consumer CSS — its `min-inline-size` floor
and interior gaps are token defaults (ADR-0102 Lane A; geometry-sizing-spec §4.8's generating rule: a
tile whose width would otherwise derive from near-zero content needs an explicit floor). *(→ PRD-G2;
ADR-0102)*
- **AC1** *Given* a bare populated `<ui-stat>` inside an unstyled flex row (browser leg, both engines),
  *then* its bounding box ≥ the token floor — never a sliver (test-the-whole-shape).

### 3.3 `ui-badge`

**SPEC-R11 — Component contract.** `ui-badge` MUST be a compact-realm, **non-interactive** leaf
(`UIElement`; no focus, no keyboard contract, no events, no form participation) with exactly two props:
`label` (`string`, default `''`) and `intent` (`'neutral' | 'info' | 'success' | 'warning' | 'danger'`,
default `neutral`). `intent` is **bindable status data** (ADR-0111 cl.2, fork F3): the catalog row
declares the enum (ADR-0098 validates literal membership), and the **component hardens the bound path**
— any unknown value arriving via property/bind snaps to `neutral` (the enum-prop snap; the validator
sees literals, not data-model values). `intent` reflects to the `[intent]` host attribute so CSS keys
on JS-set/bound values (the ui-text `variant` precedent). One component serves status and neutral
"tag" categorization (= `neutral` intent); chips (dismissible/selectable) are a fenced separate class.
*(→ PRD-G1; ADR-0111 cl.1/2, fork F3)*
- **AC1** *Given* `{ "component": "Badge", "label": "3 failing", "intent": "danger" }` rendered via
  the catalog, *then* a danger badge renders with the label as real text.
- **AC2** *Given* `el.intent = 'bogus'` (a bound-garbage simulation), *then* `el.intent === 'neutral'`
  and `[intent="neutral"]` is reflected.
- **AC3** *Given* the descriptor (`badge.md`), *then* `tier: display`, `events: []`, `keyboard: []`,
  no `size` attribute, attributes mirror `static props`.

**SPEC-R12 — Intent glyph: the ADR-0057 contract, checkable.** Every **non-neutral** intent MUST
render a **component-drawn** glyph (CSS clip-path on a real, `aria-hidden` glyph node — the checkbox
tick precedent; no icon-pack dependency) whose shape is **pairwise distinct** per intent. Hue is the
redundant channel, never the carrier: *if the only difference between two intents is color values, the
surface fails* (ADR-0057's checkable predicate — `ui-badge` is its first live intent-family consumer
and the first `--md-sys-color-warning`/`-info` component consumer). `neutral` renders no glyph — its
non-color distinction is glyph *absence* + neutral (non-intent) roles. The label is real text; no
synthetic ARIA is minted for intent (the label text carries the message; the glyph is visual
redundancy). *(→ PRD-G2; ADR-0111 cl.3/4; ADR-0057)*
- **AC1** *Given* the five intents rendered side by side (browser leg), *then* each non-neutral badge's
  glyph node has a computed `clip-path` differing pairwise, and neutral has no visible glyph.
- **AC2** *Given* any two non-neutral intents with color forcibly removed (e.g. `filter: grayscale(1)`
  emulation or computed-value comparison ignoring color channels), *then* they remain visually distinct
  (shape channel) — the C8 rubric line's first real exercise.
- **AC3** *Given* the glyph node, *then* it is `aria-hidden` and text-free; the badge's announced
  content is exactly the label text.

**SPEC-R13 — Compact-realm geometry.** The badge box rides the widget ramp: block-size =
`--ui-badge-box` off `--ui-compact-{size}` (ADR-0041 — density-invariant, `[scale]`-responsive via the
re-tabled ramp); inline padding = the **compact pad** `2px + box·ratio·density` (the realm's law —
never `h/2`; density rides the pad, not the box); radius = `box / 2` (the realm's own "count pill"
case). The badge's *text* reads the fleet font ramp (`--ui-font-*`) at `line-height: 1` (a single-line
token centers like a glyph) — the ADR-0111 cl.5 resolution of geometry.md's badge dual-listing: box =
compact-realm law, text = fleet font ramp (the booked `geometry.md` repair lands at the build wave).
No `[size]` attribute in v1 (the catalog surface is `label` + `intent`; a size axis is a foreseen
extension). An empty-label badge floors at `min-inline-size = box` (a filled pill/dot, never a
sliver). *(→ PRD-G2; ADR-0111 cl.5; ADR-0041)*
- **AC1** *Given* a rendered badge (browser leg), *then* measured block-size = the `--ui-badge-box`
  token, border-radius resolves to box/2, and `[density]` on an ancestor changes the inline pad but
  not the box.
- **AC2** *Given* `<ui-badge>` with an empty label in a flex row, *then* it paints ≥ box × box.
- **AC3** *Given* the descriptor geometry block, *then* it names the compact ramp and declares no
  `size` attribute and no `--ui-height-*` consumption.

### 3.4 Cross-cutting (all three controls)

**SPEC-R14 — Tokens, defaults, and the CSS-less consumer.** Every rendered-correctness concern has a
component-owned safe default (ADR-0102 Lane A) — the catalog's primary consumer has no CSS verb:
- Component tokens ride the standard specificity-0 `:where()` block, each control declaring only its
  own `--ui-{table,stat,badge}-*` (∪ shared allowlist — the family-coherence gate).
- **Floors:** `--ui-table-min-inline-size` and `--ui-stat-min-inline-size` token floors; badge floors
  at its box (SPEC-R13). A bare, unsized instance of each control in an unstyled flex row paints
  visible, non-collapsed, and correct with zero consumer CSS.
- **Rhythm:** table cell padding and stat/badge interior gaps ride the `--ui-space`/`--ui-gap` ladder
  (density-responsive for free — the ADR-0103 precedent); mark geometry (badge box, glyph sizes, rule
  hairlines) is density-invariant.
- **Ink/AA:** badge label ink vs badge fill MUST hold ≥ 4.5:1 (text is the meaning carrier) for every
  intent × light/dark — probed at the build wave; a failure repoints the token default (a token edit,
  never a mechanism change). Table/stat text rides surface on-color roles (inherits the page's AA
  posture).
*(→ PRD-G2; ADR-0102; ADR-0111 cl.5)*
- **AC1** *Given* each control bare in an unstyled flex row (browser, both engines), *then* each
  bounding box ≥ its floor (test-the-whole-shape).
- **AC2** *Given* the family-coherence token gate, *then* each control's `:where()` block declares
  only its own `--ui-{name}-*` (∪ shared allowlist).
- **AC3** *Given* the AA probe over all five intents × light/dark, *then* badge label-ink : fill
  ≥ 4.5:1.

**SPEC-R15 — Forced colors (WHCM).** All three MUST remain legible under `forced-colors: active`:
table text + row-separator borders survive natively (borders are repainted in system inks, never
removed); the badge keeps its boxed identity via a border and renders its glyph in a system ink (an
explicit `forced-colors` block — a background-drawn clip-path glyph is otherwise forced to `Canvas`
and vanishes, the bar-chart fill lesson); the stat's delta glyph likewise; all stat/table/badge text
is real text and survives untouched. *(→ PRD-G2)*
- **AC1** *Given* forced-colors emulation (browser leg), *then* the badge border + glyph and the stat
  delta glyph paint in system inks (computed-style assertion — the ADR-0102 sanctioned visual proof),
  and table row separators remain visible.

**SPEC-R16 — RTL.** In an RTL context (logical CSS throughout, no physical-direction assumptions):
`ui-table` mirrors — number columns end-align to the *left* (the ADR-0111 Consequences "number
end-alignment must flip" clause), column order follows the platform's native table direction handling,
and the scroll container scrolls in the inline direction; `ui-stat` and `ui-badge` mirror their
grids/slots (glyph at inline-start of the label in both directions). *(→ PRD-G2)*
- **AC1** *Given* `dir="rtl"` (browser leg), *then* a `type:"number"` cell's rendered text position
  mirrors (measured), and the badge glyph sits at the inline-start side.

**SPEC-R17 — Geometry postures.** `ui-table` and `ui-stat` are **Display-class**: no `[size]`
attribute, no `[scale]` geometry row, no control height, no `--ui-height-*`/control-band consumption —
the lever is the type matrix (`--md-sys-typescale-*`) + the space ladder (geometry.md five-class
table; geometry-sizing-spec §4.7's fourth register). `ui-badge` is the **compact realm's** first
shipped roster member (SPEC-R13) — its box is widget-ramp law, not a control height. *(→ PRD-G2;
ADR-0111 cl.5)*
- **AC1** *Given* `[density]` on an ancestor, *then* table cell padding and stat gaps change; badge
  box, glyph sizes, table rule hairlines, and the floors do not.
- **AC2** *Given* the three descriptor geometry blocks, *then* none declares a `size` attribute and
  none consumes `--ui-height-*`.

### 3.5 Catalog + teaching surface

**SPEC-R18 — Catalog rows, same wave.** The default catalog MUST declare `Table`, `Stat`, and `Badge`
in the same wave the descriptors land (SPEC-N2's fleet-derived gate, ADR-0087; intra-wave
seed-and-drain permitted; end-of-wave allowlist residue: none). All three rows are **display-only**:
one-way props, no `value:{prop,event}` mark, no children (table/stat DOM is component-built from data;
badge takes `label`). Row contracts (the `a2ui-catalog.spec.md` §5.2 table gains these rows in the
same change — that table stays the normative coverage home; this SPEC is their derivation):

| A2UI type | `ui-*` widget | Properties |
|---|---|---|
| `Table` | `ui-table` | `columns` (array of `{key: string, label: string, type?: 'string'\|'number'}` objects, **bindable**, `mapsTo: columns`) · `rows` (array of objects — open records keyed by column key, **bindable**, `mapsTo: rows`) · `label` (string, bindable, `mapsTo: label`) |
| `Stat` | `ui-stat` | `label` (string, bindable) · `value` (**union `["string","number"]`** — the conformance validator's `type`-array form, verified against `conformance.ts` `matchesSchemaType`; **bindable**, `mapsTo: value`) · `delta` (number, bindable) · `caption` (string, bindable) |
| `Badge` | `ui-badge` | `label` (string, bindable) · `intent` (enum `neutral/info/success/warning/danger`, **bindable** — status data, ADR-0111 cl.2; literal membership validated per ADR-0098, bound values hardened at the component per SPEC-R11) |

The rows declare full item schemas; the shared validator accepts literal arrays/objects at top-level
`type` depth (deeper per-item checking permitted, not required — component hardening SPEC-R3/R11 is
the safety net either way; a data-model `{path}` bind resolves to the same typed values). *(→ PRD-G1,
PRD-G3; ADR-0111 cl.2/6)*
- **AC1** *Given* the fleet-derived coverage gate over the shipped descriptors, *then*
  `Table` + `Stat` + `Badge` are declared AND factory-bound with zero allowlist residue.
- **AC2** *Given* the ADR-0111 cl.2 example payloads (verbatim), *when* validated via `validateA2ui`,
  *then* 0 `CATALOG` errors; *given* `rows` bound as `{ "path": "/regions" }` with an array in the
  data model, *then* the table renders those records and re-renders on `updateDataModel` under the
  SPEC-R4 contract.

**SPEC-R19 — Feed-partition dispositions (mechanically owed).** The ADR-0097 partition is TOTAL —
landing the three rows turns the partition gate red until each type carries its disposition. The build
wave MUST record, in `feed-catalog.ts`: **`Badge` → `FEED_SURFACE_TYPES`** (light ask furniture, the
`Text`/`Icon` class); **`Stat` → `FEED_EXCLUDED`** with the ADR-0111 cl.7 reason (report content with
no ask affordance — the atomic dashboard tile; fork F4 as recommended, standing); **`Table` →
`FEED_EXCLUDED`** with its reason (dashboard/canvas-scale content — the `List`/`Grid` exclusion a
fortiori). Ask-policy semantics otherwise unchanged. *(→ PRD-G3; ADR-0111 cl.7, fork F4; ADR-0097 +
Amendment)*
- **AC1** *Given* `feed-catalog.test.ts`, *then* the partition gate is green: union = the widened
  catalog's type set exactly, disjoint, all three dispositions present with reasons.

**SPEC-R20 — Teaching: the guidance re-base + exemplars.** The catalog SPEC §5.2 four-way guidance
MUST re-base to *`Stat` for a latest value · `Sparkline` for the shape of a series · `BarChart` for
comparing magnitudes · `Table` when exact values must be scanned row-by-row* — both hand-composed
idioms (`metric tile`, `List` table) leave the official guidance. The report-card exemplar upgrades
its hand-composed tile to `Stat`; a **table-bearing exemplar** joins `allSeeds`; corpus + derived
prompt re-validate over the widened catalog (the ADR-0087 consequence pattern). Per the PRD milestone
split: the §5.2 *rows* land at M1 (SPEC-R18, same change as the code rows); the four-way guidance
re-base + exemplars land at M2. *(→ PRD-G3; ADR-0111 cl.6)*
- **AC1** *Given* the re-based §5.2 Notes, *then* neither "metric tile" (hand-composed) nor "`List`
  table" appears as the four-way rule's answer.
- **AC2** *Given* the upgraded report-card exemplar and the new table-bearing exemplar, *then* each
  validates 0 `CATALOG` errors through `validateA2ui` and renders in the examples surface
  (browser-verified).
- **AC3** *Given* the corpus/derived-prompt gates, *then* they run green over the widened catalog.

## 4. Non-functional requirements

| ID | Requirement | Target |
|---|---|---|
| **SPEC-N1** | Zero runtime dependency, no new package | No table/formatting library, no vendored code; three ordinary `controls/{table,stat,badge}/` folders (ADR-0111 cl.8); shared formatting math = pure DOM-free in-folder modules (the `_chart` precedent); imports point inward only |
| **SPEC-N2** | Cross-engine proof — mandatory browser legs | jsdom cannot prove table paint, scroll geometry, WHCM, RTL positions, or whole-shape boxes — browser legs (Chromium + WebKit) are mandatory per control: whole-shape, scroll-preservation (SPEC-R4 AC1), overflow-in-own-container (SPEC-R5 AC1), forced-colors, RTL |
| **SPEC-N3** | Fleet gates stay green | file-set, family-coherence, descriptor↔props trip-wires, site per-tier page set (`{name}-doc.html` for tier=display), `npm run check && npm test` at every slice boundary |
| **SPEC-N4** | Size budget honesty | `npm run size` run at the build wave (manual, ADR-0040); the family ceiling is 26 KB gz (ADR-0107 Amendment) and likely re-bases — three controls, the table the heaviest; any re-base is recorded as its own note (never silently absorbed); the per-control ≤ ~2 KB gz marginal cap stays the real gate |
| **SPEC-N5** | Data-size cost posture | Rendering is O(rows × columns) over the rendered set with **no row cap and no virtualization** in v1 (a 1 000-row table renders; responsiveness is the author's data-size judgment — virtualization is a fenced re-entry) |

## 5. Open items (non-normative)

- Foreseen extensions, deliberately out of v1 (each re-enters only by its own record, per the PRD §3
  fence): table sorting/selection/pagination/virtualization/column-resizing/cell-renderers · a
  max-height/block-scroll axis · a number-format prop · interactive chips (`Chip` stays reserved) ·
  anchored count-dot badges · a badge `size` axis · a stat trend slot (fork F2's foreseen extension) ·
  delta valence/sentiment (owing its ADR-0057 co-signifier).
- The `geometry.md` badge dual-listing repair (ADR-0111 cl.5 Repairs) lands at the build wave in the
  same change as the badge descriptor.

## 6. Traceability

| Requirement | PRD goal(s) |
|---|---|
| SPEC-R1–R6 | PRD-G1 (the table type exists and behaves), PRD-G2 (native semantics, degenerates, overflow, re-render contract) |
| SPEC-R7–R10 | PRD-G1 (the stat type), PRD-G2 (no heading stamp, direction-as-text, whole-shape) |
| SPEC-R11–R13 | PRD-G1 (the badge type), PRD-G2 (ADR-0057 intent contract, compact-realm geometry) |
| SPEC-R14–R17 | PRD-G2 (tokens, CSS-less consumer, WHCM, RTL, geometry law) |
| SPEC-R18 | PRD-G1 (catalog-reachable), PRD-G3 (rows feed the teaching surface) |
| SPEC-R19 | PRD-G3 (feed dispositions — the M1 gate) |
| SPEC-R20 | PRD-G3 (guidance re-base + exemplars + corpus re-validation) |
| SPEC-N1–N5 | PRD-G2 (zero-dep, cross-engine, gates, size, cost posture) |
