# ADR-0205 — `ui-line-chart` v1 axis vocabulary: minimal baseline + min/max labels, single-series, hand-rolled inline SVG

> Source: agent-ui ADR log (this directory — the numbered files ARE the index; status lives in each ADR's own header). · 2026-08-18
>
> | Field | Value |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-08-18 |
> | **Proposed by** | planner (design seat — GH #1207, realizing `req-a2ui-library.md` mobilization item 6, dispatched from `dispatch-ticket`'s build-leader path) |
> | **Ratified by** | — |
> | **Repairs** | none — new component intake, no existing doc corrected |
> | **Supersedes / Superseded by** | (none) — relates [ADR-0107](./0107-chart-family-v1-scope.md) (names this exact gap: *"axis systems ... line-with-axes, multi-series ... Any axis-bearing type is a new intake"* — this ADR is that named intake, and leaves ADR-0107's own v1 scope for `ui-sparkline`/`ui-bar-chart` untouched) |

## Context

`.claude/docs/research/req-a2ui-library.md` mobilization item 6 names `ui-line-chart` (axes,
multi-series) as its own later-tier issue, filed as GH #1207, each carrying its own ADR — not a
rider on that doc's own v1 PRD (whose R5 fence explicitly excludes new chart code from ITS OWN
v1 scope; item 6 is the carved-out exception, not a violation of it). ADR-0107 shipped
`ui-sparkline` (axis-free line/area mark) and `ui-bar-chart` (axis-free bar-list) under a
deliberately axis-free v1, naming "line-with-axes" as **the first axis-bearing type** and ruling
it a new intake by construction (ADR-0107 cl.1). This ADR is that intake.

The same two standing laws from ADR-0107 bound the solution space again: the zero-dependency
pillar (CLAUDE.md) rules out any charting library, so the axis vocabulary must stay hand-rolled
and hand-gated; and chart scope explodes at the axis system (ticks, gridlines, legends, label
collision) — so the entire question this ADR answers is **how little axis vocabulary earns the
name "axis-bearing chart"** without re-opening ADR-0107's fenced-off scope explosion.

## Decision

**We will admit `ui-line-chart` with the SMALLEST axis vocabulary that distinguishes it from
`ui-sparkline`: a value-range baseline + textual min/max labels, single-series only, hand-rolled
inline SVG in the existing Display size-class, entering the default catalog in the same wave it
ships.**

1. **Axis vocabulary (v1)**: a baseline line (the zero line when the series' value range spans
   zero, else the value floor) rendered as one `<line>` element, plus two textual value labels —
   the series minimum and maximum — rendered as real DOM text (not SVG `<text>`), mirroring
   `ui-bar-chart`'s "labels are real DOM text, never SVG text" precedent (ADR-0107 cl.3). **No**
   tick marks, **no** gridlines, **no** legend, **no** tooltip layer, **no** time axis in v1 — all
   named LATER, each its own future issue, same fence style as ADR-0107 cl.1.
2. **Series (v1): single-series only.** The req-a2ui-library source item's own title parenthetical
   names "multi-series" as demand, but honestly weighed against the v1-small floor: a
   multi-series prop needs a per-series color/token index PLUS a legend to stay legible (multiple
   unlabeled lines in one color are not an accessible encoding), and a legend is explicitly the
   next axis-system escalation ADR-0107 cl.1 already fences out. Shipping multi-series without a
   legend would be a silent accessibility regression; shipping it WITH a legend re-opens exactly
   the scope explosion this family's v1 boundary exists to avoid. **Multi-series is deferred to
   its own later issue**, filed once a legend/color-key vocabulary is separately decided — this
   keeps v1 honest rather than pretending multi-series is free.
3. **Value labels**: min/max labels are **always shown** (unlike `ui-sparkline`'s optional
   `label` accessible-name prop) — they are the axis vocabulary itself, not decoration; an
   axis-bearing chart with no visible axis values would not earn the "axis-bearing" name this ADR
   grants it. A separate `label` prop (mirroring sparkline/bar-chart) still supplies the
   accessible name / caption, independent of the min/max value labels.
4. **Data contract**: `values: number[]` (the same safe-JSON-codec pattern as `ui-sparkline`) —
   e.g. `{ "component": "LineChart", "values": [3, 5, 4, 8, 7] }`. An explicit `min`/`max`
   override pair is a *foreseen extension*, not v1 (mirrors ADR-0107 cl.2's own deferral of the
   same override for sparkline/bar-chart).
5. **Rendering**: the continuous line = component-built inline SVG polyline (+ optional closed
   low-alpha `area` variant, same craft as `ui-sparkline`), but the viewBox is sized as a real
   chart TILE — a fixed aspect box with room reserved for the min/max label rows — not
   `ui-sparkline`'s decorative normalized 100×100 mark. The path math (baseline position,
   min/max, point coordinates) lives in a pure, DOM-free module (the LLD-C1/C4 precedent),
   unit-testable without a browser.
6. **Accessibility**: same inversion as ADR-0107 cl.4 — a chart is data, not decoration.
   `internals.role = 'img'` set once directly in `connected()` (never inside an effect, the
   `ui-sparkline` precedent); `ariaLabel` = a generated summary (label + min/max + point count)
   recomputed on `values`/`label` change, never null, never aria-hidden.
7. **Explicitly LATER** (new intakes, each its own future issue): tick marks, gridlines, legends,
   tooltips, multi-series (cl.2), time axes, streaming/animated updates, hover/keyboard
   interaction.
8. **Catalog**: `LineChart` enters the default catalog (factory, conformance, tier map, feed
   disposition, frontier seed, disposition-allowlist, corpus import-seeds) in the same wave the
   component ships, mirroring `Sparkline`/`BarChart`'s own same-wave catalog entry (ADR-0107's
   own decision, unchanged here).

