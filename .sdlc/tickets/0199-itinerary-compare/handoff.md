---
id: T-0199
title: "Itinerary and Option compare patterns for Travel, Curator, Concierge and Shopkeeper"
type: feature         # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L3             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P3         # P1 | P2 | P3
depends: [T-0193]    # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Two recurring moments with divergent hand-built shapes.

## Intent
- Do (two composites, one intake; split into two tickets if intake says so):
  1. Itinerary or day plan: day headers, stops with time and status, optional per-day weather or FX slot. Evidence: travel `itinerary-timeline` (Timeline), curator `itinerary-tabs` (Tabs per day, `agent-admin-presets.ts` about :453), concierge itinerary; corpus `frontier-trip-card`, `travel-itinerary`.
  2. Option compare: columns of options by attribute rows, a best highlight, one pick per column (the column is the target, no Button in a table row). Evidence: travel `trip-plan` (Table with a Button per row for 4+ legs, ProductCard Row for 2-3), `mini-skills/comparison-table.md`, shopkeeper `product-grid`; corpus `comparison-pricing-table`, `frontier-card-anatomy-ask`, `frontier-choice-group-rooms`. Check convergence with OptionDeck (T-0193) first.
- Done when: the common process below is complete for each composite built.

## Context
- Pattern sweep 2026-10-14 (all 15 presets, `.agent-traces/2026-10-14.jsonl`, corpus, fixtures); Kim ticketed it the same day. Process like T-0193 (OptionDeck): design intake with skill `component-design` (precedent sweep, fork sheet, decisions recorded in this ticket, ADRs retired), then a mockup at widget / md on the A2UI canvas, light and dark and the 400px column, approved by Kim before any build; then control or composite, descriptor, default catalog row with `selection.json` intents and notFor, mini-skill, factory and browser tests in both engines, visual golden, render lint clean; adopt in the presets and bump their seedVersion and manifests; live `npm run chat:probe` on Haiku 5.5 and Sonnet 5.5 (conductor runs live).
- Commit off origin/main, never push. Zero dependencies; light DOM, ARIA via ElementInternals; no buttons inside card containers (Kim 2026-10-14).

## Constraints
- No em dashes.
