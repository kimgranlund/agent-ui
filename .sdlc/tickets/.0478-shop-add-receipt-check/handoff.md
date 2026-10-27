---
id: T-0478
title: "A shopkeeper add turn is held to a ConfirmReceipt, and is-in-your-order counts as an add claim"
type: bug             # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: [file:.sdlc/evals/rounds/2026-10-26-r15-pattern/report.md]  # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-26
claimed_by: claude:a8ce3b21 2026-10-26
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
The bug is fixed and a keyless replay that failed before the fix passes after it.

## Repro
1. `npm run chat:probe -- --replay .sdlc/evals/rounds/2026-10-26-r15-pattern/runs/smoke-shopkeeper-browse-and-add-haiku-1/fixture.json` exits 1.
2. Same for `.sdlc/evals/rounds/2026-10-26-r15-pattern/runs/reach-shopkeeper-cart-amount-haiku-2/fixture.json`.

## Expected
An add-to-order turn on the storefront ends with a ConfirmReceipt: trace :6 gets CHANGE_CLAIMED, and :139 gets a missing-ConfirmReceipt finding whose repair builds one.

## Actual
:6 replies "The Brass Arc Floor Lamp is in your order at $189." with no tool, and the phrase is outside `CHANGE_CLAIM_IN_REPLY` (`produce.ts:1268`). :139 is caught by CHANGE_CLAIMED, but the repair builds bare AmountPicker lines with no ConfirmReceipt, and `COMPOSITE_MOMENTS` has no ConfirmReceipt row.

## Context
Live round 15 (T-0475), cluster P4, 2 of 69 runs; full row in `.sdlc/evals/rounds/2026-10-26-r15-pattern/report.md`, Why it failed. Fix layer: catalog check plus regex, in `packages/agent-ui/a2ui/src/catalog/composite-moments.ts` (a ConfirmReceipt row) and `packages/agent-ui/a2ui/src/agent/produce.ts` ("is in your order", "in your cart"). Cause read from source, a guess until the failing test shows it.

## Constraints
The failing test lands before or with the fix, never after. Prefer the check over prompt text; any model-read text change gets a Fable review. Measure afterwards with 3 samples of the failing cell (a separate paid run, Kim's call). No em dashes.

## Done when
- The named replay(s) pass and a unit case covers the new rule.
- A false-positive sweep over recorded round 14 and 15 fixtures for the persona stays green.
- `npm run check` plus the touched folders' tests pass.
- Lane: solo because size L2 (steps.py lane)

## Acceptance criteria
verifier: L3
- `npx vitest run scripts/e2e-admin/probe/replays/shopkeeper-haiku-in-your-order-claim.test.mjs scripts/e2e-admin/probe/replays/shopkeeper-haiku-add-no-receipt.test.mjs` exits 0: the :6 replay gets CHANGE_CLAIMED on "is in your order" (rounds 2), the :139/:140 replay gets CONFIRM_RECEIPT_MISSING on its AmountPicker order column (rounds 3), and each ends with a ConfirmReceipt (authored repair round) and no failed probe check. Both failed before the fix (exit 1).
- `npm run chat:probe -- --replay scripts/e2e-admin/probe/replays/shopkeeper-haiku-in-your-order-claim.json` exits 0 (the browser leg of the same replay).
- `npm run chat:probe -- --replay scripts/e2e-admin/probe/replays/shopkeeper-haiku-add-no-receipt.json` exits 0.
- `npx vitest run packages/agent-ui/a2ui/src/catalog/composite-moments.test.ts packages/agent-ui/a2ui/src/live-agent/produce-narration.test.ts packages/agent-ui/a2ui/src/live-agent/check-contracts.test.ts packages/agent-ui/a2ui/src/live-agent/chat-validation.test.ts` exits 0: a unit case per claim wording ("is in your order", "It's in your cart", "are now in your cart") and its negatives (a question, "Nothing is in your order yet", "show up in your order summary"); the ConfirmReceipt row fires on a hand-built order and stays quiet on a negotiator deal sheet (GameHud), a room StepFlow, a tip and a guest count, and its lacks guards bite.
- The ConfirmReceipt row's `repair` in `packages/agent-ui/a2ui/src/catalog/composite-moments.ts` is model-read text (the finding sent back to the model): it asks for ONE ConfirmReceipt beside the AmountPicker lines with items, totalLabel, totalPath, status, confirmAction and backAction, and no Button.
- `npx vitest run scripts/e2e-admin/probe packages/agent-ui/a2ui/src/agent packages/agent-ui/a2ui/src/catalog packages/agent-ui/a2ui/src/live-agent packages/agent-ui/a2ui/src/examples packages/agent-ui/a2ui/tools` exits 0.
- `npm run check` exits 0.

## Outcome

2026-10-26 · lane: solo L2 · verdict: pass · verifier: verifier-L3 (fable) · base: cfceda60f6ed
- Changed: A storefront add turn with an AmountPicker line and no ConfirmReceipt gets CONFIRM_RECEIPT_MISSING, and 'is in your order' or 'in your cart' counts as a change claim
- Commits: none
- Check: 1 `npx vitest run scripts/e2e-admin/probe/replays/shopkeeper-haiku-in-your-order-claim.test.mjs scr...: pass
- Check: 2 `npm run chat:probe -- --replay scripts/e2e-admin/probe/replays/shopkeeper-haiku-in-your-order-cl...: pass
- Check: 3 `npm run chat:probe -- --replay scripts/e2e-admin/probe/replays/shopkeeper-haiku-add-no-receipt.j...: pass
- Check: 4 `npx vitest run packages/agent-ui/a2ui/src/catalog/composite-moments.test.ts packages/agent-ui/a2...: pass
- Check: 5 The ConfirmReceipt row's `repair` is model-read text asking for ONE ConfirmReceipt beside the Amo...: pass
- Check: 6 `npx vitest run scripts/e2e-admin/probe packages/agent-ui/a2ui/src/agent packages/agent-ui/a2ui/s...: pass
- Check: 7 `npm run check` exits 0: pass
- Follow-up: decide: packages/agent-ui/a2ui/src/agent/produce.ts:1270 decide: the new... -> notes.md
- Follow-up: decide: packages/agent-ui/a2ui/src/catalog/composite-moments.ts:331 decide... -> notes.md
- Follow-up: decide: packages/agent-ui/a2ui/src/catalog/composite-moments.ts:332 note... -> notes.md
- Follow-up: decide: .sdlc/evals/rounds/2026-10-26-r15-pattern/runs/smoke-shopkeeper-bro... -> notes.md
