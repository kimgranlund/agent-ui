# SPEC — Token-Surface Family (`ui-swatch` + `ui-ramp` + `ui-ladder` + the site re-host)

> Status: proposed · v0.1 · 2026-07-10 · Layer: SPEC (execution contract)
> Refines: [`../prd/token-surfaces.prd.md`](../prd/token-surfaces.prd.md) — **PRD-G1, PRD-G2, PRD-G3** (PRD-G4 is M2, sketched only in §3.5) — under the ratified scope + contract directions of [ADR-0118](../adr/0118-token-surfaces-v1-scope.md) (accepted; forks F1–F4 all answered). Every clause of ADR-0118 is binding here; this SPEC adds the behavior contract, it re-litigates nothing.
> Refined by: [`../lld/token-surfaces.lld.md`](../lld/token-surfaces.lld.md).
> Altitude: owns **what the three token-surface controls do and how they behave at every boundary** + the site token-reference re-host acceptance (PRD-G3). Implementation (value-lane codec internals, CSS mechanics, file layout) is the LLD's. Filed in the charter home (`docs/spec/`, the chart-family regime); the M2 catalog surface (rows, exemplar, guidance, FEED_EXCLUDED) is out of this wave's normative reach and only its seams are sketched (§3.5).
> Requirement IDs file-scoped (`SPEC-R1…`); cross-document references qualify by doc name.

---

## 1. Purpose

Contract the v1 token-surface family ADR-0118 admits: `ui-swatch` (color identity), `ui-ramp` (an ordered
color series), and `ui-ladder` (labeled dimensional tiers whose magnitude is rendered), all **Display-class**,
rendered with plain CSS/DOM (**the browser is the only color engine — component-owned math is none**, ADR-0118
cl.2/3), value-first data contracts a model can emit as JSON, plus the **site token-reference re-host** (PRD-G3)
that dogfoods the primitives against the known-good `site/pages/tokens.ts` baseline. The fence stands: anything
in PRD §3's ruled-out list (editing/pickers, palette-generation math, contrast verdicts, typography specimens,
token diffing, any color library) is out of this SPEC's normative reach. The M2 catalog/teaching wave is
sketched (§3.5), never built here.

## 2. Definitions

- **Value string** — a literal CSS color/length string a control renders directly (`oklch(0.6 0.03 225)`,
  `28px`). Its **`--var` lane** (ADR-0118 cl.2): a value beginning `--` renders `var(<name>)` resolved *in this
  subtree's context* — what you see is the real resolution, the `tokens.ts` honesty generalized.
- **Step** — one `{ label, value }` `ui-ramp` entry (a color value); a **valid step** has a `string` label and a
  `string` value. **Tier** — one `{ label, value }` `ui-ladder` entry (a dimensional value); a **valid tier**
  has the same shape (`string` label + `string` value). A tier value that is not a **resolvable CSS length** does
  NOT invalidate the tier — the row is kept and its magnitude bar renders zero (SPEC-R11 the unified
  no-silent-state rule); length-validity is a rendering router, not a validity gate.
- **Rendered set** — the input after hardening (SPEC-R7/R11): entries whose `label`/`value` are not strings are
  dropped, order preserved. All rendering AND announcement derive from the rendered set, never the raw input.
- **Scheme** — the `color-scheme` a swatch/ramp resolves its color under: `auto` (inherit the ambient scheme —
  no pin), `light`, or `dark`. `ui-ladder` is scheme-invariant (dimensions do not vary by scheme) and carries
  no scheme prop.

## 3. Requirements

Normative per RFC 2119; each carries an ID, PRD trace, and acceptance criteria.

### 3.1 `ui-swatch` (color identity)

**SPEC-R1 — Component contract.** `ui-swatch` MUST be a Display-class, non-interactive, non-form-associated
leaf (`UIElement`; no events, no keyboard contract, no children content model) with exactly three props:
`value` (`string`, default `''` — a literal CSS color or a `--var` name), `label` (`string`, default `''` — the
token name / caption), and `scheme` (`'auto' | 'light' | 'dark'`, default `'auto'`). *(→ PRD-G1; ADR-0118
cl.1/2)*
- **AC1** *Given* `<ui-swatch value="oklch(0.6 0.03 225)" label="primary-500">`, *when* connected, *then* it
  renders a bordered color box painting that color, with `primary-500` as real DOM text, and `el.value` is the
  literal string.
