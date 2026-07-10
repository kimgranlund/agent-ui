# LLD — Token-Surface Family (`ui-swatch` + `ui-ramp` + `ui-ladder`, the site re-host, M2 seams)

> Refines: [`../spec/token-surfaces.spec.md`](../spec/token-surfaces.spec.md) (SPEC-R1…R18, SPEC-N1…N5) under
> [ADR-0118](../adr/0118-token-surfaces-v1-scope.md) (accepted). Build plan:
> [`../decompositions/token-surfaces-m1.decomp.json`](../decompositions/token-surfaces-m1.decomp.json)
> (coverage-clean, plan mode). · proposed · 2026-07-10 · planner
>
> **Composes on:** `UIElement` (`dom/element.ts`) + the props/signal system (`dom/props.ts`) + `ElementInternals`
> ARIA (fleet law). **No new package** (ADR-0118 cl.7): three ordinary control folders, `controls/swatch/`,
> `controls/ramp/`, `controls/ladder/`, plus one shared pure helper `controls/_token-surface/` (the value-lane
> codec + resolvers — shared 3 ways, the `_base`/`_surface` precedent; a single source, never three divergent
> copies). The site token page re-hosts onto the shipped controls; `site/lib/token-parse.ts` STAYS site-local.
>
> **Freeze discipline.** §2/§3/§4 interfaces are the fan-out contract. A builder who cannot satisfy a frozen
> interface STOPS and escalates — the fix is a coordinated LLD/decomp repair, never a local deviation.

## 1 · Intent

