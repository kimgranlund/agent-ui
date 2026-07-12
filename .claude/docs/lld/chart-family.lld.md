# LLD — Chart Family (`ui-sparkline` + `ui-bar-chart`, catalog rows, report-card exemplar)

> Refines: [`../spec/chart-family.spec.md`](../spec/chart-family.spec.md) (SPEC-R1…R14, SPEC-N1…N4) under
> [ADR-0107](../adr/0107-chart-family-v1-scope.md) (accepted). Build plan:
> [`../decompositions/chart-family-build.decomp.json`](../decompositions/chart-family-build.decomp.json)
> (coverage-clean, plan mode). · proposed · 2026-07-08 · planner
>
> **Composes on:** `UIElement` (`dom/element.ts`) + the props/signal system (`dom/props.ts`) + `ElementInternals`
> ARIA (fleet law). **No new package** (ADR-0107 cl.7): two ordinary control folders,
> `controls/sparkline/` and `controls/bar-chart/`; the pure math is co-located per control (the in-folder
> pure-core split — ADR-0065's *pattern*, not its packaging). Catalog work lands in
> `packages/agent-ui/a2ui/src/catalog/default/`; the exemplar in `a2ui/src/examples/`.
>
> **Freeze discipline.** §2/§4 interfaces are the fan-out contract. A builder who cannot satisfy a frozen
> interface STOPS and escalates — the fix is a coordinated LLD/decomp repair, never a local deviation.

## 1 · Intent

Implement the axis-free v1 chart family: a normalized-SVG sparkline whose whole contract is "show the
shape of this series in any box," and a CSS-grid bar list whose whole contract is "make these magnitudes
comparable at a glance with the printed value as the datum." Then make both catalog-reachable in the same
wave (`Sparkline`, `BarChart`) and teach the idiom with the report-card exemplar. Everything the marks do
is derived, display-only state — no events, no focus, no form participation.

## 2 · `ui-sparkline` (SPEC-R1…R4)

### LLD-C1 — the pure math (`controls/sparkline/sparkline-math.ts`, DOM-free)

```ts
import type { PropConfig } from '../../dom/props.ts'

export interface SparklineGeometry {
  points: string        // SVG polyline `points` in the 0..100 × 0..100 viewBox (y grows DOWN)
  area: string | null   // the closed fill polygon's points (line + `100,100 0,100`); null when count < 2
  count: number
  first: number; last: number; min: number; max: number   // facts over the RENDERED set (the summary's inputs)
}

/** Hardening (SPEC-R3): non-array → []; entries kept only if `typeof v === 'number' && Number.isFinite(v)`. */
export function cleanSeries(input: unknown): number[]

/** null when the clean series is empty. Coordinates rounded to 2 decimals (stable strings for tests). */
export function sparklineGeometry(values: readonly number[]): SparklineGeometry | null

/** The SPEC-R4 sentence — exact wordings, Intl.NumberFormat (default locale, module-memoized) numbers:
 *  n≥2: `{n} points, starts {first}, ends {last}, low {min}, high {max}` · n=1: `1 point, value {v}`
 *  · n=0/null: `no data`; a non-empty label prefixes as `{label}: {summary}`. */
export function sparklineSummary(label: string, g: SparklineGeometry | null): string

/** The safe values codec (SPEC-R3 row 1): `from(attr)` = null → [], JSON.parse in try/catch → [] on
 *  throw, then cleanSeries; `to` = JSON.stringify. dom/props.ts jsonType is NOT used — its bare
 *  JSON.parse throws on malformed attributes and maps a removed attribute to `null`, both of which
 *  SPEC-R3 forbids reaching the render path (verified against props.ts:73-82). */
export const sparklineValuesProp: PropConfig<number[]>
```

Mapping math (all inputs pre-cleaned; `n = values.length`):
- `x(i) = n === 1 ? 50 : (i / (n - 1)) * 100` — ordinal spacing by index (SPEC §2 "Series").
- `span = max - min`; `y(v) = span === 0 ? 50 : 100 - ((v - min) / span) * 100` — auto range; all-equal
  ⇒ the flat mid-height line (SPEC-R3 row 4); negatives fall out of the same formula (row 5).
- `n === 1` ⇒ `points` = the single coordinate **duplicated** (`"50,{y} 50,{y}"`): with
  `stroke-linecap: round` a zero-length segment paints as a round dot of stroke-width px — the visible
  point mark (SPEC-R3 row 3) with no second element kind and no ellipse distortion under
  `preserveAspectRatio="none"`.
- `area` = `points + " 100,100 0,100"` (closed to the bottom edge); built only when `n ≥ 2`.

### LLD-C2 — the element (`controls/sparkline/sparkline.ts`)

```ts
const props = {
  values: sparklineValuesProp,                            // number[] · safe JSON codec (LLD-C1)
  label: prop.string(''),                                 // accessible context (SPEC-R4)
  variant: prop.enum(['line', 'area'] as const, 'line'),  // structural — enumType snaps unknowns to 'line'
} satisfies PropsSchema

export interface UISparklineElement extends ReactiveProps<typeof props> {}
export class UISparklineElement extends UIElement { static props = props /* … */ }
```

`connected()` installs two effects; `render()` stays the inherited no-op (the `ui-icon` imperative-injection
idiom — the only child is the component-built `<svg>`):

1. **Mark effect** (reads `values`, `variant`): `g = sparklineGeometry(cleanSeries(this.values))`
   (`cleanSeries` runs here too — a property write of garbage never reaches the math, SPEC-R3 AC2). `g ===
   null` ⇒ `replaceChildren()` (empty host; the box still paints via CSS floors). Else build via
   `createElementNS`: `<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"
   focusable="false">` — `aria-hidden` on the **svg** because the HOST carries `role=img`; the svg must
   never double-announce — containing `variant === 'area' && g.area` ? a `<polygon data-part="area"
   points={g.area} fill="currentColor" stroke="none">` under (2) the `<polyline data-part="line"
   points={g.points} fill="none" stroke="currentColor" vector-effect="non-scaling-stroke"
   stroke-linecap="round" stroke-linejoin="round">`. One `replaceChildren(svg)` per change (whole-array
   swap semantics — SPEC-R2; no incremental patching of a 2-node tree).
2. **ARIA effect** (reads `label`, `values`): `internals.role = 'img'` (constant — set in `connected()`
   directly, the list.ts precedent) and `internals.ariaLabel = sparklineSummary(this.label,
   sparklineGeometry(cleanSeries(this.values)))` — recomputed on either input; **never null, never
   aria-hidden** (SPEC-R4 AC2: no silent state).

### LLD-C3 — the stylesheet (`controls/sparkline/sparkline.css`)

```css
:where(ui-sparkline) {
  --ui-sparkline-inline-size: 8em;      /* the deterministic default box (see the sizing ruling below) */
  --ui-sparkline-block-size: 1lh;       /* rides the ambient line box — inline-in-text fits by construction */
  --ui-sparkline-stroke-width: 1.5px;   /* density-invariant px (ADR-0107 cl.5) */
  --ui-sparkline-area-opacity: 0.15;
}
@scope (ui-sparkline) {
  :scope { display: inline-block; inline-size: var(--ui-sparkline-inline-size);
           block-size: var(--ui-sparkline-block-size); vertical-align: text-bottom; color: inherit; }
  :scope svg { display: block; inline-size: 100%; block-size: 100%; overflow: visible; }
  :scope svg [data-part='line'] { stroke-width: var(--ui-sparkline-stroke-width); }
  :scope svg [data-part='area'] { opacity: var(--ui-sparkline-area-opacity); }
}
```

- **The sizing ruling (SPEC-R9 AC1).** The host takes an **explicit** `inline-size` token default, not an
  `auto + min-floor` pair, because `auto` width is non-deterministic here: a percentage-sized SVG inside a
  shrink-to-fit flex item contributes the replaced-element fallback intrinsic (300px), so "auto" would
  render 300px-wide bars-of-nothing in a Row and full-bleed in a Column. `8em × 1lh` paints identically
  everywhere (whole-shape law), reads as the inline mark the PRD names, and the two tokens are the
  page-author override freedom (ADR-0102 Lane A: the no-CSS rendering is already correct; a stretched
  fill is an *upgrade*, never a repair). Suboptimal-not-destructive in a wide tile — the ADR-0102 chooser
  accepts that residual explicitly.
- `overflow: visible` on the svg: with `vector-effect: non-scaling-stroke` the stroke is px-sized, so at
  `y = 0/100` half the stroke falls outside the viewBox; visible overflow shows it instead of clipping
  the extremes flat.
- **Forced colors: no dedicated block** (SPEC-R10) — the mark is `currentColor` stroke/fill, which
  resolves to the consuming context's forced ink (the `icon.css` precedent, its `forcedColors:` descriptor
  line reused nearly verbatim); the area wash is that ink at token opacity (opacity is not a color
  property; WHCM never flattens it).
