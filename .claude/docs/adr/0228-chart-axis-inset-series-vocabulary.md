# ADR-0228 — The chart axis/inset/series vocabulary: a shared `controls/_chart/` subsystem (pure axis math + shared CSS), charts own their internal insets for zero-padding containers, projected/now-marker grammar, a static highlight callout that keeps the display tier zero-event, and a shared `--ui-chart-series-*` ramp

> Source: agent-ui ADR log (this directory — the numbered files ARE the index; status lives in each ADR's own header). · 2026-08-20
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-08-20 |
> | **Proposed by** | planning-leader (design seat — GH #1561, the svg-chart-system intake; due-process Phases 1–2, GH #969) |
> | **Ratified by** | kimgranlund (repo owner), 2026-08-21, via the [`ratify ADR-0228` utterance](https://github.com/kimgranlund/agent-ui/issues/1561#issuecomment-5364097735) — verified + flipped by `scripts/adr_ratify.py` (ADR-0149) |
> | **Repairs** | booked ON RATIFICATION, applied by the build wave (the ADR-0219 precedent): `chart-family.spec.md` gains its axis/inset/series R-clauses · `chart-family.prd.md` version-bumps (§3 scope prose names the axis system as admitted under this ADR). The #1207 close's "chart-axis vocabulary … its own ADR" deferral is DISCHARGED by this record |
> | **Supersedes / Superseded by** | **Superseded-in-part by [ADR-0230](./0230-column-chart-html-plot-layer-container-query-ladder.md)** (its cl.2's gridline-rendering mechanism sentence ONLY — the "SVG `<line>` gridlines at computed tick positions" mechanism sentence, and the "SVG for strokes" half of the one-math-source law, narrow to *SVG for continuous strokes*, `ui-column-chart`-scoped; the two-layer full-bleed model, the chrome/inset contract, the chip-collision law, and every other clause of this record STAND byte-untouched — booked repair applied by that record's own build wave, REV-annotated pointer, mechanical) — relates [ADR-0107](./0107-chart-family-v1-scope.md) (the axis-system fence whose named "new intake" this is — its clause 1 fence rows for axis systems are realized, not silently breached; sibling [ADR-0229](./0229-svg-chart-family-extensions.md) carries the type-set half) · [ADR-0205](./0205-line-chart-v1-axis-vocabulary.md) (the minimal baseline+min/max vocabulary this record builds ON, per its own cl.7/Consequences "build on its baseline/min-max vocabulary rather than re-deriving one") · [ADR-0219](./0219-pie-donut-part-of-whole-chart.md) (the lightness-ramp identity mechanism clause 6 generalizes; its cl.8 categorical-palette fence STANDS) · [ADR-0223](./0223-fill-by-default-fleet-sizing-contract.md) (fill-by-default — clause 3 states the composition) · [ADR-0046](./0046-container-box-model.md) (the container inset system clause 3 composes against, without double-padding) · [ADR-0078](./0078-ui-text-three-axis-variant-size-as.md) (the typescale rows tick/category pills read) · [ADR-0057](./0057-intent-non-color-signifier-rule.md) (the never-hue-alone law clause 6 obeys) |

## Context

**The trigger.** GH #1561 — Kim's Figma-board intake (Claude-Code-Gateway, node 133-3171): a
dark-first, purple-ramp chart SYSTEM of four archetypes (stacked columns with a dashed projected
ghost + now-marker · gradient area · dense highlighted bars with a value/date callout · multi-ring
radial gauges with a side legend) sharing ONE visual grammar — pill-shaped month labels, tick
labels in pills, gridlines, rounded caps — and one geometric contract, the issue's own Summary verbatim: *"designed to sit in ZERO-PADDING
containers — the axes, gridlines, tick labels, legends, and value callouts carry their own
padding/inset as part of the chart's coordinate system, so the host container never pads."*
(Kim's seed sentence — "they have a bit of padding/inset as part of the system" — was relayed in
the intake dispatch and is not preserved on the issue itself; the issue Summary above is the
citable record of the same contract.)
Design source note: this seat could not fetch the Figma node (no WebFetch/Figma tool in the
dispatched toolset); the design ground is the issue's own four-board inventory plus the two board
screenshots' content as described on GH #1561 — stated here so the provenance is visible.

**The deferral this discharges.** The #1207 close (`ui-line-chart`) explicitly deferred a
"chart-axis vocabulary" to its own ADR. ADR-0107 fenced ALL axis systems out of chart v1 —
"chart scope explodes at the axis system (ticks, scale labels, gridlines, legends,
label-collision handling)" — and ruled any axis-bearing type "a new intake." ADR-0205 then
admitted the SMALLEST vocabulary that earns "axis-bearing" (one baseline + min/max labels),
naming tick marks and gridlines LATER, "each its own future issue." This record is that issue's
design half: the boards demand the full tick/gridline/category-label system, across THREE
archetypes at once — so the vocabulary must be decided ONCE, shared, or each new chart re-derives
its own and the family drifts (the exact disease `.claude/docs/process.md` exists to prevent).

**What the tree already fixes.** Family craft is settled law: component-built inline SVG for
continuous marks, labels as REAL DOM text never SVG `<text>` (ADR-0107 cl.3), pure DOM-free math
modules per control (LLD-C1 pattern: `sparkline-math.ts` · `bar-math.ts` · `line-chart-math.ts` ·
`pie-math.ts`), Display-class geometry (no control frame/height/[size]/[scale]), ARIA via
`ElementInternals`, explicit forced-colors arms, whole-shape floors (ADR-0223 role (d)).
ADR-0107 cl.3 even named the shared home this record now activates: *"co-located per control (or
`controls/_chart/` if shared — the `_base`/`_surface` precedent)."* ADR-0219's Amendment settled
the CVD-safe series-fill mechanism: a strictly monotone single-family lightness ramp over primary
TONE primitives, identity never riding hue alone.

**The box-model tension to resolve, not paper over.** ADR-0223 makes every chart host block-fill;
ADR-0046 gives containers an inset system expressed as CHILDREN'S margins (6px box inset, 12px
region pad). Kim's contract puts the inset INSIDE the chart instead. Three layers of "inset"
(container margin, region padding, chart-internal inset) can stack into double/triple gutters if
nothing states which one carries the board geometry.

