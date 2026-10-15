---
id: T-0107
title: "Foundations cut: bridge, root flip to product/sm, retire scale and density, empty the allowlist (ADR-0245)"
type: feature        # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L3             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P1         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-12
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Waves 0 and 1 of the ADR-0245 campaign are on main: the generator, ui-glyph, the codemod, the probe, the census gate and every control, container, widget, package and site file reading the derived tokens with today's value as the fallback inside opt-in data-tier regions. Build the cut (ADR-0245 clauses 2, 10a to 10e, W4 to W6 of 10b) so the derived system becomes the default and `node scripts/foundations-census.mjs --gate` exits 0 with an EMPTY allowlist. The cut is a visible change: BUILD IT ON A BRANCH AND DO NOT MERGE. Kim signs off on before and after screenshots first.

## Scope (one brief paragraph, per the Inner loop rule)
In order, committing early: (1) the generated bridge `foundations-bridge.gen.css` that aliases the old `--md-sys-*` / `--ui-box-*` names, `[scale]` and `[density]` onto the derived values (ADR 10a, consumers keep today's names for one release); (2) the root flip: the document root becomes product tier at scale sm (24 / 28 / 32), the A2UI surface root carries data-scale="md" (actions stay 36px; Kim's ruling), button and toggle keep the pill (Kim's ruling), avatars 4n; (3) retire `[scale]` and `[density]`: rewrite the 27 axes files (the site gallery, component-gallery, component-preview, bar-chart-demo, segment-demo, sizing pages and the control browser tests that pin legacy [scale] px values: button-geometry, text-field-geometry, select, avatar, badge, text, radio-group, slider-multi, card, modal, disclosure, tabs, list, grid, row, column, timeline-item) to `data-tier`/`data-scale`/`data-size` with the new derived expectations; (4) the 4 glyph-alias files and the remaining px and token findings (gauge ring stroke needs an ADR-silent ruling: keep the stroke, document it in the allowlist-free way the census permits); (5) region-gated `ui-glyph` swaps for carets, ticks, dashes and chevrons that today draw as pseudo-elements, Phosphor carets or border tricks, where the cut now makes the default pixels change anyway (see .sdlc/notes.md for the lane-by-lane deferred list: nav-rail chevron, calendar and swiper carets, badge marks, control clear and stepper icons); (6) part-level token declarations so service-card, product-card and board-grid part sizes keep their own step; (7) regenerate every golden deliberately (`npm run test:visual -- -u` style, one family at a time) and the fleet baselines; (8) the allowlist is empty and the census gate and `node scripts/foundations-probe.mjs --strict` exit 0. Produce `.sdlc/foundations-cut/parity/`: before (origin/main) and after screenshots at 400px and 1000px, light and dark, of the docs site pages (button, text-field, card, select, tabs, table, a2ui-catalog) and agent-admin, plus a side-by-side of the A2UI widgets (BookingForm, CardTable, QuestionCard, ProductCard, ResultCard, ContrastPair). Rollback: the single config field that makes the root opt in (ADR 10e) and `data-foundations="legacy"`. Local gate: `npm run check` plus the touched folders' tests (CI runs the full suite, test:browser shards where goldens move); no per-ticket verifier; no em dashes; never hand-edit generated files; commit locally, do not push, and report in one short message with the census count and the parity folder path.

## Closed

2026-10-13: merged via the foundations campaign (#1920 to #1932, ADR-0245)