Implement the show-never-edit token surfaces: a bordered color box (`ui-swatch`) whose whole contract is "show
this one color value, resolved live"; an ordered strip of those cells (`ui-ramp`) whose contract is "show this
color series in order"; and a magnitude-bar list (`ui-ladder`) whose contract is "show these dimensional tiers
at their real length, the printed value as the datum." **No color math anywhere** — the browser is the resolver
(ADR-0118 cl.2/3); the components only route value strings into `background`/`inline-size` and compose the
accessible name. Then re-host the site token reference onto the primitives (PRD-G3, with the "Dimensional
ladders" retitle) and seed the M2 catalog allowlist. Everything is derived, display-only state — no events, no
focus, no form participation.

## 2 · The shared value-lane helper (`controls/_token-surface/`)

### LLD-C1 — `token-surface.ts` (DOM-free, unit-testable)

The one place the ADR-0118 cl.2 value contract lives — the three controls consume it, none re-implements it.

```ts
import type { PropConfig } from '../../dom/props.ts'

export interface TokenEntry { label: string; value: string }

/** Hardening (SPEC-R7/R11): non-array → []; an entry survives only as a plain object with a string `label`
 *  AND a string `value` (drop, never coerce). Order preserved. */
export function cleanEntries(input: unknown): TokenEntry[]

/** The safe JSON-array codec for `steps`/`tiers` (SPEC-R7/R11 row 1): `from(attr)` = null → [], JSON.parse in
 *  try/catch → [] on throw, then cleanEntries; `to` = JSON.stringify. dom/props.ts `jsonType` is NOT used — its
 *  bare JSON.parse throws on malformed attributes and maps a removed attribute to `null`, both of which the
 *  hardening rows forbid reaching the render path (the ui-sparkline/ui-bar-chart codec precedent,
 *  component-descriptor.ts:378 kindOf already classifies an array-returning `from(null)` as 'json'). */
export function tokenEntriesProp(): PropConfig<TokenEntry[]>

/** The `--var` lane (SPEC-R2), value-NEUTRAL: a value beginning `--` → `var(<value>)`; any other string is
 *  returned verbatim. Pure string routing — NO resolution, NO getComputedStyle (that readback is the ADR-0118
 *  cl.2 foreseen extension, out of v1). The browser resolves the returned expression wherever it lands. Used by
 *  BOTH swatch's `background` AND ladder's `--_mag` (LLD-C6) — the ONE transform, so a `--`-prefixed value never
 *  reaches a CSS property as a bare dashed-ident (the bug: `min(100%, --ui-height-md)` is invalid at
 *  computed-value time; `min(100%, var(--ui-height-md))` is what we want). */
export function cssValue(value: string): string   // '' → '' (transparent/none); '--x' → 'var(--x)'; literal → literal

/** The length-router (SPEC-R11): true iff `value` is a resolvable CSS length (a `--var` counts — its resolution
 *  is the browser's job). Uses `CSS.supports('inline-size', v)` when available (browser + modern jsdom), else a
 *  conservative unit-regex fallback so the jsdom unit tests still bite. NOT a drop gate — LLD-C6 uses it to
 *  route a NON-length value to a zero-length bar (`0px`) while KEEPING the row + its printed value (SPEC-R11 the
 *  unified no-silent-state rule), matching swatch's invalid-color-keeps-the-datum behavior. */
export function isRenderableLength(value: string): boolean
```

- **Why a shared folder and not co-location** (the chart family co-located per control): charts had *distinct*
  per-control math (polyline vs zero-baseline bars); here all three controls share the *identical* value-lane
  logic (ADR-0118 cl.2 is one contract). A single `_token-surface/` module is the anti-drift choice — the same
  reasoning that puts container-box.css and the `_base` bases in shared folders. It imports nothing but a type
  from `dom/props.ts`; it is pure and jsdom-free-testable (`token-surface.test.ts`).

## 3 · The three controls

### 3.1 `ui-swatch` (SPEC-R1…R4)

**LLD-C2 — the element (`controls/swatch/swatch.ts`).**

```ts
const props = {
  value:  prop.string(''),                                        // literal color OR --var (LLD-C1 cssValue)
  label:  prop.string(''),                                        // token name / caption (SPEC-R4)
  scheme: prop.enum(['auto', 'light', 'dark'] as const, 'auto'),  // color-scheme pin; enumType snaps unknowns to 'auto'
} satisfies PropsSchema
```

`connected()` sets `internals.role = 'img'` once (constant — the `list.ts`/`icon.ts` precedent) and installs
one render effect (reads `value`, `label`, `scheme`):
1. Build the box node once (a `<span data-part="box">`) + a `<span data-part="value">` text node; on each change
   set `box.style.background = cssValue(this.value)` (empty → `''` → transparent, border carries — SPEC-R3);
   `box.style.colorScheme = this.scheme === 'auto' ? '' : this.scheme` (SPEC-R2 the scheme pin); the value/label
   text content. `replaceChildren(box, valueText)` on first build; subsequent changes mutate in place (a 2-node
   tree, no reconcile needed).
2. `internals.ariaLabel = composeName(this.label, this.value)` — `label + ', ' + value` when both; the value or
   label alone otherwise; `'swatch'` when neither (SPEC-R4 — never null, never aria-hidden). The box is
   **not** separately announced (color cannot be spoken; the composed name is the datum).

**LLD-C3 — the stylesheet (`controls/swatch/swatch.css`).**

```css
:where(ui-swatch) {
  --ui-swatch-box-size: 2rem;                                  /* the deterministic default box (whole-shape, SPEC-R13) */
  --ui-swatch-border: 1px solid var(--md-sys-color-outline-variant);  /* the hairline so a surface color never vanishes (SPEC-R2 AC3) */
  --ui-swatch-radius: var(--ui-radius-base);
  --ui-swatch-gap: var(--ui-space-xs);
}
@scope (ui-swatch) {
  :scope { display: inline-grid; grid-auto-flow: column; align-items: center;
           column-gap: var(--ui-swatch-gap); color: inherit; }
  :scope [data-part='box'] { inline-size: var(--ui-swatch-box-size); block-size: var(--ui-swatch-box-size);
                             border: var(--ui-swatch-border); border-radius: var(--ui-swatch-radius);
                             flex: none; }
  :scope [data-part='value'] { font-size: var(--md-sys-typescale-body-medium-size);
                               line-height: var(--md-sys-typescale-body-medium-line-height);
                               overflow-wrap: anywhere; }
  @media (forced-colors: active) {
    :scope [data-part='box'] { background: transparent !important; border-color: CanvasText; }  /* honesty: degrade to border, never a fake color (SPEC-R14) */
  }
}
```

- **The sizing ruling (SPEC-R13 AC1):** an **explicit** `2rem` box, not `auto` — a swatch has no intrinsic
  content, so `auto` would collapse to 0 in a shrink-to-fit flex item (the `ui-sparkline` sizing-ruling lesson).
  `2rem × 2rem` paints identically everywhere; the token is the page-author override freedom (ADR-0102 Lane A).
- **WHCM honesty** (SPEC-R14): the box's `background` is forced to `transparent` and the border to `CanvasText`
  under forced-colors — the box degrades to a bordered outline (never a system color that lies about the token);
  the value/label text is real text and survives. `!important` because a color the author set inline (via
  `box.style.background`) otherwise wins over the media block.

### 3.2 `ui-ramp` (SPEC-R5…R8)

**LLD-C4 — the element (`controls/ramp/ramp.ts`).** Props `{ steps: tokenEntriesProp(), label: prop.string(''),
scheme: prop.enum(['auto','light','dark'] as const, 'auto') }`. `connected()` sets `internals.role = 'list'`
once; a label effect sets `internals.ariaLabel = this.label || null`; a steps effect rebuilds the strip:
`replaceChildren(...cleanEntries(this.steps).map(cellNode))` per swap (whole-array — display-only cells hold no
state). Each `cellNode(step)`:

```html
<div role="listitem" data-part="cell">
  <span data-part="box" aria-hidden="true" style="background: {cssValue(step.value)}; color-scheme: {scheme pin}"></span>
  <span data-part="step-label">{step.label}</span>
  <span data-part="value">{step.value}</span>
</div>
```

The listitem's text content is `{label} {value}` (the two text spans — the accessible datum, SPEC-R8); the box
is `aria-hidden` (color cannot be announced). The scheme pin (`colorScheme`) is set on each box from `this.scheme`
(the whole strip shares it). `cleanEntries` runs at the render boundary (a property write of garbage never
reaches the DOM — SPEC-R7).

**LLD-C5 — the stylesheet (`controls/ramp/ramp.css`).**

```css
:where(ui-ramp) {
  --ui-ramp-cell-size: 2rem;                                   /* the swatch-cell box (whole-shape) */
  --ui-ramp-border: 1px solid var(--md-sys-color-outline-variant);
  --ui-ramp-radius: var(--ui-radius-base);
  --ui-ramp-gap: var(--ui-space-xs);
  --ui-ramp-min-inline-size: 8em;                              /* the whole-shape floor (SPEC-R13 AC1) */
}
@scope (ui-ramp) {
  :scope { display: flex; flex-wrap: wrap; gap: var(--ui-ramp-gap);
           min-inline-size: var(--ui-ramp-min-inline-size); }   /* a strip that WRAPS, never overflows (SPEC-R6 AC2) */
  :scope [data-part='cell'] { display: grid; justify-items: center; gap: 2px; }
  :scope [data-part='box'] { inline-size: var(--ui-ramp-cell-size); block-size: var(--ui-ramp-cell-size);
                             border: var(--ui-ramp-border); border-radius: var(--ui-ramp-radius); }
  :scope [data-part='step-label'], :scope [data-part='value'] {
    font-size: var(--md-sys-typescale-body-small-size);
    line-height: var(--md-sys-typescale-body-small-line-height); text-align: center; }
  @media (forced-colors: active) {
    :scope [data-part='box'] { background: transparent !important; border-color: CanvasText; }
  }
}
```

- **RTL** (SPEC-R15): the strip keeps physical `flex-direction: row` (LTR series direction — a tonal ramp reads
  light→dark left-to-right in both locales, the `ui-sparkline` precedent); labels/values inside each cell are
  logical text. Documented in `ramp.md`.
- WHCM: same border-degradation honesty as swatch.

### 3.3 `ui-ladder` (SPEC-R9…R12)

**LLD-C6 — the element (`controls/ladder/ladder.ts`).** Props `{ tiers: tokenEntriesProp(), label:
prop.string('') }`. `connected()` sets `internals.role = 'list'`; label effect as LLD-C4; a tiers effect
rebuilds: `rendered = cleanEntries(this.tiers)` (NO length-drop — every well-formed entry KEEPS its row and its
printed value, the unified no-silent-state rule, SPEC-R11), then `replaceChildren(...rendered.map(rowNode))`.
Each `rowNode(tier)` computes the bar magnitude `mag = isRenderableLength(tier.value) ? cssValue(tier.value) :
'0px'` — a resolvable length (incl. a `--var`, transformed by `cssValue` to `var(--…)`) passes through; a
NON-length literal (`"red"`) routes to `'0px'` (a zero bar, never a raw ident that would poison the CSS `min()`):

```html
<div role="listitem">
  <span data-part="label">{tier.label}</span>
  <span data-part="track" aria-hidden="true"><span data-part="bar" style="--_mag: {mag}"></span></span>
  <span data-part="value">{tier.value}</span>
</div>
```

The bar's inline-size is the **literal length** via the row-scoped custom property `--_mag` (set imperatively —
the CSS owns the paint, the TS never writes a width; the `ui-bar-chart` fill precedent). **The `cssValue`
transform is load-bearing** (the HIGH doc-review fix): a `--`-prefixed value becomes `var(--…)`, so `--_mag:
var(--ui-height-md)` — NOT a bare dashed-ident `--_mag: --ui-height-md`, which is invalid at computed-value time
in `min(100%, …)`. An **undefined** `--var` then makes `--_mag`'s substitution guaranteed-invalid, so the CSS
`var(--_mag, 0px)` (LLD-C7) genuinely falls to `0px` — a zero bar with the printed value still carried (SPEC-R11
undefined-var row, now reachable). AT reading (SPEC-R12): the listitem text is `{label} {value}` — the printed
value ALWAYS survives, whether the mark rendered or degraded; the track subtree is `aria-hidden`.