- **AC2** *Given* the descriptor (`swatch.md`), *then* `tier: display`, `extends: UIElement`, `events: []`, and
  the `attributes[]` block mirrors `static props` (the descriptor↔props trip-wire).

**SPEC-R2 — Rendering & the `--var` lane.** The box MUST be a styled `div`/`span` whose `background` is the
value: a literal value paints directly; a value beginning `--` paints `var(<value>)` resolved in place (no
fallback — an undefined var resolves to transparent, SPEC-R3). The box carries a hairline
`--md-sys-color-outline-variant` border so a surface-colored swatch **never disappears into the page** (the
whole-shape law applied to a color that equals its background). The `scheme` prop, when `light`/`dark`, sets
`color-scheme` on the box so `light-dark()`-valued tokens resolve under the pinned scheme; `auto` sets nothing
(ambient). The label/value are real DOM text reading the type tokens (ADR-0078) — selectable, wrapping,
AT-visible. No SVG, no canvas, no library, **no color math** (ADR-0118 cl.2/3). Rendering is derived state:
setting any prop re-renders. *(→ PRD-G1, PRD-G2; ADR-0118 cl.2/3)*
- **AC1** *Given* `value="--md-sys-color-primary-container"`, *then* the box `background` computes to that
  token's resolved color in the element's context (browser leg — real `getComputedStyle`), not the literal
  string `var(...)`.
- **AC2** *Given* `scheme="dark"` on a `light-dark()`-valued token vs `scheme="light"` on the same token, *then*
  the two boxes compute **different** resolved colors (the scheme pin is observable).
- **AC3** *Given* a swatch whose value equals the page surface color, *then* the box still has a visible
  1px `outline-variant` border (it never vanishes).

**SPEC-R3 — Input hardening.** No input throws; the box always paints (SPEC-R13 floor) and always announces
(SPEC-R4). Per case:

| `value` | Box fill | Notes |
|---|---|---|
| empty / absent | transparent (border only) | the honest "no color" state — never collapsed |
| a valid CSS color literal | that color | the browser resolves |
| a `--`-prefixed name, var defined in context | the resolved token color | the live-resolution honesty |
| a `--`-prefixed name, var **undefined** in context | transparent (border only) | `var()` with no fallback → invalid → transparent; no throw, border carries the shape |
| an **invalid** color string | transparent (border only) | CSS drops the bad `background` declaration; no component guard needed, no throw |

*(→ PRD-G2)*
- **AC1** *Given* each row, *when* rendered, *then* the stated fill, no exception, and a painted, non-collapsed
  box with its border (whole-shape law).

**SPEC-R4 — A11y contract (composed name).** A swatch is data, not decoration: `role=img` via
`ElementInternals` (never host attributes), with a **composed accessible name** — there is no silent state, with
or without `label`. The name is `label` (when non-empty) + `", "` + the `value` string, e.g. `primary-500,
oklch(0.6 0.03 225)`; with no label the value alone announces; with neither, the name is `swatch` (never
nameless, never `aria-hidden`). The color box itself contributes no separate node — the composed name IS the
datum (the color cannot be announced, only its name/value). *(→ PRD-G2; ADR-0118 cl.4)*
- **AC1** *Given* `label="primary-500"` and `value="oklch(0.6 0.03 225)"`, *then* `internals.role === 'img'`
  and the accessible name is `primary-500, oklch(0.6 0.03 225)`.
- **AC2** *Given* no `label` and a set `value`, *then* the name is the value string alone and the element is
  still `role=img`; *given* neither, the name is `swatch` — never nameless.

### 3.2 `ui-ramp` (an ordered color series)

**SPEC-R5 — Component contract.** `ui-ramp` MUST be a Display-class, non-interactive, non-form-associated leaf
with exactly three props: `steps` (`{ label: string; value: string }[]`, default `[]`; attribute form = the
JSON string, property form = the typed array — the `static props` system, ADR-0107 cl.2 precedent), `label`
(`string`, default `''` — the series name), and `scheme` (`'auto' | 'light' | 'dark'`, default `'auto'`, pinning
the whole strip). The **order of `steps` is the content** (a tonal ramp, a palette range). *(→ PRD-G1; ADR-0118
cl.1/2)*
- **AC1** *Given* `<ui-ramp steps='[{"label":"100","value":"#eef"},{"label":"900","value":"#003"}]'>`, *then*
  two swatch cells render in that order and `el.steps` is the typed array.
