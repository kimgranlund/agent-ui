---
id: T-0121
title: "Page and shell geometry on the derived levels (sweep fixes 1 to 6)"
type: feature
status: done
size: L3
priority: P1
depends: []
created: 2026-10-13
router: .sdlc/AGENTS.md
---

## Goal
Fix the page and shell geometry per .sdlc/page-shell-geometry-sweep.md (read it first: region table, inconsistencies, the recommended spec in the four-level grammar). Kim 2026-10-13: start now.

## Scope (one brief paragraph, per the Inner loop rule)
Do the six priority fixes in order, committing early: (1) bar inline inset AND content block padding to the layout margin 4n (site/pages/_page.css content block padding space-xl to layout margin; header and footer columns the same min() formula so header, footer and page text share one x origin); (2) replace the fixed 18px super-shell module family (super-shell.css gap, overlay inset, narrow-tabs seam, pane-tabs padding, bar-size; agent-admin shell gutter) with level tokens: gap to layout gutter, overlay inset and shell gutter to widget margin, seams to --md-sys-inset, bar-size to height + 2 * widget margin; pane and canvas floors to n multiples or named content floors; (3) card block padding to 2n so the card text edge is 3n inline and block (container-box.css and card.css); (4) centre the docs header content in the same column as the footer and page (apply the negative --md-sys-inset margin to boxed children at a bar edge so labels land on the container text edge); (5) delete the dead --ui-modal-padding and --ui-drawer-padding tokens and the other literals the sweep lists (page and conversation rem literals to space aliases or group tokens, doc-page inline gap and api-row literals); (6) repoint site/lib/shell-spacing-gate.test.ts to the n-based levels. Keep breakpoints as rem literals but name them in one place; do not touch the A2UI renderer or size stamps. Re-pin the affected tests, re-mint only the goldens that move after eye review (unexplained diffs stay red and are reported), and produce before and after screenshots (docs site pages, agent-admin, chat shell at 400px and 1000px, light and dark) in the ticket folder with a px table. Local gate: npm run check, the touched folders' tests, the app, rest, site and visual shards, census gate and probe --strict; no per-ticket verifier; regenerate generated files with scripts; no em dashes; commit locally, do not push; report in one short message.

## Closed

2026-10-13: merged as #1948
