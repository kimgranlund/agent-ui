# ADR-0230 — ui-column-chart goes all-HTML: axis-aligned plot furniture is CSS-drawn DOM (the SVG layer retires), a pure-CSS container-query chrome-degradation ladder rides the chart's own box, and the data-granularity rung is an OPEN law-exception fork Kim's ratification picks

> Source: agent-ui ADR log (this directory — the numbered files ARE the index; status lives in each ADR's own header). · 2026-08-21
>
> | Field | Value |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-08-21 |
> | **Proposed by** | planning-leader (design seat — GH #1578, the html-column-chart intake; due-process Phases 1–2, GH #969; design reasoning worked through live with Kim, 2026-08-21) |
> | **Ratified by** | *(awaiting Kim — the ratification comment must ALSO name the clause-6 fork's branch, A or B; the fork carries NO default by Kim's own 2026-08-21 ruling)* |
> | **Repairs** | booked ON RATIFICATION, applied by the build wave (the ADR-0219/0228 precedent): [ADR-0228](./0228-chart-axis-inset-series-vocabulary.md) header gains the reciprocal Superseded-in-part pointer (REV-annotated mechanical pointer repair — cl.2's gridline-rendering assignment only) · `chart-family.spec.md` SPEC-R16/SPEC-R23-class deltas (the HTML plot layer + the ladder's rung/breakpoint contract) + `chart-family.prd.md` version-bump · `column-chart.md` descriptor doc anatomy section · the stale test/golden list in Consequences. ADR-0107 is NOT repaired — its cl.3 law already reads continuous-marks-only (Decision, clause 1) |
> | **Supersedes / Superseded by** | **Partially supersedes [ADR-0228](./0228-chart-axis-inset-series-vocabulary.md)** — ONLY cl.2's plot-furniture rendering assignment (its "SVG `<line>` gridlines at computed tick positions" mechanism sentence, and the "SVG for strokes" half of its one-math-source law, which NARROWS to *SVG for continuous strokes*); the two-layer full-bleed model, the chrome/inset contract, the chip-collision law, and every other clause STAND · **Extends ADR-0228** (its cl.7 later-item "a ruled chrome DEGRADATION ORDER" is realized here, widened from below-floor-only to a full per-width ladder) · relates [ADR-0107](./0107-chart-family-v1-scope.md) (cl.3's rendering-follows-the-mark law — read, honored, untouched) · [ADR-0229](./0229-svg-chart-family-extensions.md) (the control this re-renders; its dense-archetype producer-mode reasoning is fork branch B's precedent) · [ADR-0223](./0223-fill-by-default-fleet-sizing-contract.md) (fill-by-default — the axis the ladder adapts along) · [ADR-0100](./0100-query-container-boundary-establishment.md) (the query-container establishment law clause 3 must satisfy) · [ADR-0102](./0102-css-less-consumer-contract-law.md) (bare-markup honesty for the new divs) · [ADR-0057](./0057-intent-non-color-signifier-rule.md) (no rung may make hue a sole carrier) |

## Context

**The trigger.** GH #1578 (Kim's live-session brief, 2026-08-21): `ui-column-chart` is already
two-thirds HTML — columns are CSS divs (the wave-1 "keep divs" ruling), chrome is real DOM text —
and only `[data-part='plot']` is SVG: nice-number gridlines plus the now-marker dot/tick
(`column-chart.ts` `#plotNode`, verified at intake). Every mark in that layer is **axis-aligned**:
horizontal gridlines, a vertical short tick, a baseline dot. Kim wants the layer HTML, a pure-CSS
responsive chrome ladder on top of it, and the self-sensing data-granularity idea put to her as an
explicit law-exception fork.

**Why the SVG earns retirement, on mechanics.** ADR-0107 cl.3's law is *rendering follows the
mark*: SVG where "CSS cannot draw it" (the continuous polyline), CSS where it can (the
length-proportional box mark, "real DOM text"). Axis-aligned 1px-class lines are squarely on the
CSS side of that law's own rationale — a bordered div IS a device-pixel-constant axis-aligned
stroke, which is all `vector-effect: non-scaling-stroke` was buying. ADR-0228's Context even
restates the family law as "component-built inline SVG for **continuous** marks." The SVG layer in
this one control is therefore vocabulary debt, not craft: one extra rendering substrate, one extra
namespace (`createElementNS`), and — measured against the shipped CSS — two latent defects it
causes (Consequences: the RTL plot/columns disagreement and the now-dot's anisotropic scaling).

**What the HTML unlocks — and what it must not break.** Container queries adapt HTML children per
available inline size but cannot reach inside an SVG's own coordinate space — so the swap is the
enabling move for the chrome-degradation ladder ADR-0228 cl.7 booked ("a ruled chrome DEGRADATION
ORDER … booked as a build-wave SPEC question"). The ladder must stay inside two standing laws:
the family's no-JS sizing discipline (`geometry.md`; ADR-0007 cites it as the "no-JS,
no-`observedAttributes` sizing discipline" — no ResizeObserver, no state written by a resize), and
ADR-0100's establishment law: `container-type: inline-size` applies inline-axis size containment
(intrinsic sizes computed as-if-empty), which collapsed the content-sized layout primitives and
moved establishment to *externally-sized boundaries*.

**The measured geometry the breakpoints must come from** (the intake's owed question (b) —
grounded, not round). At default scale/density: the host's own font is
`--md-sys-typescale-label-medium-size` = 12px, so 1 host-`em` = 12px. Chips read
`label-small` = 11px with `--md-sys-space-sm` = 8px inline padding per side; a month-class 3–4
char label (the boards' canonical category vocabulary) sets ≈ 20px of text → a chip is ≈ 36px,
needing ≥ ~42px of center-to-center pitch to hold SPEC-R17's no-overlap law with clearance. The
math layer already caps rendered category chips at **8** (`maxCategoryChips`,
`columnChartGeometry`) and ticks at 5 — but that thinning is count-based and **width-blind**: at a
narrow box, 8 nowrap chips overlap anyway. The ladder is the missing width-aware half of
SPEC-R17's own drop-don't-shrink law. And the ratified whole-shape floor (ADR-0229 cl.6,
`--ui-column-chart-min-inline-size: 16em` = 192px) bounds reachable widths: a box below the floor
exists only where a consumer deliberately overrides the floor token (dense embeddings).

**The granularity fork.** Self-sensing re-bucketing (months→quarters when narrow) needs the
component to measure its own box with JS (ResizeObserver) AND to understand its ordinal labels as
time — the first breaks the no-JS sizing discipline, the second is ADR-0228 cl.7's "typed time
scales" LATER-fence. Kim explicitly ruled (2026-08-21) that this record structures the fork and
does NOT decide it; her ratification comment picks.

## Decision

**We will re-render `ui-column-chart`'s plot layer as positioned HTML divs — zero `<svg>` in the
component — keeping the layer's anatomy, part names, percent coordinate space, tokens, and a11y
contract byte-identical in intent; establish the host as its own inline-size query container
(lawful under ADR-0100 by construction); and add a THREE-rung pure-CSS chrome-degradation ladder
at two geometry-derived breakpoints (28em · 16em, host-em units). The data-granularity rung is
clause 6's OPEN fork.** Six clauses; SPEC/LLD own mechanisms at the build wave.

1. **Axis-aligned plot furniture is CSS-drawn DOM; ADR-0107 cl.3 is honored, not amended.**
   `[data-part='plot']` becomes an HTML div layer at the same `inset: 0`/`grid-area: 1/1`
   position: each gridline an absolutely-positioned div spanning the inline axis at its tick's
   percent-from-baseline block position; the now-marker a dot div plus a short-tick div at
   `nowPct`'s inline position (tick depth stays the density-invariant percent constant,
   ADR-0228 cl.4's short-tick law). The viewBox percent space becomes CSS percentages — the SAME
   `column-math.ts` outputs, unchanged. Furniture strokes draw as **borders, never backgrounds**
   (a border keeps its width and takes the forced system ink under `forced-colors`; a
   background-drawn line vanishes to `Canvas` — the SPEC-R10 lesson applied at design time);
   weights stay device-pixel-constant CSS px at the shipped values (the
   `non-scaling-stroke` guarantee, re-proven trivially: CSS px never scale with percent
   geometry; exact literals are LLD business). Ink tokens repoint from stroke/fill properties to
   border/background on the same `--ui-column-chart-{grid,now}-ink` chain — **no new tokens**.
   ADR-0107 cl.3 needs no amendment: its own rationale assigns SVG only where "CSS cannot draw
   it" — the fence is *continuous marks* (`ui-line-chart`'s polyline, `ui-pie-chart`/`ui-gauge`'s
   arcs keep SVG, out of scope here); what ADR-0228 cl.2's wording over-generalized ("SVG for
   strokes") this record narrows to "SVG for **continuous** strokes" (the partial supersession in
   the header).
2. **`data-part` naming continuity: the names stay** — `plot`, `grid-line`, `now-dot`, `now-tick`
   carry over to the divs unchanged (the intake's owed question (c); its buildable default,
   confirmed). Part names name ANATOMY, not rendering substrate — the descriptor doc, tests, and
   ADR-0228's own clause prose cite these names, and renaming would churn every citation for zero
   information. Element-TYPE-keyed selectors retire instead: `column-chart.css`'s
   `svg[data-part='plot']` re-keys element-agnostic, and any test asserting `<svg>`/namespace
   facts re-keys to geometry facts (stale list in Consequences).
3. **The host establishes its own query container — lawful under ADR-0100 by construction.**
   `container-type: inline-size` (named, e.g. `container-name: ui-column-chart`) goes on the host
   itself. ADR-0100's collapse class cannot occur here: containment computes intrinsic inline
   size as-if-empty, and this chart's intrinsic inline size is ALREADY as-if-empty by
   construction — every plot/chrome child is absolutely positioned and the columns track is
   zero-basis flex (`flex: 1 1 0; min-inline-size: 0`) — while the box's real minimum is the
   SPECIFIED `min-inline-size: 16em` floor token, which containment does not touch. The chart is
   an externally-sized boundary in ADR-0100's own sense: fill-by-default (ADR-0223) above a
   token floor, never content-sized. Establishment is on the INLINE axis only — the ladder never
   queries block size (that would need two-axis `size` containment, a genuinely riskier
   containment class with no rung that wants it). Self-establishment, not a consumer-side
   container, because the ladder must measure the CHART's own box (a grid track or flex split is
   narrower than any ancestor boundary), and ADR-0102's CSS-less consumer must get a working
   chart with zero consumer CSS.
4. **The ladder: three rungs, two breakpoints, both derived — 28em and 16em, in host-em units so
   they ride `--md-sys-scale` for free.** (Container-query lengths cannot read `var()` — the
   breakpoints are literal, banner-documented; the honest cost is in Consequences.)
   - **Wide — `≥ 28em` (336px @ default scale): full chrome.** Derivation: the math's 8-chip cap
     × ~42px worst-case month-chip pitch (36px chip + ≥4px clearance, Context arithmetic)
     = 336px = 28 × 12px — the width below which 8 chips can no longer hold SPEC-R17's
     no-overlap law.
   - **Medium — `16em–28em`: category chips thin by parity** — every second rendered
     `category-label` hides (`:nth-child(… of [data-part='category-label'])`-class selection, so
     tick-chip count never shifts the indexing), halving worst-case chip demand to 4 × 42px
     = 168px, which still clears the floor-wide box (192px − 2×8px chrome inset = 176px). Tick
     chips, gridlines, now-marker, and the callout all stay — they stack block-axis or sit at
     the baseline and are not inline-collision-bound in this band.
   - **Narrow — `< 16em`: bare marks.** All chrome (tick/category chips, callout) AND plot
     furniture (gridlines, now-marker) hide; the columns alone remain — a proportional-mark
     glyph, the gen-ui-kit degradation order's last rung realized live. Derivation: 16em IS the
     ratified whole-shape floor (ADR-0229 cl.6) — the smallest box the family calls an honest
     full chart. The rung is reachable only where a consumer deliberately overrides the floor
     token downward; it defines what that deliberate sub-floor embedding gets, instead of
     leaving it accidental.
   Zero JS, zero ResizeObserver, no state written by a resize — rungs are pure CSS
   `display`-class switching on the container query; the DOM the effect renders is identical at
   every width.
5. **The announced summary is rung-invariant — the a11y floor of the whole ladder.** The
   generated `role=img` summary (`columnChartSummary`) never varies with container width: chrome
   is presentation, the summary is the data. A rung may hide the callout's PIXELS; its fact is
   already repeated in the summary (ADR-0229 cl.5's AT-parity rule), so no rung changes what AT
   hears. No rung makes hue a sole carrier (ADR-0057): the narrow rung's bare marks still carry
   identity through the summary's printed series labels.
6. **The data-granularity fork — structured here, OPEN for Kim; her ratification comment names
   the branch. Deliberately NO default (Kim's 2026-08-21 ruling — this is not the ADR-0107
   "recommendation is the default" fork style).**
   - **Branch A — self-sensing re-bucketing, a named law exception.** The component measures its
     own box (ResizeObserver) and re-buckets rows below a threshold (months→quarters), rendering
     and re-announcing the coarser set. Honest costs: it breaks the no-JS sizing discipline
     (`geometry.md` — the family's first control whose RENDERED DATA depends on measured width);
     it needs time semantics for ordinal labels — ADR-0228 cl.7's typed-time-scales LATER-fence
     breaks too (a label-agnostic k-row sum would fabricate labels the producer never wrote);
     the role=img summary becomes width-dependent — announced DATA mutates when a pane resizes,
     a class with no fleet precedent; first paint shows un-bucketed data until the observer
     fires; verification is browser-only per rung × per bucketing. Honest benefit — the
     strongest argument FOR: an A2UI producer has no width-feedback channel, so only the
     component at the box can know narrowness; A is the only branch that adapts granularity with
     zero producer cooperation. If chosen: the exception is FENCED — one opt-in reflected
     boolean (e.g. `auto-granularity`, default OFF) so the lawful posture stays the default and
     the law gains a named exception rather than dissolving.
   - **Branch B — producer-side granularity, the ADR-0229 dense-archetype precedent.**
     Granularity is data: the producer emits quarter rows where it wants quarters — already
     expressible in the clause-2 schema, zero component/schema/law change. The catalog's §5.2
     Notes gain a guidance row (coarser buckets for narrow surfaces — the ADR-0087 Fork-A
     teaching style). Honest cost: producers largely CANNOT know the box width, so a narrow
     surface shows the SAME buckets with thinner chrome — though the narrow rung's bare marks
     keep 12 months legible as SHAPE (the sparkline-read), which is the honest degradation.
     Benefits: both fences stay intact, the component stays time-blind, the summary stays
     stable, the test surface doesn't multiply.
   - **This seat's recommendation (a recommendation only, per the ruling — not a default):
     Branch B.** Two standing laws survive untouched; re-bucketing is a data decision that
     belongs to the data's owner; and Branch A stays re-openable as its own later intake — in
     the fenced opt-in shape above — the moment real surfaces prove B insufficient (the
     ADR-0228 cl.7 re-open pattern).

## Consequences

- **Two latent defects retire with the SVG, for free.** (1) RTL self-disagreement: the SVG plot
  kept a physical-LTR coordinate space while the flex columns track mirrors under `dir="rtl"`
  (both documented in `column-chart.css`'s own banner) — so today the now-marker can sit at the
  wrong column in RTL. The HTML divs position via `inset-inline-*`, agreeing with the columns in
  both directions; the family's board-parity-RTL preference stays exactly as deferred as the
  banner already states, but now self-consistent. (2) Now-dot anisotropy: `r: 1.4` in a
  `preserveAspectRatio: none` viewBox scales into an ellipse on any non-square box; the div dot
  is a device-px circle at every size.
- **The breakpoints are literals, not tokens** — a platform constraint (`var()` is illegal in a
  container size query), stated in the CSS banner. The narrow breakpoint is a SNAPSHOT of the
  floor token's default (16em), not live-linked: a consumer who overrides the floor re-times the
  rung's reachability, not its value. Re-tuning rungs is a token-system conversation only if a
  real consumer proves the need — booked as later, not solved speculatively.
- **The ladder makes per-width looks part of the contract** — browser legs assert rung state at
  representative container widths (container queries are jsdom-invisible; the browser shard is
  load-bearing, per the intake's own Assert row), and the visual shard gains wide/medium/narrow
  goldens.
- **Stale → re-verify at the build wave:** `column-chart.css` (`svg[data-part='plot']` re-key +
  stroke→border property moves + the `@container` rungs + banner) · `column-chart.ts` `#plotNode`
  (div construction; `SVG_NS` retires from this control) · `column-chart-css.test.ts` (SVG
  property pins re-key) · `column-chart.browser.test.ts` + `column-chart-descriptor.test.ts`
  (element-type assertions re-key to geometry/part assertions; new rung legs) · visual-shard
  goldens (re-capture, booked not silent) · `chart-family.spec.md` SPEC-R16/R23-class deltas +
  `chart-family.prd.md` bump · `column-chart.md` anatomy prose · ADR-0228 header reciprocal
  pointer (REV mechanical repair) · the A2UI catalog is UNTOUCHED for clauses 1–5 (zero prop
  changes; clause 6 branch A, if picked, adds one descriptor prop and re-opens that row).
- **`ui-line-chart`, `ui-pie-chart`, `ui-gauge`, `ui-sparkline` keep SVG** — continuous/radial
  marks are the fence's own subject matter; nothing here licenses an HTML rewrite of a curve.
- **The fork stays open until ratification** — the build wave for clauses 1–5 can be dispatched
  on ratification regardless of branch (both branches leave clauses 1–5 byte-identical); branch
  A alone would add a further wave.

## Alternatives considered

- **Amend ADR-0228 (an `## Amendment` section) instead of a new ADR** — rejected (the intake's
  owed question (a), resolved): doc-standards §1b's test is whether the original Decision
  stands — cl.2's rendering-assignment SENTENCE is being *changed*, which §1b names a
  supersession ("if you want to change a sentence inside an accepted Decision, that is a
  supersession — open a new ADR"), and an amendment could not cleanly carry this record's OTHER
  two rulings (the ladder realizes cl.7's later-item; the fork must sit OPEN for a ratification
  pick). One coherent record, partial-supersession scoped to one sentence — the ADR-0100/ADR-0016
  precedent shape.
- **Amend ADR-0107 cl.3** — rejected: nothing in its Decision changes; its own rationale ("CSS
  cannot draw it") already fences SVG to continuous marks — this record RECORDS that reading
  (clause 1) rather than silently relying on it, which is all the narrowing question needed.
- **Keep the SVG and ladder only the chrome** — rejected: container queries cannot restyle the
  SVG's interior per container width without duplicated breakpoints outside it; the gridline/
  now-marker rungs would fork across two substrates, and both latent defects (RTL, dot
  anisotropy) would stand.
- **Background-drawn (not border-drawn) gridline divs** — rejected at design time: forced-colors
  strips backgrounds to `Canvas` (the SPEC-R10 vanishing-fill lesson); borders survive with the
  forced ink and need no compensating arm for the lines themselves.
- **Renaming plot parts for the substrate change (e.g. `grid-rule`)** — rejected (clause 2):
  names name anatomy; every citation would churn for zero information.
- **A consumer-established container (the ADR-0100 site-surface model) instead of
  self-establishment** — rejected (clause 3): the rungs must measure the chart's OWN box, and the
  CSS-less/zero-consumer-CSS contract (ADR-0102) forbids requiring consumer establishment.
- **Block-axis rungs too (`container-type: size`)** — rejected: no rung keys on height; two-axis
  size containment is a heavier containment class adopted speculatively — re-openable with a real
  height-degradation need.
- **Round-number breakpoints (320px/200px)** — rejected: the intake explicitly owed
  geometry-derived values; 28em falls out of the chip-pitch arithmetic and 16em out of the
  ratified floor, and both ride the type scale via host-em units where round px values would not.
- **Deciding the granularity fork here (either way)** — rejected: Kim's 2026-08-21 ruling names
  the fork as HERS; this record structures both branches with consequences and a recommendation,
  and deliberately no default (clause 6).
