# ADR-0118 — Token-surface family v1 scope: `ui-swatch` + `ui-ramp` + `ui-ladder`, display-class, CSS/DOM-rendered, value-first contracts, M2 (next-wave) catalog rows

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-10
>
> | Field | Value |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-07-10 |
> | **Proposed by** | planner (design seat — the design-system-surfaces intake, [TKT-0007](../tickets/tkt-0007-design-system-surfaces.md); Kim selected the family at intake, fork Q2 2026-07-10) |
> | **Ratified by** | *(awaiting Kim — F1 ANSWERED 2026-07-10: flat names, ramp=color/ladder=dims + the site-retitle rider, see §Forks; F2–F4 carry firm recommendations; the recommendation is the default absent an objection)* |
> | **Repairs** | NEW [`../prd/token-surfaces.prd.md`](../prd/token-surfaces.prd.md) (authored in this same change — the owning doc whose scope §3 + goals this ADR pins) |
> | **Supersedes / Superseded by** | (none) — relates [ADR-0107](./0107-chart-family-v1-scope.md) (the display-family intake pattern + the same-wave catalog and no-new-package clauses this reuses) · [ADR-0117](./0117-theme-provider-shipped-component.md) (the site-local → shipped-control promotion precedent) · [ADR-0087](./0087-a2ui-whole-fleet-catalog-scope-policy.md) (the whole-fleet catalog gate clause 6 obeys) · [ADR-0078](./0078-ui-text-three-axis-variant-size-as.md) (the type tokens label text reads) · [ADR-0102](./0102-css-less-consumer-contract-law.md) (every default must survive the CSS-less consumer) |

## Context

Kim's design-system-surfaces seed (TKT-0007) names *"token swatches, ranges (palettes), ladders
(sizes) for colors, typography, shapes"* — and the fleet cannot show any of them: no control renders a
color as color or a dimension as magnitude. The capability exists exactly once, hand-built and
site-local (`site/pages/tokens.ts` — live scheme-pinned swatches reading real custom properties back
via `getComputedStyle`; hand-rolled ramp tables), which is verbatim the shape ADR-0117 just promoted
out of for the theming wrapper. The intake dedup verified the gap against all 42 shipped descriptors.