- **AC2** *Given* the descriptor (`ramp.md`), *then* `tier: display`, `events: []`, attributes mirror `static
  props`.

**SPEC-R6 — Rendering (the strip).** One cell per valid step, in `steps` order: a color box (same painting +
`--var` lane + hairline-border rules as SPEC-R2, under the ramp's `scheme`) with its per-step `label` as real
DOM text. The cells form a **strip** (a row that reads as an ordered progression); the strip wraps rather than
overflowing its container. Labels/values stay real DOM text (selectable, token-typed). Setting `steps`
re-renders the whole strip (whole-array swap — no incremental API). *(→ PRD-G1, PRD-G2; ADR-0118 cl.2/3)*
- **AC1** *Given* four steps, *then* four cells render left-to-right in `steps` order (order preserved —
  browser leg asserts the physical cell order), each painting its value.
- **AC2** *Given* a strip wider than its container, *then* it wraps to a second line; no cell collapses and the
  host never scrolls its parent horizontally (whole-shape law).

**SPEC-R7 — Input hardening.** Same discipline as SPEC-R3, per case — none throws:

| Input | Rendering |
|---|---|
| `[]`, absent, malformed attribute JSON, non-array | zero cells; the host announces an empty list (SPEC-R8) |
| steps that are not valid steps (missing/non-string `label` or `value`) | dropped; remaining cells render in order |
| a step whose `value` is an invalid color / undefined `--var` | the cell renders transparent + border (SPEC-R3), its label still prints |
| duplicate labels | both cells render (the list is positional, not keyed) |

*(→ PRD-G2)*
- **AC1** *Given* each row, *then* the stated rendering, no exception, and (for non-empty rendered sets) a
  painted, non-collapsed strip.

**SPEC-R8 — A11y contract (list semantics).** Via `ElementInternals`: the host is `role=list` (the
`ui-bar-chart`/`ui-list` precedent) named by `label` when non-empty; each rendered cell is a `role=listitem`
node whose text content announces its **label and value string** ("`100, #eef`" — the printed value is the
accessible datum). The color box itself is `aria-hidden` (color cannot be announced). No step is color-encoded
only — the label + value string carry the meaning (CVD-safe by construction). *(→ PRD-G2; ADR-0118 cl.4)*
- **AC1** *Given* two valid steps, *then* `internals.role === 'list'` and exactly two `role=listitem`
  descendants exist, each containing the label and value text.
- **AC2** *Given* an empty rendered set, *then* the host remains `role=list` with zero items (the honest empty
  state).

### 3.3 `ui-ladder` (labeled dimensional tiers)

**SPEC-R9 — Component contract.** `ui-ladder` MUST be a Display-class, non-interactive, non-form-associated leaf
with exactly two props: `tiers` (`{ label: string; value: string }[]`, default `[]`; attribute form = the JSON
string, property form = the typed array) and `label` (`string`, default `''`). No `scheme` (dimensions are
scheme-invariant). *(→ PRD-G1; ADR-0118 cl.1/2)*
- **AC1** *Given* `<ui-ladder tiers='[{"label":"sm","value":"24px"},{"label":"lg","value":"36px"}]'>`, *then*
  two rows render, the `lg` bar longer than the `sm` bar, values printed.
- **AC2** *Given* the descriptor (`ladder.md`), *then* `tier: display`, `events: []`, attributes mirror
  `static props`.

**SPEC-R10 — Rendering (magnitude as literal length).** One row per valid tier, in `tiers` order: **label ·
magnitude bar · printed value** on a shared grid so labels/values stay real DOM text. The bar's inline-size is
the tier's **literal length value** (a `--var` value routed through the `--var` transform to `var(--…)` first —
SPEC-R2 / LLD-C1, never a bare dashed-ident), capped to the track width — `min(100%, <value>)` — so a `28px`
tier draws a 28px bar and a `36px` tier a 36px bar: **the magnitude is literally true, rendered by the browser,
with no
component normalization math** (ADR-0118 cl.2/3 — this is the deliberate departure from `ui-bar-chart`, which
DOES normalize numeric magnitudes 0..100; a ladder shows lengths at their real size, and the printed value is
the exact datum). Cross-tier re-normalization (scaling the smallest-to-largest span to fill the track) would
require component math and is a *foreseen extension*, out of v1. Values are real DOM text; setting `tiers`
re-renders the whole list. *(→ PRD-G1, PRD-G2; ADR-0118 cl.1/2/3)*

