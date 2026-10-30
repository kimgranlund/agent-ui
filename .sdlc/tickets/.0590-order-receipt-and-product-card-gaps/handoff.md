---
id: T-0590
title: "Order receipts and product browses built by hand are sent back"
type: bug             # feature | bug | chore | spike | idea
status: done
size: L2
priority: P2
depends: []
created: 2026-10-29
claimed_by: claude:a8ce3b21 2026-10-29
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
Round 21 clusters P4c, P5c and Q close: an add-to-order hand-built Card with no ConfirmReceipt, a literal-quantity order receipt with no AmountPicker after the user asked for a quantity, and a product browse built from hand-made priced Cards are each sent back.

## Intent
- Do: the composite-moments.ts (and produce.ts CHANGE_CLAIMED add-turn ask) changes the three rows below propose. Keyless tests that fail on base with false-positive guards, and `--from-trace` replays of the failing runs (copy the r21 traces to a temp `.agent-traces/` and remove them after). Any new or changed model-read text (repair asks, finding messages, parse notes) is named in the report for a Fable review. Done when: the new tests fail on base and pass after; the replays pass after; the a2ui suites, probe replays and `npm run check` exit 0; `node scripts/measure-size.mjs` stays within budget (report the a2ui/agent size).

## Context
Round 21 report (`.sdlc/evals/rounds/2026-10-29-r21-pattern/report.md`, PR 2394; until it merges, read it at `../agent-ui.worktrees/T-0589-wave-w0589/.sdlc/evals/rounds/2026-10-29-r21-pattern/`). Kim approved these fixes 2026-10-29.