Two standing laws bound the solution space. **(1) The zero-dependency pillar** rules out color
libraries — but unlike charts (ADR-0107), token surfaces need **no math at all**: the browser is the
resolver (a swatch's rendering IS `background: <value>`), so the scope decision is a *contract*
decision, not a cost decision. **(2) Display-class discipline** (the chart precedent): these are
passive content vocabulary — the moment a surface *edits* rather than *shows*, it changes class and
explodes scope (a color picker owes channel models, gamut UI, precision input). The v1 fence is
therefore *show, never edit*.

## Decision

**We will admit a token-surface family into the fleet — `ui-swatch` + `ui-ramp` + `ui-ladder` —
Display-class, rendered with plain CSS/DOM (the browser as the only color engine), value-first data
contracts a model can emit as JSON, entering the default catalog in the wave after they ship.** One
decision — the v1 scope + contract direction — realized in seven clauses; SPEC/LLD own the mechanisms
at build (PRD-G1…G4 trace).

1. **The v1 type set** *(PRD-G1; fork F1)*: `ui-swatch` (one color value: a bounded, bordered color
   box + label + value as real DOM text; a `scheme` prop pins light/dark resolution — the `tokens.ts`
   per-element `color-scheme` behavior, generalized), `ui-ramp` (an ordered color series as a strip of
   swatch cells with per-step labels — order is the content), `ui-ladder` (labeled dimensional tiers,
   each row rendering its magnitude as a sized bar/box next to label+value text). Ruled out for v1,
   with the fence in PRD §3: editing/pickers, palette-generation math, contrast verdicts, typography
   specimens, token diff views. Any editor is a **new intake**.
2. **Value-first data contracts** *(PRD-G1; fork F2)*: every type accepts **literal CSS color/length
   strings** as its primary lane — `ui-swatch value="oklch(0.6 0.03 225)" label="primary-500"`;
   `ui-ramp` takes `steps: { label: string; value: string }[]`; `ui-ladder` takes
   `tiers: { label: string; value: string }[]` (attribute form = JSON string; property form = typed
   array — the `static props` system, ADR-0107 cl.2 precedent). A **token-var lane** rides the same
   prop: a `value` beginning `--` renders `var(<name>)` resolved in place (the live-resolution
   honesty of `tokens.ts` — what you see is this subtree's real resolution). Component-owned math:
   **none** — the browser resolves; `getComputedStyle` readback (the resolved-value `title`) is a
   *foreseen extension*, not v1 contract.
3. **Rendering is CSS/DOM only** *(PRD-G2)*: color boxes are styled `div`s; ladder magnitudes are
   sized boxes; labels/values are real DOM text reading the type tokens (ADR-0078) — selectable,
   wrapping, AT-visible. No SVG, no canvas, no library. A swatch's box carries a hairline
   `--md-sys-color-outline-variant` border so a surface-colored swatch never disappears into the page
   (the whole-shape law applied to a color that equals its background).
4. **A token surface is data, not decoration** *(PRD-G2; fork F3)*: the ADR-0107 clause-4 inversion
   verbatim. `ui-swatch`: `role=img` via `ElementInternals`, accessible name = `label` + the value
   string ("primary-500, oklch(0.6 0.03 225)") — with no label, the value alone still announces;
   there is no silent state. `ui-ramp`/`ui-ladder`: **list semantics** via internals (the
   `ui-bar-chart`/`ui-list` precedent), one row per step announcing "label, value"; the color box /
   magnitude bar itself is aria-hidden (the printed value is the accessible datum). **Forced-colors
   honesty:** color boxes cannot paint under `forced-colors: active` — the printed value text IS the
   content there; the box degrades to its border (never a fake color); an explicit probe asserts the
   row stays legible.
5. **Size class: Display — no new class** *(PRD-G2)*: no control height, no `h/2` law, no
   `[scale]`/`[size]` rows (the ADR-0107 cl.5 reasoning). Box geometry (swatch box size, ramp cell
   size, ladder bar thickness) gets `--ui-{swatch,ramp,ladder}-*` tokens in the standard `:where()`
   block — density-invariant quantities, LLD business. A bare swatch in a flex row must paint a
   visible, non-collapsed box (test-the-whole-shape).
6. **Catalog + teaching, the M2 wave** *(PRD-G4)*: `Swatch` · `Ramp` · `Ladder` catalog rows —
   display-only, one-way props, no `value:{prop,event}` mark (no ADR-0019 seam slot consumed). The
   SPEC-N2 fleet-derived gate forces catalog-or-allowlist when descriptors land at M1: the M1 wave
   seeds the allowlist, M2 drains it to **no residue** with the rows + a validator-clean
   exemplar ("brand palette" / "theme audit") + §5.2 usage-guidance prose (tile for a metric ·
   Swatch/Ramp for color identity/relationships · Ladder for dimensional rhythm · a table when exact
   strings must be scanned). Corpus + derived prompt re-validate (the ADR-0087 consequence pattern).
   **Feed disposition:** the ADR-0097 partition gate is TOTAL (the ADR-0107 Amendment-2 lesson), so
   the M2 wave OWES the bookkeeping entry: all three types join `FEED_EXCLUDED` (OUT — report/reference
   content reaches the artifact feed via its full-catalog rendering; no ask affordance exists to admit).
7. **Packaging: no new package** — ordinary `controls/{swatch,ramp,ladder}/` folders (the ADR-0107
   cl.7 reasoning holds a fortiori: no vendored mass, no math module). The site page re-host (PRD-G3)
   deletes `tokens.ts`'s bespoke display code in favor of the controls; `site/lib/token-parse.ts`
   **stays site-local** (build-time sheet parsing is a docs-site concern — the controls take data,
   they do not read CSS files).

### Forks for Kim (each with a firm recommendation; the recommendation is the default absent an objection)

- **F1 — the v1 type set + names.** *Recommend: `ui-swatch` + `ui-ramp` + `ui-ladder`* (clause 1).
  Live alternatives: swatch-only (cheapest, but ramps/ladders — the *relationship* views, and the seed's
  explicit asks — stay hand-built); `ui-palette` instead of `ui-ramp` (rejected: "palette" implies an
  unordered set + selection affordance; "ramp" names the ordered-progression content honestly);
  folding ladder into ramp with a `kind` prop (rejected: color cells and magnitude bars share no
  rendering, only the row shape — one component wearing two bodies).
  **ANSWERED by Kim, 2026-07-10 (the F1 naming interrogation):** flat names stand as recommended —
  a `ui-token(s)-*` namespace was weighed and rejected (it would be the fleet's first family prefix,
  against the flat convention every shipped family holds, and "token" misnames the value-first
  contract: a proposed palette is literal values, not tokens). Ramp=color / ladder=dimensions
  confirmed, **with a vocabulary-convergence rider:** the site token page currently titles its
  dimensional section "Dimensional ramps" (`DIMENSION_RAMPS`/`parseDimensionRamp`) — at the M1
  re-host (clause 7 / PRD-G3) that section retitles to **"Dimensional ladders"** so repo vocabulary
  converges on this assignment ("tonal ramp" stays the color term, per color-industry canon).
- **F2 — the data contract.** *Recommend: value-first with the `--var` lane riding the same prop*
  (clause 2). The alternative — token-name-first (`token="--md-sys-color-primary"` as the primary
  contract) — optimizes for the docs-site consumer but fails the emitting model (an agent presenting
  a *proposed* palette has literal values, no vars) and couples the control to a resolution context it
  can't guarantee. Value-first serves both; the var lane is sugar over the same rendering.
- **F3 — forced-colors + a11y shape.** *Recommend: clause 4 as stated* (role=img + composed name for
  swatch; list semantics for ramp/ladder; border-only degradation under WHCM). The alternative — a
  table-based semantic (real `<table>` rows) — reads better for large ramps but forks the fleet's
  internals-only ARIA law and drags table layout into a strip-shaped component.
- **F4 — catalog/feed disposition.** *Recommend: M2 rows + FEED_EXCLUDED* (clause 6). The alternative
  — same-wave (M1) catalog rows — matches ADR-0107 cl.6 more literally but forces the exemplar +
  guidance work into the control wave; splitting M1 (controls + site proof) from M2 (agent teaching)
  keeps each wave one-context-sized. The allowlist seed is intra-family and drains to zero at M2.

## Consequences

- **The fleet gains a third display family** (charts · content · token surfaces) — the Display-class
  taxonomy in `geometry.md` now has three citizens with identical size-class reasoning; a future
  display intake should copy this ADR's clause skeleton.
- **The catalog surface grows by three display types at M2** — corpus, eval shards, and derived prompt
  re-validate; models must be *taught* when a swatch beats a printed hex (clause 6's guidance is an
  acceptance item).
- **The site's token page becomes a consumer** — its drift gate (`tokens-doc.test.ts`) keeps proving
  the *data*; the *rendering* moves under the fleet's own component gates. If the page and the
  controls ever disagree, the controls are the owner.
- **The family size budget likely re-bases** — three small controls, no mark code; measured at the
  build wave (`npm run size`, the ADR-0040 manual discipline), not guessed here.
- **The v1 fence will be pushed** — "just add a contrast badge" / "make the swatch clickable to copy"
  are predictable next asks. The PRD §3 ruled-out list is the fence: editors, verdicts, and copy
  affordances are new intakes or app-layer composition (`Row > [Swatch, Button]`), never riders.
- **Stale → re-verify at the build wave:** catalog `catalog.json`/`factories.ts` + allowlist ·
  catalog SPEC §5.2 rows + Notes · corpus shelf + derived prompt · `site/pages/tokens.ts` +
  `tokens-doc.test.ts` · `measure-size.mjs` line items.

## Acceptance

This is an **intake** ADR — realized in two stages:

- **Intake (this change):** the sibling PRD exists; this record passes the ADR gates and is indexed;
  the four forks carry firm recommendations awaiting Kim; doc-review is dispatched on both records. No
  code changes.
- **Build waves (M1/M2, separately dispatched):** M1 — three controls + descriptors, a11y probes
  (composed name / per-row list announcement via internals), whole-shape browser legs both engines,
  forced-colors probes, the site token page re-hosted with net-negative display LOC and its drift
  gate green — including the F1 vocabulary rider: the page's "Dimensional ramps" section retitles
  to "Dimensional ladders". M2 — catalog rows land with SPEC-N2 green and **no allowlist residue**; the exemplar
  validates 0-`CATALOG`-error; §5.2 guidance prose ships; FEED_EXCLUDED bookkeeping entries land.

## Alternatives considered

- **Keep it site-local; publish the site page as the reference.** Rejected: the page can't be
  composed by consumers or emitted by agents; the intake's grounded need (brand-kit views, theme
  tooling, agent-presented palettes) is exactly reuse. The ADR-0117 promotion precedent applies.
- **One generic `ui-token type="color|dimension|…"` component.** Rejected: the ADR-0107
  one-generic-chart rejection verbatim — N content types accrete N contract surfaces into one folder;
  per-type components keep contracts small and separately gateable.
- **A `@agent-ui/tokens` leaf package.** Rejected for v1 (clause 7): no vendored mass, no shared math;
  widening the layering trip-wire for three small display controls is cost with no offsetting benefit
  (the ADR-0107 cl.7 / ADR-0065 test).
- **Canvas-rendered ramps** (one canvas strip per ramp). Rejected: raster under DPR churn, no
  token/forced-colors participation, invisible to AT — the ADR-0107 canvas rejection verbatim, with
  even less justification (a ramp is N styled boxes).
- **A color-math core (parse/convert/measure in-component).** Rejected: the browser already resolves
  every CSS color; component-owned color math duplicates the platform, drags gamut/precision
  questions in, and violates the show-never-edit fence. Generator apps (ultimate-tokens) own math.
