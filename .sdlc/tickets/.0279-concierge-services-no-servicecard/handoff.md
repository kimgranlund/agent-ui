---
id: T-0279
title: "A spa services list is a Table or a ProductCard grid on every model, never ServiceCard: the skill and the catalog selection disagree"
type: bug             # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-15
branch: fix/r4-concierge-guidance
worktree: ../agent-ui.worktrees/wave-cg
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

## Ruling (Kim, 2026-10-16)
ProductCard. A priced, bookable treatment is a product or offer by the catalog selection definition. The `amenity-service-card` skill changes to teach one ProductCard per bookable service (price, duration, a Book action), never a Table; add a composite-moment check for it. ServiceCard stays for a service or agent to open.

## Scope note (conductor, 2026-10-16)
Also update the round scenario oracles that still expect ServiceCard for a priced services list (six, per `.sdlc/evals/rounds/2026-10-15-r4-fixes/report.md` cluster A) to expect ProductCard, with the generators and their pinning tests.

## Lane bundle
This solo lane delivers these tickets in order, one commit each (`T-NNNN: <title>`):
- .sdlc/tickets/0279-concierge-services-no-servicecard/handoff.md
- .sdlc/tickets/0285-concierge-facility-hours-composite/handoff.md

## Acceptance criteria
verifier: L3
- `npx vitest run packages/agent-ui/a2ui/src/catalog/composite-moments.test.ts` exits 0, with a ProductCard row whose recorded Haiku spa Table yields `PRODUCT_CARD_MISSING` and whose ProductCard Grid, hours Table and unworded priced Table yield none.
- `npx vitest run scripts/e2e-admin/probe/scenarios` exits 0: the six "What spa services can I book" turns expect ProductCard; facility turns keep ServiceCard.
- The `amenity-service-card` skill in `site/pages/agent-admin-libraries.ts` teaches one ProductCard per priced service, never a Table; Concierge seedVersion is 13 and its manifest is refreshed.
- `npm run check` exits 0.

## Outcome

2026-10-15 · lane: full L2 · verdict: closed by reason (Merged in #2042: ProductCard per priced service (Kim's ruling); verifier L3 pass) · verifier: verifier-L3 (fable) · base: 3b0ab74745d7
- Changed: see commits
- Commits: 87f8a8a T-0279: record lane wave-cg
- Check: 1 `npx vitest run packages/agent-ui/a2ui/src/catalog/composite-moments.test.ts` exits 0, with a Pro...: pass
- Check: 2 `npx vitest run scripts/e2e-admin/probe/scenarios` exits 0: the six "What spa services can I book...: pass
- Check: 3 The `amenity-service-card` skill in `site/pages/agent-admin-libraries.ts` teaches one ProductCard...: pass
- Check: 4 `npm run check` exits 0: pass