- **RTL: no mirroring rule** (SPEC-R11) — SVG viewBox coordinates are physical by design; the series
  reads left→right in both directions. Documented in `sparkline.md`.

## 3 · `ui-bar-chart` (SPEC-R5…R8)

### LLD-C4 — the pure math (`controls/bar-chart/bar-math.ts`, DOM-free)

```ts
export interface BarDatum { label: string; value: number }
export interface BarRow extends BarDatum {
  text: string        // the printed value — Intl.NumberFormat (default locale, memoized), sign preserved
  startPct: number    // fill inset from inline-start, 0..100
  lengthPct: number   // fill length, 0..100
}
/** Hardening (SPEC-R7): non-array → []; an entry survives only as a plain object with a string `label`
 *  and a finite numeric `value` (drop, never coerce). */
export function cleanData(input: unknown): BarDatum[]
export function barRows(data: readonly BarDatum[]): BarRow[]
export const barDataProp: PropConfig<BarDatum[]>   // safe JSON codec, same construction as LLD-C1's
```

Zero-baseline math (SPEC-R6 + §2 "Zero baseline"): `lo = min(0, …values)`, `hi = max(0, …values)`,
`span = hi − lo`. `span === 0` (empty is already handled; this is all-zero) ⇒ every row
`startPct = lengthPct = 0` — printed `0`s carry the reading (SPEC-R7 row 5). Else `zeroPct = (−lo / span)
· 100`; `lengthPct = |v| / span · 100`; `startPct = v ≥ 0 ? zeroPct : zeroPct − lengthPct`. Checks:
all-positive ⇒ `lo = 0`, bars measure from the inline-start edge, the max spans the full track
(SPEC-R7 rows 3/4); mixed sign ⇒ every bar shares `zeroPct` (SPEC-R6 AC2).

