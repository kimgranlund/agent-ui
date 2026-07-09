# ADR-0111 — Report family v1 scope: `ui-table` + `ui-stat` + `ui-badge` — static display vocabulary, the native-`<table>` stamp, the compact realm's first consumer, same-wave catalog rows

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-08
>
> | Field | Value |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-07-08 *(authored)* |
> | **Proposed by** | planner (design seat — the report-family intake, coordinator-dispatched on the §5.2 idiom evidence; the number 0111 is coordinator-RESERVED against the concurrent-intake numbering race that left the 0108 hole — sibling intakes hold 0112/0113–0114) |
> | **Ratified by** | — *(pending Kim; a hook enforces proposed→accepted is Kim's, never the author's. The `ui-table` native-`<table>` direction in cl.3 records reasoning Kim pre-ratified in conversation this session; the scope bundle as a whole still awaits his ratification)* |
> | **Repairs** | NEW [`../prd/report-family.prd.md`](../prd/report-family.prd.md) (authored in this same change — the owning doc whose §3 scope + goals this ADR pins) · on ratification+build: `a2ui-catalog.spec.md` §5.2 (three new rows + the four-way guidance **re-base** — cl.6) · `tools/agent/feed-catalog.ts` + its partition gate (the ADR-0097 total-partition bookkeeping — cl.7) · `references/geometry.md` (the badge dual-listing reconcile — cl.5) · the examples shelf (report-card tile upgrade + a table-bearing exemplar — cl.6) |
> | **Supersedes / Superseded by** | (none) — relates [ADR-0107](./0107-chart-family-v1-scope.md) (the sibling intake whose shape and fence discipline this record clones; its report-card exemplar is what this family upgrades) · [ADR-0087](./0087-a2ui-whole-fleet-catalog-scope-policy.md) (the whole-fleet catalog gate cl.6 obeys) · [ADR-0097](./0097-a2ui-feed-embedded-asks.md) + its Amendment (the feed partition is TOTAL — cl.7 pays the bookkeeping 0107's cl.8 wording initially dodged) · [ADR-0057](./0057-intent-non-color-signifier-rule.md) (its Consequences name "any badge/alert/toast/tag family" as the forward trigger where the rule first bites — `ui-badge` is that trigger arriving) · [ADR-0102](./0102-css-less-consumer-contract-law.md) (every prop decision here routed through the three-lane chooser) · [ADR-0041](./0041-widget-box-geometry-subsystem.md) (the compact-realm ramp `ui-badge` consumes) · [ADR-0078](./0078-ui-text-three-axis-variant-size-as.md) (the as-stamp doctrine cl.3 scales up; the type tokens table/stat read) |

## Context

Three verified facts force this intake — each a **taught idiom papering over a missing type**:

- **The table gap is recorded in the fleet's own guidance.** The catalog SPEC §5.2 four-way rule
  (ADR-0107 cl.6) routes "exact values must be scanned row-by-row" to *"a `List` table"* — the official
  answer to a tabular ask is *hand-compose one from `List`/`Row`/`Text`*. That composition has no header
  association, no `th` scope, no screen-reader table navigation, no typed cells; the guidance line
  (`a2ui-catalog.spec.md:210`) is the evidence, exactly as B6's "the catalog has no Chart type" note was
  for ADR-0107.
- **The metric tile is the corpus's most-taught composition with no component behind it.** At least three
  seeds hand-assemble caption-label + `h3`-variant value in a Card (`patterns.ts:183-187`,
  `catalog-coverage.ts:319-323`, `stats-grid-dashboard`) — and each fakes a document heading for
  typography, polluting the outline with headings that head nothing (the `variant:'h3'` rows carry
  heading *style*; ADR-0078 deliberately split semantics onto the separate `as` axis these tiles do not
  and should not use).
- **Status vocabulary was never ported.** `geometry.md`'s compact realm names `tag · badge · chip` in its
  always-compact roster (precursor-fleet provenance) with zero shipped controls behind them — and
  ADR-0057 names "any badge/alert/toast/tag family" as the forward trigger where the non-color-signifier
  rule first bites. Today a hue-only status `Text` is the only move a model has, and it is unshippable by
  that rule: the fleet has no *legal* compact status surface at all.

Two standing laws bound the solution space. **(1) The CSS-less-consumer law (ADR-0102):** the catalog's
primary consumer has no CSS verb, so every rendered-correctness concern here — table overflow, tile
rhythm, badge geometry — must resolve to a lane, never to "the page author styles it."
**(2) ADR-0057:** intent and direction may never travel by color alone — a constraint that shapes both
the badge contract and the stat delta from birth. And one scope law carries over from ADR-0107 verbatim:
**scope explodes at interactivity** — sorting, selection, pagination, dismissible chips are where a
"small display type" becomes an application framework; the v1 boundary is defensible only where the
component is pure display.

## Decision

**We will admit a report/status family into the fleet — `ui-table` + `ui-stat` + `ui-badge`, all
display-only, entering the default catalog in the same wave they ship — with the table rendered as a
real native `<table>` stamped in light DOM.** One decision — the v1 scope + contract directions —
realized in eight clauses; SPEC/LLD own the mechanisms at build (PRD-G1/G2/G3 trace).

1. **The v1 type set** *(PRD-G1)*: `ui-table` (a **static data table** — typed columns, record rows,
   exact values scanned row-by-row), `ui-stat` (label + value + optional delta + optional caption — the
   metric tile as a component), `ui-badge` (a compact, **non-interactive** status/label token with intent
   roles). Ruled out for v1, with the fence in PRD §3: table sorting/selection/pagination/virtualization/
   column-resizing/cell-renderers; interactive (dismissible/selectable) chips; anchored count-dot
   badges; a stat child seam; delta valence coloring. Any interactive re-entry is a **new intake**, never
   a rider — the ADR-0107 fence discipline applied to interactivity instead of axes.
2. **Data contracts a model can emit as JSON** *(PRD-G1; fork F1)* — the BarChart array-prop precedent
   (`{path}`-bindable arrays; the row declares the nested item schema; the shared validator checks
   literal arrays/objects at top-level `type` depth only, component hardening is the safety net —
   the catalog SPEC §5.2 BarChart row's recorded posture; NOTE a BOUND `Badge.intent`'s enum
   membership likewise falls to component hardening — the ADR-0098 validator leg sees literals, not
   data-model values):
   - `ui-table`: `columns: { key: string; label: string; type?: 'string' | 'number' }[]` +
     `rows: Record<string, string | number>[]` + optional `label` (→ the rendered `<caption>`), e.g.
     `{ "component": "Table", "label": "Revenue by region", "columns": [{ "key": "region", "label": "Region" }, { "key": "revenue", "label": "Revenue", "type": "number" }], "rows": [{ "region": "EMEA", "revenue": 42000 }, { "region": "APAC", "revenue": 31000 }] }`.
     Cells are `string | number` at v1; `type: "number"` columns render end-aligned, Intl-formatted (the
     bar-chart printed-value precedent). A missing key renders an empty cell; degenerate data never
     throws (the chart-family degenerate posture) — and degeneracy includes VALUES, not just structure:
     a non-finite number (`NaN`/`±Infinity`), `null`, or a type-mismatched cell (a string in a
     `type:"number"` column) each gets a defined rendering, pinned at SPEC (the chart SPEC-R3/R7
     value-row discipline).
   - `ui-stat`: `label: string` + `value: string | number` (number → Intl-formatted; string passes
     through pre-formatted, e.g. `"$1.2M"`) + `delta?: number` + `caption?: string`, e.g.
     `{ "component": "Stat", "label": "Revenue", "value": 48200, "delta": 12, "caption": "vs last month" }`.
   - `ui-badge`: `label: string` + `intent: 'neutral' | 'info' | 'success' | 'warning' | 'danger'`
     (default `neutral`), e.g. `{ "component": "Badge", "label": "3 failing", "intent": "danger" }`.
     Both bindable — intent is status *data* (it exists to reflect changing state), not structural
     presentation, so it takes the bindable-enum path (ADR-0076/0098 validate membership), unlike
     Sparkline's structural `variant`.
3. **Rendering follows the semantics — the stamp doctrine scales up** *(PRD-G2; the load-bearing call —
   reasoning Kim pre-ratified in conversation)*: `ui-table` renders a **real native `<table>`** in light
   DOM from its data — `<caption>` (from `label`), `<thead>` with `th scope="col"`, `<tbody>` rows — the
   ui-text `as`-stamp precedent (ADR-0078 cl.4: "a stamped `<h4>` IS the heading") applied to tabular
   semantics: the stamped table IS the table, so header association, `th` scope, and SR table navigation
   come free from the platform. The component owns the data contract, the `@scope`d styles, and the
   **overflow-in-own-container law**: a wide table scrolls inline *inside the component's own scroll
   container*, never the page (ADR-0102 Lane A — overflow is the component's own identity concern; the
   chooser's destructive branch: an unscrollable clipped table is not a graceful failure). `ui-stat` is
   real DOM text in a small component-owned grid — **no heading stamp** (tile typography rides the
   typescale tokens; the fake-`h3` idiom retires; a stat's value is not a document heading). `ui-badge`
   is an inline token whose intent glyph is **component-drawn** (the checkbox clip-path tick precedent —
   no icon-pack dependency for a built-in signifier).
4. **What each type announces** *(PRD-G2)*: `ui-table` — **native table semantics carry it**; no
   synthetic ARIA is minted on the host (the platform table is the accessibility tree entry; ARIA via
   `ElementInternals` stays the fleet law wherever ARIA is actually needed, and here it is not).
   `ui-stat` — label, value, and delta are real text; the delta's **direction is announced as text**
   (e.g. "up 12") with the visual glyph aria-hidden — a bare `▲` codepoint is not an announcement.
   `ui-badge` — the label is real text; the intent glyph co-carries meaning visually per ADR-0057's
   checkable contract: *if the only difference between two intents is color values, the surface fails* —
   so every non-neutral intent renders its glyph, and hue is the redundant channel, never the carrier.
5. **Geometry: two Display citizens + the compact realm's first consumer** *(PRD-G2)*: `ui-table` and
   `ui-stat` are **Display-class** (text-bearing — cells/labels/values read the
   `--md-sys-typescale-*`/`--ui-font-*` matrices; no control height, no `h/2` law; rhythm rides
   `--ui-{table,stat}-*` tokens declared in the standard `:where()` block). `ui-badge` is a
   **compact-realm widget** (ADR-0041): box off the `--ui-compact-{size}` widget ramp, the compact pad
   `2px + box·ratio·density`, pill radius = box/2 (the realm's own "count pill" case) — the realm's
   roster finally gains its first shipped `badge`. `geometry.md` currently lists `badge` in **both** the
   Display-class examples and the compact-realm roster; this ADR resolves the dual listing — the badge's
   *box* is compact-realm law, its *text* reads the fleet font ramp — and books the doc repair (Repairs).
6. **Catalog + teaching, same wave — and the guidance stops teaching the workaround** *(PRD-G1/G3)*: the
   SPEC-N2 fleet-derived gate (ADR-0087) forces catalog-or-allowlist the moment a descriptor lands, so
   the build wave lands `Table` + `Stat` + `Badge` rows **in the same wave** as the controls (intra-wave
   seed-and-drain permitted; end-of-wave residue: none). All three are display-only rows — no
   `value:{prop,event}` mark, no children (table/stat DOM is component-built from data; badge takes
   `label`). The wave **re-bases the §5.2 four-way guidance** to *`Stat` for a latest value ·
   `Sparkline` for the shape of a series · `BarChart` for comparing magnitudes · `Table` when exact
   values must be scanned row-by-row* — both hand-composed idioms leave the official guidance — and
   upgrades the report-card exemplar's hand tile to `Stat` plus lands a table-bearing exemplar
   (PRD-G3; the ADR-0087 Fork-A "guidance is an acceptance item" discipline).
7. **Feed-partition dispositions — mechanically owed, recommended here** *(fork F4)*: the ADR-0097
   partition is TOTAL — landing the cl.6 rows turns the gate red until each type carries IN or OUT + a
   reason (the 0107 Amendment-2 lesson: the bookkeeping is *owed*, never waved off). Recommended:
   **`Badge` IN** (a compact label token in the `Text`/`Icon` class of light ask furniture — e.g.
   marking one option "recommended" in a choice ask; no overlay/pagination/dashboard nature) ·
   **`Stat` OUT** (report content with no ask affordance — the Sparkline/BarChart Amendment-2 reasoning;
   a stat is the atomic unit of the dashboard idiom the partition exists to keep out of ask bubbles;
   an ask that needs a number in prose has `Text`) · **`Table` OUT** (dashboard/canvas-scale content —
   the recorded `List`/`Grid` exclusion reasoning applies a fortiori to a data table). Applied in
   `feed-catalog.ts` at the build wave; ask-policy semantics unchanged.
8. **Packaging: no new package, no new pattern** — three ordinary `controls/{table,stat,badge}/` folders
   (the ADR-0107 cl.7 reasoning holds unchanged: no vendored data mass, no layering-trip-wire widening
   for small controls). Any shared table/stat formatting math lands as a pure, DOM-free module in-folder
   (the `_chart` precedent), unit-testable without a browser.

### Forks for Kim (each with a firm recommendation; the recommendation is the default absent an objection)

- **F1 — the table `rows` shape.** *Recommend: records keyed by column key*
  (`rows: [{ "region": "EMEA", "revenue": 42000 }]`, cl.2). Self-describing JSON a model emits naturally
  (it already thinks in objects), resilient to column reordering, and consistent with `BarChart`'s
  named-field posture. The alternative — positional `rows: (string | number)[][]` — is more compact but
  couples every cell to column *order*: one silently transposed column corrupts the whole table with no
  validator-visible error, and the payloads are unreadable in the corpus/judge surfaces.
- **F2 — the stat composition seam.** *Recommend: no child seam in v1* — a sparkline beside/inside a
  stat is **pure composition** (`Column`/`Row` of `Stat` + `Sparkline` in a Card — the report-card
  exemplar's own shape). The ADR-0102 chooser resolves this cleanly: the grammar *can* express the
  pairing by composition, and the no-uptake failure is graceful (a stat without a sparkline is a
  complete, correct tile) — Lane C, taught through the exemplar. A `ChildList` seam would make `Stat` a
  container, un-typing its anatomy and inviting arbitrary content inside a semantic tile. The foreseen
  extension if composed pairs prove misaligned in practice: a named trend slot, its own intake.
- **F3 — the badge/tag/chip boundary.** *Recommend: one non-interactive `ui-badge`; chips fenced.* One
  component serves both "status" (intent-bearing) and "tag" (neutral categorization = `neutral` intent)
  — the anatomy is identical and a `variant` would duplicate what `intent` already expresses.
  **Interactivity is the real class boundary**: a dismissible/selectable chip needs focus, a keyboard
  contract, and value semantics (the ADR-0042 bases) — a different component class, not a badge variant.
  The catalog name is `Badge` (the vocabulary models know); `Chip` stays reserved for the fenced
  interactive intake.
- **F4 — the `Stat` feed disposition.** *Recommend: OUT* (cl.7) — **against the intake dispatch's
  initial "likely IN" lean**, so it is surfaced rather than silently resolved. The mechanics: the
  partition's exclusions are argued from *content class*, not interactivity alone — Sparkline/BarChart
  went OUT as "report content with no ask affordance" (0097 Amendment) even though each is a single
  display mark, and a stat is the same class (the atomic dashboard tile). The IN alternative (decision
  context inside a confirm ask, e.g. "current spend: $432 ↑ — continue?") is real but already served by
  `Text`, and admitting the tile invites `Column`-of-`Stat` mini-dashboards inside ask bubbles — the
  exact surface the partition bans. A one-line, gate-visible edit if Kim rules IN.

## Consequences

- **The fleet owns table correctness with no library and no `<table>` abstraction to blame.** Degenerate
  data (empty `rows`, empty `columns`, missing keys, ragged records, huge unbroken cell strings), RTL
  (number end-alignment must flip), forced-colors, and the overflow container are all hand-gated;
  jsdom cannot prove scroll or paint, so **browser legs are mandatory**, both engines (the chart-family
  discipline).
- **A bound `rows` update's re-render semantics are a mandatory SPEC/LLD design point** — the stamp
  doctrine's known footgun scaled up (the ui-text `textContent`-clobber lesson): a naive full re-stamp
  resets the overflow container's scroll position, drops in-cell text selection, and would drop focus
  the day any interactive cell lands. The SPEC owes the update contract; the build owes a browser leg
  pinning "a bound `rows` update does not silently reset the overflow scroll."
- **The light-DOM cascade + UA table styles are a build-wave concern** — a stamped native `<table>`
  carries UA defaults (border-collapse, cell padding) and sits exposed to page-global element rules;
  the component's `@scope` block must own the reset the way the cl.4 `font: inherit` reset owns text
  stamps.
- **The catalog surface grows by three display types** — corpus, eval shards, and the derived prompt
  re-validate over the widened catalog (the ADR-0087 consequence pattern), and the §5.2 guidance
  re-base means models must be re-taught the four-way rule with the new vocabulary (an acceptance item,
  not decoration).
- **The v1 fence will be pushed** — "just add sorting" is the predictable next ask, as "just add a
  y-axis" was for charts. The PRD §3 ruled-out list is the fence; every interactive re-entry is a new
  intake with its own cost argument.
- **Delta valence is deliberately not encoded** — v1 renders direction (glyph + sign), never
  goodness: "up is good" is false for churn-class metrics, and a wrong automatic green/red is worse
  than none. The foreseen extension is a valence/sentiment prop (its own intake) that would then owe
  its ADR-0057 co-signifier.
- **`ui-badge` is the first live ADR-0057 intent-family consumer** — the first component consumer of
  `--md-sys-color-warning`/`-info` (ADR-0057: "in scope at first consumer") and the first real exercise
  of the C8 rubric line; the component-reviewer's non-color-signifier check stops being theoretical.
- **The family size budget (26 KB, ADR-0107 Amendment 1) likely re-bases again** — three new controls,
  the table the heaviest (DOM building + Intl formatting); measured at the build wave (`npm run size`,
  the manual ADR-0040 discipline), not guessed here. The per-control ≤~2 KB marginal cap stays the real
  gate.
- **Stale → re-verify at the build wave:** catalog `catalog.json`/`factories.ts`/`index.test.ts` ·
  catalog SPEC §5.2 rows + the four-way guidance Notes · `feed-catalog.ts` + its partition gate ·
  `references/geometry.md` (the cl.5 dual-listing repair) · the examples barrels/`allSeeds` + corpus +
  derived prompt · the report-card exemplar (tile → `Stat`).

## Acceptance

This is an **intake** ADR — realized in two stages:

- **Intake (this change):** the sibling PRD exists with gates green (`harness_checks.py prd` exit 0);
  this record passes `adr_check.py` and is indexed; the intake decomposition
  ([`report-family-intake.decomp.json`](../decompositions/report-family-intake.decomp.json)) is
  coverage-clean (`coverage_check.py --strict` exit 0); the four forks carry firm recommendations
  awaiting Kim; doc-review is dispatched on both records. No code changes.
- **Build wave (M1/M2, separately dispatched):** descriptors land WITH same-wave catalog rows — SPEC-N2
  fleet-derived gate green, allowlist residue none; the ADR-0097 partition gate green with all three
  dispositions recorded; an a11y probe per type (a rendered `ui-table` exposes real
  `table/caption/th[scope]` semantics; a stat's delta direction is announced as text; every non-neutral
  badge intent renders its non-color glyph — the ADR-0057 predicate); whole-shape browser legs (a wide
  table scrolls inside its own container while the page does not scroll; a bare stat/badge paints
  visible and non-collapsed in a flex row) pass both engines; degenerate-data legs (empty rows/columns,
  missing keys, ragged records) render non-throwing output; the §5.2 guidance re-base + the upgraded
  exemplar validate 0-`CATALOG`-error through `validateA2ui`.

## Alternatives considered

- **ARIA table/grid semantics on styled `div`s (the "flexible markup" route).** Rejected: it hand-builds
  what the platform gives free — header association, `th` scope, SR table navigation are exactly the
  things ARIA-on-divs implementations get subtly wrong per engine; the fleet would own that correctness
  forever. The stamp doctrine (ADR-0078 cl.4) already establishes the honest alternative: render the
  real element.
- **Teach the List-composed table harder (Lane C) instead of shipping a type.** Rejected by the
  ADR-0102 chooser itself: the catalog grammar *cannot express* header-cell association or table
  semantics by composition at all (the Lane A forcing condition), and the failure is not graceful — to
  an AT user a fake table is destructive, not cosmetic. The §5.2 guidance line is the measured evidence
  of Lane C already at its limit.
- **Extend `List` with a `columns`/table mode.** Rejected: `List` carries `role=list` — homogeneous
  itemized collections; grafting table semantics onto it forks one component across two ARIA structures
  and bloats a shipped contract (the one-folder-one-contract law; the ADR-0107 generic-`ui-chart`
  rejection relocated).
- **One generic `ui-data-view type="table|stat|…"`.** Rejected on ADR-0107's own grounds: a single
  component wearing N display types accretes every type's option surface into one folder — the
  explosion relocated, not avoided; per-type components stay small, tree-shakeable, separately gateable.
- **Markdown tables through `ui-text`.** Rejected: `ui-text` renders textContent, not markdown — and
  even with a parser this smuggles an unvalidatable string grammar past the catalog's typed-prop
  posture (no typed cells, no Intl, no `{path}` binding into cells).
- **Badge as a `Text` variant/prop.** Rejected: the Text row already carries five orthogonal axes
  (ADR-0109) and none of them is a *boxed compact token* — badge geometry is compact-realm law
  (box/pad/pill), not typography; and the intent contract (glyph co-signifier) has no home in a text
  run.
- **Positional `rows` arrays** (fork F1's alternative). Rejected as default: column-order coupling
  makes a transposed column a silent data corruption no validator sees; records fail loudly (missing
  key → empty cell) and read honestly in the corpus.
- **Interactive chips in v1.** Rejected: dismiss/select drags focus, keyboard, and value semantics —
  a different component class (ADR-0042); shipping it as a badge variant would re-run the
  segmented-control identity lesson (ADR-0092/0095) in reverse.
- **Automatic delta valence coloring (green up / red down).** Rejected: direction ≠ goodness (churn,
  cost, latency); a wrong automatic valence is a lying dashboard. Direction-only v1; valence is a
  foreseen, separately-argued extension.
