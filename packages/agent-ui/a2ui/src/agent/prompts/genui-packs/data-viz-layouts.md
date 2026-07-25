---
id: data-viz-layouts
label: Data-viz layouts
description: Bespoke charts, comparisons, and metric grids no fixed catalog enumerates.
---
Bespoke data visualizations: bar/column comparisons, KPI grids, sparkline trends, ranked lists — the
kind of one-off chart a fixed component catalog has no row for. Favor CSS-driven shapes (flex/grid
bars, `border-radius`, `transform: scaleY()`/`scaleX()` growth animations) over a charting library —
none is available inside the sandbox, and a hand-built shape is both smaller and fully themeable.

Anatomy — a bar/column comparison:
```html
<div class="chart">
  <div class="bar">
    <div class="bar-value">$182k</div>
    <div class="bar-fill" style="height:78%"></div>
    <div class="bar-label">NA</div>
  </div>
  <!-- one .bar per category -->
</div>
<style>
  .chart { display: flex; align-items: flex-end; gap: 0.85rem; height: 7.5rem; }
  .bar { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 0.35rem;
    height: 100%; justify-content: flex-end; }
  .bar-fill { width: 100%; border-radius: 6px 6px 0 0; background: var(--md-sys-color-primary);
    animation: grow 0.7s ease-out; transform-origin: bottom; }
  @keyframes grow { from { transform: scaleY(0); } to { transform: scaleY(1); } }
</style>
```

Anatomy — a KPI/metric grid: a CSS grid of cards, each a label + a large number + an optional delta
chip (colored by sign, never color-only — pair it with a `+`/`-`/`▲`/`▼` glyph). Cap at 3-6 metrics per
surface; a metric with no real trend data states "no trend yet" rather than fabricating one.

Anatomy — a ranked/leaderboard list: an ordered list of rows, each a rank number, a label, and a value
right-aligned; the leading row gets a subtle accent treatment (a border or background tint), never a
gradient wall.

Theming: read `var(--md-sys-color-*)` tokens with a plain literal fallback (e.g.
`var(--md-sys-color-primary, #4a67ff)`) so the surface degrades gracefully if a token is ever absent,
but visibly follows the host app's live light/dark scheme in the normal case. Never hardcode a raw hex
as the ONLY color — every color-bearing declaration reads a token first.

Honesty wall: never fabricate data precision the turn doesn't actually have (no invented decimal
places, no invented historical trend) — render exactly the figures given, and if a dimension (say, a
real line-chart time series) has no safe fixed-catalog or CSS-only equivalent, say so in the reply
rather than rendering something misleading.
