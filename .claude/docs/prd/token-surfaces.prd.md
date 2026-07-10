# PRD — Token-Surface Component Family (`ui-swatch` · `ui-ramp` · `ui-ladder`)

> Status: **accepted · v1.0 · Owner: agent-ui** — direction RATIFIED by Kim 2026-07-10 (all ADR-0118 forks answered at the ratification pass; began life as a v0.1 scope intake, 2026-07-10) — authored 2026-07-10 by the design seat
> at the design-system-surfaces intake ([TKT-0007](../tickets/tkt-0007-design-system-surfaces.md));
> Kim's family selection is on record (intake fork Q2, 2026-07-10), the contract-direction forks await
> his pass on [ADR-0118](../adr/0118-token-surfaces-v1-scope.md). This is an INTAKE, not a build
> authorization. Ratification = doc-review + Kim's fork answers.
> Altitude: this document owns **why + what-should-exist** for the token-surface family. The
> scope/contract-direction decision record is [ADR-0118](../adr/0118-token-surfaces-v1-scope.md);
> SPEC/LLD are authored at the build wave, not here.
> **Sibling-vs-extension ruling:** a **new sibling PRD** (the chart-family precedent, its §header ruling
> applied): `agent-app-surfaces.prd.md` owns app *chrome*; the A2UI expert-system PRD owns *generation
> reliability*; the chart PRD owns *quantitative* marks (series-shape + magnitude). Token surfaces are
> fleet **content vocabulary** for *design-token* data — a `@agent-ui/components` control family with an
> a2ui catalog surface — that no shipped control serves.
> Grounding: Kim's design-system-surfaces seed (TKT-0007, 2026-07-10: *"token swatches, ranges
> (palettes), ladders (sizes) for colors, typography, shapes"*) · `site/pages/tokens.ts` (159 LOC) +
> `site/lib/token-parse.ts` (96 LOC) — the site-local instance this family promotes ·
> [ADR-0117](../adr/0117-theme-provider-shipped-component.md) (the site-local → shipped-control
> promotion precedent) · [ADR-0107](../adr/0107-chart-family-v1-scope.md) (the display-family intake
> pattern this follows) · `CLAUDE.md` (zero-dependency pillar, naming/layering laws).

## 1. Problem

