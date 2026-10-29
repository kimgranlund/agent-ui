---
id: T-0550
title: "A cart's ConfirmReceipt with a bound quantity ships its AmountPicker (round 17 cluster P5)"
type: bug             # feature | bug | chore | spike | idea
status: done
size: L2
priority: P2         # P1 | P2 | P3
depends: [T-0532]
created: 2026-10-28
claimed_by: claude:a8ce3b21 2026-10-29
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
On a surface whose words name an order, a cart or a basket, a ConfirmReceipt item whose `quantity` binds a path that no AmountPicker on the surface binds is sent back (SURFACE_MISSING) with a repair asking for one AmountPicker per such line, so the round 17 P5 failure cannot ship.

## Intent
- Do: add the row the round 17 report proposes to `packages/agent-ui/a2ui/src/catalog/composite-moments.ts` (the inverse of T-0478's gate), standing aside for GameHud, StepFlow and BookingForm surfaces like the ConfirmReceipt row; a `composite-moments.test.ts` case from :154 r2's payload (finding on `order`, path `/lamp/qty`) and a negative from :139's payload (AmountPicker bound to the same path, no finding); a keyless replay re-derived from the :154 trace with `--from-trace` (T-0498 precedent) whose r2 now draws the finding.
- Non-goals: other composites; grammar.md (Kim's ruling only).
- Done when: the new cases fail on base and pass after; the replay reproduces the finding; `npm run check`, the catalog tests and the probe tests exit 0; the prompt-equivalence baseline is untouched unless the change requires the deliberate recapture flow (skill a2ui-prompt-authoring), which must then be named in the report.

## Context
Round 17 (`.sdlc/evals/rounds/2026-10-29-r17-pattern/report.md`, PR 2340): 68 of 69, one new cluster. Kim approved the fix 2026-10-28. The report row:

| P5. A cart turn answered note-only is repaired as a ConfirmReceipt with a bound quantity and no AmountPicker, while the reply says "Adjust the quantity below" | 1 failed run: `reach-shopkeeper-cart-amount-haiku-3` (:153, :154) | (c) model, with a (d) check gap | :154 r1 ("Add two of the first one to my order and show me my cart.") answers with a `target` meta line on `shop-lamps-1` and a note only, so CHANGE_CLAIMED fires. r2 resends `shop-lamps-1` with an `order` ConfirmReceipt whose item `quantity` is `{path: "/lamp/qty"}` and no component that writes `/lamp/qty`; the reply promises "Adjust the quantity below". It passes every check but the scenario oracle `expect-component AmountPicker`. Routing is the same on :124, :139 and :154 (`cart-summary` index-only, whose description asks for one AmountPicker per cart line), and :124 and :139 ship ConfirmReceipt plus AmountPicker, so this is a 1 in 3 slip on the repair path, not drift. The T-0478 ConfirmReceipt row in `composite-moments.ts` reads only the opposite shape (AmountPicker lines with no ConfirmReceipt); no row asks for the picker a receipt's bound quantity needs. | catalog semantic check (composite moments) | `packages/agent-ui/a2ui/src/catalog/composite-moments.ts`: an AmountPicker row, the inverse of T-0478's gate: on a surface whose words name an order, a cart or a basket, a ConfirmReceipt item whose `quantity` binds a path that no AmountPicker on the surface binds is SURFACE_MISSING, repair "add ONE AmountPicker per such line, value bound to that quantity path, beside the ConfirmReceipt". Stands aside for GameHud, StepFlow and BookingForm surfaces, as the ConfirmReceipt row does. | a `composite-moments.test.ts` case built from :154 r2's payload (finding on `order`, path `/lamp/qty`) and a negative from :139's payload (AmountPicker bound to the same path: no finding); a fixture re-derived from :154 with `--from-trace` (as T-0498 did) whose r2 now draws the new finding | "A cart's ConfirmReceipt with a bound quantity ships its AmountPicker" (L2) |

## Constraints
The repair and finding text is model-read: Opus author, Fable review (verifier L3). No em dashes. No paid runs.
- Lane: solo because size L2 (steps.py lane)

## Acceptance criteria
verifier: L3
- The AmountPicker row's cases (the :154 r2 finding `SURFACE_MISSING` at `shop-lamps-1:order` naming `/lamp/qty`, the :139 and same-path negatives, the guard bites) pass; 10 of them fail on base 1e59e50b5: `npx vitest run packages/agent-ui/a2ui/src/catalog/composite-moments.test.ts`
- The replay re-derived from :153,:154 draws `SURFACE_MISSING` on round 2 and ships the authored AmountPicker on round 3 (fails on base, rounds 2): `npx vitest run scripts/e2e-admin/probe/replays/shopkeeper-haiku-receipt-no-picker.test.mjs`
- The check contracts and the catalog co-run pins hold: `npx vitest run packages/agent-ui/a2ui/src/live-agent/check-contracts.test.ts packages/agent-ui/a2ui/src/live-agent/chat-validation.test.ts`
- The standing gate is green: `npm run check`
- The producer prompts and the prompt-equivalence baseline are untouched: `git diff --quiet 1e59e50b555c878906c1f066b752ac491b3ab8f9 -- packages/agent-ui/a2ui/src/agent/prompts packages/agent-ui/a2ui/src/live-agent/prompt-equivalence.baseline.json`

## Outcome

2026-10-29 · lane: solo L2 · verdict: pass · verifier: verifier-L3 (fable) · base: 1e59e50b555c
- Changed: A cart or order ConfirmReceipt whose quantity no AmountPicker binds is sent back with a repair asking for one
- Commits: none
- Check: 1 The AmountPicker row's cases pass; 10 of them fail on base 1e59e50b5 (`npx vitest run packages/ag...: pass
- Check: 2 The replay re-derived from :153,:154 draws `SURFACE_MISSING` on round 2 and ships the authored Am...: pass
- Check: 3 The check contracts and the catalog co-run pins hold (`npx vitest run packages/agent-ui/a2ui/src/...: pass
- Check: 4 The standing gate is green (`npm run check`): pass
- Check: 5 The producer prompts and the prompt-equivalence baseline are untouched (`git diff --quiet 1e59e50...: pass
- Follow-up: decide: packages/agent-ui/a2ui/src/catalog/composite-moments.ts:779 decide... -> notes.md
