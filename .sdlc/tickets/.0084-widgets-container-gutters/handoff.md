---
id: T-0084
title: "Widgets conform to the ADR-0046 container box model and the canvas gutter rule"
type: bug             # feature | bug | chore | spike | idea
status: done     # proposed | ready | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-12
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
The five merged widgets (ProductCard, BoardGrid, GameHud, CardTable, QuestionCard) follow one composed container and gutter system: the canvas owns the outer gutter and the gap between top-level roots; each container owns everything inside it per ADR-0046; a widget never sets its own outer margin.

## Repro
1. Audit at /private/tmp/claude-501/gutter-audit/ (scripts) and the findings pasted under Context. Reproduce with a headless Playwright render of each widget seed through createCanvasSurface, createRenderer, ingest, finalize, applyRootStretch (see site/pages/a2ui-catalog.ts renderSeedCard) at 1400px.

## Expected
The model (do not change it): canvas surface `.ui-artboard-surface` (packages/agent-ui/app/src/controls/surface-host/artboard.css) = 16px padding (--md-sys-space-lg), 12px gap between top-level roots (--md-sys-space-md), content centered at min(32rem, 100% - 2xl). ADR-0046 containers: `[data-box]`, children inset 6px (--ui-box-inset), region padding 12 inline / 6 block, 8px gap between a region's children, nested containers step the inline padding 12, 6, 6. Fixed rem values, no density scaling.
Make each widget conform:
1. Width: GameHud, ProductCard and BoardGrid roots stretch to the canvas content width like Column/Card roots do (applyRootStretch in packages/agent-ui/app/src/controls/surface-host/artboard.ts currently only stretches UIContainerElement roots; extend it to the widget roots or give the widgets the container posture, without regressing other roots).
2. Inset: GameHud, ProductCard (body), CardTable and QuestionCard put ink 6px further in (the 6px --ui-box-inset), i.e. about 19px inline from the border like a stock ui-card with regions, using the shared --ui-box-* tokens and [data-box] where it fits, not bespoke numbers.
3. Block padding 6px (not 12) in GameHud and ProductCard body; QuestionCard's asymmetric 12/16/16/16 padding becomes the region padding (12 inline, 6 block) with the 8px rhythm; its mixed 4 gap + 8 margins become one 8px gap.
4. BoardGrid: frame inset 6px and its row/child gaps follow the 8px rule at the container level (cell-to-cell gap inside the grid may stay tight, it is a data grid: say what you chose and why).
5. CardTable: its head, zones and readout use the real header/content/footer region pattern (or equivalent --ui-box-* tokens) so ink lands at about 19px inline like a stock card; keep the green felt zones and the 36px action row.
6. Keep the approved look: re-compare each widget to its mockup (/private/tmp/claude-501/local-artifact/mockups.html, section ids #pc #bg #gh #ct #qc) with a side-by-side screenshot before and after; spacing may tighten or loosen by the 6px inset but the look must stay recognisably the approved one.
7. Record the canvas gutter rule and the widget conformance as an appended `## Amendment 3` on ADR-0046 (append-only): it states the canvas tokens (existing, unchanged) and that widgets conform. Update the composition-patterns skill row and any spec line the change invalidates.

## Actual
Audit 2026-10-12 (1400px): GameHud hugs 248px while siblings fill 480; ink at 13px inline (not 19) in ProductCard, GameHud, CardTable, 17 in QuestionCard; ProductCard/GameHud block pad 12 vs 6; ProductCard row gap 4 vs 8; BoardGrid frame 4 and gap 4; QuestionCard pad 12/16/16/16 with mixed 4 gap and 8 margins; CardTable head and zones are plain divs, not regions.

## Context
Controls: packages/agent-ui/components/src/controls/{product-card,board-grid,game-hud}/*.css; composites: packages/agent-ui/a2ui/src/catalog/personas/{croupier,quizmaster}/factories.ts (inline el.style today). Canvas: packages/agent-ui/app/src/controls/surface-host/{artboard.css,artboard.ts,surface-host.css}. Box model: packages/agent-ui/components/src/controls/_surface/container-box.css, ADR-0046 (Amendment 2). Update the control tests, visual baselines (ProductCard, any others) and the catalog/showcase pages. Regenerate generated files with their scripts; K6 must stay under 46,430 (report the number); recapture the prompt baseline once only if prompt text changes.

## Constraints
Local gate: npm run check plus the touched folders' tests (components controls product-card, board-grid, game-hud, sandbox-frame/dogfood; croupier and quizmaster fragments; a2ui examples; app artboard/surface-host; site pages for the catalog and showcase), browser tests for the geometry; CI runs the full suite. No em dashes. No border-left highlights. Keep wire props unchanged.

## Closed

2026-10-12: merged #1906
