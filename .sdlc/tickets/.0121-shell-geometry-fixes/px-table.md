# T-0121 px table: page and shell geometry before and after

Measured by `capture.mjs` in Chromium, light scheme (dark renders the same geometry). Before is origin/main at
e2a43515 (T-0120 merged; T-0127 and T-0128 after it change no shell or page geometry); after is this branch. The root register
is product at scale sm: n 6, c 2, h 24,
control 6, group 8, widget 12 / 6, card 18 / 12, page 24 / 18 (margin / gutter).
The derived column is computed by `px-table.mjs` from `scale.mjs` `resolve()`, never typed in; "ok" means the measured
after value equals it within 0.5px. x values are relative to the docs shell's inline start. Screenshots:
`screens/<page>-<width>-<scheme>-<before|after>.png`, and `screens/contact-sheet-<scheme>.png` side by side.

## Docs page (button-doc)

| Quantity | Formula (resolve()) | 400px before to after | 400px derived | 1000px before to after | 1000px derived |
|---|---|---|---|---|---|
| Shell bar height (header) | h + 2 x widget.margin (8n) | 54 to 48 | 48 ok | 54 to 48 | 48 ok |
| Shell bar height (footer) | h + 2 x widget.margin (8n), a minimum | 54 to 48 | 48 ok | 54 to 48 | 48 ok |
| Shell inter-card gap | page.gutter (3n) | 18 (same) | 18 ok | 18 (same) | 18 ok |
| Shell card radius | card.radius (3n) | 18 (same) | 18 ok | 18 (same) | 18 ok |
| Overlay pane inset | widget.margin (2n) | 12 (same) | 12 ok | 12 (same) | 12 ok |
| Narrow-tabs seam, pane-tabs pad | control.margin (n) | 6 (same) | 6 ok | 6 (same) | 6 ok |
| Pane width | named content measure 15.75rem | 252 (same) | 252 ok | 252 (same) | 252 ok |
| Canvas and pane floor | 6 x page.margin (24n) | 162 to 144 | 144 ok | 162 to 144 | 144 ok |
| Docs header: nav toggle box x | page.margin - control.margin | 0 to 18 | 18 ok | 0 to 18 | 18 ok |
| Docs header: nav toggle glyph x | page.margin (the footer text x) | 6 to 24 | 24 ok | 6 to 24 | 24 ok |
| Docs header: brand x | toggle box x + h + page.gutter | 66 to 60 | 60 ok | 66 to 60 | 60 ok |
| Docs header: brand to actions gap | page.gutter (3n) | 8 to 18 | 18 ok | 8 to 18 | 18 ok |
| Docs header: last action box right | W - page.margin + control.margin | 376 to 382 | 382 ok | 976 to 982 | 982 ok |
| App footer column x | page.margin (below the 64rem cap) | 24 (same) | 24 ok | 24 (same) | 24 ok |
| App footer column right | W - page.margin | 376 (same) | 376 ok | 976 (same) | 976 ok |
| Page header column x | canvas x + page.margin | 24 (same) | 24 ok | 294 (same) | 294 ok |
| Content column x | canvas x + page.margin | 24 (same) | 24 ok | 294 (same) | 294 ok |
| Content block padding | page.margin (4n) | 18 to 24 | 24 ok | 18 to 24 | 24 ok |

## Card page (card-demo)

| Quantity | Formula (resolve()) | 400px before to after | 400px derived | 1000px before to after | 1000px derived |
|---|---|---|---|---|---|
| Shell bar height (header) | h + 2 x widget.margin (8n) | 54 to 48 | 48 ok | 54 to 48 | 48 ok |
| Shell bar height (footer) | h + 2 x widget.margin (8n), a minimum | 54 to 48 | 48 ok | 54 to 48 | 48 ok |
| Shell inter-card gap | page.gutter (3n) | 18 (same) | 18 ok | 18 (same) | 18 ok |
| Shell card radius | card.radius (3n) | 18 (same) | 18 ok | 18 (same) | 18 ok |
| Overlay pane inset | widget.margin (2n) | 12 (same) | 12 ok | 12 (same) | 12 ok |
| Narrow-tabs seam, pane-tabs pad | control.margin (n) | 6 (same) | 6 ok | 6 (same) | 6 ok |
| Pane width | named content measure 15.75rem | 252 (same) | 252 ok | 252 (same) | 252 ok |
| Canvas and pane floor | 6 x page.margin (24n) | 162 to 144 | 144 ok | 162 to 144 | 144 ok |
| Docs header: nav toggle box x | page.margin - control.margin | 0 to 18 | 18 ok | 0 to 18 | 18 ok |
| Docs header: nav toggle glyph x | page.margin (the footer text x) | 6 to 24 | 24 ok | 6 to 24 | 24 ok |
| Docs header: brand x | toggle box x + h + page.gutter | 66 to 60 | 60 ok | 66 to 60 | 60 ok |
| Docs header: brand to actions gap | page.gutter (3n) | 8 to 18 | 18 ok | 8 to 18 | 18 ok |
| Docs header: last action box right | W - page.margin + control.margin | 376 to 382 | 382 ok | 976 to 982 | 982 ok |
| App footer column x | page.margin (below the 64rem cap) | 24 (same) | 24 ok | 24 (same) | 24 ok |
| App footer column right | W - page.margin | 376 (same) | 376 ok | 976 (same) | 976 ok |
| Page header column x | canvas x + page.margin | 24 (same) | 24 ok | 294 (same) | 294 ok |
| Content column x | canvas x + page.margin | 24 (same) | 24 ok | 294 (same) | 294 ok |
| Content block padding | page.margin (4n) | 18 to 24 | 24 ok | 18 to 24 | 24 ok |
| Card region margin | control.margin (n) | 6 (same) | 6 ok | 6 (same) | 6 ok |
| Card region inline padding | card.gutter (2n) | 12 (same) | 12 ok | 12 (same) | 12 ok |
| Card region block padding | card.gutter (2n) | 6 to 12 | 12 ok | 6 to 12 | 12 ok |