**LLD-C7 — the stylesheet (`controls/ladder/ladder.css`).**

```css
:where(ui-ladder) {
  --ui-ladder-min-inline-size: 16em;                          /* the whole-shape floor */
  --ui-ladder-bar-size: 0.75rem;                              /* bar THICKNESS — density-invariant */
  --ui-ladder-bar-radius: 2px;
  --ui-ladder-bar-ink: var(--md-sys-color-primary);           /* the magnitude fill (≥3:1 vs surface — probed) */
  --ui-ladder-row-gap: var(--ui-space-sm);                    /* rides [density] free (ADR-0103) */
  --ui-ladder-col-gap: var(--ui-space-sm);
}
@scope (ui-ladder) {
  :scope { display: grid; grid-template-columns: fit-content(30%) 1fr auto;
           column-gap: var(--ui-ladder-col-gap); row-gap: var(--ui-ladder-row-gap);
           align-items: center; min-inline-size: var(--ui-ladder-min-inline-size);
           font-size: var(--md-sys-typescale-body-medium-size);
           line-height: var(--md-sys-typescale-body-medium-line-height); }
  :scope [role='listitem'] { display: grid; grid-template-columns: subgrid; grid-column: 1 / -1; align-items: center; }
  :scope [data-part='label'] { overflow-wrap: anywhere; }
  :scope [data-part='track'] { block-size: var(--ui-ladder-bar-size); }
  :scope [data-part='bar'] { display: block; block-size: 100%;
                             inline-size: min(100%, var(--_mag, 0px));   /* LITERAL length, track-capped — NO normalization (SPEC-R10) */
                             background: var(--ui-ladder-bar-ink); border-radius: var(--ui-ladder-bar-radius); }
  :scope [data-part='value'] { text-align: end; font-variant-numeric: tabular-nums; }
  @media (forced-colors: active) {
    :scope [data-part='bar'] { background: CanvasText; }      /* system ink — length still carries magnitude */
  }
}
```