> **The literal-length limitation (accepted, Kim 2026-07-10 — a documented property, not a surprise).** Because
> magnitudes are literal and unnormalized, a **small-scale** ladder (e.g. radii `2/4/8/12px`) shows visually
> near-identical short bars — its rhythm is read from the **printed values**, not from bar-length contrast — and
> a tier **wider than the track saturates** at 100% (`min(100%, …)`), so several large tiers can read as
> equal-length full bars. This is the accepted cost of the no-math law (ADR-0118 cl.2); cross-tier normalization
> (scaling the span to fill the track) is the named foreseen extension (§5). **PRD-G1's "visible rhythm" is
> therefore honestly scoped at M1:** the bar makes *relative* magnitude pre-attentive where the tiers span a
> visible range; the printed value is the exact datum in every case, including the saturated and near-zero ends.
- **AC1** *Given* tiers `24px`/`28px`/`36px`, *then* the three bar inline-sizes measure 24/28/36 px within ε
  (browser leg — the literal-length rendering, not a normalized proportion).
- **AC2** *Given* a tier value wider than the track (e.g. `400px` in a 200px track), *then* its bar caps at the
  track width (`min(100%, …)`) and does not overflow the host.
- **AC3** *Given* a long label, *then* it wraps within its column; the bar and value cells stay visible and
  aligned.

**SPEC-R11 — Input hardening & length routing.** Same discipline as SPEC-R7; length-validity is a **rendering
router, not a drop gate** — the **unified no-silent-state rule**: whenever the magnitude bar cannot render, the
row is KEPT with a zero-length bar and its printed value, so the datum always survives — matching swatch's
invalid-color-keeps-the-datum (SPEC-R3) and ramp's invalid-color-keeps-the-cell (SPEC-R7). None throws:

| Input | Rendering |
|---|---|
| `[]`, absent, malformed attribute JSON, non-array | zero rows; the host announces an empty list (SPEC-R12) |
| tiers with a missing/non-string `label` or `value` | dropped; remaining rows render in order (the only drop case — the entry is not a well-formed tier) |
| a tier whose `value` is **not a resolvable length** (e.g. `"red"`, `"abc"`) | **kept** — a zero-length bar, the printed value (`red`) carries the reading; the reader sees exactly what malformed value was supplied (not silently vanished) |
| a `0`-length tier (`0`, `0px`) | one row, a zero-length bar; the printed `0` carries the reading |
| a `--var` length | rendered via `var(<value>)` in the bar size; an undefined var → zero-length bar, value text prints (the `min(100%, var(--_mag, 0px))` fallback genuinely fires — LLD-C6/C7) |
| duplicate labels | both rows render (positional, not keyed) |

*(→ PRD-G2)*
- **AC1** *Given* each row, *then* the stated rendering, no exception, and (for non-empty rendered sets) a
  painted, non-collapsed host.
- **AC2** *Given* `tiers` mixing `"24px"`, `"red"`, and `"36px"`, *then* **three** rows render — the `24px` and
  `36px` bars measure literally, and the `red` row shows a zero-length bar with `red` printed (the malformed
  datum survives, no silent state).

