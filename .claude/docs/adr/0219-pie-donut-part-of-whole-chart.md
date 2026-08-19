# ADR-0219 — `ui-pie-chart` (`PieChart`, donut-default): the part-of-whole mark enters the chart family with a lightness-ramp palette and a real-DOM key list, lifting ADR-0107's pie fence on its own stated conditions

> Source: agent-ui ADR log (this directory — the numbered files ARE the index; status lives in each ADR's own header). · 2026-08-19
>
> | Field | Value |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-08-19 |
> | **Proposed by** | planning-leader (design seat — GH #1375, the classic-widget decision lane #1372/#1373/#1375; ADR number host-assigned) |
> | **Ratified by** | *(awaiting Kim)* |
> | **Repairs** | `chart-family.prd.md` §3 (the pie/donut ruled-out bullet → "admitted under ADR-0219's conditions") · ADR-0107 "Pie/donut in v1" rejected-alternative (annotated as lifted, the ADR-0205 precedent of a named intake realizing a named fence) · `a2ui-catalog.spec.md` §5.2 (the drafted row below, UNAPPLIED) — all applied by the build wave on ratification |
> | **Supersedes / Superseded by** | (none) — relates ADR-0107 (the v1 fence this intake lifts, on mechanics) · ADR-0205 (the named-intake-realizes-named-fence precedent; its cl.2 legend/color-key deferral is PARTIALLY settled here for the part-of-whole case only) · ADR-0057 (the non-color-signifier law this ADR's palette obeys) |

## Context

The chart family ships `Sparkline`/`BarChart` (ADR-0107) and `LineChart` (ADR-0205). Every genUI kit
carries a proportional chart; "part of a whole" is a distinct answer shape agents reach for, and the
catalog has no mark for it (GH #1375). ADR-0107 ruled pie/donut OUT of v1 **on mechanics, not
fashion**, naming three reasons: (1) angle is a low-accuracy perceptual channel; (2) segment identity
in a pie is typically hue-only, colliding with ADR-0057 (the fleet never signifies by hue alone — the
CVD finding); (3) a pie needs a legend, an axis-system cousin. Its closing claim — "aligned bars
answer the same proportion question" — is the load-bearing one to test.

Tested against mechanics, that claim is half-true. `BarChart` encodes MAGNITUDE by length against a
zero baseline; it does not make the WHOLE visible — nothing in a bar list sums to 100%, so "what
fraction is each" is left to the reader's arithmetic. A part-of-whole mark's job is exactly to make
the whole a visible unit. So the question is not "pie vs bars" but "which part-of-whole mark clears
ADR-0107's three conditions." Two candidates: a **proportion bar** (one 100%-stacked horizontal
bar — length channel, strongest) and a **donut** (the ring — angle channel, weaker, but the
universally recognized part-of-whole gestalt with a center that can hold the whole's own label/total).

The tree fixes the craft either way: component-built inline SVG, `currentColor`/token ink, labels as
REAL DOM text never SVG text (ADR-0107 cl.3, ADR-0205 cl.1), an explicit `forced-colors` arm
(SPEC-R10), Display-class geometry (SPEC-R12), `role` via `ElementInternals` with the host as a
`role=list` of real `listitem` rows (the `ui-bar-chart` pattern). The token estate has NO categorical
palette — eight SEMANTIC families (`primary`/`secondary`/`accent`/`neutral` + the four intents) each
with a lightness ladder (`-bright`/`-high`/base/`-dim`/`-low`/`-muted`); using the intent families as
slice colors would read "danger" on slice four. ADR-0205 cl.2 deferred multi-series line precisely
because "a legend/color-key vocabulary" was not yet decided — this ADR must decide one for slices or
it re-commits that deferral's sin.

Note on inputs: the intake cites "the dataviz skill's form heuristic + color formula"; no skill by
that name is installed in this estate (searched `~/.claude` and every plugin cache). The form/color
rules applied below are the fleet's own ratified ones (ADR-0057, ADR-0107 cl.3/4, chart-family SPEC
R8/R10/R12) — named here so the gap is visible, not papered over.

## Decision

**We will admit `ui-pie-chart` as ONE new chart-family control and catalog type `PieChart`, with
`variant: 'donut' | 'pie'` defaulting to `donut`, reusing `BarChart`'s `{label, value}[]` data
row, identity carried by ORDER + LABEL + PRINTED PERCENT in a real-DOM key list (never hue alone),
slice fills drawn from a single-family LIGHTNESS ramp of existing tokens, and a donut center slot for
the whole's label/total — lifting ADR-0107's pie fence because each of its three stated conditions
is met by construction, not waived.**

1. **One type, not a `variant` on an existing chart** — ADR-0107 already rejected the generic
   `ui-chart type=…` (one component wearing N marks); `BarChart`'s own `variant` axis is reserved
   for `orientation` (its foreseen extension). `variant` lives INSIDE `PieChart`: `donut` (default —
   the ring leaves a center for the whole) and `pie` (solid), the `Sparkline` `line|area` precedent.
2. **Data**: `data: {label: string, value: number}[]` (bindable; the `BarChart` row schema verbatim,
   same validator depth posture) + `label` (bindable accessible name). Hardening (SPEC-R7 class):
   non-finite/negative values and empty labels DROPPED from the rendered set; an all-zero/empty
   rendered set paints an empty track ring + no key rows; the whole-shape law holds. **No
   "Other" folding, no sorting** — the mark makes no analysis (ADR-0107's "rising" rule); the
   agent orders its own data.
3. **Condition 1 (angle is weak) → every slice prints its percent.** The key list row is
   `{label} · {percent}` (percent = `value / Σ rendered`, `Intl`-formatted, 0 decimals default),
   real DOM text. Angle carries the gestalt; the number carries the accuracy — the same split
   `BarChart` makes with its printed value (SPEC-R5).
4. **Condition 2 (hue-only identity) → identity never rides hue.** Slice *k* and key row *k*
   share (a) the same INDEX (DOM order = data order = clockwise order from 12 o'clock), (b) the
   label, (c) the printed percent, and (d) the fill. Fill is the FOURTH carrier, never the only
   one. Fills step down a LIGHTNESS ramp of one semantic family — `--md-sys-color-primary-bright`
   → `-high` → base → `-dim` → `-low` → `-muted` (6 steps, cycling past 6 with a hairline
   separator keeping adjacent slices distinct) — surfaced as `--ui-pie-chart-slice-{1..6}-ink`
   tokens so a consumer re-maps the ramp without touching the control. Lightness order survives
   CVD (ADR-0057's own argument: L is the channel deuteranopia keeps) and is monotone with data
   order, so a CVD reader still reads "first slice = brightest." Adjacent slices are separated by
   a constant-width stroke in the surface role (`vector-effect: non-scaling-stroke`).
5. **Condition 3 (needs a legend) → the legend IS the data list, not an SVG legend layer.** The
   key list is the `ui-bar-chart` row pattern (`role=list` host, real `listitem` rows, labels as
   DOM text) placed beside/below the ring by CSS — NOT an axis-system SVG vocabulary. ADR-0205's
   "legend = axis-system escalation" fence concerned SVG-layer legends with label-collision math;
   a DOM list has none of that. This settles ADR-0205 cl.2's color-key question for the
   PART-OF-WHOLE case only (slices are categorical AND ordered, so a lightness ramp suffices);
   multi-series LINE stays deferred — its series are not ordinal, so this ramp is not its answer.
6. **Donut center slot**: `variant='donut'` exposes one light-DOM child slot for the whole's
   caption (an author-placed `Stat` or `Text` — "Total · 1,240"); the control itself paints nothing
   in the center. The catalog row carries this as `children: 'ChildList'`-free for v1 — the center
   content is a SIBLING composition in the consumer's layout, not a child of the chart row
   (keeps the row display-only and mirrors the other chart rows). A `centerLabel` string prop is
   the foreseen v1.1 widening if composition proves clumsy in seeds.
7. **Rendering + a11y**: the ring = one `<path>` arc per slice in a normalized viewBox
   (`preserveAspectRatio` default — a ring must stay round; the chart-family `none` law is the
   sparkline's, not universal), token fills, surface-role separators; `forced-colors`: every slice
   `CanvasText`, separators `Canvas` (identity via the key list, which survives untouched), track
   `Canvas` + `CanvasText` border. Host `internals.role='list'` + `ariaLabel = label || null`;
   the ring SVG `aria-hidden` (the rows ARE the accessible rendering — the `ui-bar-chart` law).
8. **Explicitly LATER** (each its own intake, ADR-0107 cl.1 / ADR-0205 cl.7 fence style):
   interaction/hover, exploded slices, multi-ring, a `proportionBar` variant (the length-channel
   cousin — recorded below as the rejected v1 default, foreseen as a `variant` value), per-slice
   color overrides from the wire, center-label prop (cl.6), a categorical palette token family
   (the moment a SECOND non-ordinal multi-category mark lands — multi-series line — the ramp stops
   sufficing and a real categorical family is the intake).

### Drafted SPEC §5.2 delta (UNAPPLIED — lands with the build wave, on ratification)

> | `PieChart` | `ui-pie-chart` | **(build wave)** (ADR-0219 — the part-of-whole mark; lifts
> ADR-0107's pie fence on its three stated conditions). Bindable `data` (array of
> `{label: string, value: number}`, `mapsTo: data` — the `BarChart` row schema verbatim;
> negative/non-finite/unlabeled entries dropped, no folding, no sorting); bindable `label`
> (string, the accessible name); `variant` (`donut`/`pie`, non-bindable, default `donut`).
> Display-only row: no `value:{prop,event}` mark, no children (the donut center is a SIBLING
> composition in the consumer's layout, ADR-0219 cl.6). Identity per slice = order + label +
> printed percent + a single-family lightness-ramp fill (never hue alone, ADR-0057); the key
> list is real DOM (`role=list`), the ring `aria-hidden`. **Usage:** parts of ONE whole (share of
> revenue by region, allocation of a budget) — ≤6 slices reads best; magnitudes across items
> that do NOT sum to a meaningful whole → `BarChart`; a series over time → `LineChart`/`Sparkline`.

## Consequences

- A new control folder + row + the chart-family size-budget re-base (ADR-0107's amendment
  precedent) + the full §5(iii) rider set — priced into the build wave. `chart-family.prd.md` §3
  and ADR-0107's rejected-alternative are REPAIRED (annotated), not silently contradicted.
- The lightness ramp is ordinal by construction: slice 1 is always the brightest. A consumer whose
  data order has no meaning gets an implied ranking from the ramp; the usage note names this
  (order your slices deliberately). Rejected mitigation: a hue-varied palette (below).
- Past 6 slices the ramp cycles; separators + the key list keep identity, but the mark gets
  visually weaker — the usage note says ≤6, the hardening does NOT truncate (no analysis).
- Settling a color-key vocabulary for ONE ordinal case leaves multi-series line's deferral
  (ADR-0205 cl.2) open and now sharper: its answer is a categorical token family, not this ramp.
- A negative value in part-of-whole data is meaningless and is dropped (not clamped) — a
  documented hardening difference from `BarChart`, where negatives are legal magnitudes.
- **Stale → re-verify on land:** `chart-family.prd.md` §3 + ADR-0107's rejected-alternative
  annotation · `a2ui-catalog.spec.md` §5.2 (apply the drafted row) · `chart-family.spec.md`
  gains R-clauses for the new control (the ADR-0205 wave's precedent) · catalog factory +
  conformance/coverage gates · size-budget test · the new `--ui-pie-chart-*` tokens in the token
  docs test.

## Alternatives considered

- **Uphold ADR-0107 — no part-of-whole mark; route agents to `BarChart`** — rejected: ADR-0107's
  "bars answer the same question" is not mechanically true for part-of-whole (no visible whole,
  no percent); the gap is real and recurring (GH #1375), and each of ADR-0107's three conditions
  has a by-construction answer above. Leaving the fence would make agents compose a fake
  ("Stat per slice") exactly as the chart PRD's own Context records them doing before `BarChart`.
- **Proportion bar (100%-stacked horizontal bar) as the v1 default mark** — seriously weighed: it
  uses the LENGTH channel (stronger than angle) and needs no new geometry posture. Rejected as the
  DEFAULT, kept as the foreseen `variant`: (a) a stacked bar's inner segments lose the shared
  baseline ADR-0107 cl.2 prizes — only the first segment is baseline-aligned, the rest are
  compared end-to-end, which is the same weak-channel class as angle; (b) it has no place for the
  whole's own caption (the donut center); (c) the recognized gestalt for "share of a whole" that
  producers and readers both reach for is the ring — a catalog that names `PieChart` and draws a
  bar confuses the vocabulary the producer prompt teaches. The mechanics gap between the two is
  smaller than ADR-0107's prose implies once percents are printed; the gestalt gap is not.
- **`variant: 'pie'` on `BarChart` (one chart type, many marks)** — rejected: ADR-0107 already
  rejected the generic-`type` component on descriptor/geometry grounds, and `BarChart`'s row
  semantics (zero baseline, negatives legal, magnitude) contradict part-of-whole's (sum = whole,
  negatives meaningless).
- **A hue-varied categorical palette (one color per slice across families)** — rejected v1: the
  token estate has no categorical family; borrowing the intent families mis-signals (red = danger),
  and a hue-varied set is exactly the hue-only identity ADR-0057 forbids unless every slice ALSO
  carries a non-color carrier — which the key list provides, so hue variation buys nothing the
  ramp doesn't while costing CVD-ordering. The categorical family is the LATER intake (cl.8).
- **SVG legend layer (labels/percents as `<text>` around the ring)** — rejected: SVG text is the
  label-collision/axis-system escalation ADR-0107/0205 fence; real-DOM rows cost nothing and
  are already the family's a11y rendering.
- **A `total` prop (author-supplied whole, unfilled remainder drawn as track)** — rejected v1: it
  turns the mark into a progress/quota ring, which is `Stat variant='ring'`'s job (ADR-0111's
  `percent`); part-of-whole's whole is Σ of its parts by definition. Foreseen only if a real
  "share of a budget not yet allocated" seed demands it.
- **A new `@agent-ui/charts` package** — rejected, same reasoning as ADR-0107 clause 7: no
  vendored data mass, three small controls do not justify a layering-trip-wire widening.
