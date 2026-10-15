---
id: T-0065
title: "Design: the shared and preset-specific widgets the 15 agent presets need (read-only spike)"
type: spike           # feature | bug | chore | spike | idea
status: done        # proposed | ready | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-12
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Question
Which widgets and composed components should be built for the 15 agent presets, where should each live (default catalog, a shared opt-in widgets fragment, or a persona fragment), and what does each cost in prompt budget?

## Goal
A design (no code) that fixes the list of widgets and composed components the 15 agent presets need, where each one lives, and what it costs, so the build can be ticketed in waves.

## Intent
- Do: read all 15 presets in `site/pages/agent-admin-presets.ts` (croupier, quant, concierge, restaurant, travel, curator, stylist, quizmaster, mentalist, negotiator, lexicographer, admiral, alchemist, dungeon-master, builder) with their prompts, local patterns, pack entries and surface idioms (`packages/agent-ui/a2ui/src/agent/prompts/**`, `src/agent/surface-seeds.ts`), the existing persona fragments (`packages/agent-ui/a2ui/src/catalog/personas/{concierge,croupier,fixture-demo}`), and the default catalog's component list. Decide, with evidence per preset: which surfaces each preset repeatedly composes by hand today (count the Row/Card/Stat compositions in its idioms and recorded fixtures) and which of those deserve a named widget. Starting hypothesis from Kim's examples and a first pass (confirm, cut or extend it): Tier 1 shared: ProductCard/OfferCard, MediaGallery (room gallery), GameHud/Scoreboard, BoardGrid; Tier 2: Itinerary/Timeline, AvailabilityPicker, QuestionCard, CharacterSheet; Tier 3 preset-specific: CardTable (with PlayingCard), SwatchPalette/TokenCard, ExhibitCard, CommitmentLedger. Also: whether a new Shopkeeper (shop) preset is justified to exercise ProductCard, and what Kim's "Hotelier room gallery" maps to (the Hotel Concierge preset).
- For each widget decide: catalog type (a2ui) vs a composed ui-* control (components package, light DOM, FACE rules, ADR-0233 per-control entry) vs both; where it lives (default catalog, one shared opt-in widgets fragment, or a persona fragment scoped by `targetCatalogs`); its props and slots; its A2UI schema; how it binds data; its states (empty, loading, error, long content, dark/light, density); which presets use it; and the exact files a build would touch.
- Measure the prompt-budget cost: the producer prompt is at 44,392 of 46,400 chars (K6, T-0061). For each placement option compute the added chars per widget using the prompt-budget probe (see `.claude/docs/lld/response-type-selection.lld.md` section 4 and `src/live-agent/prompt-budget.test.ts`) and recommend a placement that keeps the default turn under the bound; show the numbers.
- Coverage and gates: each new type needs a selection sidecar, seeds, a preview card and must satisfy the catalog-coverage gate being built in T-0064 (`.sdlc/tickets/.0064-catalog-previews-all/`; read its plan if present).
- Output: write `.sdlc/0065-preset-widgets-design/design.md` (max 200 lines): verdict and recommended wave order; a table of widgets (name, tier, kind, home, presets served, evidence, prompt cost, size S/M/L); per-preset coverage matrix; rejected alternatives with reasons; the ADR or amendment route (new ADR number, contracts touched); a list of build children with disjoint file lists, levels and dependencies, ready to become tickets; risks and unknowns marked [U].
- Non-goals: any source edit, any generated-file edit, the live leg, any key.
- Done when: design.md exists with measured prompt-cost numbers (saved command outputs under `.sdlc/0065-preset-widgets-design/measure/`), every widget row cites at least one preset idiom or fixture as evidence, and no em dash.

## Context
Kim 2026-10-12: "what widgets (and any composed components) should be developed based on the agent presets we currently have? example of a widget: Croupier game UI and its contents (cards, game/score toolbar), room gallery for Hotelier, ecommerce product cards for shops." Related: ADR-0233 (no barrels, per-control entries), ADR-0169 (multi-catalog, composed/derived catalogs, targetCatalogs), ADR-0241 (lazy catalogs), ADR-0242 (response type), skills a2ui-multi-catalog, component-design, component-build, component-catalog.

## Constraints
Read-only. Write only under `.sdlc/0065-preset-widgets-design/`. No push, no PR.

## Closed

2026-10-12: Design delivered: .sdlc/0065-preset-widgets-design/design.md (5 widgets, ADR-0243 route, 8 build children)
