---
id: T-0066
title: "Fix the prompt-stack contradictions the preset review found; expose Grid columns and PlayingCard size on the wire"
type: bug             # feature | bug | chore | spike | idea
status: done        # proposed | ready | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-12
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
The prompt stack and the persona/catalog docs stop contradicting the catalog and each other, and the two missing wire props the preset review found are exposed.

## Intent
- Source: `.sdlc/preset-review-2026-10-12.md` (cross-preset review, 15 presets). Each item below was reported with file:line evidence; RE-VERIFY every one against the code before editing and drop or adjust any that is false.
- Do, part A (prompt/teaching text, each S):
  1. Quant: `mini-skills/dashboard-kpi-grid.md:6` says "real charts/sparklines are not hosted" and teaches Card+Text tiles. (VERIFIED by the conductor 2026-10-12. `genui-packs/data-viz-layouts.md:9` says no charting LIBRARY exists inside the genui sandbox; that is about hand-built HTML shapes, is NOT a contradiction with the catalog, and must be left alone.) the default catalog has Stat, BarChart, ColumnChart, LineChart, PieChart, Gauge, Sparkline, Table. Rewrite to teach the real types (Stat row with delta/caption, then a chart, then a Table), consistent with seeds `report-card-dashboard` (`catalog-coverage.ts`) and `kpi-panel-lifecycle`.
  2. Concierge: the `gallery-swiper` entry in `site/pages/agent-admin-libraries.ts` (~line 105-110) says "No Image type exists"; `Image` is in the default catalog (catalog.json ~790) and the `media-grid`/`product-presentation` skills teach it. Rewrite to teach Image (hero usageHint, `fit: cover`) in the swiper.
  3. Travel: `trip-plan` (libraries.ts ~199) teaches Cards in a Row for comparisons, colliding with the `comparison-table` mini-skill; teach a Table with a choose action per row for 4 or more options, Cards for 2-3.
  4. DROPPED after verification: the CORE `round-loop` (libraries.ts ~148-153) says one persistent surface, and Dungeon Master's `quest-log` (~260) says the same, so they agree. Croupier's one-surface-per-round override is deliberate (T-0002). No change.
  5. Admiral/Lexicographer/Alchemist/Mentalist/Quizmaster/Negotiator/Dungeon Master: add the missing END-STATE sentence to each preset's surface idiom or workflow (win, lose, play again) as a short, consistent clause; do not add components.
- Do, part B (wire props, each S):
  6. `PlayingCard` persona component: expose `size` on the wire (the control `ui-playing-card` has it at `packages/agent-ui/components/src/controls/playing-card/playing-card.ts` ~line 50; the persona `catalog.json` under `packages/agent-ui/a2ui/src/catalog/personas/croupier/` does not). Update factory, catalog.json, selection sidecar and the croupier checks/tests so a sized card validates and renders.
  7. Default catalog `Grid`: expose a column-count prop (the Grid row at catalog.json ~457 has only `min` and `gap`). If the underlying control (`ui-grid`) already has a columns/min mechanism, map it; if exposing it needs a NEW control prop or an ADR-level change, STOP and report blocked with the exact reason rather than widening: part B item 7 is then dropped from this ticket.
- Non-goals: any new component or widget (T-0065 owns widgets), new knowledge/resources, BookingForm field kinds, fixtures, the lexicon.
- Done when: `npm run check` and full `npm test` (--maxWorkers=4) exit 0; prompt-equivalence baseline recaptured ONCE via the documented flow (skill a2ui-prompt-authoring) if any prompts/ file changes; generated assets regenerated with their scripts (`node scripts/generate-agent-assets.mjs`, `npm run generate:registry`, props generators) and never hand-edited; K6 probe (system prompt plus tool definition) at or under 46,400 chars with the number reported; the persona/catalog tests for croupier and the default catalog green; no em dash in any added line; records (docs, skill text mentioning the old behavior) repaired in the same change.

## Context
Review: `.sdlc/preset-review-2026-10-12.md`. Related: T-0065 (widgets design, running), T-0064 (catalog previews, planning). If T-0064 lands first, rebase onto it; both may touch `packages/agent-ui/a2ui/src/catalog/**`.

## Constraints
Imports point inward only. Light DOM, ARIA via ElementInternals. No live runs and no key. Commit in the worktree; no push.

## Closed

2026-10-12: Merged in #1887; verifier pass. Grid column count dropped (needs a new control prop), decide separately