- **The literal-length ruling (SPEC-R10):** `inline-size: min(100%, var(--_mag, 0px))` renders each tier at its
  real length, capped to the track. This is the deliberate departure from `ui-bar-chart` (which normalizes
  numeric magnitudes 0..100 via `bar-math.ts`): a ladder has **no math module** because ADR-0118 cl.2 forbids
  component-owned math, and a dimensional value already IS a renderable length. The `var(--_mag, 0px)` fallback
  is the zero-bar floor for BOTH the LLD-C6 non-length route (`--_mag` set to `0px` directly) AND an undefined
  `--var` (whose `var(--…)` substitution is guaranteed-invalid, so `var(--_mag, 0px)` falls to `0px`) — in every
  such case the row + printed value survive (SPEC-R11 the unified no-silent-state rule).
- Rows are real `role="listitem"` subgrid children (NOT `display: contents` — its role semantics have an
  engine-bug history the fleet avoids; the `ui-bar-chart` LLD-C6 precedent).
- **RTL is free** (SPEC-R15): logical grid + `inline-size` mirror under `dir="rtl"`. **WHCM**: the bar paints
  `CanvasText` (a system ink is never forced away); magnitude still travels by length + printed value.

## 4 · Descriptors + fleet integration (SPEC-R16, SPEC-N3)

**LLD-C8 — descriptors.** `swatch.md` / `ramp.md` / `ladder.md` per the `icon.md`/`bar-chart.md` display-leaf
shape: `tag`, `tier: display`, `extends: UIElement`, the `attributes[]` block mirroring `static props`
(swatch: value/label/scheme · ramp: steps/label/scheme · ladder: tiers/label — each `reflect: false`; the JSON
attribute forms for steps/tiers documented), `properties: []`, `events: []`, `slots: []` (children are
component-built), `parts:` documenting `box/value` (swatch) · `cell/box/step-label/value` (ramp) ·
`label/track/bar/value` (ladder), `customStates: []`, `face.formAssociated: false`, an `aria:` block (swatch
`role: img` + composed-name `labelSource`; ramp/ladder `role: list` + listitem rows), `keyboard: []`, a
`geometry:` block naming the token box (NO `size` attribute — SPEC-R16 AC2), a `forcedColors:` line, and the
`marginal:` size note. Each folder ships `{name}-descriptor.test.ts` (the contract↔props trip-wire,
`icon-descriptor.test.ts` precedent). **Descriptor sketch (block-style YAML), swatch shown as the template:**