## Agent-admin app

| Quantity | Formula (resolve()) | 400px before to after | 400px derived | 1000px before to after | 1000px derived |
|---|---|---|---|---|---|
| Shell bar height (header) | h + 2 x widget.margin (8n) | 54 to 48 | 48 ok | 54 to 48 | 48 ok |
| Shell inter-card gap | page.gutter (3n) | 18 (same) | 18 ok | 18 (same) | 18 ok |
| Shell card radius | card.radius (3n) | 18 (same) | 18 ok | 18 (same) | 18 ok |
| Overlay pane inset | widget.margin (2n) | 12 (same) | 12 ok | 12 (same) | 12 ok |
| Narrow-tabs seam, pane-tabs pad | control.margin (n) | 6 (same) | 6 ok | 6 (same) | 6 ok |
| Pane width | named content measure 15.75rem | 252 (same) | 252 ok | 252 (same) | 252 ok |
| Canvas and pane floor | agent-admin's own 16rem override, unchanged | 256 (same) | 256 ok | 256 (same) | 256 ok |
| Agent-admin shell gutter | widget.margin (2n) | 12 (same) | 12 ok | 12 (same) | 12 ok |

## Chat shell (a2ui-chat)

| Quantity | Formula (resolve()) | 400px before to after | 400px derived | 1000px before to after | 1000px derived |
|---|---|---|---|---|---|
| Shell bar height (header) | h + 2 x widget.margin (8n) | 54 to 48 | 48 ok | 54 to 48 | 48 ok |
| Shell bar height (footer) | h + 2 x widget.margin (8n), a minimum | 54 to 48.7 | 48 OFF | 54 to 48 | 48 ok |
| Shell inter-card gap | page.gutter (3n) | 18 (same) | 18 ok | 18 (same) | 18 ok |
| Shell card radius | card.radius (3n) | 18 (same) | 18 ok | 18 (same) | 18 ok |
| Overlay pane inset | widget.margin (2n) | 12 (same) | 12 ok | 12 (same) | 12 ok |
| Narrow-tabs seam, pane-tabs pad | control.margin (n) | 6 (same) | 6 ok | 6 (same) | 6 ok |
| Pane width | named content measure 15.75rem | 252 (same) | 252 ok | 252 (same) | 252 ok |
| Canvas and pane floor | 6 x page.margin (24n) | 162 to 144 | 144 ok | 162 to 144 | 144 ok |
| Docs header: nav toggle box x | page.margin - control.margin | 0 to 18 | 18 ok | 0 to 18 | 18 ok |
| Docs header: nav toggle glyph x | page.margin (the footer text x) | 6 to 24 | 24 ok | 6 to 24 | 24 ok |
| Docs header: brand x | toggle box x + h + page.gutter | 66 to 60 | 60 ok | 66 to 60 | 60 ok |
| Docs header: brand to actions gap | page.gutter (3n) | 8 to 18 | 18 ok | 8 to 18 | 18 ok |
| Docs header: last action box right | W - page.margin + control.margin | 376 to 382 | 382 ok | 976 to 982 | 982 ok |
| App footer column x | page.margin (below the 64rem cap) | 24 (same) | 24 ok | 24 (same) | 24 ok |
| App footer column right | W - page.margin | 376 (same) | 376 ok | 976 (same) | 976 ok |
| Content column x | full-bleed page: the canvas x only | 0 (same) | 0 ok | 270 (same) | 270 ok |
| Content block padding | full-bleed page: none | 0 (same) | 0 ok | 0 (same) | 0 ok |
| Chat shell header bar height | its content, at least 8n | 119.6 (same) | measured | 83 (same) | measured |
| Chat shell inter-card gap | page.gutter (3n) | 18 (same) | 18 ok | 18 (same) | 18 ok |

## Measured values off the derived value

- Chat shell (a2ui-chat), Shell bar height (footer), 400px: measured 48.7, derived 48
