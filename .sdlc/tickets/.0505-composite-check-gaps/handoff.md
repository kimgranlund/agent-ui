---
id: T-0505
title: "The booking lacks-guards get bite tests, and a tip picker beside a Total line no longer draws CONFIRM_RECEIPT_MISSING"
type: bug             # feature | bug | chore | spike | idea
status: done
size: L2
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-28
claimed_by: claude:a8ce3b21 2026-10-28
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
The BookingForm and BookingConfirmation `lacks` guards in the composite-moment checks have tests that bite, and a bill with a tip AmountPicker beside a "Total" Text no longer draws CONFIRM_RECEIPT_MISSING.

## Intent
- Do: in `packages/agent-ui/a2ui/src/catalog/composite-moments.test.ts`, add cases proving each booking guard in the `lacks` lists suppresses its check (red when that entry is removed); narrow the ConfirmReceipt `words` gate (it matches `total`) so a tip picker plus a Total line without an order or purchase is not a receipt moment, with a failing-first case for it and the existing receipt positives still firing.
- Non-goals: repair text or any model-read prose; other composites.
- Done when: the new cases fail at base where they should and pass after; `npm run check` and `npx vitest run packages/agent-ui/a2ui/src/catalog` exit 0.

## Context
Notes on T-0485 era closes: composite-moments.ts `lacks: ['BookingForm', 'BookingConfirmation', ...]` (around :342 and :360) has bite proof only for GameHud and StepFlow (test around :1632); the `words` gate around the CONFIRM_RECEIPT check takes `total`.

## Constraints
No model-read text change; if one seems needed, stop and report (it needs a Fable review). No em dashes.
- Lane: solo because size L2 (steps.py lane)

## Outcome

2026-10-28 · lane: solo L2 · verdict: closed by reason (already fixed by T-0480 (#2287): receipt words gate has no total, tip-and-Total negative and both booking guard bite tests exist) · verifier: none · base: 97e49c89b1b1
- Changed: see commits
- Commits: none
