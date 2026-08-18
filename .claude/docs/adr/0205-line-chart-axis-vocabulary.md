# ADR-0205 — `ui-line-chart` v1 axis vocabulary (GH #1207): the honest floor for an axis-bearing chart — one value-range baseline + printed min/max labels, multi-series as bare `number[][]` with token-indexed identity, everything else (ticks, gridlines, legend, tooltips, time axes, interaction) fenced as named future intakes

> Source: agent-ui ADR log (this directory — the numbered files ARE the index; status lives in each
> ADR's own header). · 2026-08-18
>
> | Field | Value |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-08-18 |
> | **Proposed by** | planner (design seat — the GH #1207 intake; this is the axis-bearing "new intake" ADR-0107 cl.1 names, run as the `due-process` Understand/Research + Plan phases of that size:big issue) |
> | **Ratified by** | — |
> | **Repairs** | none — this record EXERCISES ADR-0107's fence rather than repairing anything: cl.1's *"Any axis-bearing type is a new intake"* is the door this ADR walks through. At the build wave, the chart-family PRD §3 ruled-out row for "line-with-axes, multi-series" gains its answered-by pointer to this ADR (build-wave housekeeping, not owed now). |
> | **Supersedes / Superseded by** | (none) — relates [ADR-0107](./0107-chart-family-v1-scope.md) (the axis-free chart-family v1 whose cl.1 fence names this exact intake; every craft law it pinned — zero-dep hand-rolled marks, per-type components, Display class, `role=img` + generated name, `--ui-{name}-*` tokens — carries forward unchanged, never superseded) · [ADR-0057](./0057-intent-non-color-signifier-rule.md) (intent never travels by color alone — the law clause 3's series-identity design answers) · [ADR-0087](./0087-a2ui-whole-fleet-catalog-scope-policy.md) (the same-wave catalog gate clause 6 obeys) · [ADR-0078](./0078-ui-text-three-axis-variant-size-as.md) (the type tokens the printed value labels read) |

## Context

ADR-0107 (accepted 2026-07-08) admitted the chart family as a deliberately **axis-free** v1 —
`ui-sparkline` + `ui-bar-chart` — and fenced out *"axis systems … line-with-axes, multi-series …
Any axis-bearing type is a new intake"* (its Decision cl.1), because chart scope explodes exactly at
the axis system: ticks, scale labels, gridlines, legends, and label-collision handling are where a
small chart becomes a rendering framework. GH #1207 is that named new intake, carried on the
mobilization map as `req-a2ui-library.md` item 6 — *"Line chart (axes, multi-series)"* — explicitly
its own later-tier issue with its own ADR (item 6 is carved OUT of that doc's R5 v1 fence, not a
violation of it).

The standing laws bound the solution space before taste enters, all inherited from ADR-0107 and
still binding: the **zero-dependency pillar** rules out every charting library, so every mark is
hand-rolled and hand-gated and the scope decision *is* the cost decision; **per-type components**
over one generic `ui-chart`; **Display size-class**, no new class; **CVD safety** — intent never
travels by color alone (ADR-0057); **`role=img` + a generated accessible name** via
`ElementInternals` (the sparkline SPEC-R4 pattern); **`--ui-{name}-*` tokens**. The build craft is
already proven in-repo: `controls/sparkline/` (normalized-viewBox inline SVG polyline,
`vector-effect="non-scaling-stroke"`, pure DOM-free math module, safe JSON attribute codec) and
`controls/bar-chart/` (labels/values as real DOM text reading the type tokens, math/element/css
file split).

What this ADR must therefore decide is not *how to draw a line* — sparkline already draws one — but
**which axis vocabulary earns v1**. The governing judgment is the honest-floor law: ship the
minimum that earns the name "axis-bearing chart", not a full axis system. A sparkline shows the
*shape* of a series; what it cannot answer is *"roughly what values am I looking at, and where is
zero?"* The floor that answers that question is a reference baseline plus printed range extremes —
everything past it (ticks, gridlines, legends) is the explosion ADR-0107 fenced.

## Decision

**We will admit `ui-line-chart` as the family's first axis-bearing type with a deliberately minimal
axis vocabulary — one value-range baseline + always-printed min/max value labels — carrying
multi-series data as a bare `number[][]` with token-indexed, non-hue-only series identity, and NO
ticks, gridlines, legend, tooltips, time axis, or interaction in v1 — each fenced as its own named
future intake.** One decision realized in seven clauses; SPEC/LLD own the mechanisms at the
separately-dispatched build wave.

1. **The v1 axis vocabulary is a baseline + two printed extremes — nothing else.** The chart draws
   ONE horizontal reference line: at `y(0)` when the auto value range crosses zero (min < 0 < max),
   otherwise the chart's bottom edge *is* the value floor and no separate line is drawn. Exactly two
   textual value labels print — the range **max** (top) and **min** (bottom) — as **real DOM text
   outside the SVG** (the bar-chart law: selectable, wrapping, reading the `--md-sys-typescale-*`
   matrix, natively AT-visible; no SVG text), formatted via the module-memoized default-locale
   `Intl.NumberFormat` (the sparkline-math precedent). *Why this floor:* two labels at two fixed
   positions have **no label-collision problem and need no tick-placement ("nice numbers")
   algorithm** — the two costs that make a real axis system a framework. A zero-line is the single
   highest-value reference a line chart can carry (it disambiguates "trending down" from "negative"),
   and it falls out of the existing normalization math as one more y-coordinate. Exact label
   placement/grid geometry is LLD business under the test-the-whole-shape law.
2. **Value labels are ALWAYS shown** (whenever the rendered set is non-empty) — never gated behind a
   prop. *Why:* the printed extremes ARE the axis vocabulary; a `ui-line-chart` with its labels off
   is a multi-series sparkline, and that consumer should reach for `ui-sparkline` (or a foreseen
   sparkline extension), not a degraded mode of this control. One fewer boolean, one fewer state to
   gate, and the control never renders in a shape that fails to earn its name. (The `label` prop —
   accessible-name *context*, clause 4 — is independent of, and does not gate, the printed extremes.)
3. **Multi-series ships in v1, as the smallest surface that carries it: `series: number[][]`.**
   The req item is literally titled "Line chart (axes, multi-series)", and the marginal mechanics are
   genuinely small: one shared auto min/max over the union of all series (the same span formula
   sparkline-math already owns), N polylines instead of one. The attribute codec additionally accepts
   a bare `number[]` and normalizes it to one series (hardening/normalization, not a second prop —
   models will emit flat arrays for single-series charts). Series identity is **positional and
   unnamed**: per-series stroke rides an indexed token ladder (`--ui-line-chart-series-{i}`, a small
   fixed count that cycles) **paired with an indexed dash-pattern ladder**, so identity never travels
   by hue alone (ADR-0057; solid/dashed/dotted is a shape channel CVD keeps). **Named series and a
   legend are ONE future intake together** — a `{name, values}[]` shape whose names render nowhere is
   a dishonest contract, and a legend is exactly the label-collision/layout system this fence exists
   to keep out of v1.
4. **A11y follows the sparkline pattern, extended per-series** *(a chart is data, not decoration —
   ADR-0107 cl.4)*: `role=img` via `ElementInternals` set once in `connected()`; a generated
   accessible summary recomputed on change — per series, the SPEC-R4-style sentence (count, start →
   end, low/high), enumerated ("series 1: …; series 2: …"); the optional `label` prop prefixes as
   context; the SVG is `aria-hidden`; there is never a silent state (no data announces "no data").
   Exact wording is SPEC business.
5. **Build shape inherits the family craft laws wholesale** (restated as binding, not re-decided):
   hand-rolled inline SVG polylines in a normalized viewBox with `preserveAspectRatio="none"` +
   `vector-effect="non-scaling-stroke"`; the pure DOM-free math module + element + single
   `line-chart.css` file split (LLD-C1/C2 pattern); one `controls/line-chart/` folder in
   `@agent-ui/components` (no new package — ADR-0107 cl.7 stands); Display size-class, geometry via
   `--ui-line-chart-*` tokens in the standard `:where()` block; safe JSON codec for the `series`
   attribute (garbage never reaches the math on either the attribute or the property path).
6. **Catalog + feed disposition, same wave** *(build-wave scope, decided here)*: a `LineChart`
   display-only catalog row lands in the same wave as the control (the ADR-0087 SPEC-N2
   fleet-derived gate; no `value:{prop,event}` mark, no ADR-0019 seam slot), and `LineChart` joins
   `FEED_EXCLUDED` with the same OUT-reasoning as its siblings (ADR-0107 Amendment 2 — the partition
   gate is total; report content reaches the artifact feed through full-catalog rendering).
7. **Ruled out for v1 — the fence, each item its own named future intake, never a rider on a build
   wave:** tick marks + intermediate scale labels ("nice numbers" axis) · gridlines · legend + named
   series (one intake, per clause 3) · tooltips / hover / any pointer or keyboard interaction ·
   time/x-axis labels (a time axis is a second full axis system plus date formatting) · streaming /
   animated updates · explicit `min`/`max` range overrides (already the foreseen extension of
   ADR-0107 cl.2 — inherited, not new here). "Just add gridlines" is the predictable next ask; this
   list is the fence.

**No open forks for Kim** — every fork this intake carried (axis floor, series arity, label gating)
is decided above with its reasoning; ratification of this record as a whole is the only pending
decision.

## Consequences

- **The family's first labeled chart is no longer a pure inline mark.** Printed extremes give
  `ui-line-chart` a real minimum box (label rows + mark region) larger than sparkline's; the LLD owes
  explicit floors under the test-the-whole-shape law, and narrow-container (feed-bubble) behavior is
  a mandatory browser leg, both engines.
- **Multi-series correctness is fleet-owned with no library to blame:** shared-range math over
  ragged series lengths, degenerate data per series (empty series, single point, all-equal,
  all-negative, NaN entries), the zero-line's presence/absence flip at range boundaries — all
  hand-gated in the pure math module first, then whole-shape browser legs.
- **The series token ladder is a new token-class:** an INDEXED `--ui-line-chart-series-{i}` ladder
  (plus dash patterns) has no exact fleet precedent; the token-builder seat owns its light/dark/
  forced-colors behavior at build. Cycling means series `i` and `i+N` share ink — an accepted,
  documented limit of unnamed positional identity, not a bug.
- **Catalog surface grows by one display type** — corpus, eval shards, and the derived prompt
  re-validate over the widened catalog (the ADR-0087 consequence pattern), and the §5.2-style usage
  guidance must teach the boundary: *Sparkline for the shape of a series · LineChart when values/zero
  matter or series must be compared · BarChart for comparing magnitudes across categories.*
- **The family size budget (26 KB after the ADR-0107 Amendment re-base) will be pushed again** —
  measured at the build wave (`npm run size` discipline), never guessed here; the per-control ≤~2 KB
  marginal cap remains the real gate.
- **The accessible summary is lossy by design** (the ADR-0107 verbosity judgment, now × N series);
  the foreseen extension remains an author-supplied long-description/data-table fallback.

## Acceptance

This is an **intake-and-decision** ADR — the component build and catalog wiring happen in
separately-dispatched phases (the `due-process` Execute/Evaluate phases of GH #1207), not in this
change:

- **Intake (this change):** this record exists, is indexed by filename, carries the decisions above
  with stated reasoning and zero open forks, and is linked from GH #1207 via a dated Findings
  comment. The independent docs critic (docs:doc-checker) runs separately in this campaign; Status
  stays `proposed` until Kim's own flip.
- **Build wave (separately dispatched):** `controls/line-chart/` lands to clauses 1–5 with the
  same-wave `LineChart` catalog row + `FEED_EXCLUDED` entry (clause 6); pure-math unit legs cover
  the degenerate-data matrix incl. the zero-line boundary flip; browser legs assert printed min/max
  as real text, the baseline's presence/absence, ≥2-series rendering with distinct stroke+dash, and
  `role=img` + the enumerated summary via internals; gates green by exit codes.

## Alternatives considered

- **Full tick/gridline axis in v1.** Rejected: tick placement needs a "nice numbers" algorithm,
  collision handling, and label-density decisions — the exact framework-shaped explosion ADR-0107
  fenced. The two-extremes floor answers the value-magnitude question at a fraction of the surface.
- **No axis vocabulary at all — ship a multi-series sparkline.** Rejected: fails the ticket (the
  intake IS the axis-bearing type) and fails the honest-floor test from the other side — nothing
  would earn the name. The gap between "shape of a series" and "values in context" is precisely the
  baseline + extremes.
- **Min/max labels gated behind a prop (default off, or shown only with `label`).** Rejected
  (clause 2): the labels are the axis; an opt-out mode duplicates `ui-sparkline`'s territory and adds
  a state with no owner. Consumers wanting a bare mark already have a control for that.
- **Single-series v1 (`values: number[]`), multi-series later.** Rejected: the source item names
  multi-series as the point of the type, and the true costs of multi-series (legend, names,
  interaction) are all behind the clause-7 fence anyway — what remains is a loop over polylines and
  a union min/max. Deferring it would near-guarantee a prop-shape break (`values` → `series`) at v2.
- **Named series in v1 (`{name, values}[]`), names surfaced only to AT.** Rejected (clause 3): a
  name the sighted user can never see is a dishonest contract and a standing pressure toward an
  unplanned legend; names + legend ship together as one honest future intake.
- **Hue-only series identity (color ladder alone, no dash patterns).** Rejected: ADR-0057 —
  intent never travels by color alone; adjacent-hue series would be indistinguishable under CVD and
  in forced-colors mode. Dash patterns ride the existing stroke for free.
- **A time/x-axis in v1 (`req` item says "axes", plural).** Rejected: an x-axis owes tick placement
  on a second dimension PLUS date parsing/formatting/locale — a larger system than the entire v1
  surface decided here. The x-dimension stays ordinal-by-index (the sparkline law); a time axis is
  its own named intake.
