---
id: T-0484
title: "A booking ask with two clock times does not draw ITINERARY_MISSING"
type: bug             # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-27
claimed_by: claude:a8ce3b21 2026-10-27
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 5
---

## Goal
ITINERARY_MISSING fires on a day plan, never on a request to book things at set times.

## Repro
1. Run the ITINERARY_MISSING row in `packages/agent-ui/a2ui/src/catalog/composite-moments.ts:267` on the say turns "Schedule a massage at 15:00 and a taxi to the airport at 18:00." and "Can you schedule the spa at 3pm and dinner at 8pm for us?"

## Expected
Neither draws ITINERARY_MISSING; the T-0480 day-plan replay (`scripts/e2e-admin/probe/replays/concierge-haiku-day-plan-no-itinerary.test.mjs`) still does.

## Actual
Both draw it: the `schedule` and `plan` cues plus two clock times match a pure booking ask (T-0480 Fable verifier note).

## Constraints
Failing unit cases land before or with the fix. Any model-read text change gets a Fable review. Run the keyless sweep over the round 14 and 15 fixtures. No em dashes.

## Done when
- Unit cases for both wordings and the T-0480 replay pass; sweep unchanged.
- `npm run check` plus the touched folders' tests pass.
- Lane: solo because size L1 (steps.py lane)

## Outcome

2026-10-27 · lane: solo L1 · verdict: pass · verifier: verifier-L1 (opus) · base: be31c52e658a
- Changed: A booking ask with two clock times no longer draws ITINERARY_MISSING; the day-plan cue needs plan, itinerary or schedule as a noun
- Commits: none
- Check: 1 Unit cases for both wordings and the T-0480 replay pass; sweep unchanged: pass
- Check: 2 `npm run check` plus the touched folders' tests pass: pass
- Follow-up: note: packages/agent-ui/a2ui/src/catalog/composite-moments.ts:269 the... -> notes.md
