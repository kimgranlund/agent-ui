---
# bar-chart.md frontmatter — the attributes-as-API descriptor for ui-bar-chart (ADR-0004; LLD-C7,
# chart-family.lld.md §4). The machine-checkable public surface lives HERE (frontmatter); the prose below
# the fence is the /site doc. The `attributes[]` block MUST mirror bar-chart.ts `static props`
# (data/label) — the contract<->props trip-wire (bar-chart-descriptor.test.ts) targets this fence.
tag: ui-bar-chart
description: An axis-free horizontal bar list that compares magnitudes with a printed value, no ticks or legend.
tier: display          # geometry size-class (Display band — NO control frame/height/[size]/[scale]; SPEC-R12/ADR-0107 cl.5)
extends: UIElement     # a non-interactive, non-form-associated display LEAF (SPEC-R5)
# marginal: 447 B gz — within the 2048 B gz per-control budget (ADR-0080 clause 3); solo 5067 B gz
# (foundation-inclusive, informational). Measured 2026-07-08 (wave M1-b, LLD-C8, `npm run size` through the
# public `./controls/bar-chart` entry) after the barrel + component-styles.css wiring landed. The whole-family
# `components` barrel measured 25847 B gz — over the old 25 KB ceiling by 247 B with both chart controls
# wired in; RESOLVED same-wave by the ADR-0107 ## Amendment (the Consequences-anticipated re-base): the
# ceiling is now 26 KB (26624 B gz), recorded in scripts/measure-size.mjs's re-base comment chain (each
# control's OWN marginal was always well within the 2048 B cap).

attributes:            # attributes-as-API — mirrors bar-chart.ts `static props` (data, label)
  - name: data
    type: json          # closest ATTR_TYPES member to "array of {label,value} objects, JSON-string attribute form" (SPEC-R5)
    default: ''         # the LIVE default is `[]` (an empty array) — `String([])===''` is what the
                         # contract<->props trip-wire (compareDescriptorToProps) actually compares against,
                         # since it reads `String(config.default)`, not a JSON-stringified form
    reflect: false      # NOT reflected — a JSON-string attribute round-trips through the codec, not setAttribute
    # the live codec is the SPEC-R7 safe-data codec — `from(null) = []` (never `null`), so a malformed/
    # removed attribute never reaches the render path. component-descriptor.ts's `kindOf` classifies this
    # (and sparkline.md's `values`) as "json" via its array-result branch — a clean bijection against
    # compareDescriptorToProps (M1-b shared-infra fix).
  - name: label
    type: string
    default: ''
    reflect: true       # TKT-0069 item 2 ruling: label reflects fleet-wide

properties: []         # no manual accessors beyond the two typed props

events: []             # display-only — emits nothing (SPEC-R5: no events, no keyboard contract)

slots: []              # no light-DOM content model — render() stays the inherited no-op; every row is
                        # component-built (replaceChildren), never author-slotted

parts:                  # data-part nodes inside each component-built row (selected by bar-chart.css, not by name from TS)
  - name: label
    description: The `<span data-part="label">` — the datum's label text (real DOM text, selectable, wraps at the 40% column cap — SPEC-R6 AC3). Part of the listitem's accessible text content.
  - name: track
    description: The `<span data-part="track" aria-hidden="true">` — the decorative rail. `aria-hidden` and text-free; repeats the magnitude only in the length channel (SPEC-R8 AC2).
  - name: fill
    description: The `<span data-part="fill">` inside `track` — the length-proportional bar. Its inset/length ride two row-scoped custom properties (`--_bar-start`/`--_bar-length`, 0..100) set imperatively by bar-chart.ts; bar-chart.css owns the paint.
  - name: value
    description: The `<span data-part="value">` — the locale-formatted printed value (Intl.NumberFormat, sign preserved, tabular numerals). The accessible datum (SPEC-R8) — the bar itself never carries a datum AT cannot also get from this text.

customStates: []       # NO interaction state and NO motion gate — a display leaf has neither (no :state(); nothing to transition)

face:
  formAssociated: false  # a display leaf — extends UIElement, no value/validity participation

aria:
  role: list             # role=list via ElementInternals — CONSTANT, set once in connected() (the ui-list precedent, list.ts:50)
  roleSource: internals   # `this.internals.role = 'list'` — NEVER a host role attribute (the FACE pattern)
  labelSource: label prop  # `internals.ariaLabel = label || null` — an unlabeled list is legal (SPEC-R8); never aria-hidden
  childRole: listitem      # each rendered row is a real `role="listitem"` element (a light-DOM attribute — the anatomy.md sanction for interior nodes; only HOST aria rides internals)

keyboard: []           # NOT interactive and NOT focusable — no tabindex, no keyboard contract

