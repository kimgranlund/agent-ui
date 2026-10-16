---
id: T-0299
title: "The last repair round drops or swaps the Concierge surface (FEED_SCOPE then SURFACE_DEGRADED)"
type: bug             # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L3             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-16
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
A Concierge turn whose last repair round builds the right form never ships nothing or a downgraded card instead.

## Context
Round 6 cluster D (`.sdlc/evals/rounds/2026-10-15-r6-matrix/report.md`, P1, follows T-0290): :75 round 3 builds the form on ask-3, then FEED_SCOPE and SURFACE_DEGRADED ship nothing; :170 BOOKING_FORM_MISSING, PARSE, then a SURFACE_DROPPED halt; :161 PRODUCT_CARD_MISSING, PARSE, then a DescriptionList card with no code. Sonnet ships the ProductCard grid on identical framing (:347). Cause (d) loop defect (lesson 20) with (c) underneath.

## Scope
`packages/agent-ui/a2ui/src/agent/produce.ts` (FEED_SCOPE on the last round: re-scope a feed-ask form instead of degrading it; an earlier round's missing-composite finding stays binding so a later round cannot silently ship without it), `catalog/personas/concierge/checks.ts`.

## Done when
- `scripts/e2e-admin/probe/replays/concierge-haiku-final-round-feed-scope.test.mjs` flipped (ask-3 kept, no SURFACE_DEGRADED) and a test for the binding finding; each red at the base.
- The concierge checks, live-agent tests and `npm run check` exit 0.

## Acceptance criteria
- (red) `npx vitest run --project scripts scripts/e2e-admin/probe/replays/concierge-haiku-final-round-feed-scope.test.mjs`
- (red) `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/produce-binding-finding.test.ts`
- (guard) `npx vitest run --project packages packages/agent-ui/a2ui/src/catalog/personas/concierge packages/agent-ui/a2ui/src/catalog/composite-moments.test.ts`
- (guard) `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent`
- (guard) `npm run check`

## Lane bundle
- T-0297: NARRATED_MECHANICS misses a capitalized surface id (`.sdlc/tickets/0297-narrated-mechanics-case/handoff.md`)
- T-0298: Haiku repair rounds never call render_surface: force the tool on a no-tool repair round (`.sdlc/tickets/0298-haiku-repair-forced-tool/handoff.md`)
- T-0299: The last repair round drops or swaps the Concierge surface (this handoff)
