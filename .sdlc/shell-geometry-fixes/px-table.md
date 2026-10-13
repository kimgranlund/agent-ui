# T-0121 px table: page and shell geometry before and after

Measured by `capture.mjs` in Chromium at the root register (product at scale sm, n = 7), light scheme
(dark renders the same geometry). Before is `f4305eb2`; after is this branch. x values are relative to
the docs shell's inline start. Screenshots: `screens/<page>-<width>-<scheme>-<before|after>.png`.

## Docs page (button-doc)

| Quantity | 400px | 1000px | After is |
|---|---|---|---|
| Shell bar height (header) | 54 to 56 | 54 to 56 | height 4n + 2 x widget margin = 8n |
| Shell bar height (footer) | 54 to 56 | 54 to 56 | 8n |
| Shell inter-card gap | 18 to 21 | 18 to 21 | layout gutter 3n |
| Shell card radius | 18 to 21 | 18 to 21 | card radius 3n |
| Overlay pane inset | 12 to 14 | 12 to 14 | widget margin 2n |
| Narrow-tabs seam, pane-tabs pad | 6 to 7 | 6 to 7 | control inset n |
| Pane width | 252 | 252 | 9 x layout margin = 36n |
| Canvas and pane floor | 162 to 168 | 162 to 168 | 6 x layout margin = 24n |
| Docs header: nav toggle box x | 0 to 21 | 0 to 21 | column edge minus n |
| Docs header: nav toggle glyph x | 7 to 28 | 7 to 28 | column edge (= footer text x) |
| Docs header: brand x | 74 to 70 | 74 to 70 | after the toggle and one gap |
| Docs header: brand to actions gap | 9 to 21 | 9 to 21 | layout gutter 3n |
| Docs header: last action box right | 372 to 379 | 972 to 979 | column end plus n |
| App footer column x | 28 | 28 | max(layout margin, (W - 64rem) / 2) |
| App footer column right | 372 | 972 | W minus the same |
| Page header column x | 28 | 298 to 301 | canvas x + layout margin |
| Content column x | 28 | 298 to 301 | canvas x + layout margin |
| Content block padding | 21 to 28 | 21 to 28 | layout margin 4n |

## Card page (card-demo)

| Quantity | 400px | 1000px | After is |
|---|---|---|---|
| Shell bar height (header) | 54 to 56 | 54 to 56 | height 4n + 2 x widget margin = 8n |
| Shell bar height (footer) | 54 to 56 | 54 to 56 | 8n |
| Shell inter-card gap | 18 to 21 | 18 to 21 | layout gutter 3n |
| Shell card radius | 18 to 21 | 18 to 21 | card radius 3n |
| Overlay pane inset | 12 to 14 | 12 to 14 | widget margin 2n |
| Narrow-tabs seam, pane-tabs pad | 6 to 7 | 6 to 7 | control inset n |
| Pane width | 252 | 252 | 9 x layout margin = 36n |
| Canvas and pane floor | 162 to 168 | 162 to 168 | 6 x layout margin = 24n |
| Docs header: nav toggle box x | 0 to 21 | 0 to 21 | column edge minus n |
| Docs header: nav toggle glyph x | 7 to 28 | 7 to 28 | column edge (= footer text x) |
| Docs header: brand x | 74 to 70 | 74 to 70 | after the toggle and one gap |
| Docs header: brand to actions gap | 9 to 21 | 9 to 21 | layout gutter 3n |
| Docs header: last action box right | 372 to 379 | 972 to 979 | column end plus n |
| App footer column x | 28 | 28 | max(layout margin, (W - 64rem) / 2) |
| App footer column right | 372 | 972 | W minus the same |
| Page header column x | 28 | 298 to 301 | canvas x + layout margin |
| Content column x | 28 | 298 to 301 | canvas x + layout margin |
| Content block padding | 21 to 28 | 21 to 28 | layout margin 4n |
| Card region margin | 7 | 7 | n |
| Card region inline padding | 14 | 14 | card gutter 2n |
| Card region block padding | 7 to 14 | 7 to 14 | card gutter 2n |

## Agent-admin app

| Quantity | 400px | 1000px | After is |
|---|---|---|---|
| Shell bar height (header) | 54 to 56 | 54 to 56 | height 4n + 2 x widget margin = 8n |
| Shell inter-card gap | 18 to 21 | 18 to 21 | layout gutter 3n |
| Shell card radius | 18 to 21 | 18 to 21 | card radius 3n |
| Overlay pane inset | 12 to 14 | 12 to 14 | widget margin 2n |
| Narrow-tabs seam, pane-tabs pad | 6 to 7 | 6 to 7 | control inset n |
| Pane width | 252 | 252 | 9 x layout margin = 36n |
| Canvas and pane floor | 256 | 256 | agent-admin's own 16rem override, unchanged |
| Agent-admin shell gutter | 12 to 14 | 12 to 14 | widget margin 2n |

## Chat shell (a2ui-chat)

| Quantity | 400px | 1000px | After is |
|---|---|---|---|
| Shell bar height (header) | 54 to 56 | 54 to 56 | height 4n + 2 x widget margin = 8n |
| Shell bar height (footer) | 54 to 56 | 54 to 56 | 8n |
| Shell inter-card gap | 18 to 21 | 18 to 21 | layout gutter 3n |
| Shell card radius | 18 to 21 | 18 to 21 | card radius 3n |
| Overlay pane inset | 12 to 14 | 12 to 14 | widget margin 2n |
| Narrow-tabs seam, pane-tabs pad | 6 to 7 | 6 to 7 | control inset n |
| Pane width | 252 | 252 | 9 x layout margin = 36n |
| Canvas and pane floor | 162 to 168 | 162 to 168 | 6 x layout margin = 24n |
| Docs header: nav toggle box x | 0 to 21 | 0 to 21 | column edge minus n |
| Docs header: nav toggle glyph x | 7 to 28 | 7 to 28 | column edge (= footer text x) |
| Docs header: brand x | 74 to 70 | 74 to 70 | after the toggle and one gap |
| Docs header: brand to actions gap | 9 to 21 | 9 to 21 | layout gutter 3n |
| Docs header: last action box right | 372 to 379 | 972 to 979 | column end plus n |
| App footer column x | 28 | 28 | max(layout margin, (W - 64rem) / 2) |
| App footer column right | 372 | 972 | W minus the same |
| Content column x | 0 | 270 to 273 | full-bleed page: the canvas x (pane 252 + gap) |
| Content block padding | 0 | 0 | full-bleed page: none |
| Chat shell header bar height | 119.6 | 83 | the chat shell's header content, taller than the 8n minimum |
| Chat shell inter-card gap | 18 to 21 | 18 to 21 | layout gutter 3n |