geometry:
  sizeClass: display
  minInlineSize: var(--ui-bar-chart-min-inline-size)  # 16em default — the whole-shape floor (SPEC-R9 AC1); NO [size] ramp, NO --md-sys-height-* (SPEC-R12 AC2)
  rowGap: var(--ui-bar-chart-row-gap)                 # the density-RESPONSIVE row rhythm (rides [density] for free — ADR-0103)
  barSize: var(--ui-bar-chart-bar-size)                # bar/track thickness — density-INVARIANT mark geometry (SPEC-R12)

forcedColors: An explicit `@media (forced-colors: active)` block (SPEC-R10) — the fill paints `CanvasText` (a background-drawn fill is otherwise forced to `Canvas` and vanishes) and the track keeps shape via a `Canvas` background + `CanvasText` border, so fill != track survives WHCM. The printed value is plain text and needs no override.
---

# ui-bar-chart

`ui-bar-chart` is the **Display**-class magnitude-comparison bar list (ADR-0107, chart-family v1) — an
axis-free chart that answers "how do these magnitudes compare?" with a length-proportional bar list, the
printed value as the datum. It is **not** interactive and **not** form-associated: no ticks, no legend, no
keyboard contract, no events.

> **Naming note (ADR-0107 fork F2).** The name stays `ui-bar-chart`/`BarChart` even though v1 renders the
> **horizontal bar-list model** (label · bar · value, one row per datum) rather than a vertical-column
> chart — models know "BarChart"; "BarList" is niche vocabulary. A vertical `orientation` is a *foreseen
> extension*, not v1.

```html
<ui-bar-chart data='[{"label":"EMEA","value":42},{"label":"APAC","value":31}]' label="Revenue by region"></ui-bar-chart>
```

## Rendering

One row per valid datum, in data order — **label · bar · printed value** on a shared CSS grid so bars are
length-comparable and labels/values stay real DOM text (selectable, wrapping, token-typed — no SVG text).
Bar length is proportional to `|value|` over the **zero-baseline** span (`lo = min(0, …values)`,
`hi = max(0, …values)`); when negatives are present, every bar shares one origin and diverges from it
(negative bars extend toward the inline-start side of that shared zero point) — still axis-free: no ticks,
no gridlines, no legend, no scale labels. Every value is printed with the default-locale
`Intl.NumberFormat` (signed values keep their sign) — the printed value is the datum's exact reading, which
is why no axis is owed. A long label wraps within the bounded 40%-cap label column rather than truncating
silently or starving the bars. Setting `data` re-renders the whole row list — there is no incremental-
append API (A2UI `updateDataModel` semantics).

## Degenerate data

Every case still paints the host box and still announces (never throws — SPEC-R7): `[]`/absent/malformed
input renders zero rows (the host stays `role=list` with zero items — an honest empty state, not a silent
one); entries missing a string `label` or a finite numeric `value` are dropped, the remainder renders in
order; exactly one valid datum renders one full-length row (it is the max); all-equal positive values
render every bar full length (equality visible at a glance); all-zero values render every bar zero-length
(the printed `0`s carry the reading); all-negative values put the shared zero point at the track's
inline-end, every bar extending toward inline-start of it (longest = most negative); duplicate labels
render as separate rows (the list is positional, not keyed).

## Accessibility

A chart is data, not decoration: the host carries `role="list"` via `ElementInternals` (the `ui-list`
precedent), named by `label` when non-empty — an unlabeled chart is legal (never a silent state, never
`aria-hidden`). Each rendered row is a real `role="listitem"` element whose text content is the label plus
the printed value — the two real text spans (`[data-part='label']` / `[data-part='value']`). The visual bar
(`[data-part='track']` + its `[data-part='fill']`) is `aria-hidden` and text-free: it repeats the magnitude
in the length channel only, never as the sole carrier (ADR-0057) — the printed value is the accessible
datum either way.

## Sizing

The host defaults to a `16em` `min-inline-size` floor (`--ui-bar-chart-min-inline-size`) — a bare,
unstyled chart in a flex row still paints a visible, non-collapsed, proportionally-correct box with zero
consumer CSS (ADR-0102 Lane A). Bar/track thickness (`--ui-bar-chart-bar-size`) is density-**invariant**;
row/column gap (`--ui-bar-chart-row-gap`/`-col-gap`) rides the `--md-sys-space` ladder and responds to an
ancestor `[density]` for free. There is no `[size]`/`[scale]` attribute and no `--md-sys-height-*` lever
(SPEC-R12 AC2) — labels/values read the `--md-sys-typescale-body-medium-*` row directly.

## RTL

Rows follow the writing direction — labels at inline-start, values at inline-end, bars grow from
inline-start — via logical CSS throughout (`inset-inline-start`, subgrid columns); no physical-direction
assumption anywhere in bar-chart.css, so a `dir="rtl"` context mirrors the whole row for free.

## Forced colors (WHCM)

The fill paints `CanvasText` and the track keeps its shape via a `Canvas` background + `CanvasText` border
— an explicit override, because a background-drawn fill is otherwise forced to `Canvas` (invisible) under
`forced-colors: active`. The printed value is plain text and survives untouched.
