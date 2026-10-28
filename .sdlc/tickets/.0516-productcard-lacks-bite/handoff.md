---
id: T-0516
title: "The ProductCard row's BookingForm and BookingConfirmation lacks-guards get bite tests"
type: chore           # feature | bug | chore | spike | idea
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
The ProductCard composite-moment row's `lacks: ['BookingForm', 'BookingConfirmation', ...]` (around `packages/agent-ui/a2ui/src/catalog/composite-moments.ts:342`) has a test per booking guard that fails when that entry is removed, like the ConfirmReceipt row's guards (composite-moments.test.ts around :1662-1683).

## Intent
- Do: add one case per guard: quiet with the full lacks row, firing its finding with that guard filtered out.
- Non-goals: changing the row or any model-read text.
- Done when: each new case reds when its entry is removed (mutation noted); `npm run check` and `npx vitest run packages/agent-ui/a2ui/src/catalog` exit 0.

## Context
T-0505 solo note: the ConfirmReceipt row is covered, the ProductCard row is not.

## Constraints
Tests only. No em dashes.
- Lane: solo because size L1 (steps.py lane)

## Outcome

2026-10-28 · lane: solo L1 · verdict: pass · verifier: verifier-L1 (opus) · base: 833bd7dd69a1
- Changed: The ProductCard row's BookingForm and BookingConfirmation lacks-guards get bite tests
- Commits: none
- Check: 1 Each new case reds when its entry is removed (mutation noted): pass
- Check: 2 `npm run check` and `npx vitest run packages/agent-ui/a2ui/src/catalog` exit 0: pass
