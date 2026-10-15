---
id: T-0201
title: "Catalog architecture SPEC and migration plan: core, agentic (cross-cutting) and shared domain catalogs"
type: chore           # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L3             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P1         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Kim 2026-10-14: "we should have catalogs that are domain specific (Croupier) and others that are cross-cutting and general-purpose 'agentic' type of patterns that could be useful in almost any kind of context." She chose "spec and migration first". This ticket writes the SPEC that every new pattern ticket (T-0193, T-0195 to T-0199, and the agentic patterns below) slots into, plus a migration plan. It builds nothing.

## Proposed shape (conductor draft for the SPEC to test, not settled)
- **Core:** primitives, layout, form controls and data viz. Every agent loads it.
- **Agentic (cross-cutting):** moments every agent has. Proposed members:
  - existing: SourceList, Suggestions;
  - in flight: OptionDeck (T-0193), Confirm & receipt (T-0195), Step flow (T-0198), Compare (T-0199), Amount picker (T-0196);
  - new: Clarify (one structured question before acting), Approval gate (approve, edit or deny a pending action), Plan / task list (live step status), Progress job (stages, ETA, cancel), Summary card, Recovery (failure, retry, alternatives), Feedback (rating plus reason, feeds evals), Handoff (to a human or agent, with context), Memory / preference (remember or forget).
- **Domain (shared across presets, not one per persona):**
  - **Games** (Croupier, Admiral, Lexicographer, Mentalist, Dungeon Master, Quizmaster):
    - today: CardTable, PlayingCard, BoardGrid, GameHud, ResultCard, QuestionCard;
    - candidates: dice / spinner, score sheet and leaderboard, turn order, inventory, scene choice, guess grid, timer.
  - **Hospitality** (Concierge, Maitre d', Travel):
    - today: BookingForm, BookingConfirmation, ServiceCard;
    - candidates: availability slots, itinerary, menu, room or seat picker, guest profile.
  - **Commerce** (Shopkeeper, Negotiator):
    - today: ProductCard;
    - candidates: cart, variant picker, order tracking, offer / counter-offer, price history.
  - **Design** (Stylist, Alchemist):
    - today: Swatch, Ramp, Ladder, ContrastPair, ColorPicker;
    - candidates: palette builder, type specimen, token diff, before / after.
  - **Knowledge & data** (Quant, Curator, Lexicographer):
    - today: charts, Table, DrillPanel, SourceList;
    - candidates: KPI board, entry or definition card, collection gallery, annotated document.

## Intent
- Do:
  1. Read first:
     - `packages/agent-ui/a2ui/AGENTS.md` (catalog records, lazy loading ADR-0241, selection sidecars, the capability registry, persona fragments and manifests, the byte-pinned prompt stack and budget);
     - `spec/a2ui-catalog.spec.md` and `spec/persona-catalog-composition.spec.md`;
     - `spec/agent-content.spec.md` (T-0182) and `spec/agent-closed-loop.spec.md` (T-0181);
     - `site/pages/agent-admin-presets.ts` `localPatterns`;
     - the 84 default types (`src/catalog/default/catalog.json`) and the persona fragments.
  2. Write a new SPEC, `.claude/docs/spec/a2ui-catalog-architecture.spec.md` (v0.1, proposed). It must cover:
     - the layer definitions and the test for which layer a type belongs to;
     - catalog ids and composition, including how `<base>--<domain>` and multiple domains combine, and whether the agentic layer is part of the default or its own id;
     - how a preset declares its domains;
     - selection guidance per layer;
     - the prompt-budget effect of loading fewer types per turn;
     - the a2ui-basic interop catalog;
     - the registry and manifests;
     - naming.
     Cite tickets, never new ADR clauses.
  3. Classify every current type: core, agentic, or which domain. Flag ambiguous ones (ResultCard, GameHud, ServiceCard, Ladder) with a recommendation.
  4. Write the migration plan as ordered waves:
     - move the domain types out of the default catalog into shared domain fragments;
     - turn the persona fragments (concierge, croupier, quizmaster, stylist) into domain catalogs;
     - update the presets' `localPatterns`;
     - recapture the baseline through its flow.
     Each wave needs its gates (catalog records, registry, selection tests, agent manifests, prompt-equivalence baseline, eval:catalog, chat:probe smoke per preset) and a rollback.
  5. Write the pattern backlog: each agentic and domain candidate with one line of purpose, its evidence (preset or trace), its layer, and its priority. Fold in or re-home T-0193 and T-0195 to T-0199.
  6. Write the open decisions for Kim as a short list with recommendations. Do not decide them silently.
- Non-goals: building or moving any type.
- Done when: doc_lint and `npm run check` exit 0; the SPEC classifies all 84 default types and every persona fragment type; the migration waves and pattern backlog are written; Kim's open decisions are listed.

## Context
- Commit off origin/main, never push. Docs-only gate (doc_lint plus check).

## Constraints
- No em dashes. Status flips are Kim's.

## Closed

2026-10-14: merged as PR #1988
