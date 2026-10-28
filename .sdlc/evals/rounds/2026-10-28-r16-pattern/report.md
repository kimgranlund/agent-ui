# T-0486 live round 16: report

Round 16 ran on 2026-10-28 UTC (16:25 to 17:01) at `eb742cd0` (main after T-0478 to T-0485), the round 15 matrix rerun unchanged to measure the round 15 fixes: T-0478 (CONFIRM_RECEIPT_MISSING on a storefront add turn, and "is in your order" or "in your cart" as add claims, cluster P4), T-0479 and T-0482 (GAME_HUD_MISSING judges any play control and any game catalog with a GameHud; grammar.md says a game's ask turn sends or updates its HUD, cluster W2), T-0480 and T-0484 (ITINERARY_MISSING for a timed day plan, and its booking-ask negative, cluster Y), T-0481 (claim regex negatives) and T-0485 (SemanticCheck `requiresAny`). Trace line numbers (`:n`) are 1-based lines of `traces/2026-10-28.jsonl`.

**69 of 69 runs, 67 passed and 2 failed, $0.67 in the ledger against the $5 cap, stop done, 0 cap skips.** No turn halted (round 15: 0); all 156 turns have outcome ok. No judge run and no fog ingest: the analysis reads the trace lines, the run reports, two keyless replays, an offline validator run and the producer and renderer source.

## Comparison set
- **Plan:** the same 69 runs as round 15. The generated section is `plan.ts --tag smoke --tag regression --tag long --persona concierge --persona restaurant --persona travel --persona shopkeeper --persona negotiator --persona mentalist --model haiku --samples 3 --cap 5 --round r16-pattern`; regenerated at this commit, its 39 commands match round 15's byte for byte once `--out` is set aside.
- **Hand-written section, 30 runs:** round 15's 10 hand-written probes, 3 samples each, byte for byte, under a T-0486 comment in `live-commands.sh`.
- **Against round 15:** all 23 cells are shared and no oracle changed. The prompt changed for every persona: the grammar section digest moved from `4148a708bd220d4e` to `5f9b7bf9c54c6206` (T-0482's grammar.md line); persona and components digests for concierge and negotiator are unchanged. The other fixes are checks, not prompt text.
- **Prompt digests and exemplars:** `signals.md` (Section digests per persona, Exemplar retrieval per persona).

## Churn against round 15 (generated)

From `npm run eval:signals -- --round 2026-10-28-r16-pattern --against 2026-10-26-r15-pattern --min-samples 1`:

| Transition | Count | Cells | Sample 1 |
| --- | --- | --- | --- |
| fail to pass | 3 | `reach-concierge-day-itinerary-haiku`, `reach-shopkeeper-cart-amount-haiku`, `smoke-shopkeeper-browse-and-add-haiku` | 2 (`smoke-negotiator-first-offer-haiku`, `smoke-shopkeeper-browse-and-add-haiku`) |
| pass to fail | 1 | `regress-concierge-spa-booking-haiku` | 1 (`regress-concierge-spa-booking-haiku`) |
| fail to fail | 1 | `smoke-negotiator-first-offer-haiku` | 0 |
| pass to pass | 18 | stable | 20 |

## Per cell

| Cell | Round 15 | Round 16 |
| --- | --- | --- |
| `claim-croupier-rename-table-haiku` | 3 of 3 | 3 of 3 |
| `long-concierge-booking-haiku` | 3 of 3 | 3 of 3 |
| `long-concierge-booking-confirm-haiku` | 3 of 3 | 3 of 3 |
| `long-concierge-facility-hours-haiku` | 3 of 3 | 3 of 3 |
| `long-concierge-spa-services-haiku` | 3 of 3 | 3 of 3 |
| `pick-croupier-game-deck-haiku` | 3 of 3 | 3 of 3 |
| `pick-mentalist-answer-deck-haiku` | 3 of 3 | 3 of 3 |
| `reach-concierge-day-itinerary-haiku` | 2 of 3 | 3 of 3 |
| `reach-concierge-room-stepflow-haiku` | 3 of 3 | 3 of 3 |
| `reach-shopkeeper-cart-amount-haiku` | 2 of 3 | 3 of 3 |
| `reach-shopkeeper-compare-haiku` | 3 of 3 | 3 of 3 |
| `reach-travel-trip-itinerary-haiku` | 3 of 3 | 3 of 3 |
| `regress-concierge-dinner-at-vela-haiku` | 3 of 3 | 3 of 3 |
| `regress-concierge-facilities-then-tour-haiku` | 3 of 3 | 3 of 3 |
| `regress-concierge-spa-booking-haiku` | 3 of 3 | 2 of 3 |
| `smoke-concierge-booking-haiku` | 3 of 3 | 3 of 3 |
| `smoke-croupier-blackjack-deal-haiku` | 3 of 3 | 3 of 3 |
| `smoke-mentalist-first-answer-haiku` | 3 of 3 | 3 of 3 |
| `smoke-negotiator-first-offer-haiku` | 2 of 3 | 2 of 3 (a different failure, on the second turn) |
| `smoke-restaurant-reserve-table-haiku` | 3 of 3 | 3 of 3 |
| `smoke-shopkeeper-browse-and-add-haiku` | 2 of 3 | 3 of 3 |
| `smoke-stylist-palette-haiku` | 3 of 3 | 3 of 3 |
| `smoke-travel-compare-legs-haiku` | 3 of 3 | 3 of 3 |

By preset, round 16 (round 15): concierge 29 of 30 (29), croupier 9 of 9 (9), mentalist 6 of 6 (6), negotiator 2 of 3 (2), restaurant 3 of 3 (3), shopkeeper 9 of 9 (7), stylist 3 of 3 (3), travel 6 of 6 (6). All: 67 of 69 (65).

Trace tallies, all samples, round 16 (round 15): halted turns 0 (0); PARSE 7 rounds on 7 turns, 6 saved (4 on 4, 4 saved); string `messages` rounds 8 (3); SURFACE_DEGRADED turns 1 (0); SURFACE_CLAIMED 3 rounds on 3 turns, 3 saved (10 on 10); CHANGE_CLAIMED 3 rounds, 3 saved (3); SURFACE_MISSING 17 on 17, 16 saved (17 on 17, all saved); IDGRAPH 3 rounds on 2 turns, 1 saved; ITINERARY_MISSING 1, saved; GAME_HUD_MISSING 0; CONFIRM_RECEIPT_MISSING 0.

## Cost

$0.671607 estimated at list prices in `round.json` `totals.costUsd` (156 trace lines; 1,015,310 input, 318,522 output, 3,561,995 cache read and 436,922 cache creation tokens), against the $5 cap; round 15 was $0.66. Per turn $0.004, latency p50 8.6 s and p90 20.2 s (`signals.md`). The two keyless replays and the offline validator run cost nothing.

## The round 15 clusters, before and after

| Cluster (round 15) | Fix | Round 15 | Round 16 | Verdict | Evidence |
|---|---|---|---|---|---|
| W2. A Negotiator opening answered note-only is repaired as its offer card alone, with no GameHud | T-0479, T-0482, T-0485 | `smoke-negotiator-first-offer-haiku` 2 of 3, failing on the opening turn | the opening turn ships `hud-1` with a GameHud and `ask-1` with an AmountPicker 3 of 3 (:9, :46, :83) in round 1 | holds on the opening turn, but the check was not exercised: GAME_HUD_MISSING fired 0 times. The cell still fails 1 of 3, on its second turn (cluster M below) | :9, :46 and :83 have no retry code; the grammar digest moved with T-0482. |
| P4. A shopkeeper add turn ships no ConfirmReceipt | T-0478, T-0481 | `smoke-shopkeeper-browse-and-add-haiku` 2 of 3, `reach-shopkeeper-cart-amount-haiku` 2 of 3 | 3 of 3 and 3 of 3; add turns ship a ConfirmReceipt 6 of 6 (:6, :43, :80, :124, :139, :154) | holds | CHANGE_CLAIMED fired on :6 and :80 and both repairs ship a ConfirmReceipt. CONFIRM_RECEIPT_MISSING fired 0 times. |
| Y. A fully specified day plan is answered with a clarifying ask deck and no Itinerary | T-0480, T-0484 | `reach-concierge-day-itinerary-haiku` 2 of 3 | 3 of 3 | holds, exercised once | ITINERARY_MISSING fired on :135 and its repair ships the Itinerary `saturday-plan`; :120 and :150 ship one in round 1. No booking turn drew ITINERARY_MISSING (the T-0484 negative). |

## Pattern controls (round 16, Haiku)

| Control | Verdict | Metric |
|---|---|---|
| OptionDeck | holds | Croupier and mentalist pick cells 6 of 6. |
| OptionCompare | holds, fewer repairs | Travel 3 of 3 (:4, :41, :78), shopkeeper compare 3 of 3 (:122, :137, :152). 3 of 6 now ship in round 1 (round 15: 0 of 6); :4, :78 and :137 need a SURFACE_CLAIMED repair. |
| ConfirmReceipt | shopkeeper holds; concierge slips once | Shopkeeper add turns 6 of 6 (round 15: 4 of 6). Concierge confirm turns 17 of 18; :13 is cluster Q. SURFACE_MISSING fires on 8 confirm turns (:2, :28, :50, :91, :97, :102, :105 saved; :13 not). |
| AmountPicker | slips once on the negotiator's second turn | Negotiator deal sheet with its GameHud 5 of 6 turns (:9, :10, :46, :47, :83); :84 is cluster M. Shopkeeper cart lines on :43, :124, :139, :154. |
| StepFlow | holds | Room booking 3 of 3 (:119, :134, :149). |
| Itinerary | holds | Concierge day plan 3 of 3 (:120, :135, :150), travel trip 3 of 3 (:121, :136, :151). |

## Why it failed and how to fix it

Both failing runs reproduce keylessly: `npm run chat:probe -- --replay .sdlc/evals/rounds/2026-10-28-r16-pattern/runs/<run>/fixture.json` exits 1 with the same failed checks. Each row below is a proposal for Kim, not filed.

| Cluster | Runs | Class | Evidence | Fix layer | File | Keyless test that proves it | Proposed ticket |
|---|---|---|---|---|---|---|---|
| M. A component moved to a new parent in the same `updateComponents` batch is disposed by the reconcile, so a valid payload reads as a dangling id | 1 failed run: `smoke-negotiator-first-offer-haiku-3` (:83, :84) | (b) renderer and validator mirror defect | :83 builds `ask-1` with `ask_ft` (CardFooter) whose `child` is `walk`. :84 resends `ask-1` with `ask_ft.child` = `ask_row`, a new Row whose `children` are `accept` and `walk`, and resends `walk` itself. All three rounds send that same tree and all three get `IDGRAPH ask_row->walk`; the turn ships nothing (IDGRAPH, SURFACE_DEGRADED) and the probe fails `action-updates-surface` and the GameHud oracle. The payload alone validates clean (`validate-payload.ts` exits 0); seeded with :83's `ask-1` it fails. Cause, from source: `applyComponentBatch` upserts `walk`, then reconciles the resent mounted `ask_ft`, finds `walk` dropped from its children and disposes it, though `ask_row` in the same batch names it. `tree.ts` `#reconcileNode` and `#reconcileChildren` do the same in the browser, so the renderer would lose `walk` too. | renderer reconcile, with its server mirror | `packages/agent-ui/a2ui/src/renderer/component-merge.ts` (`applyComponentBatch`: do not dispose a dropped child the merged graph still references or the batch redelivers) and `packages/agent-ui/a2ui/src/renderer/tree.ts` (`#reconcileChildren`: move such a child's widget to its new parent instead of disposing it). Cheaper stopgap: an IDGRAPH `dangling` hint in `produce.ts` for a dangling id the same payload defines ("a moved child needs a new id") | a new `component-merge.test.ts` case (seed `ask_ft.child = walk`, batch `ask_ft.child = ask_row`, `ask_row.children = [accept, walk]`, `walk` resent: `walk` survives); a `validate.test.ts` case for the seeded pair; the :84 replay ships `ask-1` in round 1 and exits 0 | "A child moved to a new parent in one batch survives the reconcile" (L3: renderer behaviour) |
| Q. A confirm turn's forced SURFACE_MISSING repair comes back empty and the PARSE round after it answers note-only, so the confirm ships in prose | 1 failed run: `regress-concierge-spa-booking-haiku-1` (:13) | (c) model, with a (d) repair-path gap | :13 r1 answers "Those details are right, please confirm the booking." with a `target` meta line and prose, no tool (SURFACE_MISSING; the hint asks for a ConfirmReceipt re-creating `spa-booking`). r2 (thinking 0 characters, so the forced render_surface round) ends `end_turn` with 483 output tokens, no text and no tool call, and is filed as PARSE. r3 gets the PARSE hint, not the SURFACE_MISSING ask again, and answers note-only with `flowEnd`; it is the last round, so the note ships with SEMANTIC_UNCORRECTED and no surface. Why r2 is empty is not on the trace line (observed: no text, no tools, `end_turn`). | producer repair loop | `packages/agent-ui/a2ui/src/agent/produce.ts` (an empty round, no text and no tool, after a semantic repair keeps the earlier failure: re-send the SURFACE_MISSING ask and keep `forceSurfaceRound`, instead of the line-mode PARSE hint) | a unit test in `produce.test.ts` with a scripted adapter (r1 prose plus target meta on a confirm turn, r2 empty): r3's request carries the SURFACE_MISSING repair text and `toolChoice` render_surface | "An empty repair round keeps the semantic failure it was repairing" (L2) |

**Single-run notes, no cluster:** :131 recovers from a cross-turn `ask-1:root` IDGRAPH in round 2 and passes; :85 needs PRODUCT_CARD_MISSING and CATALOG rounds and ships with SURFACE_REPLACED, and passes; :8 and :82 recover from ACTION_NOT_APPLIED and pass. String `messages` rounds rose from 3 to 8; each was decoded (MESSAGES_STRING_DECODED on 5 shipped turns) and none failed a run. CONTRAST_PAIR_WRAPPED fires on all three stylist turns (:114, :129, :144), each saved in one repair: no fail, a cost to watch.

**Observed against inferred:** codes, rounds, tool inputs, meta lines and replies are on the trace lines, and both failures reproduce keylessly. The M mechanism is reproduced offline with `validate-payload.ts` (the :84 payload alone passes; seeded with :83's `ask-1` it fails `ask_row->walk`) and read from `component-merge.ts` and `tree.ts`. Inferred: that the browser renderer loses `walk` the same way (from `tree.ts`, not run), and that a resend of the SURFACE_MISSING ask would have moved :13's r3.

Bounded experiment per proposed ticket, measured on the same runs:
- **M:** the unit tests and the :84 replay, then `smoke-negotiator-first-offer-haiku`, 3 samples.
- **Q:** the unit test, then `regress-concierge-spa-booking-haiku` and `long-concierge-booking-confirm-haiku`, 3 samples each.

## Tickets
None filed by this round (the solo seat files none). Proposed, one per cluster: M and Q, as in the table above.

## Process notes
- **Batches:** a probe took about 15 s to 1.5 min; `--max 10` to `--max 16` batches fit the 10 minute foreground limit, and each restart skipped every run that already had a report. `ledger.jsonl` merged the batches into one 69-run round.
- **live-commands.sh:** written straight into the round folder from round 15's file with the round paths changed and the T-0486 comment; the generated 39 lines were checked against a fresh `plan.ts` run at this commit.
- **Worktree key:** the lane's `.env` is a symlink to the main checkout's file (never read); the first run proved it.