```yaml
tag: ui-swatch
tier: display          # Display band — no control frame/height (geometry.md)
extends: UIElement     # a non-interactive display leaf — NOT form-associated
attributes:            # mirrors swatch.ts `static props` (value, label, scheme)
  - name: value
    type: string
    default: ''        # a literal CSS color OR a --var name (cssValue routes it)
    reflect: false
  - name: label
    type: string
    default: ''
    reflect: false
  - name: scheme
    type: enum
    values: [auto, light, dark]
    default: auto      # color-scheme pin; 'auto' = inherit ambient
    reflect: false
properties: []
events: []             # display-only — emits nothing
slots: []              # only child is the component-built box (no author-slotted content)
parts:
  - name: box          # the bordered color box (aria-hidden — color cannot be announced)
  - name: value        # the value string as real DOM text
customStates: []       # no interaction state
face:
  formAssociated: false
aria:
  role: img            # constant via internals — a swatch is data, not decoration (ADR-0118 cl.4)
  roleSource: internals
  labelSource: composed name (label + ', ' + value; value or label alone; 'swatch' when neither)
keyboard: []
geometry:
  sizeClass: display
  inlineSize: var(--ui-swatch-box-size)   # 2rem default box — NO [size] ramp (SPEC-R16)
  blockSize: var(--ui-swatch-box-size)
forcedColors: The color box degrades to a CanvasText border (background forced transparent) — honest, never a fake system color; the value/label text survives (SPEC-R14).
```

(`ramp.md` swaps in `steps` [type json, default `[]`] + `scheme`, `role: list` + listitem rows, parts
`cell/box/step-label/value`; `ladder.md` swaps in `tiers` [type json, default `[]`], no scheme, `role: list`,
parts `label/track/bar/value`. The `steps`/`tiers` JSON props classify as `type: json` — the kindOf array
branch, component-descriptor.ts:378, already handles the hardened `from(null) → []` codec.)

**LLD-C9 — the serial integration slice** (one writer; after all three folders land):
- `controls/index.ts` — export all three controls (family-coherence C1).
- `descriptor/component-styles.css` — import all three sheets (family-coherence C3).
- `descriptor/site-coverage.test.ts` — the display-tier membership assertion (currently
  `['attachment', 'badge', 'bar-chart', 'code', 'icon', 'progress', 'sparkline', 'stat', 'table', 'text']`,
  ~line 187) becomes `['attachment', 'badge', 'bar-chart', 'code', 'icon', 'ladder', 'progress', 'ramp',
  'sparkline', 'stat', 'swatch', 'table', 'text']` (sorted). A **gate edit** — reverting it must fail `npm test`
  (the gate must bite on the new descriptors).
- The chart precedent's as-built shared-file seeds this wave also owes (verify against the tree at build): the
  components `package.json` per-control `exports` entries (ADR-0080 T4 three-way gate) · `descriptor/
  site-toc.test.ts` `PENDING_TOC_GROUPS` + `site-coverage.test.ts` `KNOWN_UNDOCUMENTED` seeds (drained by
  LLD-C10) · the a2ui catalog `index.test.ts` `EXCLUSION_ALLOWLIST` seed for `Swatch`/`Ramp`/`Ladder`
  (SPEC-R18 AC1 — the M1 allowlist seed, drained to zero at M2, WITH the residue-guard assertion) ·
  `site/lib/component-preview.ts` specimen seeds (the fleet-preview browser gates need real specimen content —
  a swatch with a real color, a ramp of ≥5 steps, a ladder of a real dimensional set).
- `npm run size` by hand (ADR-0040); a family-budget re-base, if any, is its own recorded note (SPEC-N4).

