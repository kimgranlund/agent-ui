---
id: T-0452
title: "The shopkeeper order summary is a ConfirmReceipt with AmountPicker lines"
type: bug             # feature | bug | chore | spike | idea
status: done     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-24
claimed_by: claude:a8ce3b21 2026-10-24
from: T-0445
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
The shopkeeper cart is built as one ConfirmReceipt with AmountPicker quantity lines, as the `cart-summary` skill teaches, not a hand-built Card.

## Context
Round 13 cluster U in .sdlc/evals/rounds/2026-10-24-r13-pattern/report.md (round 13, T-0445): 0 of 3 reach runs and every smoke add hand-build `orderCard` bound to `/order/summary`; the `cart-summary` guidance is not routed.

## Constraints
Model-read text follows the debate rule (Opus author, fable review).

## Done when
- A composed-prompt test shows `cart-summary` routed on the storefront turns.
- A live check of `reach-shopkeeper-cart-amount-haiku`, 3 samples, under $1.
- `npm run check` plus the a2ui agent tests pass.
- Lane: solo because size L2 (steps.py lane); overnight goal 2026-10-21

## Acceptance criteria
- `npx vitest run --project site site/pages/agent-admin-shopkeeper-cart.test.ts site/pages/agent-admin-seed-digests.test.ts site/agent-content` exits 0: both reach-probe turns compose the cart-summary index line (ONE ConfirmReceipt plus one AmountPicker per line) and the v5 surface style; the v4 seed fails it.
- `npx vitest run packages/agent-ui/a2ui/src/agent packages/agent-ui/a2ui/src/live-agent` exits 0.
- `npm run check` exits 0.
- `node scripts/generate-agent-assets.mjs --check` exits 0.
- Live: .sdlc/runtime/tasks/0452-shopkeeper-cart-receipt/live/ holds 3 samples of reach-shopkeeper-cart-amount-haiku on the final text, estimated under $1.

## Outcome

2026-10-24 · lane: solo L2 · verdict: pass · verifier: verifier-L3 (fable) · base: 17215d8c66e7
- Changed: The shopkeeper's first add opens one ConfirmReceipt with an AmountPicker per line, as the cart-summary skill teaches
- Commits: none
- Check: 1 `npx vitest run --project site site/pages/agent-admin-shopkeeper-cart.test.ts site/pages/agent-ad...: pass
- Check: 2 `npx vitest run packages/agent-ui/a2ui/src/agent packages/agent-ui/a2ui/src/live-agent` exits 0: pass
- Check: 3 `npm run check` exits 0: pass
- Check: 4 `node scripts/generate-agent-assets.mjs --check` exits 0: pass
- Check: 5 Live: .sdlc/runtime/tasks/0452-shopkeeper-cart-receipt/live/ holds 3 samples of reach-shopkeeper-...: pass
- Follow-up: decide: scripts/e2e-admin/probe/scenarios/shopkeeper.ts:2-3,15-16 decide... -> notes.md
- Follow-up: decide: site/pages/agent-admin-presets.ts:29 note: the header still says... -> notes.md
- Follow-up: decide: .sdlc/runtime/tasks/0452-shopkeeper-cart-receipt/live/run-3.log... -> notes.md