### LLD-C5 — the element (`controls/bar-chart/bar-chart.ts`)

Props: `{ data: barDataProp, label: prop.string('') }`. `connected()`:

1. `internals.role = 'list'` — constant, set directly (`list.ts:50` precedent); never a host attribute.
2. **Label effect**: `internals.ariaLabel = this.label || null` (an unlabeled list is legal — SPEC-R8
   requires the name only when `label` is non-empty).
3. **Rows effect** (reads `data`): `rows = barRows(cleanData(this.data))`; full
   `replaceChildren(...rows.map(rowNode))` rebuild per swap — whole-array semantics, display-only rows
   hold no focus/selection state worth reconciling (deliberately NOT the ADR-0024 positional reconcile:
   that exists for stateful child components; these are inert text rows).

`rowNode(row)` (component-created light DOM; interior nodes may carry role/aria **attributes** — the
`Option`/`MenuItem` sanction; only HOST aria must ride internals):

```html
<div role="listitem">
  <span data-part="label">{row.label}</span>
  <span data-part="track" aria-hidden="true"><span data-part="fill"></span></span>
  <span data-part="value">{row.text}</span>
</div>
```

The fill's geometry rides two row-scoped custom properties set imperatively —
`node.style.setProperty('--_bar-start', String(row.startPct))` / `'--_bar-length'` — so the CSS owns every
paint decision and the TS never writes a width. AT reading (SPEC-R8 AC1): the listitem's text content is
`{label} {printed value}` (the two text spans); the track subtree is `aria-hidden` and text-free.