**LLD-C10 — the catalog allowlist seed (M1's only catalog obligation).** The three descriptors landing at
LLD-C9 turn the SPEC-N2 fleet-derived catalog gate red until each type is declared or allowlisted (ADR-0087,
the ADR-0107 lesson). M1 seeds `EXCLUSION_ALLOWLIST` with `Swatch`/`Ramp`/`Ladder` + the residue-guard
assertion (every allowlist key absent from the catalog). The rows themselves are **M2** (LLD-C13, sketch). This
is the split-wave adaptation ADR-0118 fork F4 ratified — distinct from the chart family, which landed rows in
the same wave.

**LLD-C11 — site doc pages.** `site/swatch-doc.html` + `site/ramp-doc.html` + `site/ladder-doc.html` (tier=
display ⇒ `doc` page only, `site-coverage.test.ts` PAGES_BY_TIER) + the toc/nav rows the site drift gates walk.
Pages mount the live controls (degenerate-input strips double as visual fixtures — a bare swatch, an empty ramp,
a mixed-validity ladder).

## 5 · The site token-reference re-host (SPEC-R17, PRD-G3) — the enumeration

**LLD-C12 — `site/pages/tokens.ts` re-host.** Every `tokens.ts` consumer of the deleted display code, named:

| Deleted (bespoke display) | Replaced by | Stays |
|---|---|---|
| `swatch(role, scheme)` — a hand-built `div` + inline `background`/`colorScheme` + `getComputedStyle` `title` | `<ui-swatch value="{role.varName}" label="{role.role}" scheme="{light\|dark}">` (the `--var` lane + scheme pin) | — |
| `roleRow(role)` + the per-family `<table>` (`thead`/`tbody`, Token/Role/Light/Dark cells) | a per-family composition of `ui-swatch` (light + dark per role, reading `parseColorRoles`) — roles **STAY swatch tables** (Kim 2026-07-10: roles-as-ramp REJECTED — a semantic role set is not an ordered progression; it would teach the idiom F1 legislated against) | the `heading(2/3, …)` section structure |
| — (NEW section, no deletion) | **the ramp dogfood** — a new "Tonal primitives" section: `<ui-ramp steps="{parseColorPrimitives(tokensCss)[family]}" label="{family}">` per family, rendering the numbered `--md-sys-color-{family}-100…900` steps as the genuinely ordered series (Kim 2026-07-10) | — |
| the five dimensional `<table>`s (the `for (…DIMENSION_RAMPS)` table loop, Tier/Value cells) | `<ui-ladder tiers="{parseDimensionRamp(...)}" label="{ramp label}">` — one ladder per dimensional set | the `DIMENSION_RAMPS` note prose |
| `## Dimensional ramps` heading + `DIMENSION_RAMPS`/`parseDimensionRamp` **naming** in `tokens.ts` | **"Dimensional ladders"** heading + `DIMENSION_LADDERS` const rename (the F1 rider — ADR-0118 cl.1; `parseDimensionRamp` in `token-parse.ts` is NOT renamed, it stays site-local and its `tokens-doc.test.ts` calls it by name) | `parseDimensionRamp` (the parse fn name — SPEC-R17: token-parse.ts's EXISTING functions unchanged; `parseColorPrimitives` is the one additive helper) |

- **Net-negative display LOC** (SPEC-R17 AC1): the measurable baseline is the **enumerated deletable-function
  subset ≈85 LOC** — `swatch()` (~11) + `roleRow()` (~19) + the per-family table loop (~20) + the dimensional
  table loop (~35) — NOT the whole 159-line file (the PRD-G3 "159 LOC" is the whole-file figure; imports,
  `mountPage`/`pageLead`, the anti-vacuous parse guards, and the section prose STAY). The swatch/ladder
  replacements are prop-set compositions (a few LOC each); **the NEW tonal-primitive `ui-ramp` section ADDS
  ~12–15 display LOC to `tokens.ts`** (Kim's ramp-dogfood ruling) — honestly counted, and still strongly swamped
  by the ~85 deleted, so tokens.ts display LOC stays net-negative. The `parseColorPrimitives` helper is *parse*
  logic in `token-parse.ts`, which the PRD's own display-vs-parse split excludes from the display-LOC count. The
  anti-vacuous parse guards STAY (and the new section gets its own `parseColorPrimitives(...).length === 0` throw).
- **`token-parse.ts` — existing functions unchanged, ONE additive helper** (SPEC-R17, Kim's ruling): the page
  still calls `parseColorRoles`/`parseDimensionRamp`/`familiesOf` to FEED the swatch/ladder sections (untouched);
  it GAINS a small additive `parseColorPrimitives(tokensCss)` — collects the numbered `--md-sys-color-{family}-{N}`
  base steps (the `NUMERIC_SUFFIX` matches `parseColorRoles` EXCLUDES), drops the alpha `-{N}-{aa}` variants,
  groups by family, sorts numerically → one ordered step series per family. It derives from the same sheet
  (`derive-don't-hand-type`), so a palette change flows automatically — NOT a hand-typed literal (the rot-prone
  anti-pattern this page exists to avoid). Adding a function is not changing the existing ones, so the site-local
  drift contract holds.
- **`tokens-doc.test.ts` — existing assertions unchanged, ONE additive** (SPEC-R17 AC2): the parse-layer
  assertions (>100 roles, nine families, five ramp tiers) are untouched by the rendering swap; the file GAINS one
  non-vacuous assertion that `parseColorPrimitives` resolves a non-empty ordered step set per family (so the new
  section is gate-backed, the same drift discipline as the rest of the page). It stays the gate that proves the
  DATA; the rendering has its own component gates.
- **The resolved-value `title` delta** (SPEC-R17 note): the `getComputedStyle` readback string is dropped
  (ADR-0118 cl.2 foreseen extension); the live-resolved COLOR is preserved via the swatch `--var` lane + scheme.

## 6 · M2 seams (sketch only — a separate wave, its own SPEC/LLD/decomp)

Not built in M1. Recorded so the M1 build does not foreclose them:
- **LLD-C13 (M2) — catalog rows + factories** (`a2ui/src/catalog/default/`): `Swatch`/`Ramp`/`Ladder`
  display-only rows (one-way props, no `value:{prop,event}` mark), `accessorFactory('ui-swatch'|…)`; drain the
  LLD-C10 allowlist to zero residue.
- **LLD-C14 (M2) — catalog SPEC §5.2 + guidance + FEED_EXCLUDED**: the three rows + the when-to-use prose
  (Swatch/Ramp for color identity/relationships · Ladder for dimensional rhythm · tile for a metric · table for
  exact strings) + the three `FEED_EXCLUDED` bookkeeping entries (OUT — the ADR-0097 total-partition gate,
  ADR-0118 cl.6).
- **LLD-C15 (M2) — exemplar + corpus re-validation**: a "brand palette" / "theme audit" seed in `allSeeds`
  (validator-clean); corpus + derived prompt re-validate over the widened catalog (the ADR-0087 consequence
  pattern).

## 7 · Failure modes & edge handling (the per-case ledger)

| # | Case | Handling | Where |
|---|---|---|---|
| 1 | malformed `steps`/`tiers` attribute JSON | try/catch codec → `[]`; no throw reaches `attributeChangedCallback` | LLD-C1 `tokenEntriesProp` (SPEC-R7/R11) |
| 2 | attribute removed (`from(null)`) | `[]`, not `null` — why the controls ship the shared hardened codec | LLD-C1 |
| 3 | property write of a non-array / mixed-garbage entry list | `cleanEntries` at the render boundary — hardening is not codec-only | LLD-C4/C6 effects |
| 4 | swatch `value` empty / invalid color / undefined `--var` | transparent box, border carries the shape, composed name still announces | LLD-C2/C3 (SPEC-R3) |
| 5 | ladder tier value not a resolvable length (`"red"`) | `isRenderableLength` routes it to a `0px` bar (NOT dropped); the row + printed value `red` survive — the unified no-silent-state rule, matching swatch's invalid-color-keeps-the-datum | LLD-C6 (SPEC-R11) |
| 6 | ladder tier value huge (`400px` in a 200px track) | `min(100%, --_mag)` caps at the track; no host overflow | LLD-C7 (SPEC-R10 AC2) |
| 7 | every entry dropped | ramp/ladder: zero rows, `role=list` intact; swatch: transparent box + composed name | SPEC-R7/R8/R11/R12 |
| 8 | scheme-invariant token probed for scheme divergence | SPEC-N5: the real-color leg must pick a `light-dark()`-divergent role, else SPEC-R2 AC2 passes vacuously | §8 test plan |
| 9 | forced-colors flattens a painted box | boxes degrade to a `CanvasText` border (swatch/ramp) / the bar paints `CanvasText` (ladder) — honest, printed text survives | LLD-C3/C5/C7 (SPEC-R14) |
| 10 | full `replaceChildren` rebuild mid-AT-read | accepted: display-only cells/rows hold no focus/caret; not a live-region contract (token surfaces are not status surfaces) | LLD-C4/C6 |
| 11 | `--ui-ladder-bar-ink` fails 3:1 on some surface variant | the build wave's color probe measures it; fallback = repointing the token default (a token edit, not a mechanism change) | LLD-C7 |
| 12 | `subgrid`/`@scope`/`min()`/`CSS.supports` engine floor | all ≥ the fleet's existing `@scope`/`subgrid` baseline (ui-bar-chart precedent); browser legs run both engines | LLD-C6/C7, LLD-C1 |

## 8 · Test plan (per slice) & gates

- **Helper units** (`_token-surface/token-surface.test.ts`, jsdom-free): `cleanEntries` (non-array → [], drop
  non-string label/value, order preserved); `cssValue` (empty → '', `--x` → `var(--x)`, literal verbatim);
  `isRenderableLength` (`24px`/`0`/`1.5rem`/`--x` true; `red`/`abc`/'' false); the codec round-trip incl.
  malformed JSON → `[]`.
- **jsdom** (`swatch.test.ts`, `ramp.test.ts`, `ladder.test.ts`): props/attribute reflection; `internals.role`
  (`img`/`list`/`list`) + `ariaLabel` (the composed swatch name verbatim; the ramp/ladder label-or-null); DOM
  shape (cell/row count, `aria-hidden` box/track, printed values, and the ladder's non-length-tier row KEPT with
  its printed value + a `0px` `--_mag` — the unified no-silent-state route, not a drop);
  descriptor trip-wires (`*-descriptor.test.ts`). **jsdom blind spots** (browser-only, below): real color
  resolution, `getComputedStyle` color values, `forced-colors`, `min()`/`subgrid` geometry.
- **Browser, Chromium + WebKit** (`*.browser.test.ts` — SPEC-N2; jsdom is blind to color resolution AND
  forced-colors): whole-shape (bare-in-flex-row box ≥ floor, all three controls); **real color resolution** —
  `getComputedStyle(box).backgroundColor` equals the token's resolved color (SPEC-R2 AC1); **scheme-pin
  divergence** — light vs dark on a **genuinely `light-dark()`-divergent** role compute different colors (SPEC-N5
  — pick e.g. `--md-sys-color-neutral-surface`, NOT a scheme-invariant role); **ladder literal length** — bar
  inline-sizes measure the literal px within ε (SPEC-R10 AC1) and cap at the track (AC2); **RTL** (ladder rows
  mirror, ramp series stays physical LTR); **forced-colors honesty** — every box paints only its `CanvasText`
  border, no fill (SPEC-R14 AC1) — computed-style is the sanctioned visual proof (ADR-0102), no pixel-diff.
- **Site** (`tokens-doc.test.ts` UNCHANGED — the negative proof that the re-host touched rendering, not
  derivation; the per-control `{name}-doc.html` pages under site-coverage; the re-hosted `tokens.ts` builds and
  renders both schemes).
- **Gates**: `npm run check && npm test` green at every slice boundary; `npm run test:browser` before each wave
  commit (the component-reviewer DoD — jsdom-green ≠ done); `npm run size` by hand at LLD-C9. Negative controls:
  the site-coverage display-tier edit (LLD-C9) and the catalog allowlist residue-guard (LLD-C10) must each FAIL
  when their new entry is reverted.

## 9 · Build sequence (checkpointed; = the decomp's edge order)

1. **Wave M1-a:** LLD-C1 (the shared `_token-surface/` helper — frozen first; the three controls all bind to
   its signatures). *Checkpoint:* `token-surface.test.ts` green.
2. **Wave M1-b (parallel, one writer per folder):** LLD-C2/C3 (swatch) ∥ LLD-C4/C5 (ramp) ∥ LLD-C6/C7 (ladder).
   *Checkpoint:* each folder's jsdom + browser legs green.
3. **Wave M1-c (serial):** LLD-C8 descriptors finalized in-folder, then LLD-C9 (barrel/styles/gate edit/size)
   + LLD-C10 (the catalog allowlist seed + residue-guard) — the ONE shared-file writer. *Checkpoint:* repo-wide
   check+test+browser green; SPEC-N2 catalog gate green via the allowlist seed.
4. **Wave M1-d:** LLD-C11 per-control site doc pages, then LLD-C12 the `tokens.ts` re-host + the "Dimensional
   ladders" retitle. *Checkpoint:* site-coverage/toc/nav green; `tokens-doc.test.ts` green UNCHANGED; the
   re-hosted page renders both schemes; net-negative display LOC confirmed.
5. **Wave M2 (separate dispatch — NOT this build):** LLD-C13/C14/C15 catalog rows + guidance + FEED_EXCLUDED +
   exemplar; drain the allowlist to zero.

## Component IDs (trace)

`LLD-C1` shared value-lane helper ← SPEC-R2/R7/R11 · `LLD-C2` UISwatchElement ← SPEC-R1/R2/R3/R4 · `LLD-C3`
swatch.css ← SPEC-R2/R13/R14/R16 · `LLD-C4` UIRampElement ← SPEC-R5/R6/R7/R8 · `LLD-C5` ramp.css ←
SPEC-R6/R13/R14/R15/R16 · `LLD-C6` UILadderElement ← SPEC-R9/R10/R11/R12 · `LLD-C7` ladder.css ←
SPEC-R10/R13/R14/R15/R16 · `LLD-C8` descriptors ← SPEC-R1/R5/R9/R16 · `LLD-C9` integration ← SPEC-N3/N4 ·
`LLD-C10` catalog allowlist seed ← SPEC-R18 · `LLD-C11` site doc pages ← SPEC-N3 · `LLD-C12` tokens.ts re-host
← SPEC-R17 · `LLD-C13/C14/C15` M2 catalog/exemplar (sketch) ← SPEC-R18 / PRD-G4. (`LLD-C#` IDs per-doc-scoped —
the house convention.)
