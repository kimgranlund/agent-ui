# ADR-0163 — `ui-table` widens in place: selection + sort + filter + pagination land on the ratified display-only contract (Kim's 2026-07-28 ruling, held to the letter at F1), `ui-pagination` minted

> Source: agent-ui ADR log (this directory — the numbered files ARE the index; status lives in each ADR's own header). · 2026-07-28
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-28 *(authored)* |
> | **Proposed by** | design seat (the M-A `ui-table` widening intake, roadmap §3 — the number 0163 is claimed against a live concurrent-intake field; 0162 is taken, sibling intakes running this session may race the number, collision resolved at index time) |
> | **Ratified by** | kimgranlund (repo owner), 2026-07-29, via the [`ratify ADR-0163` utterance](https://github.com/kimgranlund/agent-ui/issues/316#issuecomment-5113166676) — verified + flipped by `scripts/adr_ratify.py` (ADR-0149) |
> | **Repairs** | on ratification+build: [`../spec/report-family.spec.md`](../spec/report-family.spec.md) (§1/SPEC-R1/R3/R4/R18/§5 amended + SPEC-R21…R28 added — the amendment sheet accompanies this intake) · [`../lld/report-family.lld.md`](../lld/report-family.lld.md) (LLD-C17…C21 — the sheet's C11…C15, renumbered past the IDs the M1/M2 waves already hold) · [ADR-0111](./0111-report-family-v1-scope.md) gains a forward pointer (its cl.1 fence is amended HERE, per its own "any interactive re-entry is a new intake" clause — this is that intake) · `report-family.prd.md` §3 ruled-out list (four items move from fenced to admitted) · `controls/table/{table.ts,table.css,table.md,table-model.ts}` + NEW `controls/table/table-view.ts` · NEW `controls/pagination/**` · a2ui `catalog.json`/`factories.ts` (`Table` row marks + NEW `Pagination` row) + `feed-catalog.ts` disposition · catalog SPEC §5.2 · site pages |
> | **Supersedes / Superseded by** | (none) — **amends** [ADR-0111](./0111-report-family-v1-scope.md) cl.1 (the interactivity fence, by its own fenced-re-entry rule) · relates [ADR-0161](./0161-catalog-multi-slot-two-way-value-marks.md) (the multi-slot value mark the widened `Table` row is the third consumer of) · [ADR-0019](./0019-pull-renderer-lld-c8-two-way-binding.md) (the bindable state-prop + commit-event pattern) · [ADR-0042](./0042-face-widget-value-control-bases.md) (base-class ladder — deliberately NOT taken, cl.3) · [ADR-0087](./0087-a2ui-whole-fleet-catalog-scope-policy.md) (catalog-or-allowlist forces the `Pagination` decision) · [ADR-0097](./0097-a2ui-feed-embedded-asks.md) (partition bookkeeping) · [ADR-0102](./0102-css-less-consumer-contract-law.md) (every capability routed through the three-lane chooser) · [ADR-0111](./0111-report-family-v1-scope.md) (the amended record) |

## Context

The 2026-07-28 roadmap intake (`reports/roadmap-wave-2026-07-28/`) found the fleet's biggest
component gap by its own inventory: **every SaaS data pattern needs selection, sort, filter,
and pagination, and none has a fleet home** — `ui-table` is display-only by ratified contract
(ADR-0111 cl.1; report-family SPEC-R1; realized in `table.md`'s `events: []` / `keyboard:`
notes), and **no pagination control exists anywhere in the fleet** (inv-4 §finding 1, inv-6
§c — the grep's only hits are `ui-swiper-pagination` dots, an unrelated position indicator).

The synthesis recommended minting a separate interactive tier. **Kim ruled the opposite on
2026-07-28: widen `ui-table` itself** — the ruling is settled and recorded in roadmap §3's
M-A entry; this record designs the widening, it does not re-litigate the fork. ADR-0111's own
fence anticipated exactly this door: *"Any interactive re-entry is a new intake, never a
rider"* — this is that intake, arriving with the cost argument the fence demanded.

Standing laws that bound the design: the CSS-less-consumer law (ADR-0102 — the catalog's
primary consumer has no CSS and no glue code, so a capability that needs consumer-side wiring
to be usable from an agent payload effectively doesn't exist for that consumer); ADR-0111
cl.3's load-bearing rationale (**native `<table>` semantics carry the accessibility** — any
widening that forfeits the native table role forfeits the reason the control renders a real
`<table>` at all); SPEC-R4's own clause 4 (*"the day any interactive cell lands (a fenced
re-entry), this clause re-opens"* — it re-opens here); and ADR-0161's just-ratified
multi-slot two-way value marks (a catalog row may now carry one-or-more `{prop,event}`
slots — the seam the widened `Table` row's two-way state rides).

## Decision

**`ui-table` stays one control and widens in place: opt-in row selection, opt-in per-column
sort, opt-in filter/search state, and opt-in pagination land on `ui-table` itself (the
ruling's letter, all four); the QUERY UI for filter composes around it; a new standalone
`ui-pagination` control is minted and the table consumes it internally. The
host stays `UIElement` with the native `<table>` role — the interactive anatomy is stamped
native controls, never `role=grid`. Every capability defaults OFF, and with defaults the
rendered DOM is byte-identical to today's.** Ten clauses; the SPEC/LLD deltas own mechanisms.

1. **The fence moves — four admissions, and only four** *(amends ADR-0111 cl.1)*. Sorting,
   row selection, filtering/search, and pagination move from the ruled-out list to the
   contract (the ruling's letter, held — fork F1). Everything else on the ADR-0111/PRD-§3
   fence **stays fenced**: filter OPERATORS beyond the cl.2 facet shape (ranges,
   comparisons, per-cell expressions), an in-table query input, column resizing, cell
   renderers, virtualization (cl.10), interactive chips, editable cells. Each still
   re-enters only by its own record.
2. **Filter/search — first-class table STATE, composed query UI** *(fork F1, Kim-ruled)*.
   Two bindable props, both control-owned and applied client-side over the rendered set:
   - **`search`** (`string`, default `''`) — free-text row filter. A row survives when the
     needle matches ANY searchable column's **rendered cell text** (the `resolveCell` output
     — "search what you see": the Intl-formatted `42,000` matches `42,0`), matched
     case-insensitively and diacritic-insensitively (fold = `normalize('NFKD')` + strip
     combining marks + `toLocaleLowerCase`, then substring `includes`). A column opts out
     via the column schema's new `searchable?: boolean` (default `true`).
   - **`filter`** (`{ key: string, values: (string | number)[] }[]`, JSON codec, default
     `[]`) — the bounded FACET shape (the dominant SaaS pattern: column ∈ set). A row
     survives when, for EVERY entry, the row's raw cell value for `key` equals one of
     `values` (`String`-coerced strict equality) — OR within a column, AND across columns.
     No operator grammar: ranges/comparisons are deliberately fenced (cl.1) — the unbounded
     surface stays out; the facet shape is validator-friendly and agent-emittable.
   The table renders **no query UI of its own** — no in-table search input (it would drag
   focus/labelling/layout chrome the control shouldn't own, and `ui-text-field` already
   exists): the query surface COMPOSES, and for the CSS-less A2UI consumer the wiring is
   zero-glue by construction — the agent binds a `TextField`'s `value` and the table's
   `search` to the SAME data-model path (two-way in, one-way out; the shared-path idiom).
   Neither prop is user-mutable from inside the table, so neither emits an event and
   neither takes a value-mark slot (cl.9). A filter that yields zero rows renders the
   honest empty `<tbody>` (SPEC-R3 row 2's posture); **no live results-count announcement
   in v1** — a recorded residual (the composing recipe can add a visible/live count; a
   built-in `aria-live` region is a foreseen extension, not this record). The **data-table
   toolbar recipe** survives as the taught COMPLEMENT — `ui-text-field` search +
   `ui-segmented-control` chips now driving the first-class `search`/`filter` props (no
   longer hand-filtering `rows`), clearly subordinate to the mechanism it drives.
3. **ARIA: table, not grid — the correctness crux** *(fork F2)*. The host stays `UIElement`;
   the stamped `<table>` keeps its native role; **`role=grid` is rejected**. Verified against
   the APG (fetched 2026-07-28): a grid is a *composite widget* — one tab stop, author-owned
   roving 2D arrow-key focus over every cell — for content whose primary purpose is
   cell-by-cell interaction; adopting it forfeits native SR table navigation (the entire
   ADR-0111 cl.3 rationale) and takes on a keyboard contract this control doesn't need. The
   APG's own **sortable-table example keeps the native table role**: sortable header text
   wrapped in a real `<button>` inside the `<th>`, `aria-sort` on the currently-sorted `<th>`
   only. Selection likewise stays native: **real `<input type=checkbox>`/`<input type=radio>`
   cells** in a stamped leading selection column — checked state IS the announced selection
   (`aria-selected` is selection-widget vocabulary — grid/treegrid/listbox — not conveyed by
   ATs on plain-table rows; the native input needs none of it). All interactive elements sit
   in the **normal tab order** (the APG grid pattern, same 2026-07-28 fetch: "all focusable
   elements contained in a table are included in the page tab sequence" — re-verify the
   verbatim sentence at ratification) — no roving focus, no `UIListboxElement` (its `role=listbox` + option anatomy
   is the wrong semantic family; `rovingFocus` is a composite-widget mechanism and this is
   deliberately not a composite widget). A 50-row selectable table has 50 checkbox tab stops
   — native-honest, same as a form of 50 checkboxes; recorded as accepted, with the grid
   pattern named as the future escape hatch if a real cell-editing intake ever arrives.
4. **Selection** *(fork F3)*: `selectable ∈ '' | 'single' | 'multi'` (default `''` — off; the
   `''`-first inherit/off canon). `multi` stamps a leading checkbox column plus a header
   **select-all** checkbox (indeterminate when partially selected); `single` stamps a radio
   column (one shared stamped `name`). Selection identity: a **`row-key` prop** names the
   column whose cell values identify rows; absent, identity falls back to the **data-order
   index as a string** (stable across sort/page — they are view transforms — but fragile
   across a `rows` swap, stated honestly in the descriptor; `row-key` is the recommended
   posture for live data). `selected: string[]` (JSON codec, bindable, not reflected);
   commit emits **`select`** (the §4 vocabulary's list-selection commit — never fired by a
   programmatic `selected` write, the fleet's commit law). Selected rows carry
   `data-selected` for CSS; selection styling is token-owned (`--ui-table-row-selected-*`),
   with the checkbox itself as the non-color signifier (ADR-0057 satisfied structurally).
5. **Sort** *(fork F6)*: opt-in per column — `columns[].sortable?: boolean` (the column
   schema widens by one optional field). A sortable header renders its label inside a stamped
   real `<button>` in the `<th>` (the APG shape); activation cycles ascending → descending;
   `aria-sort` rides the sorted `<th>` alone. Sort state is one bindable prop:
   `sort: { key: string, direction: 'ascending' | 'descending' } | null` (JSON codec; the
   direction vocabulary IS `aria-sort`'s — derivable, no translation table). v1 sorting is
   **control-owned, client-side** over the rendered set: number columns compare numerically,
   string columns `Intl.Collator` (numeric-aware), degenerate cells (empty/placeholder) sort
   last in both directions; one sorted column at a time. Commit emits **`change`**. A
   consumer-driven/server-side `sort-mode="manual"` (state + event only, no comparator) is a
   named foreseen extension, not v1 — SPEC-N5's no-virtualization posture already means v1
   data is client-sized.
6. **Pagination — a new control, consumed internally** *(forks F4 + naming)*: the fleet mints
   **`ui-pagination`** — a standalone page navigator (`controls/pagination/`), reusable
   beyond tables (lists, feeds — inv-6 #4's "unlocks workflows fleet-wide"). Props: `page`
   (number, 1-based, default 1), `pages` (number, default 0 — renders nothing until ≥ 2, an
   honest empty state), `label` (string — the accessible nav name). Anatomy: previous/next +
   a windowed page list with ellipsis (fixed window algorithm, no knob in v1), **composing
   `ui-button`** for every stop (reuse — the ADR-0160 action-chip precedent for a component
   stamping `ui-button`); the active page's button carries `aria-current="page"`; host role
   `navigation` via internals with `label` as its accessible name. `tier: pattern`, extends
   `UIElement`, **no new geometry row** (the buttons carry their own §1 geometry; the
   novelty is zero). Commit emits `change`. Naming per naming.md §13: family `pagination` ⇒
   folder `controls/pagination/`, tag `ui-pagination`, class `UIPaginationElement`, tokens
   `--ui-pagination-*`, descriptor `pagination.md`, catalog `Pagination`, pages
   `pagination-{doc,demo}.html`. The §10 concept-canon check surfaces one homonym:
   `ui-swiper-pagination` (the swiper family's position DOTS) — a family-scoped part, a
   different concept; recorded here rather than renamed (the industry/ARIA canon for a page
   navigator is "pagination"; the alternative `ui-pager` rejected as less derivable).
   **`ui-table` consumes it**: `page-size` (number, default 0 — off) + `page` (number,
   1-based, bindable); when `page-size > 0` the table stamps a `ui-pagination` in its own
   footer region (`data-part="footer"`, outside the scroll container) and windows the
   rendered set. Table-internal windowing (rather than consumer-sliced rows) is the
   ADR-0102 Lane-A call: the catalog's agent consumer has no glue code to slice rows with —
   a compose-only pagination story effectively doesn't exist for the primary consumer.
7. **The view pipeline is law**: rendered set (SPEC-R3 hardening, unchanged) → facet
   `filter` → `search` → sort (when `sort` non-null) → page window (when `page-size > 0`) →
   stamped `<tbody>`. The order is normative (filter narrows before sort pays its
   comparator cost; the window always sees the final order). Selection identity is held
   against the **whole rendered set**, view-independent — a selection survives filtering,
   sorting, and paging by construction (a filtered-out selected row STAYS selected; its
   identity simply isn't visible). Select-all operates on the **MATCHING SET** — the
   SPEC-defined term for the rendered set after BOTH narrowing stages, facet filter AND
   search (with neither active it is the whole rendered set) — "select all matching"; the
   header checkbox's checked/indeterminate state is computed against that same universe,
   `pageCount` derives from that same universe's count, and the
   descriptor states all of this. A `rows` swap reconciles `selected` by dropping
   identities that no longer exist (never throwing); a `filter`/`search`/`sort` change
   never mutates `selected`.
8. **Form participation: none** *(fork F5)*. The host stays `UIElement`, not `UIFormElement`
   — a table's selection is transient view state, not a submittable value (no name/value
   pair, no validity, no form reset semantics make sense here), and A2UI two-way binding
   does not require FACE: ADR-0161's renderer input controller listens on the declared event
   and reads the declared prop — `{prop,event}` is the whole seam. A form that needs "the
   selected rows" reads `selected` or listens for `select` — the same seam every consumer
   gets.
9. **Catalog + feed** *(the ADR-0161 consumption)*: the `Table` row widens — `selectable`,
   `rowKey`, `selected`, `sort`, `page`, `pageSize`, `search`, `filter` join as bindable
   props (`search`/`filter` bind ONE-WAY IN only: no user commit inside the table mutates
   them, so they carry no value-mark slot and emit nothing — the shared-path idiom wires
   them to a query control), and the row takes
   the **multi-slot value mark** `[{prop:'selected',event:'select'}, {prop:'sort',event:'change'},
   {prop:'page',event:'change'}]` (slot props distinct ✓, events may repeat ✓ — the third
   array-form consumer after `Calendar`/`SliderMulti`). A NEW **`Pagination` row** enters the
   catalog (ADR-0087 forces catalog-or-allowlist at descriptor-landing; a standalone page
   navigator over a bound list is agent-legitimate) with value slot `{prop:'page',event:'change'}`.
   Feed dispositions (ADR-0097, total partition): **`Pagination` → `FEED_EXCLUDED`**
   (pagination-natured furniture is the class ADR-0111 cl.7 already names as out); `Table`
   stays `FEED_EXCLUDED` (unchanged). §5.2 guidance gains one line: the four-way rule's
   `Table` arm now also answers "…and when the user must pick rows from it".
10. **Migration: byte-identity at defaults — the opt-in law, proven not promised.** With
    `selectable=''`, no `sortable` column, `page-size=0`, `search=''`, `filter=[]`: no
    selection column, no header buttons, no footer, no view transform applied (empty
    filter/search are identity functions with zero stamped anatomy), no new event ever
    fires, and the rendered DOM is **byte-identical**
    to the pre-widening control — proven by a committed-baseline probe (the exact serialized
    DOM of the SPEC fixtures captured from main before the diff, asserted equal after it).
    SPEC-R1's "exactly three props / no events" wording is amended rather than silently
    falsified; SPEC-R4 gains clause 5 (its own clause-4 residual re-opens as promised):
    across a rows-driven `<tbody>` rebuild, if focus was on a stamped interactive cell
    control, focus is restored to the same row-identity's control when it still exists.
    **Virtualization stays explicitly deferred** — pagination is this wave's answer to
    scale; SPEC-N5's no-virtualization, no-row-cap posture stands verbatim.

### Forks for Kim (F1 resolved by ruling; F2–F6 each with a firm recommendation, the default absent an objection)

- **F1 — capability partition. RESOLVED (Kim, 2026-07-28): hold the letter — all FOUR
  capabilities land on `ui-table`** (cl.1/2). This intake's original recommendation was to
  keep filter COMPOSED while admitting the other three, argued from mechanics: selection,
  sort, and pagination each have a table-semantic or CSS-less-consumer forcing condition
  (checkbox column anatomy; `aria-sort`/header-button semantics; Lane-A windowing), while
  filter has neither — the `rows` prop already accepts any filtered array and the query UI
  is unbounded surface. Kim read that recommendation and **overruled it**, ruling the
  recorded letter stands ("selection, sort, filter, pagination land on `ui-table`", roadmap
  §3 M-A entry). The reasoning is preserved here as the considered-and-overruled
  alternative (the ledger keeps both sides); cl.2 realizes the ruling with the deliberately
  bounded shape — filter STATE and application are the table's, the query UI still
  composes, and the unbounded part (operator grammars, an in-table input) stays fenced by
  cl.1.
- **F2 — table vs grid.** *Recommend: native table role, stamped native controls, normal tab
  order; grid rejected* (cl.3) — the APG-verified call; grid would forfeit ADR-0111 cl.3's
  entire rationale.
- **F3 — selection identity.** *Recommend: `row-key` column designation with data-order-index
  fallback* (cl.4). Pure index selection silently rebinds across a `rows` swap; requiring
  `row-key` always would break the zero-config agent payload.
- **F4 — pagination vehicle.** *Recommend: mint standalone `ui-pagination` AND consume it
  internally via `page-size`* (cl.6). Standalone-only fails the CSS-less consumer;
  internal-only wastes the control the fleet measurably lacks.
- **F5 — form participation.** *Recommend: none — `UIElement` stands* (cl.8).
- **F6 — sort ownership.** *Recommend: control-owned client-side comparator in v1;
  `sort-mode="manual"` a named foreseen extension* (cl.5).

## Consequences

- **ADR-0111's fence is amended, not broken**: the re-entry arrives by its own record exactly
  as cl.1 demanded; ADR-0111 gains a forward pointer at ratification (never a Status change —
  it remains accepted; only its cl.1 list is narrowed by this record).
- **SPEC-R4 cl.4's accepted residual is discharged**: focus preservation across `<tbody>`
  rebuilds becomes a contract (SPEC delta R4.5) — the whole-array-swap mechanism stays, with
  identity-keyed focus restoration layered on it, not a reconcile rewrite.
- **The table stops being the family's simplest control**: size re-measured at the build wave
  (`npm run size`); the family ceiling (26 KB gz, ADR-0107 Amendment) likely re-bases —
  recorded, never silently absorbed; the per-control ≤ ~2 KB marginal cap is the real gate
  and the interactive legs must fit it or the re-base is argued explicitly.
- **The predictable next asks are pre-fenced**: editable cells, column resize, sticky
  columns, server-side sort, filter operators (ranges/comparisons), an in-table search
  input, a live results-count region, virtualization — each a new intake; this record's
  cl.1 list is the new fence line.
- **Zero-result filters announce nothing in v1** — a recorded residual (cl.2): the empty
  `<tbody>` is visually honest but silent to SR users; the composing recipe teaches a
  visible results count, and a built-in `aria-live` region is the named foreseen extension.
- **Stale → re-verify at build**: `table.md` (events/keyboard/customStates/parts all change) ·
  report-family SPEC/LLD · PRD §3 · catalog `catalog.json`/`factories.ts`/§5.2 ·
  `feed-catalog.ts` + partition gate · the descriptor↔props trip-wire · site table pages ·
  the `agent-ui-component-patterns` row for selection patterns.

## Acceptance

Intake (this change): this record `proposed` + indexed; the SPEC/LLD delta sheets +
decomposition accompany it (coverage of every clause); independent doc review PASSED.
Build wave (post-ratification, separately dispatched): the byte-identity probe green (cl.10);
real-engine interaction probes both engines (sort click → `aria-sort` + reorder; selection
commit via keyboard incl. select-all indeterminate over the matching set; search/facet
filtering incl. the filter→search→sort→page interplay and selection persistence across a
filter; page change; focus restoration across a `rows` update; scroll preservation SPEC-R4
AC1 still green with interactive anatomy on);
a11y probes (native `table` computed role retained with every capability enabled; `aria-sort`
on exactly one `<th>`; `ui-pagination` announces as a labeled navigation with
`aria-current="page"`); catalog gates green (multi-slot mark validates; `Pagination` row +
feed disposition; corpus/derived-prompt re-validate); `npm run check && npm test` +
browser shards green.

## Alternatives considered

- **A separate interactive tier (`ui-data-table`)** — the synthesis's recommendation.
  Overruled by Kim 2026-07-28 (roadmap §3 records the override deliberately); not
  re-litigated here. The mechanics Kim's ruling buys: one control, one descriptor, one
  catalog row, no display-vs-interactive chooser to teach agents, no duplicated
  stamp/scroll/degeneracy machinery.
- **`role=grid` + roving focus (`UIListboxElement`/composite-widget route).** Rejected —
  cl.3; forfeits native table semantics, adopts a 2D keyboard contract built for
  cell-by-cell interaction this control doesn't have.
- **`aria-selected` on rows.** Rejected — selection-widget vocabulary ATs do not convey on
  plain-table rows; the native
  checkbox's checked state is the honest, platform-announced selection carrier.
- **Selection as a form value (`UIFormElement`).** Rejected — cl.8; no submit/validity/reset
  semantics apply, and ADR-0161's seam needs only `{prop,event}`.
- **Positional/index-only selection identity.** Rejected as the only mode — silent rebinding
  across data swaps; kept only as the zero-config fallback under `row-key`'s absence.
- **Composite `{sortKey, sortDirection}` scalar prop pair.** Rejected — two props that are
  only valid together; the single JSON `sort` prop is atomic by construction (the ADR-0161
  Calendar-range lesson applied preemptively).
- **Filter composed-around only (this intake's original F1 recommendation).** Considered
  and OVERRULED by Kim, 2026-07-28 — the ruling's letter held (F1); its mechanics are
  preserved in the F1 entry. cl.2's bounded realization keeps what that argument protected:
  no operator grammar, no in-table query UI.
- **An operator-bearing `filter` grammar (ranges, comparisons, expressions).** Rejected —
  the genuinely unbounded surface; the facet shape covers the dominant pattern and anything
  richer re-enters by its own record (cl.1).
- **An in-table search input.** Rejected — drags focus/labelling/layout chrome into the
  control while `ui-text-field` already exists; the A2UI shared-path binding makes the
  composed wiring zero-glue (cl.2).
- **Table-internal pagination only (no standalone control).** Rejected — the fleet's
  measured gap is a *reusable* page navigator; burying it in the table re-creates the gap
  for lists.
- **`ui-pager` as the tag.** Rejected — less derivable than the ARIA/industry canon
  "pagination"; the swiper-dots homonym is family-scoped and non-colliding.