### LLD-C6 — the stylesheet (`controls/bar-chart/bar-chart.css`)

```css
:where(ui-bar-chart) {
  --ui-bar-chart-min-inline-size: 16em;                       /* the whole-shape floor (SPEC-R9 AC1) */
  --ui-bar-chart-bar-size: 0.5rem;                            /* bar thickness — density-invariant */
  --ui-bar-chart-bar-radius: 2px;
  --ui-bar-chart-bar-ink: var(--md-sys-color-primary);        /* the data-bearing fill (≥3:1 vs surface — probed) */
  --ui-bar-chart-track-ink: var(--md-sys-color-neutral-container);  /* decorative rail */
  --ui-bar-chart-row-gap: var(--ui-space-sm);                 /* rhythm — rides [density] free (ADR-0103) */
  --ui-bar-chart-col-gap: var(--ui-space-sm);
}
@scope (ui-bar-chart) {
  :scope { display: grid; grid-template-columns: fit-content(40%) 1fr auto;
           column-gap: var(--ui-bar-chart-col-gap); row-gap: var(--ui-bar-chart-row-gap);
           align-items: center; min-inline-size: var(--ui-bar-chart-min-inline-size);
           font-size: var(--md-sys-typescale-body-medium-size);
           line-height: var(--md-sys-typescale-body-medium-line-height); }   /* text-bearing Display: the type matrix is the lever (ADR-0078) */
           /* token names corrected at build (M1-a): the fleet's typescale rows are -small/-medium/-large
              (dimensions.css), never -sm/-md/-lg — the first draft's names would not have compiled */
  :scope [role='listitem'] { display: grid; grid-template-columns: subgrid; grid-column: 1 / -1; align-items: center; }
  :scope [data-part='label'] { overflow-wrap: anywhere; }     /* long labels wrap at the 40% cap (SPEC-R6 AC3) */
  :scope [data-part='track'] { position: relative; block-size: var(--ui-bar-chart-bar-size);
                               border-radius: var(--ui-bar-chart-bar-radius);
                               background: var(--ui-bar-chart-track-ink); }
  :scope [data-part='fill']  { position: absolute; inset-block: 0;
                               inset-inline-start: calc(var(--_bar-start) * 1%);
                               inline-size: calc(var(--_bar-length) * 1%);
                               background: var(--ui-bar-chart-bar-ink); border-radius: inherit; }
  :scope [data-part='value'] { text-align: end; font-variant-numeric: tabular-nums; }
  @media (forced-colors: active) {
    :scope [data-part='fill']  { background: CanvasText; }                 /* system inks are never forced-away */
    :scope [data-part='track'] { background: Canvas; border: 1px solid CanvasText; }
  }
}
```

- **Column model**: `fit-content(40%) 1fr auto` — labels cap at 40% and wrap (never starve the track);
  the track takes the remainder; values right-align in an `auto` cell with tabular numerals so magnitudes
  scan vertically. Rows are `subgrid` children so every row shares the three columns (real `role=listitem`
  elements — NOT `display: contents`, whose role semantics have an engine-bug history the fleet doesn't
  need).
- **RTL is free** (SPEC-R11 AC1): `inset-inline-start` + logical grid flow mirror the rows under
  `dir="rtl"`; no physical properties anywhere in the sheet.
- **WHCM** (SPEC-R10 AC1): author-set **system colors** survive forced-colors without
  `forced-color-adjust` games — fill paints `CanvasText`, the track keeps shape via `Canvas` +
  `CanvasText` border, fill ≠ track by construction; the printed value is plain text.
- **Non-color signifier** (SPEC-R8, ADR-0057): magnitude = length + printed number; no intent-role is
  consumed anywhere in the sheet — nothing to co-carry.

## 4 · Descriptors + fleet integration (SPEC-R12, SPEC-N3)