| P4b (recurrence). After a CHANGE_CLAIMED repair the add turn ships the order as a hand-built Card with an AmountPicker and no ConfirmReceipt | 2: `smoke-shopkeeper-browse-and-add-haiku-3` (:80), `-2` (:43) | (c) model, with a (b) check gap | :80 r2's order Card holds an AmountPicker labelled "Brass Desk Lamp" with a literal `value` 1 and `actionName` `set_quantity`; the ConfirmReceipt row's `inputCue` reads only `label`, `name` and the bound path, so its quantity cue matches nothing and the row stands aside although the reply says "to your order". :43 spent rounds 1 and 2 on a string PARSE and a CHANGE_CLAIMED, and round 3 shipped the same shape, labelled "Quantity", tallied SEMANTIC_UNCORRECTED (inferred: the row fired on the last round, with no round left to repair) | (b) check: let `inputCue` read `actionName` (and the AmountPicker's `currency`) as well; and (d) producer: a CHANGE_CLAIMED repair on an add turn names the ConfirmReceipt in its ask | `packages/agent-ui/a2ui/src/catalog/composite-moments.ts`, `agent/produce.ts` | `composite-moments.test.ts`: the :80 r2 messages with the reply fire `SURFACE_MISSING` for ConfirmReceipt; the T-0480 tip-picker case still stands aside; replay of :80 | P4c |

| P5b (recurrence). An order ConfirmReceipt with a literal item quantity of 2 and no AmountPicker, the reply offering no quantity change | 1: `reach-shopkeeper-cart-amount-haiku-1` (:124) | (c) model, with a (b) check gap | :124 r2 ships `ConfirmReceipt` "Your order" with `items[0].quantity` 2 and no AmountPicker; the reply "Here's your order summary." has no `QUANTITY_OFFER`, so the T-0582 `unpickedLines` branch for literal quantities stays shut by design | (b) check: on the shopkeeper's `agent-ui` surfaces, a pending order receipt's literal quantity fires the AmountPicker row without the reply offer when the user asked for a quantity ("Add two") | `packages/agent-ui/a2ui/src/catalog/composite-moments.ts` | `composite-moments.test.ts` with the :124 r2 messages and the user ask; a booking receipt and a confirmed receipt still stand aside; replay of :124 with `--expect-component AmountPicker` | P5c |

| Q. A product browse ("What lamps do you have?") answered with hand-built Cards holding a price Text and a Button, no ProductCard, and no check fires | in 1: `smoke-shopkeeper-browse-and-add-haiku-2` turn 1 (:42) | (c) model, with a (b) check gap | :42 r1 ships four Cards (CardHeader name, Badge, price Text "$189", Button) and passes with no failure code; the ProductCard row reads only priced Table columns and priced DescriptionList or List rows on a services ask | (b) check: a priced-Card arm on the ProductCard row (a Card whose texts carry a price and whose footer holds a Button), on a product ask as well as a services ask | `packages/agent-ui/a2ui/src/catalog/composite-moments.ts` | `composite-moments.test.ts` with the :42 messages fires PRODUCT_CARD_MISSING; a single order Card with a total does not; replay of :42 | Q1 |

## Constraints
No em dashes. No paid runs. Never rewrite a round archive. Never change grammar.md. Regenerate generated files with their scripts.
- Lane: solo because size L2 (steps.py lane)

## Acceptance criteria
verifier: L3
1. `npx vitest run packages/agent-ui/a2ui/src/catalog/composite-moments.test.ts packages/agent-ui/a2ui/src/live-agent/produce-narration.test.ts` exits 0; the T-0590 positives (:80 r2 CONFIRM_RECEIPT_MISSING on line_desk, :124 r2 SURFACE_MISSING on order_card under the quantity ask, :42 r1 PRODUCT_CARD_MISSING on the four Cards, the add-turn CHANGE_CLAIMED repair naming ONE ConfirmReceipt) fail with composite-moments.ts and produce.ts at base, and the false-positive guards (tip bill with currency and actionName, deal sheet, guess TextField, no ask, an ask for one or a price, confirmed and booking receipts, a single order Card beside one product card, unpriced or unbuttoned Cards, a non-add CHANGE_CLAIMED turn) pass.
2. `npx vitest run scripts/e2e-admin/probe/replays/shopkeeper-haiku-order-card-action-name.test.mjs scripts/e2e-admin/probe/replays/shopkeeper-haiku-receipt-asked-qty.test.mjs scripts/e2e-admin/probe/replays/shopkeeper-haiku-browse-priced-cards.test.mjs` exits 0, and each fails with the two source files at base.
3. `npx vitest run packages/agent-ui/a2ui scripts/e2e-admin/probe` exits 0.
4. `npm run check` exits 0.
5. `node scripts/measure-size.mjs` exits 0 with `@agent-ui/a2ui/agent` within budget.
6. Model-read text: existing finding and repair strings unchanged except the ProductCard repair's last clause ("drop the hand-built priced rows or cards"); the new strings are the AmountPicker row's asked-quantity sentence ("after the user asked for a quantity, and no AmountPicker on the surface can change it.") and produce.ts CHANGE_CLAIMED_ORDER_HINT.

## Outcome

2026-10-29 · lane: solo L2 · verdict: pass · verifier: verifier-L3 (fable) · base: be8f9dae80e4
- Changed: Hand-built order cards, asked-quantity receipts and hand-built product browses are sent back, closing round 21 clusters P4c, P5c and Q
- Commits: none
- Check: 1 `npx vitest run packages/agent-ui/a2ui/src/catalog/composite-moments.test.ts packages/agent-ui/a2...: pass
- Check: 2 the three replay tests exit 0 and each fails at base: pass
- Check: 3 `npx vitest run packages/agent-ui/a2ui scripts/e2e-admin/probe` exits 0: pass
- Check: 4 `npm run check` exits 0: pass
- Check: 5 `node scripts/measure-size.mjs` exits 0 with `@agent-ui/a2ui/agent` within budget: pass
- Check: 6 model-read text unchanged except the named strings: pass
- Follow-up: note: .sdlc/tickets/0590-order-receipt-and-product-card-gaps/handoff.md:3... -> notes.md
- Follow-up: note: .sdlc/tickets/0590-order-receipt-and-product-card-gaps/handoff.md:2... -> notes.md
- Follow-up: decide: packages/agent-ui/a2ui/src/catalog/composite-moments.ts:431... -> notes.md
- Follow-up: note: scripts/e2e-admin/probe/replays/shopkeeper-haiku-receipt-asked-qty.... -> notes.md
- Follow-up: note: packages/agent-ui/a2ui/src/agent: @agent-ui/a2ui/agent sits at... -> notes.md
