---
doc-type: research
status: approved
id: req-a2ui-library
owner: Kim
date: 2026-08-17
---

# req-a2ui-library — Expanded A2UI widget library (Lane 3)

Status: research synthesis, 2026-08-17 · Source lane: `.claude/docs/research/2026-08-17-exploration-campaign-plan.md` Lane 3 · Author: research seat (read-only lane)

## Goal

Disposition every candidate agent-facing widget (slideshow, multi-step selection, confirmation
views, cards with lists/columns/grids, itinerary, 5-day weather, restaurant/drinks menu, trend
lists with up/down metrics, basic SVG charts) as **composition | catalog-row | new-component**,
with full-bleed imagery craft notes and an honest zero-dep analytics scope — so the default
catalog can express the widget vocabulary the generative-UI ecosystem (Vercel AI SDK demos,
Thesys C1, Google A2UI standard catalog) treats as table stakes.

## Grounding facts (repo)

- Default catalog: `packages/agent-ui/a2ui/src/catalog/default/catalog.json` — **61 types**
  (not 55; the charter's count is stale — Toast et al. landed). Already present and relevant:
  `Card/CardHeader/CardContent/CardFooter`, `Row/Column/Grid/List/Split`, `Swiper/SwiperItem`
  (a real carousel with `orientation/slidesInView/align/loop`), `Stat` (label/value/**delta**/caption),
  `Sparkline` (values + line|area variant), `BarChart` (label+value array), `Table`
  (typed columns, selectable rows), `Timeline/TimelineItem`, `Calendar`, `Badge` (intent enum),
  `Icon`, `Progress`, `Ladder`, `Modal`, `SegmentedControl`, `RadioGroup`.
- Controls inventory (`packages/agent-ui/components/src/controls/`): `ui-stat`, `ui-table`,
  `ui-sparkline`, `ui-bar-chart`, `ui-swiper` all exist as zero-dep hand-rolled controls —
  the SVG-chart floor is already proven in-repo.
- **There is NO Image type** — not in the catalog, not as a `ui-*` control. This is the single
  largest gap: Google's A2UI standard basic catalog defines `Image` (URL + `fit`
  cover/contain + `usageHint` avatar/hero) plus Video/AudioPlayer
  ([a2ui.org basic-catalog guide](https://a2ui.org/specification/v1.0-basic-catalog-implementation-guide/),
  [Google Developers Blog, A2UI v0.9, 2026-07](https://developers.googleblog.com/a2ui-v0-9-generative-ui/)).
  Every full-bleed candidate below is blocked on it.
- Zero-dep law (CLAUDE.md): charts are inline SVG/CSS or hand-rolled components; size budgets
  gated by `scripts/measure-size.mjs`.
- Corpus/example demand: `packages/agent-ui/a2ui/src/examples/catalog-frontier.ts` + `catalog-coverage.ts` already probe
  the catalog edge; no weather/menu/itinerary seeds exist yet — the corpus needs pattern seeds
  for each composition below to be teachable to the producer (`buildSystemPrompt`).

## Findings digest (lane schema)

| widget | priority | buildKind | dependsOn | fullBleedNotes | chartTech | source |
|---|---|---|---|---|---|---|
| Image (prerequisite) | now | **new-component** (`ui-image` + `Image` catalog row) | — | `aspect-ratio` CSS + `object-fit`; reserve space (CLS); `usageHint` hero/avatar/thumb per A2UI std | — | a2ui.org v1.0 basic catalog; web.dev aspect-ratio card pattern |
| Slideshow / gallery | now | **composition** (Swiper + SwiperItem > Image [+ Text caption over scrim]) | Image | full-bleed slide: image fills SwiperItem; caption on bottom gradient scrim (~40% black→transparent), WCAG-checked | — | Smashing Magazine text-over-images (2023); Thesys C1 informational category |
| Confirmation view | now | **composition** (Card > CardHeader + CardContent summary List + CardFooter Button pair; Modal variant) | — | optional hero Image atop Card, radius clipped by card | — | Vercel AI SDK gen-UI demos (order/booking confirmations) |
| Card w/ list · columns · grid | now | **composition** — already fully expressible (Card children: List/Row/Column/Grid) | — | full-bleed media row: Image as first Card child, edge-to-edge (needs Card padding-bypass slot — see R3) | — | repo catalog inspection |
| Trend list (up/down metrics) | now | **composition** (List > Row{Text label · Sparkline · Stat delta}) | — | — | existing `ui-sparkline` SVG; delta arrow = `ui-stat` intent color (green-up/red-down, inverted for lower-is-better) | Domo/ClearPoint KPI-tile conventions |
| 5-day weather | next | **composition** (Card > Row of 5 Column{Text day · Icon glyph · Text hi/lo}) | Icon-pack weather glyph coverage | hero variant: full-bleed condition Image behind today's temp, scrim | — | Subframe/Tubik weather-widget surveys: day+icon+hi/lo is THE convention |
| Restaurant / drinks menu | next | **composition** (Column of sections: Text heading + List > Row{Column{Text name, Text desc} · Text price}; Disclosure for long menus) | — | section hero Image optional; price right-aligned, no dot leaders in v1 | — | Behance/Dribbble menu surveys: category sections + name/desc/price row |
| Itinerary | next | **composition** (Timeline > TimelineItem{Badge type · Text · Card detail}) | — | day-hero Image inside TimelineItem Card | — | travel-timeline convention: typed events (flight/hotel/activity) on a vertical timeline |
| Multi-step selection (wizard) | next | **composition** (Column > Ladder/Progress + step body (RadioGroup/SegmentedControl/Select) + Row{Back·Next Buttons}); state via dataModel path per step | — | — | — | Vercel Academy "Multi-Step & Generative UI" |
| Line chart (axes, multi-series) | later | **new-component** (`ui-line-chart` + catalog row) | — | — | hand-rolled inline SVG, same craft as `ui-bar-chart`/`ui-sparkline` | zero-dep law; Thesys C1 data-viz category as demand signal |
| Donut / progress-ring | later | **new-component** or CSS (`conic-gradient`) inside `ui-stat` variant | — | — | CSS conic-gradient (zero JS) preferred over SVG | dashboard-tile conventions |
| Video / AudioPlayer | later | **new-component** (A2UI std catalog parity) | Image ships first | full-bleed poster frame = Image mechanics reused | — | a2ui.org basic catalog |

## Requirements

- **R1 — Image lands first (now).** `ui-image` control + `Image` catalog row: `src` (bindable),
  `alt` (required for admission), `fit` (`cover|contain`), `aspect` (ratio string), `usageHint`
  (`hero|thumb|avatar|inline`), lazy-loading, space reserved before load.
  *Accept:* catalog row validates; a Card-with-hero payload renders with zero CLS in the
  browser gate; conformance + `measure-size.mjs` stay in budget.
- **R2 — Scrim/overlay craft is a token, not per-widget CSS.** One `--ui-image-scrim-*`
  treatment (bottom gradient, ≈40% start alpha, both themes) reused by slideshow captions,
  weather hero, menu section heroes. *Accept:* overlay text passes WCAG AA contrast on a
  pinned worst-case fixture (a solid #FFF image) in both themes — one named fixture so two testers cannot disagree.
- **R3 — Card full-bleed slot.** A Card child marked full-bleed (`Image usageHint:"hero"`)
  escapes Card padding and inherits the top radius. *Accept:* hero-card payload shows
  edge-to-edge media, no double radius, no padding gutter.
- **R4 — Pattern seeds, not new types, for the eight compositions.** Slideshow, confirmation,
  card-layouts, trend-list, weather, menu, itinerary, wizard each get a corpus seed +
  skill-doc pattern section so the producer emits them idiomatically. *Accept:* each seed
  admitted through the corpus gate and rendered through `packages/agent-ui/a2ui/src/examples/catalog-coverage.ts` (the named harness); the
  bounded compose→validate→self-correct loop (SPEC-R6 of `.claude/docs/spec/a2ui-live-agent.spec.md`) passes on each.
- **R5 — Honest v1 analytics scope.** v1 chart set = existing `Sparkline` + `BarChart` +
  `Stat` delta, unchanged. No line-chart-with-axes, pie, or tooltip layer in v1; those are
  `later` rows above, each its own issue. *Accept:* trend-list and 5-day-weather seeds
  express fully with the v1 set; no new chart code merges under this PRD.
- **R6 — Zero-dep law holds.** Any new chart or media component is hand-rolled inline
  SVG/CSS; no charting or image library, no new package deps. *Accept:* `layering.test.ts` +
  dependency review green; `measure-size.mjs` deltas reported in each PR.

## Non-goals

- No Video/AudioPlayer in this arc (parity noted, deferred until Image proves the media seam).
- No charting dependency (D3/Chart.js/uPlot) ever; no axes/tooltip/legend engine in v1.
- No new container types — Card/Row/Column/Grid/List/Swiper already cover the layout algebra;
  the eight widgets are payload patterns, not catalog rows.
- No image upload/hosting; `Image.src` is URL-only (the ADR-0073 trust boundary untouched).
- No dot-leader/print-menu typography; no map rendering for itinerary.

## Mobilization list (proposed issues)

1. **`ui-image` + `Image` catalog row + scrim token** (R1+R2) — size M. The gate-opener.
2. **Card full-bleed hero slot** (R3) — size S. Depends on 1.
3. **Composition seeds pack A (now-tier): slideshow · confirmation · trend-list · card-layouts** (R4) — size M. Slideshow depends on 1.
4. **Composition seeds pack B (next-tier): weather · menu · itinerary · wizard** (R4) — size M. Weather hero depends on 1; audit icon-pack weather glyphs (S sub-task).
5. **Skill-doc pattern sections** for packs A+B in `a2ui-payload-authoring` — size S each pack.
6. *(later)* `ui-line-chart` catalog row — size M, own ADR (chart-axis vocabulary).
7. *(later)* donut/progress-ring `ui-stat` variant via conic-gradient — size S.
8. *(later)* Video/AudioPlayer A2UI-std parity — size M, gated on 1 shipping cleanly.

## Sources

- [Google Developers Blog — A2UI v0.9 (2026-07)](https://developers.googleblog.com/a2ui-v0-9-generative-ui/) · [A2UI v1.0 basic-catalog guide](https://a2ui.org/specification/v1.0-basic-catalog-implementation-guide/) · [InfoQ on A2UI v0.9 (2026-07)](https://www.infoq.com/news/2026/07/google-a2ui-genui/)
- [Vercel — AI SDK 3.0 generative UI](https://vercel.com/blog/ai-sdk-3-generative-ui) · [Vercel Academy — Multi-Step & Generative UI](https://vercel.com/academy/ai-sdk/multi-step-and-generative-ui)
- [Thesys C1 component library](https://docs.thesys.dev/library) (data-viz / forms / informational / triggers taxonomy)
- [Smashing Magazine — accessible text over images (2023)](https://www.smashingmagazine.com/2023/08/designing-accessible-text-over-images-part1/) · [web.dev — aspect-ratio image card](https://web.dev/patterns/layout/aspect-ratio-image-card)
- KPI/trend conventions: [ClearPoint KPI dashboard practices](https://www.clearpointstrategy.com/blog/kpi-dashboard-best-practices) · [Domo sparkline guide](https://www.domo.com/learn/charts/sparkline-chart)
- Weather/menu/itinerary pattern surveys: [Subframe CSS weather widgets](https://www.subframe.com/tips/css-weather-widget-examples) · [Tubik — weather in UI design](https://blog.tubikstudio.com/weather-in-ui-design-come-rain-or-shine/) · Dribbble/Behance itinerary + restaurant-menu tag surveys

## Rubric self-check (Lane-3 rubric)

- Every widget dispositioned with buildKind + evidence — **pass** (12 rows, each sourced).
- Zero-dep law respected — **pass** (all chartTech inline-SVG/CSS/hand-rolled; R6).
- Full-bleed treatment specified where imagery leads — **pass** (R1–R3 + per-row fullBleedNotes).
- Analytics set scoped to an honest v1 — **pass** (R5: existing Sparkline/BarChart/Stat only; axes/pie deferred as sized later-issues).
- Priorities justified by persona/playbook demand — **pass with a caveat**: web-ecosystem demand (Vercel/Thesys/A2UI std) is cited per row, but the repo corpus has no weather/menu/itinerary seeds yet, so in-repo demand evidence is inferred from the catalog-frontier examples rather than measured. Footer verdict: **PASS** (4 clean, 1 pass-with-caveat).