**LLD-C7 — descriptors.** `sparkline.md` / `bar-chart.md` per the `icon.md` display-leaf shape: `tag`,
`tier: display`, `extends: UIElement`, the `attributes[]` block mirroring `static props` (values/label/
variant · data/label — each `reflect: false`; the JSON attribute forms documented), `properties: []`,
`events: []`, `slots: []` (the only children are component-built), `parts:` documenting
`label/track/fill/value` (bar-chart) and `line/area` (sparkline), `customStates: []`,
`face.formAssociated: false`, an `aria:` block (sparkline `role: img`, `roleSource: internals`,
`labelSource:` the generated summary; bar-chart `role: list` + listitem rows), `keyboard: []`, a
`geometry:` block naming the token box (NO `size` attribute — SPEC-R12 AC2), a `forcedColors:` line, and
the `marginal:` size note. Each folder ships `{name}-descriptor.test.ts` (the contract↔props trip-wire,
`icon-descriptor.test.ts` precedent).

**LLD-C8 — the serial integration slice** (one writer; after both folders land):
- `controls/index.ts` — export both controls (family-coherence C1).
- `descriptor/component-styles.css` — import both sheets (family-coherence C3).
- `descriptor/site-coverage.test.ts` — the display-tier membership assertion (line ~163) becomes
  `['bar-chart', 'icon', 'sparkline', 'text']` (sorted). This is a **gate edit** — its negative control is
  that reverting it fails `npm test` (the gate must bite on the new descriptors).
