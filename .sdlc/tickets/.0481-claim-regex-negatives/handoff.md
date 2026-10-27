---
id: T-0481
title: "A reply that only mentions what is in the order is not a change claim"
type: bug             # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []  # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-27
claimed_by: claude:a8ce3b21 2026-10-27
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 5
---

## Goal
CHANGE_CLAIM_IN_REPLY fires on a reply that claims an add, never on one that only describes or questions the order.

## Repro
1. In `produce.ts:1270`, test `CHANGE_CLAIM_IN_REPLY` against "No items are in your order yet.", "Here's what's in your cart: two lamps." and "Everything that is in your order ships Tuesday."

## Expected
None of the three counts as a change claim; "The Brass Arc Floor Lamp is in your order at $189." (the T-0478 :6 replay) still does.

## Actual
All three read as a change claim (T-0478 verifier node probe).

## Context
Follow-up from the T-0478 Fable review (produce.ts:1270 decide note). The T-0470 add-claim replay and the T-0478 in-your-order replay must stay red without their fixes.

## Constraints
Failing unit cases land before or with the fix. No em dashes.

## Done when
- A unit case per negative wording and the T-0470 and T-0478 replays pass.
- `npm run check` plus the touched folders' tests pass.
- Lane: solo because size L1 (steps.py lane)

## Outcome

2026-10-27 · lane: solo L1 · verdict: pass · verifier: verifier-L1 (opus) · base: 02b5afbc391b
- Changed: A reply that only describes or questions the order, such as 'No items are in your order yet.', is not a change claim
- Commits: none
- Check: 1 A unit case per negative wording and the T-0470 and T-0478 replays pass: pass
- Check: 2 `npm run check` plus the touched folders' tests pass: pass
- Check: 3 Lane: solo because size L1 (steps.py lane): pass
- Follow-up: note: produce.ts:1274 the ?<!\bno\s+?:\w-+\s+{0,2} lookbehind also... -> notes.md