Design-token data — a color role, a tonal ramp, a dimensional scale — is a first-class *content type*
for this stack, and the fleet can only show it as **printed strings**. The shipped vocabulary has no
way to *show* a color or make a scale's progression visible; `ui-text` can print `oklch(0.598 0.0316
225.06)` but nothing can render the color it names next to the name.

The gap is already paid for, once, as site code — the exact shape ADR-0117 just fixed for the theming
wrapper. `site/pages/tokens.ts` hand-builds live swatch rows (each swatch carries its own
`color-scheme` and reads the real custom property back via `getComputedStyle` — resolved truth, not
prose) and hand-builds dimensional-ramp tables for the five `--ui-*` ladders. That page proves the
rendering is *possible* and *valuable*; it does not make it *reusable* — 159 LOC of display logic
(plus 96 of parse helpers that stay site-local) that the next token page, theme diff, or brand-kit
view re-derives from scratch.

**Who has the problem.** (1) *The docs site* — the grounded internal instance: `tokens.ts` is
untested-as-a-primitive display code. (2) *Models emitting A2UI payloads* — asked to present a palette,
a theme audit, or "show me the brand colors," a model has no honest vocabulary: it can print hex
strings into a table, not show color. (3) *Design-system tooling built on this stack* — including the
sibling **ultimate-tokens** generator (whose exported kits are exactly what `tokens.css` now carries):
any brand-kit editor, theme switcher preview, or token-reference surface re-hand-builds swatches and
ramps today.

**Why this family must beat the printed-string idiom to earn a place.** A `ui-text`/table composition
already covers "what is the token's name and value" — the family is justified only where *seeing the
value* is the point: color identity (a swatch), color *relationships* (a ramp's monotonic progression),
and dimensional *rhythm* (a ladder's stepping). Anything a table of strings already serves stays out.

## 2. Goals & success metrics

Stable IDs; priority tiers; metrics carry baseline + target + timeframe. Milestones M0–M2 in §4.
Downstream SPEC requirements trace to these IDs.

| ID | Priority | Outcome |
|---|---|---|
| **PRD-G1** | must (flagship) | Token data can be *shown*: a swatch, a ramp, and a ladder exist as fleet controls |
| **PRD-G2** | must (cross-cutting) | Token surfaces hold every fleet pillar — zero-dep, token-themed, announced to AT, cross-engine proven |
| **PRD-G3** | must | The site token reference is re-expressed on the primitives; its bespoke display code is deleted |
| **PRD-G4** | should | Agents can emit token surfaces: catalog rows + an exemplar teach the idiom |

**PRD-G1 — Token data can be shown (flagship).** The three failing questions in §1 each get a
component: color identity (`ui-swatch`), color relationship (`ui-ramp` — an ordered series of swatches
with monotonic-progression layout), dimensional rhythm (`ui-ladder` — labeled tiers whose *rendered
magnitude* is visible, not just printed).
- *Metric*: token-surface controls shipped with descriptors; each renders from data a consumer (or
  model) supplies as plain props.
- *Baseline*: **0** (grep: no swatch/ramp/ladder control exists; `site/pages/tokens.ts` is the only
  instance, site-local).
- *Target*: **3** controls shipped (names + contracts per ADR-0118 F1/F2).
- *Timeframe*: **M1** (the first build wave — not authorized by this intake).

**PRD-G2 — Fleet pillars (cross-cutting).** Token surfaces are ordinary `ui-*` citizens: CSS/DOM
rendering only (no canvas, no library), themed via the token roles, sized under the geometry law's
Display class, announced to AT (**a swatch is data, not decoration** — the ADR-0107 clause-4 inversion
applies verbatim: there is no silent state), and proven whole-shape in Chromium AND WebKit.
- *Metric*: fleet DoD gates + an a11y probe per type asserting announced role + accessible name
  (a swatch announces its label and its value; a ramp/ladder announces per-row).
- *Baseline*: n/a (no controls exist).
- *Target*: all gates green at M1, including forced-colors honesty (a swatch whose ink is forced must
  not silently lie — the honest degradation is ADR-0118 F3's fork).
- *Timeframe*: **M1**.

**PRD-G3 — The site token reference upgrades (the dogfood proof).** `site/pages/tokens.ts`
re-expressed on the shipped primitives, its bespoke swatch/table code deleted — the PRD-D5/ADR-0117
"re-host the existing instance" discipline: the promotion is proven against the known-good baseline.
- *Metric*: bespoke display LOC in `tokens.ts`; the parse helpers (`token-parse.ts`) STAY site-local
  (they read the repo's own sheets at build time — a docs-site concern, not a component's).
- *Baseline*: ~85 LOC of deletable display FUNCTIONS in `tokens.ts` (swatch/roleRow/family-loop/dim-loop — the metric correction the M1 doc-review prescribed: 159 was the whole file incl. setup/prose that stays; the 96-LOC `token-parse.ts` is
  parse logic, not display, and stays).
- *Target*: the page composes the primitives; net-negative display LOC; the tokens-doc drift gate
  stays green unchanged.
- *Timeframe*: **M1** (same wave — the reference consumer IS the acceptance proof).

**PRD-G4 — Agents can emit token surfaces.** Catalog rows for the family + one exemplar seed (a
"brand palette" or "theme audit" payload) teach models when a swatch beats a printed hex.
- *Metric*: catalog rows + ≥ 1 validator-clean exemplar in `allSeeds`, usage guidance in the catalog
  SPEC §5.2 Notes (the ADR-0087 Fork-A precedent).
- *Baseline*: **0**.
- *Target*: rows + exemplar shipped; corpus/derived-prompt re-validated (the ADR-0087 consequence
  pattern).
- *Timeframe*: **M2**.

## 3. Scope

**In scope (v1):**
- `ui-swatch` — one color value rendered as a bounded, bordered color box with its label and value as
  real DOM text; scheme-pinnable (render *this* value under light or dark resolution — the
  `tokens.ts` live-resolution behavior, generalized).
- `ui-ramp` — an ordered color series (a tonal ramp, a palette range) as a strip/row of swatch cells
  with per-step labels; the *order* is the content.
- `ui-ladder` — labeled dimensional tiers (heights, spaces, radii, font sizes) where each row renders
  its magnitude visibly (a sized bar/box next to the label+value text).
- Default-catalog rows + the exemplar seed (PRD-G4) at **M2** — the SPEC-N2 whole-fleet gate fires
  the moment descriptors land, so the M1 wave seeds the allowlist and M2 drains it to no residue
  (the ADR-0107 cl.6 discipline, adapted to this family's split waves).
- The site token-reference re-host (PRD-G3).

**Out of scope (v1) — the fence, each with its reason:**
- **Color *editing*** (pickers, sliders, channel inputs) — input-class controls with a spec surface of
  their own; this family is Display-class output. Any editor is a **new intake**.
- **Palette *generation* math** (ramp derivation, contrast solving, gamut mapping) — owned by
  generator apps (the sibling ultimate-tokens engine); these controls *show* values they are given.
  No color math beyond parsing/serializing what CSS already resolves.
- **Contrast-verdict badges** (AA/AAA pass-fail on a swatch pair) — valuable, but it imports a
  judgment engine and a policy surface; *foreseen extension*, named for a future intake.
- **Typography specimen rendering** (waterfalls, pangram previews) — type tokens ride `ui-ladder` as
  magnitude rows in v1; a real specimen surface is its own family if earned.
- **Token *diffing*** (theme-vs-theme comparison views) — composition of these primitives at app
  level, not a v1 control.
- **Any third-party color library** — the zero-dep pillar; CSS itself is the resolver (the browser
  computes the rendered value; the ADR-0118 F2 contract keeps component-owned math to none).

## 4. Milestones

| Milestone | Delivers | Gate |
|---|---|---|
| **M0 (this intake)** | This PRD + ADR-0118 (scope + contract directions + Kim forks) — docs only | doc-review + Kim's fork answers; harness gates green |
| **M1** | The three controls + descriptors + the site token-reference re-host (PRD-G1/G2/G3) | fleet DoD; tokens-doc drift gate green; net-negative site display LOC |
| **M2** | Catalog rows + exemplar + §5.2 guidance + corpus/prompt re-validation (PRD-G4) | SPEC-N2 fleet-derived gate green, no allowlist residue; examples/corpus gates green |

## 5. Open decisions

The genuine forks are owned by [ADR-0118](../adr/0118-token-surfaces-v1-scope.md) §Forks, each with a
firm recommendation awaiting Kim: **F1** the v1 type set + names · **F2** the data contract
(value-string-first with an optional token-var lane) · **F3** forced-colors + a11y announcement shape ·
**F4** catalog/feed disposition. Contract directions (rendering split, size-class, packaging) are
recorded there; mechanisms are SPEC/LLD business at the build wave. Nothing else is open at PRD
altitude.