- `npm run size` by hand (ADR-0040 discipline); if the family budget is exceeded, the re-base is its own
  recorded note in the wave (SPEC-N4) — expected, per ADR-0107 Consequences. **Realized 2026-07-08 as the
  ADR-0107 `## Amendment`**: 25847 B gz measured → ceiling re-based 25 → 26 KB (the Consequences named the
  stale 22 KB figure; the live ceiling was ADR-0095's 25 KB).
- **As-built additions the first draft did not enumerate** (M1-b's true footprint, recorded per the review's
  context-is-memory finding): the components `package.json` per-control `exports` entries (the ADR-0080
  T4 three-way gate demands them) · `descriptor/component-descriptor.ts` — the `kindOf` prober gained an
  `Array.isArray(from(null)) → 'json'` branch (shared infra, fleet blast radius verified empty: no prior
  codec maps a removed attribute to an array; properly LLD-C7 territory) · `descriptor/site-toc.test.ts`
  `PENDING_TOC_GROUPS` + `site-coverage.test.ts` `KNOWN_UNDOCUMENTED` seeds (drained by M1-c/LLD-C9) · the
  a2ui catalog `index.test.ts` `EXCLUSION_ALLOWLIST` seed (drained by M1-d/LLD-C10, which also owes the
  residue-guard assertion: every allowlist key absent from the catalog, so a forgotten entry cannot stay
  silently green) · `site/lib/component-preview.ts` `NO_SLOT_TEXT` + `COMPONENT_SAMPLE_ATTRS` seeds (the
  fleet-preview browser gates need real specimen content).

**LLD-C9 — site pages.** `site/sparkline-doc.html` + `site/bar-chart-doc.html` (tier=display ⇒ `doc`
page only, `site-coverage.test.ts` PAGES_BY_TIER) + the toc/nav rows the site drift gates walk. Pages
mount the live controls (degenerate-input strips double as visual fixtures).

## 5 · Catalog wave (SPEC-R13)

**LLD-C10 — rows + factories** (`a2ui/src/catalog/default/`):

```jsonc
// catalog.json → components
"Sparkline": { "properties": {
  "values":  { "type": { "type": "array", "items": { "type": "number" } }, "bindable": true, "mapsTo": "values" },
  "label":   { "type": { "type": "string" }, "bindable": true, "mapsTo": "label" },
  "variant": { "type": { "type": "string", "enum": ["line", "area"] }, "mapsTo": "variant" } } },
"BarChart": { "properties": {
  "data":  { "type": { "type": "array", "items": { "type": "object",
             "properties": { "label": { "type": "string" }, "value": { "type": "number" } },
             "required": ["label", "value"] } }, "bindable": true, "mapsTo": "data" },
  "label": { "type": { "type": "string" }, "bindable": true, "mapsTo": "label" } } }
```

```ts
// factories.ts — display-only leaves: plain accessor factories, no value mark, no children, no submitGate.
export const sparklineFactory: WidgetFactory = accessorFactory('ui-sparkline')
export const barChartFactory: WidgetFactory = accessorFactory('ui-bar-chart')
```

Build-verify items (named, not guessed): (a) the fleet-derived gate's tag→PascalCase util must yield
`bar-chart → BarChart` (the `combo-box → ComboBox` precedent says yes — assert it in the gate run);
(b) the shared validator's depth on array-item schemas — SPEC-R13 requires top-level type acceptance
only; if literal-array item checking is shallow today, that is conformant, and the row's full item schema
stays declared for the validator's future depth. `factories.test.ts` gains both types (count + binding);
`index.test.ts`'s fleet-derived gate covers them with zero allowlist residue (SPEC-R13 AC1).

**LLD-C11 — catalog SPEC repair.** `a2ui-catalog.spec.md` §5.2 gains the two rows (cells per SPEC-R13's
table + factory facts) and the Notes block gains the when-to-use guidance (SPEC-R14's four-way rule), in
the same change as the rows — the coverage table stays the one normative home; the chart SPEC is cited as
the behavior contract.

## 6 · Exemplar wave (SPEC-R14)

**LLD-C12 — the report-card seed** (`a2ui/src/examples/catalog-coverage.ts`, the `stats-grid-dashboard`
sibling): `report-card-dashboard` — data model `{ title, latest, trend: number[], regions:
{label,value}[] }`; components: `Card > CardContent > Column [ Text(h3 title), Row [ Column [Text(caption
"Revenue"), Text(h3 latest)], Sparkline(values: {path:/trend}, label:"Revenue trend") ],
Text(caption "By region"), BarChart(data: {path:/regions}, label:"Revenue by region") ]` — the tile keeps
the latest value (tiles are for latest values), the sparkline shows the shape, the bars the breakdown:
the seed itself demonstrates the guidance. Joins `allSeeds`; validates 0-`CATALOG` (SPEC-R14 AC1).
**LLD-C13 — corpus/prompt re-validation**: re-run the corpus admission + derived-prompt/coverage gates
over the widened catalog (the ADR-0087 consequence pattern); repair any drift in the same change.

## 7 · Failure modes & edge handling (the per-case ledger)

| # | Case | Handling | Where |
|---|---|---|---|
| 1 | malformed `values`/`data` attribute JSON | try/catch codec → `[]`; no throw ever reaches `attributeChangedCallback` | LLD-C1/C4 codecs (SPEC-R3/R7) |
| 2 | attribute removed (`from(null)`) | `[]`, not `null` — the dom/props.ts `jsonType` null-mapping is why the charts ship their own codecs | LLD-C1/C4 |
| 3 | property write of a non-array / mixed-garbage array | `cleanSeries`/`cleanData` at the render boundary — hardening is not codec-only | LLD-C2/C5 effects |
| 4 | every entry dropped | sparkline: clear + `no data` summary; bar-chart: zero rows, `role=list` intact | SPEC-R3/R7/R8 AC3 |
| 5 | n=1 / all-equal / all-zero / negative / mixed-sign | the LLD-C1/C4 formula cases — each pinned by a unit test | §2/§3 math |
| 6 | huge series (10k points) | no cap in v1: one polyline, O(n) string build, no per-point DOM — linear and cheap; revisit only on a measured complaint | LLD-C2 |
| 7 | full `replaceChildren` rebuild mid-AT-read | accepted: display-only rows hold no focus/caret; a live-region contract is out of scope (charts are not status surfaces) | LLD-C5 |
| 8 | `1lh`/`subgrid`/`@scope` engine floor | all ≥ the fleet's existing `@scope` baseline — no new floor introduced; browser legs run both engines | LLD-C3/C6 |
| 9 | `--md-sys-color-primary` fill fails 3:1 on some surface variant | the build wave's color probe measures it; fallback is repointing the token default (a token edit, not a mechanism change) | LLD-C6 |
| 10 | validator shallow on array items | conformant per SPEC-R13 (top-level depth required only); component hardening is the safety net | LLD-C10 |

## 8 · Test plan (per slice) & gates

- **Math units** (`sparkline-math.test.ts`, `bar-math.test.ts`, jsdom-free): every §7 row 1–5 case; the
  exact SPEC-R4 summary wordings (AC3); codec round-trips incl. malformed JSON; the 4:2:1 proportion and
  shared-zero assertions as pure numbers.
- **jsdom** (`sparkline.test.ts`, `bar-chart.test.ts`): props/attribute reflection; `internals.role`/
  `ariaLabel` (the summary sentence verbatim); DOM shape (listitem count, aria-hidden track, printed
  values); descriptor trip-wires (`*-descriptor.test.ts`).
- **Browser, Chromium + WebKit** (`*.browser.test.ts` — SPEC-N2; jsdom is blind to painted geometry):
  whole-shape (bare-in-flex-row box ≥ floor, both controls); non-scaling stroke under resize; bar
  proportion within ε of the math; RTL mirroring (bar rows) + physical series direction (sparkline);
  forced-colors computed-style legs (fill=CanvasText, track border) — computed-style is the sanctioned
  visual proof (ADR-0102), no pixel-diff harness.
- **Gates**: `npm run check && npm test` green at every slice boundary; `npm run test:browser` before each
  wave commit (the component-reviewer DoD — jsdom-green ≠ done); `npm run size` by hand at LLD-C8;
  catalog gates (`factories.test.ts`, `index.test.ts`) at LLD-C10; examples/corpus gates at LLD-C12/C13.
  Negative controls: the site-coverage display-tier edit and the fleet-derived catalog gate must each FAIL
  when their new entry is reverted.

## 9 · Build sequence (checkpointed; = the decomp's edge order)

1. **Wave M1-a (parallel):** LLD-C1 → LLD-C2/C3 (sparkline folder) ∥ LLD-C4 → LLD-C5/C6 (bar-chart
   folder) — one writer per folder; math frozen first. *Checkpoint:* folder-local tests green.
2. **Wave M1-b (serial):** LLD-C7 descriptors finalized in-folder, then LLD-C8 (barrel/styles/gate edit/
   size) — the ONE shared-file writer. *Checkpoint:* repo-wide check+test+browser green.
3. **Wave M1-c:** LLD-C9 site pages. *Checkpoint:* site-coverage/toc/nav green; site builds.
4. **Wave M1-d (same wave as the descriptors — SPEC-N2):** LLD-C10 catalog rows+factories, then LLD-C11
   catalog-SPEC repair. *Checkpoint:* fleet-derived gate green, allowlist residue none, ADR-0107 cl.2
   payloads validate clean.
5. **Wave M2:** LLD-C12 exemplar seed, then LLD-C13 corpus/prompt re-validation. *Checkpoint:* SPEC-R14
   ACs; exemplar renders in the gallery.

## Component IDs (trace)

`LLD-C1` sparkline math ← SPEC-R2/R3/R4 · `LLD-C2` UISparklineElement ← SPEC-R1/R2/R3/R4 · `LLD-C3`
sparkline.css ← SPEC-R2/R9/R10/R11/R12 · `LLD-C4` bar math ← SPEC-R6/R7 · `LLD-C5` UIBarChartElement ←
SPEC-R5/R6/R7/R8 · `LLD-C6` bar-chart.css ← SPEC-R6/R9/R10/R11/R12 · `LLD-C7` descriptors ←
SPEC-R1/R5/R12 · `LLD-C8` integration ← SPEC-N3/N4 · `LLD-C9` site pages ← SPEC-N3 · `LLD-C10` catalog
rows/factories ← SPEC-R13 · `LLD-C11` catalog-SPEC repair ← SPEC-R13/R14 · `LLD-C12` exemplar ← SPEC-R14
· `LLD-C13` corpus re-validation ← SPEC-R14. (`LLD-C#` IDs per-doc-scoped — the house convention.)