## Rejected alternatives

- **No axis at all** (ship `ui-line-chart` as a second sparkline with a different name) — rejected:
  this would not answer the gap ADR-0107 itself named ("line-with-axes... a new intake"); it would
  just be a renamed `ui-sparkline`.
- **A full axis system** (ticks + gridlines + legend + tooltip in v1) — rejected: re-opens exactly
  the scope explosion ADR-0107 cl.1 fences out; the honest-floor law keeps v1 to the minimum that
  earns the axis-bearing name.
- **Multi-series in v1** — rejected per Decision cl.2 for THIS build wave on scope/sequencing
  grounds, not on the merits: a concurrently-drafted alternative design for this same ADR slot
  (produced by a stray duplicate dispatch during this campaign — see the numbering-collision note
  below) argued convincingly that multi-series can ship safely in v1 as a bare `series:
  number[][]`, with per-series identity carried by an INDEXED token+dash-pattern ladder
  (`--ui-line-chart-series-{i}`, cycling, paired with a dash-pattern ladder so identity never rides
  hue alone — ADR-0057) rather than named series + a legend. That sidesteps exactly the legend
  concern this ADR's cl.2 raises, and is the correct shape for whoever picks up multi-series next —
  named here so the insight isn't lost, not adopted in this build because the shipped, gate-green
  `values: number[]` single-series component already exists and a mid-flight prop-shape change
  (`values` → `series`) was judged a larger, unbudgeted redo for this dispatch round.

## Non-goals

- No charting dependency (D3/Chart.js/uPlot) ever — the zero-dep pillar is absolute (CLAUDE.md,
  ADR-0107 cl.1's own framing).
- No pie/donut/scatter — out of scope for this ADR entirely (ADR-0107 cl.1's fence already names
  these; unaffected here).
- No time-axis, no streaming/animated append — later intakes.

## Consequences

- `ui-line-chart` becomes the fleet's first axis-bearing chart type, opening the door for later
  intakes (multi-series + legend, tick marks) to build on its baseline/min-max vocabulary rather
  than re-deriving one.
- The min/max-always-shown rule is a small, deliberate a11y-visible departure from `ui-sparkline`'s
  optional-label pattern — documented here so a future reviewer does not read it as inconsistency.

## Numbering-collision note (transparency, not part of the decision)

A dispatch-orchestration defect during this same build campaign (an already-nested coordinator
seat fired an async sub-dispatch to a planner and then ended its own turn treating that dispatch
as a pending callback — the callback structurally could not route back to it) produced a SECOND,
independently-authored ADR also claiming the number 0205 (`0205-line-chart-axis-vocabulary.md`,
since removed from this branch). That draft reached a stronger multi-series design than this one;
its reasoning is folded into this ADR's "Rejected alternatives" section above rather than
discarded. Recorded here so the collision and its resolution are auditable, not silently erased
from history.
