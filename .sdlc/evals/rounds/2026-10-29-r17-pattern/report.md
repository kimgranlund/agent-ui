# T-0532 live round 17: report

Round 17 ran on 2026-10-29 UTC (03:15 to 03:54) at `28bfcbd3` (main after T-0498 to T-0504), the round 16 matrix rerun unchanged to measure the round 16 fixes: T-0498 (a component moved to a new parent in one batch survives the merge and the reconcile, cluster M), T-0499 and T-0501 (an empty round after a semantic or any forced repair re-sends that repair ask, cluster Q), T-0500 (the probe's new `no-renderer-rejection` check) and T-0503 (the itinerary schedule cue matches all seven weekdays). Kim approved the spend on 2026-10-28.

**69 of 69 runs, 68 passed and 1 failed, $0.66 in the ledger against the $5 cap, stop done, 0 cap skips.** Round 16 was 67 of 69 for $0.67. No turn halted; all 156 turns have outcome ok. No judge run and no fog ingest: the analysis reads the trace lines (`traces/2026-10-29.jsonl`, cited as `:<line>`), the run reports, one keyless replay and the fix tickets' own keyless tests.

## Comparison set
- **Plan:** the same 69 runs as round 16. The generated section is `plan.ts --tag smoke --tag regression --tag long --persona concierge --persona restaurant --persona travel --persona shopkeeper --persona negotiator --persona mentalist --model haiku --samples 3 --cap 5 --round r17-pattern`; a fresh run at this commit matched round 16's 39 lines byte for byte (only `--out` differs).
- **Hand-written section, 30 runs:** round 16's 30 hand-written probes, byte for byte, under a T-0532 comment in `live-commands.sh`.
- **Against round 16:** all 23 cells are shared and no oracle changed. The prompt did not change: every persona's grammar, persona and components section digests equal round 16's (grammar `5f9b7bf9c54c6206`); only the few-shot and mini-skill digest sets per persona differ, from per-turn retrieval. The fixes under test are code-side (merge, renderer, producer repair loop, probe check, cue regex).
- **Prompt digests and exemplars:** `signals.md` (Section digests per persona, Exemplar retrieval per persona).

## Churn against round 16 (generated)

From `npm run eval:signals -- --round 2026-10-29-r17-pattern --against 2026-10-28-r16-pattern --min-samples 1`:

| Transition | Count | Cells | Sample 1 |
| --- | --- | --- | --- |
| fail to pass | 2 | `regress-concierge-spa-booking-haiku`, `smoke-negotiator-first-offer-haiku` | 1 (`regress-concierge-spa-booking-haiku`) |
| pass to fail | 1 | `reach-shopkeeper-cart-amount-haiku` | 0 |
| fail to fail | 0 | | 0 |
| pass to pass | 20 | stable | 22 |

## Per cell

| Cell | Round 16 | Round 17 |
| --- | --- | --- |
| `claim-croupier-rename-table-haiku` | 3 of 3 | 3 of 3 |
| `long-concierge-booking-haiku` | 3 of 3 | 3 of 3 |
| `long-concierge-booking-confirm-haiku` | 3 of 3 | 3 of 3 |
| `long-concierge-facility-hours-haiku` | 3 of 3 | 3 of 3 |
| `long-concierge-spa-services-haiku` | 3 of 3 | 3 of 3 |
| `pick-croupier-game-deck-haiku` | 3 of 3 | 3 of 3 |
| `pick-mentalist-answer-deck-haiku` | 3 of 3 | 3 of 3 |
| `reach-concierge-day-itinerary-haiku` | 3 of 3 | 3 of 3 |
| `reach-concierge-room-stepflow-haiku` | 3 of 3 | 3 of 3 |
| `reach-shopkeeper-cart-amount-haiku` | 3 of 3 | 2 of 3 (sample 3, cluster P5) |
| `reach-shopkeeper-compare-haiku` | 3 of 3 | 3 of 3 |
| `reach-travel-trip-itinerary-haiku` | 3 of 3 | 3 of 3 |
| `regress-concierge-dinner-at-vela-haiku` | 3 of 3 | 3 of 3 |
| `regress-concierge-facilities-then-tour-haiku` | 3 of 3 | 3 of 3 |
| `regress-concierge-spa-booking-haiku` | 2 of 3 | 3 of 3 |
| `smoke-concierge-booking-haiku` | 3 of 3 | 3 of 3 |
| `smoke-croupier-blackjack-deal-haiku` | 3 of 3 | 3 of 3 |
| `smoke-mentalist-first-answer-haiku` | 3 of 3 | 3 of 3 |
| `smoke-negotiator-first-offer-haiku` | 2 of 3 | 3 of 3 |
| `smoke-restaurant-reserve-table-haiku` | 3 of 3 | 3 of 3 |
| `smoke-shopkeeper-browse-and-add-haiku` | 3 of 3 | 3 of 3 |
| `smoke-stylist-palette-haiku` | 3 of 3 | 3 of 3 |
| `smoke-travel-compare-legs-haiku` | 3 of 3 | 3 of 3 |

## Per cluster and preset

By preset, round 17 (round 16): concierge 30 of 30 (29), croupier 9 of 9 (9), mentalist 6 of 6 (6), negotiator 3 of 3 (2), restaurant 3 of 3 (3), shopkeeper 8 of 9 (9), stylist 3 of 3 (3), travel 6 of 6 (6). All: 68 of 69 (67).

| Cluster | Round 16 | Round 17 |
| --- | --- | --- |
| M (moved child, `smoke-negotiator-first-offer-haiku`) | 2 of 3, 1 failed run | 3 of 3, 0 failed runs |
| Q (empty repair round, `regress-concierge-spa-booking-haiku`) | 2 of 3, 1 failed run | 3 of 3, 0 failed runs |
| P5 (new: cart repair without its AmountPicker, `reach-shopkeeper-cart-amount-haiku`) | 3 of 3, 0 failed runs | 2 of 3, 1 failed run |

Trace tallies, all samples, round 17 (round 16): halted turns 0 (0); SURFACE_DEGRADED turns 0 (1); SEMANTIC_UNCORRECTED turns 0 (1); PARSE 4 rounds on 4 turns, 4 saved (7 on 7, 6 saved); SURFACE_MISSING 21 rounds on 21 turns, 21 saved, 0 reply-only repairs (17, 1 reply-only); SURFACE_CLAIMED 2, saved (3); CHANGE_CLAIMED 3, saved (3); SURFACE_DROPPED 2, saved (0); ACTION_NOT_APPLIED 4, saved (2); IDGRAPH 1, saved (3); CATALOG 3, saved (4); string `messages` rounds 8 (8). Every fired code was saved this round.

## Cost

$0.65952 estimated at list prices in `round.json` `totals.costUsd` (156 trace lines; 1,017,520 input, 295,280 output, 3,509,264 cache read and 473,614 cache creation tokens), against the $5 cap; round 16 was $0.67. Per turn $0.004, latency p50 8.3 s and p90 15.4 s (round 16: 8.6 s and 20.2 s; `signals.md`). The keyless replay and tests below cost nothing.

## The round 16 fixes, before and after

| Cluster or fix | Fix | Round 16 | Round 17 | Verdict | Evidence |
|---|---|---|---|---|---|
| M. A child moved to a new parent in one batch read as a dangling id | T-0498 | `smoke-negotiator-first-offer-haiku` 2 of 3, :84 IDGRAPH `ask_row->walk` in all three rounds | 3 of 3; the second turns :10, :47, :84 ship (two after an ACTION_NOT_APPLIED repair) | holds, not exercised live | No run in round 17 moved a component to a new parent: a parent-map scan of every round of every run finds 0 moves (the same scan finds round 16's :84 move in r1, r2 and r3). The keyless proof is T-0498's re-derived replay `negotiator-haiku-move-under-row.test.mjs`, 1 passed at this commit. |
| Q. An empty round after a semantic repair got the PARSE hint and the confirm shipped in prose | T-0499 | `regress-concierge-spa-booking-haiku` 2 of 3, :13 SEMANTIC_UNCORRECTED | 3 of 3; the confirm turn :13 ships a ConfirmReceipt in round 1 | holds, not exercised live | One empty round in 156 turns (:31 r1), a first round, so PARSE was the right code; its r2 answered note-only, drew SURFACE_MISSING, and r3 shipped. No empty round followed a repair. SURFACE_MISSING repairs 21 of 21 saved, 0 reply-only (round 16: 1 of 17 reply-only). `produce-empty-repair.test.ts` 8 passed at this commit. |
| Every other forced repair keeps its ask after an empty round | T-0501, T-0504 | (no live failure; hardening) | SURFACE_DROPPED 2 of 2 (:24, :96), SURFACE_CLAIMED 2 of 2 (:7, :78), CHANGE_CLAIMED 3 of 3 (:6, :141, :154) saved | holds, not exercised live | No empty round followed any of these repairs; the same `produce-empty-repair.test.ts` cases cover them. |
| `no-renderer-rejection` probe check | T-0500 | (not in the probe) | 156 of 156 turns pass | passes, no rejection to catch | No `report.json` holds a page-fired step (`"page"`), so the page never rejected a shipped payload this round. |
| Weekday schedule cue | T-0503 | ITINERARY_MISSING fired once (:135), saved | `reach-concierge-day-itinerary-haiku` 3 of 3, each in round 1 (:120, :135, :150); ITINERARY_MISSING fired 0 times; no booking turn drew it | holds, not exercised | The scenario's weekday already matched before T-0503, so the round neither needed nor tested the wider cue. |

## Pattern controls (round 17, Haiku)

| Control | Verdict | Metric |
|---|---|---|
| OptionDeck | holds | Croupier and mentalist pick cells 6 of 6; one OPTION_DECK_COUNT repair (:131) saved, one cross-turn `ask-1:root` IDGRAPH (:146) saved. |
| OptionCompare | holds, fewer repairs | Travel 3 of 3, shopkeeper compare 3 of 3. 4 of 6 ship in round 1 (:4, :122, :137, :152; round 16: 3 of 6); :41 needs a PARSE repair and :78 a SURFACE_CLAIMED one. |
| ConfirmReceipt | holds | Concierge confirm turns 18 of 18 (round 16: 17 of 18). Shopkeeper add turns 6 of 6 ship one. |
| AmountPicker | slips once on a cart turn | Negotiator deal sheet with its GameHud 6 of 6 turns. Shopkeeper cart lines on :124 and :139, missing on :154 (cluster P5). |
| StepFlow | holds | Room booking 3 of 3 (:119, :134, :149). |
| Itinerary | holds | Concierge day plan 3 of 3, travel trip 3 of 3 (:121, :136, :151). |

## Why it failed and how to fix it

The failing run reproduces keylessly: `npm run chat:probe -- --replay .sdlc/evals/rounds/2026-10-29-r17-pattern/runs/reach-shopkeeper-cart-amount-haiku-3/fixture.json --expect-component AmountPicker` exits 1 with the same failed check. A replay of a live run fixture plays the recorded wire lines, so it shows recorded behaviour, not today's code; replaying round 16's two failed runs that way still fails for that reason, and is no evidence about T-0498 or T-0499 (their re-derived tests are). The row below is a proposal for Kim, not filed.

| Cluster | Runs | Class | Evidence | Fix layer | File | Keyless test that proves it | Proposed ticket |
|---|---|---|---|---|---|---|---|
| P5. A cart turn answered note-only is repaired as a ConfirmReceipt with a bound quantity and no AmountPicker, while the reply says "Adjust the quantity below" | 1 failed run: `reach-shopkeeper-cart-amount-haiku-3` (:153, :154) | (c) model, with a (d) check gap | :154 r1 ("Add two of the first one to my order and show me my cart.") answers with a `target` meta line on `shop-lamps-1` and a note only, so CHANGE_CLAIMED fires. r2 resends `shop-lamps-1` with an `order` ConfirmReceipt whose item `quantity` is `{path: "/lamp/qty"}` and no component that writes `/lamp/qty`; the reply promises "Adjust the quantity below". It passes every check but the scenario oracle `expect-component AmountPicker`. Routing is the same on :124, :139 and :154 (`cart-summary` index-only, whose description asks for one AmountPicker per cart line), and :124 and :139 ship ConfirmReceipt plus AmountPicker, so this is a 1 in 3 slip on the repair path, not drift. The T-0478 ConfirmReceipt row in `composite-moments.ts` reads only the opposite shape (AmountPicker lines with no ConfirmReceipt); no row asks for the picker a receipt's bound quantity needs. | catalog semantic check (composite moments) | `packages/agent-ui/a2ui/src/catalog/composite-moments.ts`: an AmountPicker row, the inverse of T-0478's gate: on a surface whose words name an order, a cart or a basket, a ConfirmReceipt item whose `quantity` binds a path that no AmountPicker on the surface binds is SURFACE_MISSING, repair "add ONE AmountPicker per such line, value bound to that quantity path, beside the ConfirmReceipt". Stands aside for GameHud, StepFlow and BookingForm surfaces, as the ConfirmReceipt row does. | a `composite-moments.test.ts` case built from :154 r2's payload (finding on `order`, path `/lamp/qty`) and a negative from :139's payload (AmountPicker bound to the same path: no finding); a fixture re-derived from :154 with `--from-trace` (as T-0498 did) whose r2 now draws the new finding | "A cart's ConfirmReceipt with a bound quantity ships its AmountPicker" (L2) |

**Single-run notes, no cluster:** :31 opens with an empty round (no text, no tool, `end_turn`) and is saved by PARSE then SURFACE_MISSING in r3. :17 is a PARSE round (a JSON line cut at column 481) saved the same way. SURFACE_DROPPED, absent in round 16, fires twice (:24, :96), both saved in one repair. CONTRAST_PAIR_WRAPPED fires on all three stylist turns again (:114, :129, :144), each saved: no fail, a standing cost.

**Observed against inferred:** codes, rounds, tool inputs, meta lines and replies are on the trace lines; the failure reproduces keylessly; the move scan and the empty-round count are computed from every round of every trace line. Inferred: that the proposed row would have sent :154 back for an AmountPicker (it is built from the recorded payload, not run).

Bounded experiment for the proposed ticket, measured on the same runs: the unit tests and the re-derived :154 replay, then `reach-shopkeeper-cart-amount-haiku` and `smoke-shopkeeper-browse-and-add-haiku`, 3 samples each.

## Tickets
None filed by this round (the solo seat files none). Proposed: P5, as in the table above.

## Process notes
- **Batches:** a probe took about 15 s to 1.5 min; `--max 12` to `--max 15` batches fit the 10 minute foreground limit, and each restart skipped every run that already had a report. `ledger.jsonl` merged the batches into one 69-run round.
- **live-commands.sh:** assembled outside the archive from a fresh `plan.ts` run plus round 16's hand-written section with the round paths changed and the T-0532 comment; the runner copied it in with `--round r17-pattern`.
- **Worktree key:** the lane's `.env` is a symlink to the main checkout's file (never read); the first run proved it.