**SPEC-R12 — A11y contract (list semantics).** Identical shape to SPEC-R8: `role=list` via `ElementInternals`
named by `label` when non-empty; each tier a `role=listitem` announcing its **label and value string** ("`sm,
24px`"); the magnitude bar is `aria-hidden` (the printed value is the accessible datum). Magnitude travels by
length + printed value — no color-only signifier. *(→ PRD-G2; ADR-0118 cl.4)*
- **AC1** *Given* two valid tiers, *then* `internals.role === 'list'` and two `role=listitem` rows announce
  label + value; the bar nodes are `aria-hidden` and text-free.
- **AC2** *Given* an empty rendered set, *then* the host stays `role=list` with zero items.

### 3.4 Cross-cutting (all three controls)

**SPEC-R13 — Tokens, defaults, and the CSS-less consumer.** Box/cell/bar geometry rides component-owned tokens —
`--ui-swatch-*` / `--ui-ramp-*` / `--ui-ladder-*`, density-invariant px/em quantities per ADR-0118 cl.5 (the
declaring-selector mechanics — the standard specificity-0 `:where()` block — are the LLD's). Under **ADR-0102
Lane A**, every rendered-correctness concern has a component-owned safe default: a bare, unsized surface in any
container (including a flex row) MUST paint a visible, non-collapsed box with zero consumer CSS — sizing floors
are token defaults, page-author CSS survives only as override freedom. Specifically: **a bare `<ui-swatch>`
never collapses** — an explicit token box size (not `auto`), plus the hairline border, guarantees a visible
square. *(→ PRD-G2; ADR-0102; ADR-0118 cl.3/5)*
- **AC1** *Given* a bare `<ui-swatch value="…">`, a populated `<ui-ramp>`, and a populated `<ui-ladder>` each
  inside an unstyled flex row, *when* painted (browser, both engines), *then* each bounding box ≥ its token
  floor — never a dot/sliver (test-the-whole-shape).
- **AC2** *Given* the family-coherence token gate, *then* each control's `:where()` block declares only its own
  `--ui-{name}-*` (∪ shared allowlist).

**SPEC-R14 — Forced colors (WHCM) honesty.** Color boxes cannot paint under `forced-colors: active` — the
printed value text IS the content there. Each color box MUST **degrade to its border** (a `CanvasText`
hairline), never a fake system color that misrepresents the token; the label and value text are real text and
survive untouched. An explicit `forced-colors` probe asserts the row stays legible and the box does not
masquerade as a painted color. `ui-ladder` bars similarly degrade to a bordered shape (magnitude still travels
by length + printed value). *(→ PRD-G2; ADR-0118 cl.3/4 — the forced-colors honesty fork F3)*
- **AC1** *Given* forced-colors emulation (browser leg), *then* every color box renders as its `CanvasText`
  border with no painted fill (computed-style assertion — the ADR-0102 sanctioned visual proof), and the label
  + value text remain legible.

**SPEC-R15 — RTL.** In an RTL context: `ui-ramp` cells and `ui-ladder`/`ui-swatch` label/value layout follow the
writing direction via logical CSS throughout (no physical-direction assumptions). A **color ramp keeps its
series direction physical left→right** by default — a tonal progression conventionally reads light→dark
left-to-right regardless of locale (the `ui-sparkline` series-direction precedent, SPEC chart-family R11);
`ui-ladder` rows and text mirror. *(→ PRD-G2)*
- **AC1** *Given* `dir="rtl"` (browser leg), *then* ladder label/value cells mirror (measured positions) and the
  ramp's first step remains at the physical left edge.

**SPEC-R16 — Geometry posture (Display class).** No control takes a `[size]` attribute, a `[scale]` geometry
row, or any control height (`geometry.md` five-class table; ADR-0118 cl.5). Box/cell/bar geometry gets
`--ui-{name}-*` density-invariant tokens; label/value text reads the `--md-sys-typescale-*` matrix (ADR-0078);
any row/cell rhythm rides the `--ui-space` ladder (density-responsive for free — the ADR-0103 precedent). *(→
PRD-G2)*
- **AC1** *Given* `[density]` on an ancestor, *then* cell/row gap changes and box size / bar thickness / floors
  do not.
- **AC2** *Given* the descriptor geometry blocks, *then* none declares a `size` attribute nor consumes
  `--ui-height-*`.

### 3.5 Site token-reference re-host (PRD-G3) + the M2 seams

**SPEC-R17 — The site re-host (the dogfood proof).** `site/pages/tokens.ts` MUST be re-expressed on the shipped
primitives, its bespoke display code deleted (**net-negative display LOC**), against the known-good baseline —
the ADR-0117 "re-host the existing instance" discipline. Specifically:
1. **Color roles → `ui-swatch`** (Kim 2026-07-10): the per-family color-**role** tables (the hand-built
   `swatch()`/`roleRow()`/`<table>` construction) become `ui-swatch` compositions reading the same
   `parseColorRoles` data. The role families **stay swatch tables** — roles-as-ramp is **rejected** (a semantic
   role set is not an ordered progression; rendering it as a ramp would teach the very idiom F1 legislated
   against, ADR-0118 cl.1 / F1).
2. **Numbered tonal primitives → `ui-ramp`** (the ramp dogfood, Kim 2026-07-10): a **new section** renders the
   numbered tonal-primitive steps (`--md-sys-color-{family}-100…900`, the genuinely ordered series
   `parseColorRoles` deliberately excludes) as one `ui-ramp` per family — the honest home for the ordered-series
   idiom. **Data source:** an **additive** `parseColorPrimitives(tokensCss)` site helper in `token-parse.ts` —
   NOT a hand-typed literal series (which would silently rot on a palette change, the exact anti-pattern this
   page exists to avoid). It derives from the same sheet (`derive-don't-hand-type`) and carries its own
   anti-vacuous guard + a `tokens-doc.test.ts` non-vacuous assertion; it is **purely additive** — `parseColorRoles`/
   `parseDimensionRamp`/`familiesOf` and their existing assertions are untouched, so `token-parse.ts`'s site-local
   drift contract holds (adding a function is not changing the existing one).
3. **Dimensional tables → `ui-ladder`**: the five dimensional-ramp tables become `ui-ladder` compositions reading
   the same `parseDimensionRamp` data; and — the **F1 vocabulary rider (ADR-0118 cl.1)** — the page's `##
   Dimensional ramps` heading (and the `DIMENSION_RAMPS` naming) retitles to **"Dimensional ladders"** so repo
   vocabulary converges (color=ramp / dimensions=ladder; "tonal ramp" stays the color term).

The `tokens-doc.test.ts` drift gate keeps proving the **data**: its existing `parseColorRoles`/`parseDimensionRamp`/
`familiesOf` assertions are unchanged, and it **gains** one non-vacuous assertion for `parseColorPrimitives`
(the new section is gate-backed, not hand-derived). *(→ PRD-G3; ADR-0117; ADR-0118 cl.1/7)*
- **AC1** *Given* the re-hosted `tokens.ts`, *then* it composes `ui-swatch` (roles), `ui-ramp` (tonal primitives),
  and `ui-ladder` (dimensions) — no hand-built swatch `div`s or magnitude tables remain; the delete is
  net-negative against the **enumerated deletable-function subset (≈85 LOC:** `swatch()` ~11 + `roleRow()` ~19 +
  the per-family table loop ~20 + the dimensional table loop ~35) — NOT the whole 159-line file (the PRD-G3 "159
  LOC" is the whole-file figure; imports/`mountPage`/`pageLead`/guards/prose STAY). **Honest LOC accounting:** the
  new primitive-ramp section ADDS ~12–15 *display* LOC to `tokens.ts`, still swamped by the ~85 deleted (net
  strongly negative); the `parseColorPrimitives` helper is *parse* logic in `token-parse.ts`, which the PRD's own
  display-vs-parse split excludes from the display-LOC count. The page renders in the built site (both schemes).
- **AC2** *Given* `tokens-doc.test.ts`, *then* its **existing** parse assertions (`> 100` roles, the nine
  families, the five ramp tiers) pass **unchanged**, and a **new** non-vacuous assertion proves
  `parseColorPrimitives` resolves a non-empty ordered step set per family — the re-host touched rendering + added
  a derived data source, never mutating the existing derivation.
- **AC3** *Given* the built page, *then* the dimensional section heading reads **"Dimensional ladders"** (the F1
  rider), the color-role section still shows the light/dark resolution per role via the swatch `scheme` prop, and
  the new tonal-primitive section shows each family's `100…900` steps as an ordered `ui-ramp`.

> **The resolved-value readback delta (an accepted loss, not an escalation).** The current `tokens.ts` sets a
> `title` on each swatch with the `getComputedStyle` resolved color string. ADR-0118 cl.2 rules the
> `getComputedStyle` readback a **foreseen extension, not v1 contract** — so the re-hosted page renders the
> live-resolved *color* (via `ui-swatch`'s `--var` lane + `scheme`) but no longer surfaces the resolved *string*
> on hover. The live resolution — the honesty the page exists for — is preserved; only the hover-string is
> deferred. Recorded here so the re-host is not read as a regression.

**SPEC-R18 — M2 seams (sketch only — NOT built in this wave).** The M2 wave (ADR-0118 cl.6, fork F4) will add
`Swatch` · `Ramp` · `Ladder` **display-only** catalog rows (one-way props, no `value:{prop,event}` mark, no
ADR-0019 seam slot), a validator-clean exemplar ("brand palette" / "theme audit"), §5.2 usage-guidance prose
(*tile for a metric · Swatch/Ramp for color identity/relationships · Ladder for dimensional rhythm · a table
when exact strings must be scanned*), and the **FEED_EXCLUDED** bookkeeping entries (all three OUT — report/
reference content, no ask affordance; the ADR-0097 partition gate is TOTAL, so descriptors landing at M1 seed
the SPEC-N2 allowlist and M2 drains it to no residue). This SPEC pins none of it normatively — the M2 wave gets
its own SPEC/LLD/decomp. The **only M1 obligation the seam creates**: when the three descriptors land (SPEC-N3),
the SPEC-N2 fleet-derived catalog gate turns red until each type is catalog-declared **or** allowlisted; M1
therefore seeds the intra-family allowlist (drained to zero at M2). *(→ PRD-G4; ADR-0118 cl.6)*
- **AC1** *Given* the three descriptors landed at M1 with no catalog rows, *then* the SPEC-N2 gate is satisfied
  by an allowlist seed carrying `Swatch`/`Ramp`/`Ladder`, with a residue-guard assertion (every allowlist key
  absent from the catalog, so a forgotten entry cannot stay silently green — the LLD-C10 chart precedent).

## 4. Non-functional requirements

| ID | Requirement | Target |
|---|---|---|
| **SPEC-N1** | Zero runtime dependency | No color library, no vendored code, no new package (ADR-0118 cl.7 — ordinary `controls/{swatch,ramp,ladder}/` folders); imports point inward only; component-owned color math is **none** (the browser resolves) |
| **SPEC-N2** | Cross-engine proof | jsdom is blind to real color resolution AND to `forced-colors` — browser legs (Chromium + WebKit) are mandatory per control: whole-shape, real `getComputedStyle` color-resolution, scheme-pin divergence, WHCM honesty, RTL, literal-length ladder bars |
| **SPEC-N3** | Fleet gates stay green | file-set, family-coherence, descriptor↔props trip-wires, site per-tier page set (`{name}-doc.html` for tier=display), the site-coverage display-tier membership list, `tokens-doc.test.ts` existing assertions unchanged (+ one additive `parseColorPrimitives` assertion), `npm run check && npm test` |
| **SPEC-N4** | Size budget honesty | `npm run size` run at the build wave (manual, ADR-0040); a family budget re-base, if needed, recorded — never silently absorbed (three small controls, no math module; likely cheap) |
| **SPEC-N5** | Scheme-invariance probe honesty | the real-color-resolution legs MUST pick a **genuinely scheme-divergent** token (a `light-dark()`-valued role whose light and dark resolutions differ) — some `--md-sys-color-*` roles are deliberately scheme-invariant, and a probe on one of those would pass vacuously (SPEC-R2 AC2 must bite) |

## 5. Open items (non-normative)

- Foreseen extensions, deliberately out of v1 (each re-enters only by its own record): the `getComputedStyle`
  resolved-value readback (`title`/copy affordance) · cross-tier ladder normalization · a contrast-verdict badge
  on a swatch pair · typography specimen rendering · token diffing · any editor/picker (a **new intake**, per
  the fence). The M2 catalog/teaching wave (§3.5) is scheduled, not open.

## 6. Traceability

| Requirement | PRD goal(s) |
|---|---|
| SPEC-R1–R4 | PRD-G1 (`ui-swatch` exists + behaves), PRD-G2 (a11y, hardening) |
| SPEC-R5–R8 | PRD-G1 (`ui-ramp` exists + behaves), PRD-G2 |
| SPEC-R9–R12 | PRD-G1 (`ui-ladder` exists + behaves), PRD-G2 |
| SPEC-R13–R16 | PRD-G2 (tokens, WHCM honesty, RTL, geometry law, CSS-less consumer) |
| SPEC-R17 | PRD-G3 (the site re-host + the retitle rider + drift-gate continuity) |
| SPEC-R18 | PRD-G4 (M2 catalog/teaching seam — sketched, allowlist seeded at M1) |
| SPEC-N1–N5 | PRD-G2 (zero-dep, cross-engine, gates, size, probe honesty) |