**Sibling-system study (prior art to mine, not contracts to copy).** Kim's gen-ui-kit repo holds
a Charts 2.0 SPEC family designed against the SAME Figma boards:
`~/Projects/adia/gen-ui-kit/docs/ops/spec/spec-charts-2-0-foundations.md` (v0.1.0, 2026-08-20,
status draft) and `…/spec-charts-2-0-ratio-and-surface.md` (v0.1.1, 2026-08-18, draft) — read in
full for this record, cited the way the sibling's own Benchmark section cites Tremor/Recharts:
studied, never adopted as dependencies. Its sharpest finding, adopted below on the merits: the
**two-layer full-bleed model** (its REQ-F-001) — the PLOT layer (gridlines, marks, fills) spans
the chart box edge-to-edge at ZERO inset, and the CHROME layer (label chips, legend, markers —
all text) floats on top with its own single-knob inset — which SUPERSEDED that system's own
earlier residual-gutter model ("labels never push the plot inward, they inset *within* it").
That is exactly Kim's "the lines, legends, values … have a bit of padding/inset as part of the
system," stated as a mechanism. Also mined: chip collision law (clamp end chips inward; DROP
intermediate chips on overlap — density thinning, never font shrink; corner-adjacent chips clear
the composed card's radius, its REQ-F-006), text-safety OWNERSHIP on the chart never the card
(REQ-F-002), nice-number gridline steps (1/2/5 × 10ⁿ, REQ-F-007), the today-marker anatomy
reading of the same boards (baseline dot + a short tick through the label band — never a
full-height rule, REQ-F-008), per-mark provisional-datum renderings with radial/sparkline ruled
N/A (REQ-F-015/016), and a chrome degradation ORDER below a plot-height floor (REQ-F-013). NOT
adopted: its single `chart-ui type=…` component shape (the generic-type component ADR-0107
rejected — agent-ui's per-type tags stand), its `--a-*`/`--chart-*` token tiers (ADR-0078's
`--ui-{name}-*`/`--md-sys-*` grammar governs here), and its 3-value `ratio` attribute grammar
(unreconciled with ADR-0223's fill-by-default posture — named LATER in clause 7, not imported).

**Grill discharge (GH #1561 Scope/Open item 1).** The intake ran fork-side with no question
channel and skipped the pre-fork grill; per house convention the record performs the
interrogation instead: the issue's Scope/Open items are each resolved with alternatives — items
3 (axis vocabulary), 4 (tooltip/highlight tier), and 6 (series-ramp tokens) in this ADR's clauses
below; items 2 (new tags vs extend) and 5 (multi-series schema) in its sibling ADR-0229 — this
note being the discharge of item 1 itself.

## Decision

**We will mint ONE shared chart subsystem — `controls/_chart/` (a pure, DOM-free axis-math module
plus a shared stylesheet, the `_base`/`_surface` precedent ADR-0107 cl.3 already named) — built on
the TWO-LAYER full-bleed model: the plot layer spans the chart box edge-to-edge at zero inset,
and the chrome layer (every label, legend, marker — the text) floats on top carrying the system's
inset itself, composing with zero-padding containers without double-padding; plus the
projected/now-marker grammar, a STATIC highlight-callout that keeps the display tier zero-event,
and a shared `--ui-chart-series-{1..6}-ink` ramp generalizing ADR-0219's mechanism.** Seven
clauses; SPEC/LLD own mechanisms at the build wave.

1. **The shared home is `controls/_chart/` — pure math + shared CSS, consumed as per-component
   parts. Not a trait, not an element.** `_chart/axis-math.ts` (DOM-free, unit-testable: tick
   computation over a value range, chrome-band positions from `--ui-chart-chrome-inset`'s
   numeric input, percent positions for gridlines/labels/marks) + `_chart/chart-axis.css`
   (tick/category pill treatment, gridline/baseline inks, the chrome-inset custom property —
   all `--ui-chart-*`, declared in the standard `:where()` block, aliased per-control where a
   consumer re-maps). Each chart
   stamps its OWN `data-part` DOM (`grid-line`, `tick-label`, `category-label`, …) from the
   shared math — the descriptor/trip-wire system stays per-control, exactly as `_surface/
   container-box.css` is shared paint/spacing consumed by per-control markup. A trait
   (`(host, opts) => cleanup`) is the wrong unit: traits own connected-lifecycle BEHAVIOR;
   axis furniture is render-time geometry with no lifecycle of its own. A shared `ui-axis`
   ELEMENT is worse (Alternatives).
2. **The axis anatomy, named once — two layers.** The *plot layer* IS the chart box: gridlines,
   columns, fills, rings, and marks span it edge-to-edge at zero inset (SVG `<line>` gridlines
   at computed tick positions, subtle ink `--ui-chart-grid-ink`, never load-bearing for reading
   a value). The *chrome layer* — every text element — floats ON TOP of the plot: *tick-label
   pills* (the value-scale readings) along the start edge at gridline positions, *category-label
   pills* (months, days) in a band along the block-end edge, both REAL DOM text (the family's
   never-SVG-text law holds — one math source, two renderings: SVG for strokes, DOM for text,
   sharing the same percent coordinates). Tick math uses nice-number steps (1/2/5 × 10ⁿ over the
   resolved range). Pill typography reads the fleet's KICKER/label typescale rows (ADR-0078),
   never ad-hoc font values. Baseline semantics stay ADR-0205 cl.1's (zero line when the range
   spans zero, else the value floor) — inherited, not re-derived. Chrome collision law (the
   sibling study's REQ-F-006 class, adopted on the merits): end pills clamp INWARD rather than
   overflow the box; overlapping intermediate pills DROP (density thinning — pills never overlap
   and never shrink their type); a pill adjacent to a composed container's rounded corner clears
   the corner radius so an `overflow: hidden` card never clips a glyph — text safety is the
   CHART's own obligation by construction, never a container-side guard.
3. **The inset contract: the CHROME carries the system's inset; the plot bleeds.** One knob,
   `--ui-chart-chrome-inset` (token-overridable, `--md-sys-space`-laddered), governs the chrome
   layer's clearance from all four chart-box edges — labels never push the plot inward, they
   inset WITHIN it. This is Kim's zero-padding contract as a mechanism: the "bit of
   padding/inset as part of the system" is the chrome's, and the host container never pads.
   Composition law, stated plainly:
   - **ADR-0223 is untouched.** The host stays block-level fill; the chrome inset is internal
     geometry, not a width opinion. Whole-shape floors stay role (d).
   - **In an ADR-0046 `[data-box]`/region container, the chart child composes FULL-BLEED**
     (`margin: 0` via the model's own full-bleed affordance) when board-parity is wanted — the
     chrome inset REPLACES the container's gutter for that child; the two never stack by design.
     In a padded/inset context left as-is, the chart still renders correctly with the ambient
     gutter simply added outside it — honest degradation, and NO compensating negative-margin or
     padding-detection mechanism inside the control (the ADR-0046 Amendment-2 lesson: box-model
     reconciliation mechanisms breed cross-engine amendment chains).
   - Dropping any chart into a padding-less `ui-card`-style container reproduces the board
     geometry with zero consumer CSS — the GH #1561 acceptance line, and the ADR-0102 CSS-less
     honesty surface for this family.
4. **Projected/now grammar.** Two shared vocabulary items any time-ordered cartesian chart may
   consume: *projected marks* — a per-datum "not yet actual" state with a per-mark rendering
   (columns: hollow, dashed-outline, no fill — the boards' August ghost; line/area: dashed
   stroke over the projected span with the fill suppressed or faded there;
   `--ui-chart-projected-*`) — declaring provisionality in a channel that survives CVD and
   forced-colors (line style, not hue); and the *now-marker* — a baseline dot plus a SHORT tick
   descending through the category-label band (`--ui-chart-now-*`), positioned at the boundary
   between the last actual and first projected datum by the shared axis math — NEVER a
   full-height rule through the plot (the short-tick reading is the sibling study's — REQ-F-008,
   made with board access this seat lacked — and is consistent with the issue's own "dot + drop
   line" description). Both are explicit no-ops on
   radial marks (`ui-gauge`) and `ui-sparkline` (no chrome band to descend through) — the
   REQ-F-016 class, stated so a no-op is a contract, not an accident. Which prop drives them is
   the consuming control's contract (ADR-0229 cl.2); the RENDERED grammar is shared here so
   "projected" looks identical on a column chart and an area chart.
5. **The callout is a static, data-driven chart part; the display tier stays zero-event (GH
   #1561 Scope/Open item 4's ruling).** A chart-internal `data-part="callout"` (value + category, REAL DOM
   text) rendered at the datum a `highlight` prop names — no hover, no focus, no keyboard, no
   events; the display tier's zero-interaction contract is unchanged, and the AGENT/author
   decides what is highlighted (the A2UI producer model: emphasis is data, not gesture).
   Rejected: hover interactivity (breaks the tier — demands keyboard parity, focus management,
   and an event surface fleet-wide; a LATER intake if ever earned) and composing `ui-tooltip`
   (a floating overlay surface anchored to interactive triggers — wrong tier, wrong anchor
   model; a chart callout is anchored in plot coordinates).
6. **The shared series ramp: `--ui-chart-series-{1..6}-ink`, minted in `_chart/`, over the exact
   tone-primitive ladder ADR-0219's Amendment proved out** (light `primary-300→-800`, dark
   `primary-200→-700`, `light-dark()`, pairwise-distinct and strictly monotone per scheme — the
   boards' own purple lightness ramp IS this ramp). Consumed by every multi-series chart mark;
   series identity is carried by ORDER + printed LABEL (+ value where printed) with fill as the
   shared, never-sole carrier — ADR-0219 cl.4's law generalized, exactly as the
   component-patterns data-viz row already teaches. At the build wave the six
   `--ui-pie-chart-slice-{1..6}-ink` DEFAULTS repoint to alias the shared family (names — the
   consumer re-map seam — unchanged). ADR-0219 cl.8's categorical-palette fence STANDS: this is
   the ordinal single-family ramp made shared, not a hue-varied categorical family; that intake
   still waits for a genuinely non-ordinal multi-hue need, which the purple boards do not
   present. This clause IS the design ruling for GH #1561's token half — the
   `design:token-feature-intake-rules` routing the intake grid names is discharged here; the
   build wave implements the declared family and mints no further token decisions.
7. **Explicitly LATER** (each its own intake, the ADR-0107 cl.1 fence style): hover/keyboard
   interaction and events on any chart; typed time scales (the category axis is ordinal labels,
   not date math); log/dual axes; SVG-layer legends; streaming/animated appends; a studied
   `ratio` grammar (the sibling system's 3-value enum + container-query auto-snap — NOT adopted:
   agent-ui charts fill their measured box under ADR-0223 and adapt by density thinning; a ratio
   attribute is a real fork against fill-by-default and earns its own record only if thinning
   proves insufficient on real surfaces); a ruled chrome DEGRADATION ORDER below the whole-shape
   floor (the sibling's REQ-F-013 class — booked as a build-wave SPEC question, not ruled here).

## Consequences

- **A new shared coupling point.** A `_chart/` change fans across every axis-bearing chart —
  deliberate (one vocabulary, no per-control drift) and priced: the shared module gets its own
  co-located pure tests, and every consuming control's browser legs re-run at any `_chart/`
  touch (the `_surface/container-box.css` maintenance pattern).
- **The inset contract makes "drop it in a zero-padding container" the family's honest default
  composition** — docs/site demos and app compositions should show the full-bleed pairing, and a
  consumer wanting the old ambient-gutter look simply doesn't full-bleed the child. No renderer
  or catalog bytes move for this.
- **The static-callout ruling keeps the whole system display-tier** — no descriptor gains
  events/keyboard rows; `sizing-gates`/descriptor trip-wires stay the existing shape.
- **The pie-chart ramp repoint is a build-wave byte-change with test fallout** (the
  `pie-chart-css.test.ts` declared-ladder pin re-anchors to the alias) — booked, not silent.
- **Stale → re-verify at the build wave:** `chart-family.spec.md` gains the axis/inset/series
  R-clauses · `chart-family.prd.md` version-bumps (§3 scope prose names the axis system as
  admitted under this ADR) · the token docs test learns `--ui-chart-*` · `pie-chart-css.test.ts`
  ladder pin · this vocabulary's consuming controls are ADR-0229's business.

## Alternatives considered

- **A trait (`traits/chart-axis.ts`)** — rejected: traits are `(host, opts) => cleanup` lifecycle
  behavior invoked from `connected()`; axis furniture is derived render geometry with nothing to
  clean up, and a trait would still need the pure math + CSS homes anyway — it adds a layer, not
  a home.
- **A shared `ui-axis` element charts compose as a child** — rejected: an author-facing element
  mints wire/descriptor/catalog surface for something that is never authored independently,
  breaks the family's "every child is component-built" law, and positional composition between a
  sibling axis element and each mark re-opens the label/coordinate coupling the shared math
  exists to solve.
- **Per-control axis copies (no shared layer)** — rejected: three archetypes land at once; three
  hand-rolled tick algorithms and three pill stylings is the drift disease on day one, and
  ADR-0107 cl.3 already reserved the shared home for exactly this moment.
- **Insets as host padding** — rejected: the labels live INSIDE the plot box (board geometry),
  so the inset must be part of the chart's own coordinate system; host padding would also
  collide with ADR-0046's children-margin model and re-open the double-gutter question this
  record closes, and a scroll-adjacent consumer would clip at the padding box (the swiper
  border-band lesson class).
- **The plot-rect-subtraction (residual-gutter) model** — insets subtract from the plot, labels
  live in the freed gutter band — rejected: label presence would change the plot's drawable
  extent (gridlines/marks stop short of the box edge, off the board geometry), and the sibling
  system reached the same verdict against its OWN earlier model (foundations REQ-F-001
  superseding ratio-and-surface REQ-R-001/R-004's gutter clauses) — independent confirmation
  from the same design source. This record's first draft carried exactly this hybrid; repaired
  pre-ratification on the sibling-study read.
- **A `ratio` attribute (the sibling's REQ-R-002 grammar)** — not adopted (clause 7): a pinned
  aspect ratio is a width/height opinion in tension with ADR-0223's fill-by-default posture;
  agent-ui charts adapt to the measured box by chrome density thinning. Re-openable as its own
  intake with real-surface evidence.
- **A container-side fix (a `[chart]` region mode in `container-box.css`)** — rejected: it
  spreads chart knowledge into the container family and still fails outside `[data-box]`
  consumers; the full-bleed affordance ADR-0046 already ships is sufficient and already ratified.
- **Hover tooltip via `ui-tooltip` composition** — rejected (clause 5): wrong tier, wrong anchor
  model, and it would make chart reading gesture-gated — the printed callout is data.
- **A hue-varied categorical series palette** — rejected (clause 6): ADR-0219 already litigated
  this — buys nothing the ramp doesn't while costing CVD ordering; the boards are themselves a
  single-family lightness ramp; the categorical intake stays fenced behind a real non-ordinal
  need (ADR-0219 cl.8).
