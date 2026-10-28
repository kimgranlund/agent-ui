---
id: T-0503
title: "The itinerary cue fires on 'schedule our <any weekday>', not only Friday to Sunday"
type: bug             # feature | bug | chore | spike | idea
status: done
size: L1
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-28
claimed_by: claude:a8ce3b21 2026-10-28
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 5
---

## Goal
The itinerary composite cue matches "schedule my/our <weekday>" for every weekday, so "schedule our Tuesday" still draws ITINERARY_MISSING the way "schedule our Saturday" does.

## Intent
- Do: widen the weekday alternation in the `cue` regex at `packages/agent-ui/a2ui/src/catalog/composite-moments.ts:269` to all seven weekdays; add test cases (a Tuesday plan matches; a booking such as "schedule a massage at 15:00" still does not) in that file's test.
- Non-goals: any other cue, any prompt text.
- Done when: the new cases fail at base and pass after; `npm run check` and the catalog tests exit 0.

## Context
T-0484 verifier note. The T-0484 comment at :267-268 explains the plan-vs-booking split this must keep.

## Constraints
No model-read text changes. No em dashes.
- Lane: solo because size L1 (steps.py lane)

## Outcome

2026-10-28 · lane: solo L1 · verdict: pass · verifier: verifier-L1 (opus) · base: 993df87857a2
- Changed: the itinerary schedule cue matches all seven weekdays
- Commits: none
- Check: 1 Do: widen the cue weekday alternation to all seven weekdays and add the Tuesday-plan and booking ...: pass
- Check: 2 Done when: new cases fail at base and pass after; npm run check and catalog tests exit 0: pass
