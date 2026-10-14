---
id: T-0200
title: "Teach existing composites where missing: ResultCard end states, GameHud, ServiceCard, Suggestions"
type: chore           # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Composites that already exist get taught where presets still hand-build the moment (pattern sweep 2026-10-14). No new components.

## Intent
- Do:
  1. ResultCard vs Toast: the CORE `round-loop` playbook (`site/pages/agent-admin-libraries.ts` about :188) says results are a Toast; align it: a transient round result may Toast, the game's end state is a ResultCard (all five game presets seed it). Fix corpus `frontier-round-outcome` only through the corpus admission flow, else note it.
  2. GameHud for scores and status: name it in the Lexicographer, Alchemist and Admiral skills (only Admiral's `battle-rounds` and the Mentalist, Negotiator, Dungeon Master skills do today).
  3. ServiceCard: the Maitre d' `facility-info-card` (about :137) is a Card with action Buttons; switch it to ServiceCard like the Concierge's `amenity-service-card`.
  4. ProductCard templated in a Grid: travel `trip-plan` 2-3 legs as ProductCards in a Row should template like `product-grid`.
  5. Suggestions for tappable follow-up prompts: no preset teaches it; add one line to the shared core playbook where next-step prompts are taught, instead of Button rows.
  6. Each change passes the preset prose-vs-catalog gate (T-0159); bump touched presets' seedVersion, refresh manifests; recapture the prompt baseline only through its flow if a byte-pinned prompt changes.
- Done when: `npm run check` exit 0; `site/pages/agent-admin-presets.test.ts`, `site/lib/agent-manifest` and agent-admin tests exit 0; a live probe on two touched presets (conductor runs it) shows the composite.

## Context
- Commit off origin/main, never push. Keys server-side only.

## Constraints
- No em dashes.

## Acceptance criteria
- `npm run check` exits 0.
- `npx vitest run --project site site/pages/agent-admin-presets.test.ts site/lib/agent-manifest` exits 0 (the T-0159 prose-vs-catalog gate and manifest freshness).
- `npx vitest run --project site --project packages site/pages/agent-admin-app.test.ts packages/agent-ui/app/src/controls/agent-admin` exits 0.
- CORE `round-loop` in site/pages/agent-admin-libraries.ts allows a Toast only for a transient round result and names ONE ResultCard as the game end state; `word-tiles` and `board-grid` name ONE GameHud; `facility-info-card` teaches ServiceCard; `trip-plan` templates its 2-3 legs as ProductCard tiles in one Grid from a `{path:"/legs",componentId}` template; `intake-confirm` teaches Suggestions for follow-up prompts.
- seedVersion bumped for every preset seeding an edited entry (concierge 9, travel 5, lexicographer 3, alchemist 3, dungeon-master 3, admiral 4), each manifest matching.
