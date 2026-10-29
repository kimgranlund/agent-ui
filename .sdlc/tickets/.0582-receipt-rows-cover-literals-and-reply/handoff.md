---
id: T-0582
title: "The AmountPicker and order-receipt rows read literal and rows quantities and the reply's words"
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
Round 19 clusters P5b and P4b close: the T-0550 AmountPicker row reads a cart receipt's quantity given as a literal or through a `rows` path, and the T-0478 order-receipt row's words gate also reads the reply.

## Intent
- Do: both fixes in `packages/agent-ui/a2ui/src/catalog/composite-moments.ts` as the rows below propose, keyless tests that fail on base with false-positive guards, and `--from-trace` replays of the failing runs (copy the r19 traces to a temp `.agent-traces/` and remove them after).
- Done when: the new tests fail on base and pass after; the replays pass after; the a2ui suites, probe replays and `npm run check` exit 0.

## Context
Round 19 report (`.sdlc/evals/rounds/2026-10-29-r19-pattern/report.md`, PR 2386; until it merges, read it at `../agent-ui.worktrees/T-0581-wave-w0581/.sdlc/evals/rounds/2026-10-29-r19-pattern/`). Kim approved these fixes 2026-10-29.

| P5b. A cart receipt ships without its AmountPicker when the quantity is a literal or read through `rows`, so the T-0550 row stays silent while the reply says the quantity can be changed | 2: `reach-shopkeeper-cart-amount-haiku-2` (:139), `-3` (:154) | (c) model, with a (b) check gap | :139 r2 (the CHANGE_CLAIMED repair) ships `order` ConfirmReceipt with `items: [{label, quantity: 2, amount: "$378"}]` (a literal) and no AmountPicker; reply "You can change the quantity below". :154 r3 ships the receipt with `rows: [{label, path: "/order/brass"}]` and data `/order/brass = 2`, no `items`, no AmountPicker; reply "Adjust the quantity below". The T-0550 `unpickedLines` row reads only `items[].quantity` bound to a path (`composite-moments.ts` near line 717), so neither shape is a finding. Round 18's report flagged the literal shape at :43 r2 as one to watch. | catalog semantic check | `packages/agent-ui/a2ui/src/catalog/composite-moments.ts`, the T-0550 AmountPicker row: also count a ConfirmReceipt `rows[].path` line, and a literal `items[].quantity`, as an unpicked quantity line when the turn's reply offers to change the quantity (the row already sits behind the order, cart or basket words gate) | `composite-moments.test.ts` cases from :139 r2 and :154 r3's payloads with their replies: each yields SURFACE_MISSING for AmountPicker; negatives: the same payloads with a reply that offers no quantity change, and a receipt whose `status` is not pending, yield none | "A cart receipt's literal or rows quantity with a quantity-change reply asks for its AmountPicker" (L2) |

| P4b. An order read back as a hand-built Card (DescriptionList, AmountPicker, total Text) with no ConfirmReceipt passes the T-0478 row because the surface's words never say order, cart or basket | 1: `smoke-shopkeeper-browse-and-add-haiku-2` (:43) | (c) model, with a (b) check gap | :43 r1 is note-only ("Added the Brass Desk Lamp..."), CHANGE_CLAIMED fires; r2 ships `shop-1` with an `order` Card holding `order_lines` DescriptionList, `order_picker` AmountPicker (label "Brass Desk Lamp quantity") and Text "Total: $68"; reply "Your order summary is below the shelf". The T-0478 ConfirmReceipt row's `inputCue` matches the AmountPicker label ("quantity") but its `words` gate (`/\b(order|cart|basket)\b/i`) tests `surfaceWords` only (`composite-moments.ts` near line 648); "order" appears only in component ids and the reply, so no finding. | catalog semantic check | `packages/agent-ui/a2ui/src/catalog/composite-moments.ts`, the T-0478 row: let the `inputCue.words` gate also read the turn's reply, as the Swatch row's `prose` check does | `composite-moments.test.ts` case from :43 r2's payload with its reply: SURFACE_MISSING for ConfirmReceipt; negatives: the T-0480 tip AmountPicker bill with a "Total" Text and a reply naming no order stays clean, and a negotiator GameHud deal sheet stays clean | "An order the reply names asks for its ConfirmReceipt even when the surface words do not" (L2) |

## Constraints
No em dashes. No paid runs. Model-read text unchanged; never rewrite a round archive.
- Lane: solo because size L2 (steps.py lane)

## Acceptance criteria
- `npx vitest run packages/agent-ui/a2ui/src/catalog/composite-moments.test.ts` exits 0; its T-0582 positives (:139 r2 literal and :154 r3 rows with their replies yield SURFACE_MISSING on `order`; :43 r2 with its reply yields CONFIRM_RECEIPT_MISSING) fail with base `composite-moments.ts`, and its negatives (no reply, a no-offer reply, a non-pending status, a non-numeric rows line, a picker on the surface, no order word, the tip bill, the GameHud deal sheet, the guess TextField row) yield none.
- `npx vitest run scripts/e2e-admin/probe/replays/shopkeeper-haiku-receipt-literal-qty.test.mjs scripts/e2e-admin/probe/replays/shopkeeper-haiku-receipt-rows-qty.test.mjs scripts/e2e-admin/probe/replays/shopkeeper-haiku-order-card-reply-words.test.mjs` exits 0: fixtures derived with `--from-trace` from 2026-10-29.jsonl:138,139, :153,154 and :42,43; each fails with base `composite-moments.ts`.
- `npx vitest run packages/agent-ui/a2ui scripts/e2e-admin/probe` exits 0.
- `npm run check` exits 0.
- Model-read text: the existing finding and repair strings are unchanged; the one new string is the literal-quantity SURFACE_MISSING message.

## Outcome

2026-10-29 · lane: solo L2 · verdict: pass · verifier: verifier-L3 (fable) · base: 219f14a51a91
- Changed: The AmountPicker row reads literal and rows quantities and the order-receipt row reads the reply, closing round 19 clusters P5b and P4b
- Commits: none
- Check: 1 `npx vitest run packages/agent-ui/a2ui/src/catalog/composite-moments.test.ts` exits 0; positives ...: pass
- Check: 2 the three `--from-trace` replays exit 0 and each fails on base: pass
- Check: 3 `npx vitest run packages/agent-ui/a2ui scripts/e2e-admin/probe` exits 0: pass
- Check: 4 `npm run check` exits 0: pass
- Check: 5 existing finding and repair strings unchanged; the one new string is the literal-quantity SURFACE...: pass
- Follow-up: decide: .sdlc/tickets/0582-receipt-rows-cover-literals-and-reply/handoff.md... -> notes.md
- Follow-up: decide: scripts/e2e-admin/probe/replays/shopkeeper-haiku-receipt-rows-qty.t... -> notes.md
- Follow-up: decide: packages/agent-ui/a2ui/src/catalog/composite-moments.ts:742 decide... -> notes.md
- Follow-up: decide: packages/agent-ui/a2ui/src/catalog/composite-moments.ts:758 note: a... -> notes.md
