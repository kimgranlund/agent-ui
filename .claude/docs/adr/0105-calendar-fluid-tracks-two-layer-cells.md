# ADR-0105 — `ui-calendar` fills its given width: fluid `minmax(cell, 1fr)` tracks + a two-layer cell (full-track band layer, fixed circular point layer)

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-08
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-08 *(authored)* |
> | **Proposed by** | system-planner — the design seat; ticket #30 (booking-reservation: half-empty wide panel), with the fork's geometry falsification of naive track-widening |
> | **Ratified by** | *(pending — Kim / orchestration-coordinator on gate; doc-reviewer pass first)* |
> | **Repairs** | on ratification+build: `controls/calendar/calendar.css` (`:204` tracks → `minmax()`; the gridcell rule `:235-253` splits into the two-layer model; the state rules `:255-296` re-home per layer; `:116` "callers set width" comment rewritten) · `controls/calendar/calendar.md` sizing + state-visual paragraphs · `calendar.browser.test.ts` new wide-panel legs + negative control · `__screenshots__` re-baseline (shrink-wrapped must match; wide is new) · `a2ui-catalog.spec.md` §5.2 Calendar row sizing note. No `calendar.ts` change (CSS-only — the DOM anatomy stands). Decomp: [`css-less-consumer-family.decomp.json`](../decompositions/css-less-consumer-family.decomp.json) · **on accept: reciprocal `Extended by ADR-0105` back-links on ADR-0048 and ADR-0093** (scheduled per convention) |
> | **Supersedes / Superseded by** | Applies **ADR-0102** (Lane A — width adaptation becomes component-owned; no page CSS, no new prop). Extends **ADR-0048** (its cell ramp survives as the track FLOOR and the point-layer size; its square-cell/circular-state anatomy is re-expressed, not replaced) and **ADR-0093** (clause 4's fill contract is preserved invariant-by-invariant, §Decision 4) · relates ADR-0057 (shape signifier) · ADR-0036 (numeral line-height) · ADR-0100 (the mount surfaces that hand the calendar real width) |

## Context

`calendar.css:204` pins the day grid to seven fixed tracks — `repeat(7, var(--ui-calendar-cell-size, 2rem))`
— and the host shrink-wraps (`calendar.css:115-120`: `inline-block`; "callers set width … to control
sizing"). On an A2UI surface the caller is a model: booking-reservation composes the calendar inside
`Column gap='md'` (`catalog-coverage.ts:54,67`), whose ADR-0030 `stretch` default hands the calendar the
column's full width. The panel (a block box inside the host) spans that width; the fixed grid sits in its
inline-start corner; half the bordered panel is empty (ticket #30's screenshot). "Set a width on it" is a
CSS verb the composing consumer does not have (ADR-0102/0096) — and the panel *visibly claims* the width it
then wastes.

The fork's geometry analysis falsifies the naive fix. Widening tracks to `1fr` and letting the existing
single-element cells stretch breaks ADR-0093 clause 4's fill contract: the gridcell **button** carries both
the circular state visuals (`border-radius: 50%` endpoint/selected fill, hover, today ring —
`calendar.css:243,267,276`) and the square interior wash (`:291-296`); stretched buttons turn circles into
ellipses, while keeping buttons fixed inside wide tracks opens holes in the range band (wash cells no longer
abut). The correct geometry must separate the two roles the single box currently plays: the **band** wants
the full track; the **point** (endpoint circle, hover, today ring, focus) wants a fixed circle.

## Decision

Fluid tracks with a **two-layer cell** — CSS-only, no DOM change (the cells stay the single
`<button role="gridcell">` of `calendar.ts:660`; the layers are the button box + its pseudo-elements):

1. **Tracks go fluid with the ADR-0048 ramp as the floor:** `grid-template-columns: repeat(7,
   minmax(var(--ui-calendar-cell-size, 2rem), 1fr))`. Shrink-wrapped, `minmax` resolves to today's exact
   natural width (min = the old fixed track) — the compact rendering is unchanged. Given surplus width, the
   seven tracks share it equally and the grid fills its panel. Row heights stay fixed
   (`block-size: var(--ui-calendar-cell-size)` on cells) — width adapts, the month never inflates
   vertically.
2. **The BAND layer = the button box itself,** stretching to its track (the fixed `inline-size` at `:240`
   is released; `block-size` stays). It carries what is legitimately track-shaped: the square
   `[data-in-range]` interior wash (now continuous at any width — the band's cells abut except the existing
   `0.125rem` grid gap, unchanged from today), the ink/disabled/outside colors, and the enlarged hit target
   (a strict a11y win — the commit path `calendar.ts:491` already resolves through
   `closest('[role="gridcell"]')`, so a wider button changes nothing behaviorally).
3. **The POINT layer = a fixed `--ui-calendar-cell-size` circle centered in the button** (a pseudo-element;
   the button establishes its own stacking context so the layer paints above the band wash and below the
   numeral). It carries what is legitimately circular: the `[aria-selected]` endpoint/single fill, the
   hover wash, the `[data-today]` inset ring, and the `:focus-visible` outline — so the focus ring stays a
   circle at every width. A **second** pseudo on `[data-range-start]`/`[data-range-end]` paints a
   half-track wash from the circle's center toward the band interior (logical `inset-inline-*`, RTL-safe by
   construction — no directional gradient), so a wide track never opens a gap between an endpoint circle
   and the interior band; at the track floor its width is 0 — today's rendering exactly.
4. **ADR-0093 clause 4 survives invariant-by-invariant, named:** endpoints stay **circles** (the point
   layer is fixed-size — an ellipse is unconstructible); the interior wash stays **square/radius-0** (band
   layer); the band stays **self-delimiting** (`aria-selected` on endpoints + interior unchanged;
   endpoint-vs-interior still signified by shape per ADR-0057 — border-radius is untouched by
   forced-colors); the **four WHCM states** keep their mapping (selected/band = `Highlight`/`HighlightText`
   across both layers — the half-wash is the same `Highlight`; today = `ButtonText` inset on the point
   layer; focus = `Highlight` outline on the point layer; disabled = `GrayText`), with
   `forced-color-adjust: none` inherited by the pseudos from the cell rules that already set it. The
   preview-band and swap-complete interaction semantics (`calendar.ts`) are untouched — this is paint
   re-homing, zero behavior.
5. **No new prop, no token change:** `--ui-calendar-cell-size` keeps its ADR-0048 meaning re-stated as
   "the track floor and the point-layer diameter"; `[size]`/`[scale]` retables flow through unchanged. The
   host stays `inline-block` — a calendar in a content-sized context still shrink-wraps; only a consumer
   that *gives* it width (stretch, a sized cell) sees the grid spend it.

## Acceptance

- Cross-engine browser legs: **(a) floor** — an unstretched calendar's grid box, track widths, and cell
  geometry are pixel-identical to the pre-change screenshots (the shrink-wrap regression); **(b) wide** —
  in a ~600px stretched column, the grid's inline-size equals the panel's content box, all seven tracks
  are equal, and a range render shows: endpoint point-layer boxes with aspect-ratio 1 (circles, not
  ellipses), a continuous band (each interior cell's wash spans its full track; the endpoint half-wash
  abuts the neighbor within the grid gap), and a circular focus ring on a focused cell. **(c) negative
  control** — asserting endpoint circularity against a deliberately naive-stretched build (radius on the
  full button) FAILS.
- RTL leg: `dir="rtl"` range renders the half-washes toward the band interior (logical, mirrored).
- WHCM leg (Chromium `forced-colors` emulation): the four states remain distinct at wide width.
- The booking-reservation seed's calendar fills its card column on an unmodified A2UI mount —
  screenshot-verified.
- `npm run check && npm test` + `test:browser` green.

## Consequences

- **The calendar's rendered shape becomes context-dependent** (compact when shrink-wrapped, filling when
  given width) — the cost of serving a consumer that grants width but cannot trim it. Page authors who
  relied on the grid staying compact *inside a stretched context* see wider tracks; the escape stays one
  CSS line (`max-inline-size: max-content`) — override freedom, ADR-0102.
- **Endpoint cells gain an inner half-wash** that today's fixed grid never painted; at the floor width it
  is invisible (0px), but wide range renders are a genuinely new (deliberate) visual: circle + connecting
  wash, the M3 date-picker idiom. Screenshot baselines re-key.
- **The cell button doubles as the band box** — future cell-state CSS must pick its layer consciously;
  `calendar.md` gains the layer table so the next author doesn't repaint a circle on the band.
- **Slightly heavier cell paint** (up to two pseudos per endpoint cell) — negligible against a 42-cell
  grid; no JS cost (zero `calendar.ts` change).
- **Out of scope, unchanged:** the pick/swap/preview interaction (ADR-0093 cl.3), value/validity/FormData
  (cl.2), timezone-safe predicates (cl.5), nav header/weekday rows (headers stay flex-centered in wider
  tracks by their existing rules), the Calendar catalog row.

## Alternatives considered

- **Naive fluid tracks (`repeat(7, 1fr)` on the existing single-box cells).** Rejected — the fork's
  falsification this ADR exists to answer: stretched buttons make ellipse endpoints; fixed buttons in wide
  tracks make band holes (ADR-0093 cl.4 broken either way).
- **Cosmetic centering (`justify-content: center` on the grid).** Rejected: one line, but the panel still
  claims and wastes the width — the ticket's defect is the empty panel, and Kim's intake names fill as the
  expectation ("the grid should fill its given width"). Centering also does nothing for the wide bordered
  panel's visual weight.
- **Cap the panel (`max-inline-size: max-content` on the host).** Rejected as the default: it silently
  vetoes the consumer's stated layout intent (the stretch the Column asked for) — the component would be
  un-fillable by construction, the inverse over-correction of today. Kept as the page-author escape hatch
  (§Consequences).
- **Widen the gaps instead of the tracks.** Rejected: the band becomes mostly holes (gaps carry no wash),
  and cells drift apart from their week neighbors — worse range legibility at exactly the width that needs
  it.
- **A DOM anatomy change (an inner `<span>` per cell as the point layer).** Rejected: 42 extra nodes per
  month view, `calendar.ts` render + heal churn, and screen-reader cell content risk — when two pseudos
  express the same two layers with zero behavior surface.
- **A `fill`/`fluid` prop (Lane B).** Rejected: there is no second intent to gate — a calendar given width
  should spend it (the floor case is automatic); a prop would be a repair knob, which ADR-0102's Lane B
  bar excludes.
