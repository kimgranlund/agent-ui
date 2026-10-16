---
id: T-0279
title: "A spa services list is a Table or a ProductCard grid on every model, never ServiceCard: the skill and the catalog selection disagree"
type: bug             # feature | bug | chore | spike | idea
status: proposed     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-15
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
A ruling, then one teaching for the Concierge's bookable services list: ServiceCard per service (as the `amenity-service-card` skill says) or ProductCard per priced treatment (as the catalog selection says), and a composite-moment check for the chosen one.

## Repro
`.sdlc/evals/rounds/2026-10-15-r4-fixes/`every "What spa services can I book during my stay?" turn (traces :4, :6, :23, :77, :109, :117, :127, :129, :146, :149, :181, :189, :213).

## Expected
The services list draws the composite the playbook names, on every model.

## Actual
ServiceCard drew 0 of 13 services asks. Haiku draws a Table (or a Card with a DescriptionList), Sonnet a Table or a Grid of ProductCards, Opus a Grid of ProductCards. The list itself is now right (T-0267's six treatments with durations and prices). ServiceCard drew only on "What services could I add for the rest of my stay?" (:85, :157). No check fires.

## Context
`site/pages/agent-admin-libraries.ts:149` (the skill: "one ServiceCard each") is index-only on every turn. `packages/agent-ui/a2ui/src/catalog/default/selection.json:1127` gives ServiceCard "a service or agent to open" and ProductCard "a product or offer with a price and an action". `composite-moments.ts` has no ServiceCard row, and the services exemplar ranked is `frontier-service-gateway` (an agent-service gateway). Like T-0266, this is a guidance conflict. Found by T-0275.

## Done when
- Kim rules which composite a priced treatment list uses; the skill, the selection sidecar and a composite-moment row agree.
- `npx vitest run packages/agent-ui/a2ui/src/catalog/composite-moments.test.ts` and `npm run check` exit 0.
