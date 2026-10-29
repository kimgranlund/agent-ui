# T-0589 live round 21: report

Round 21 ran on 2026-10-29 UTC (22:50 to 23:24) at `be8f9dae` (main after T-0585, T-0586, T-0587 and T-0588, PRs 2390 to 2393), the round 20 matrix rerun unchanged to measure the round 20 cluster fixes: the meta-line note read and the "started your order" branch of `CHANGE_CLAIM_IN_REPLY` (cluster Z), the CardTable row for a game pick (cluster G), the bindable ProductCard `actionLabel` (cluster S part 1) and heal's stray envelope `surfaceId` move (cluster S part 2). Kim approved the spend on 2026-10-29.

**69 of 69 runs, 63 passed and 6 failed, $0.68 in the ledger against the $5 cap, stop done, 0 cap skips.** Round 20 was 64 of 69 for $0.68. So the answer to the ticket's question is no: the matrix did not reach 68 or 69. The two cells round 20 lost to G and S recovered (pick-croupier-game-deck 1 to 3 of 3, facilities-then-tour 1 to 3 of 3) and Z has no failed run, but the shopkeeper add turn lost four runs to P4b and P5b recurrences and a new string-repair cluster J, the stylist lost one run to J, and a negotiator run lost its first turn to a GAME_HUD_MISSING repair (cluster H).

## Comparison set
- **Plan:** the same 69 runs as rounds 16 to 20. The generated section is `plan.ts --tag smoke --tag regression --tag long --persona concierge --persona restaurant --persona travel --persona shopkeeper --persona negotiator --persona mentalist --model haiku --samples 3 --cap 5 --round r21-pattern`; a fresh run at this commit matched round 20's 39 lines byte for byte once `--out` was normalized to `runs/<name>`.
- **Hand-written section, 30 runs:** round 20's 30 hand-written probes with the round paths changed, under a T-0589 comment. All 69 `chat:probe` lines equal round 20's once the round slug is normalized.
- **Against round 20:** all 23 cells are shared and no oracle changed. Prompt section digests equal round 20's for every persona except one croupier mini-skills digest in the per-turn set (`signals.md`); grammar and every persona digest are unchanged. Exemplar retrieval moved on two croupier rows: `frontier-option-compare-legs` 3 to 0 turns and `frontier-review-split` 0 to 3.
- **Code between the commits** (`git diff --stat b97e7cf47 be8f9dae8 -- packages/agent-ui/a2ui/src scripts`): `produce.ts` (T-0585 meta-note read, T-0588 note), `catalog/composite-moments.ts` (T-0586 CardTable row), `catalog/default/catalog.json` and `factories.ts` (T-0587), `corpus/heal.ts` (T-0588 arm), plus their tests and replay fixtures.

## Churn against round 20 (generated)

From `npm run eval:signals -- --round 2026-10-29-r21-pattern --against 2026-10-29-r20-pattern --min-samples 1`:

| Transition | Count | Cells | Sample 1 |
| --- | --- | --- | --- |
| fail to pass | 2 | `pick-croupier-game-deck-haiku`, `regress-concierge-facilities-then-tour-haiku` | 0 |
| pass to fail | 3 | `reach-shopkeeper-cart-amount-haiku`, `smoke-negotiator-first-offer-haiku`, `smoke-stylist-palette-haiku` | 1 (`reach-shopkeeper-cart-amount-haiku`) |
| fail to fail | 1 | `smoke-shopkeeper-browse-and-add-haiku` | 0 |
| pass to pass | 17 | stable | 22 |

The fail to fail cell fails for a different reason than in round 20: Z there, P4b (twice) here.

## Per cell

| Cell | Round 20 | Round 21 |
| --- | --- | --- |
| `claim-croupier-rename-table-haiku` | 3 of 3 | 3 of 3 |
| `long-concierge-booking-haiku` | 3 of 3 | 3 of 3 |
| `long-concierge-booking-confirm-haiku` | 3 of 3 | 3 of 3 |
| `long-concierge-facility-hours-haiku` | 3 of 3 | 3 of 3 |
| `long-concierge-spa-services-haiku` | 3 of 3 | 3 of 3 |
| `pick-croupier-game-deck-haiku` | 1 of 3 (G) | 3 of 3 |
| `pick-mentalist-answer-deck-haiku` | 3 of 3 | 3 of 3 |
| `reach-concierge-day-itinerary-haiku` | 3 of 3 | 3 of 3 |
| `reach-concierge-room-stepflow-haiku` | 3 of 3 | 3 of 3 |
| `reach-shopkeeper-cart-amount-haiku` | 3 of 3 | 1 of 3 (sample 1 P5b, sample 2 J) |
| `reach-shopkeeper-compare-haiku` | 3 of 3 | 3 of 3 |
| `reach-travel-trip-itinerary-haiku` | 3 of 3 | 3 of 3 |
| `regress-concierge-dinner-at-vela-haiku` | 3 of 3 | 3 of 3 |
| `regress-concierge-facilities-then-tour-haiku` | 1 of 3 (S) | 3 of 3 |
| `regress-concierge-spa-booking-haiku` | 3 of 3 | 3 of 3 |
| `smoke-concierge-booking-haiku` | 3 of 3 | 3 of 3 |
| `smoke-croupier-blackjack-deal-haiku` | 3 of 3 | 3 of 3 |
| `smoke-mentalist-first-answer-haiku` | 3 of 3 | 3 of 3 |
| `smoke-negotiator-first-offer-haiku` | 3 of 3 | 2 of 3 (sample 2, H) |
| `smoke-restaurant-reserve-table-haiku` | 3 of 3 | 3 of 3 |
| `smoke-shopkeeper-browse-and-add-haiku` | 2 of 3 (Z) | 1 of 3 (samples 2 and 3, P4b; sample 2 also Q) |
| `smoke-stylist-palette-haiku` | 3 of 3 | 2 of 3 (sample 2, J) |
| `smoke-travel-compare-legs-haiku` | 3 of 3 | 3 of 3 |

## Per cluster and preset

By preset, round 21 (round 20): concierge 30 of 30 (28), croupier 9 of 9 (7), mentalist 6 of 6 (6), negotiator 2 of 3 (3), restaurant 3 of 3 (3), shopkeeper 5 of 9 (8), stylist 2 of 3 (3), travel 6 of 6 (6). All: 63 of 69 (64).

| Cluster | Round 20 | Round 21 |
| --- | --- | --- |
| Z (a note-only say reply claims a change the surface does not carry) | 1 failed run | 0 failed runs; CHANGE_CLAIMED fired 7 rounds on 6 turns, every one caught, none shipped uncorrected |
| G (a game pick answered with no CardTable) | 2 failed runs | 0 failed runs; the T-0586 row fired once live and its turn shipped a CardTable (:146) |
| S (a third-round slip after PRODUCT_CARD_MISSING degrades a services turn) | 2 failed runs | 0 failed runs; PRODUCT_CARD_MISSING fired on :24 and :61 in that cell, both saved by round 2 |
| P4b (recurs: an add-to-order repair ships the order as a hand-built Card with an AmountPicker, no ConfirmReceipt) | 0 | 2 failed runs, `smoke-shopkeeper-browse-and-add-haiku-2` (:43) and `-3` (:80) |
| P5b (recurs: an order ConfirmReceipt with a literal quantity and no AmountPicker) | 0 | 1 failed run, `reach-shopkeeper-cart-amount-haiku-1` (:124) |
| J (new: a `messages` string with one surplus `}` is resent byte for byte until the bound runs out) | 0 | 2 failed runs, `smoke-stylist-palette-haiku-2` (:129) and `reach-shopkeeper-cart-amount-haiku-2` (:139) |
| H (new: the GAME_HUD_MISSING repair says "Keep ask-1 as it is", so the last round never recreates ask-1) | 0 | 1 failed run, `smoke-negotiator-first-offer-haiku-2` (:46) |
| Q (new, with P4b: a product browse answered with hand-built priced Cards, which no check reads) | 0 | in 1 failed run, `smoke-shopkeeper-browse-and-add-haiku-2` turn 1 (:42) |

Trace tallies, all samples, round 21 (round 20), fired rounds and saved turns: halted turns 0 (0); SURFACE_MISSING 17, 17 saved (21); CHANGE_CLAIMED 7 on 6 turns, 4 saved (3); PARSE 6 on 5 turns, 2 saved (11); ACTION_NOT_APPLIED 5 on 4 turns, 4 saved (1); PRODUCT_CARD_MISSING 4, 4 saved (4); SURFACE_CLAIMED 4, 3 saved (4); BOOKING_VALUE_UNBOUND 3, 3 saved (1); CONTRAST_PAIR_WRAPPED 2, saved (3); GAME_HUD_MISSING 2, 1 saved (0); OPTION_DECK_COUNT 2, saved (1); CATALOG 1, saved (1); SURFACE_NOT_CREATED 1, saved (3). String `messages` rounds 14 (9). Every turn's outcome is ok.

## Cost

$0.675688 estimated at list prices in `round.json` `totals.costUsd` (156 trace lines; 1,042,888 input, 309,367 output, 3,694,144 cache read and 378,412 cache creation tokens), against the $5 cap; round 20 was $0.68. Per turn $0.004, latency p50 8.2 s and p90 16.1 s (round 20: 8.7 s and 17.4 s; `signals.md`). The keyless replays and offline checks cost nothing.

## Are Z, G and S closed

- **Z: yes, by result.** No run failed on Z and no turn shipped CHANGE_CLAIM_UNCORRECTED. All 7 CHANGE_CLAIMED fires are true positives, each a round that claimed an add or a rename with no surface change: :43 r2, :80 r1, :124 r1, :126 r1, :139 r1 and r2, :141 r1. But the T-0585 branches were never the deciding read: run against the `produce.ts` literal at `b97e7cf47` and at `be8f9dae8`, every fire matches the old regex too, on the prose or, for the two meta-only rounds (:80 r1, :139 r1), on the note that is the whole reply. The round 20 wording ("I've started your order") did not recur. The T-0585 unit tests and replay remain its only evidence.
- **G: yes, with one live exercise.** `pick-croupier-game-deck-haiku` passed 3 of 3. On :146 r1 the `pick_game` press was answered by restyling the OptionDeck; the T-0586 row filed `SURFACE_MISSING ask-1:root` asking for the CardTable, round 2 was a PARSE, and round 3 shipped one CardTable. The other two samples (:116, :131) raised no CardTable fire.
- **S: yes, by result; neither mechanism was exercised.** `regress-concierge-facilities-then-tour-haiku` passed 3 of 3, with PRODUCT_CARD_MISSING saved in round 2 on :24 and :61. No ProductCard this round bound `actionLabel` to a path and no message carried an envelope `surfaceId` (a scan of every parseable round's messages and text lines), and `trace.healed` is 0 on all 156 lines, so neither T-0587 nor T-0588 had a case.

## Regression check: the new checks and the widened heal

No false sends-back and no wrong heals. CHANGE_CLAIMED fired 7 times, all true positives (above). The T-0586 CardTable row fired once (:146 r1), on a pick answered with no CardTable, and was saved. The heal arm (e) never fired (healed 0 on every line), so it could not misplace an id. The T-0587 catalog change shows no SCHEMA or CATALOG slip on a ProductCard (the one CATALOG fire, :142 r1, is a croupier deal turn, saved). ACTION_NOT_APPLIED rose from 1 to 5 fired rounds and GAME_HUD_MISSING from 0 to 2; neither path changed between the commits, and every fire but :46 was saved.

## Why they failed and how to fix them

Every failing run reproduces keylessly: `npm run chat:probe -- --replay .sdlc/evals/rounds/2026-10-29-r21-pattern/runs/<name>/fixture.json` plus the run's own `--expect-component` flags from `live-commands.sh` exits 1 with the same failed checks for all six. Without those flags the run-level `expect-component` check is not replayed, so `reach-shopkeeper-cart-amount-haiku-1`, whose only failure is that check, exits 0.

| Cluster | Runs | Class | Evidence | Fix layer | File | Keyless test that proves it | Proposed ticket |
|---|---|---|---|---|---|---|---|
| J. A `messages` string with one surplus `}` is resent byte for byte; the pinpoint does not name the surplus closer | 2: `smoke-stylist-palette-haiku-2` (:129), `reach-shopkeeper-cart-amount-haiku-2` (:139) | (c) model, with a (d) producer gap | :129 sends the same 2,398-character string in all three rounds; it breaks at character 565 on `]}}}},{"version"` (one `}` too many after the `updateDataModel`), and `messagesParseNote` only quotes the text there. :139 r2 and r3 send the same string; it has one `}` too many before `]` after the ConfirmReceipt's `backAction`, and the note wrongly says a `]` is missing. In both, dropping that one `}` parses (3 and 2 messages); `stringifiedMessages` returns undefined for both | (d) producer: extend T-0469's `closedInPlace` to drop one surplus closer at JSON.parse's break when the result parses as an array of messages, and have `messagesParseNote` name a surplus `}` instead of a missing `]` | `packages/agent-ui/a2ui/src/agent/response-type.ts` | `response-type.test.ts` cases with the :129 and :139 strings (both parse to their message counts, and a two-defect string still does not), plus a replay fixture of :129 that ships the palette | J1 |
| P4b (recurrence). After a CHANGE_CLAIMED repair the add turn ships the order as a hand-built Card with an AmountPicker and no ConfirmReceipt | 2: `smoke-shopkeeper-browse-and-add-haiku-3` (:80), `-2` (:43) | (c) model, with a (b) check gap | :80 r2's order Card holds an AmountPicker labelled "Brass Desk Lamp" with a literal `value` 1 and `actionName` `set_quantity`; the ConfirmReceipt row's `inputCue` reads only `label`, `name` and the bound path, so its quantity cue matches nothing and the row stands aside although the reply says "to your order". :43 spent rounds 1 and 2 on a string PARSE and a CHANGE_CLAIMED, and round 3 shipped the same shape, labelled "Quantity", tallied SEMANTIC_UNCORRECTED (inferred: the row fired on the last round, with no round left to repair) | (b) check: let `inputCue` read `actionName` (and the AmountPicker's `currency`) as well; and (d) producer: a CHANGE_CLAIMED repair on an add turn names the ConfirmReceipt in its ask | `packages/agent-ui/a2ui/src/catalog/composite-moments.ts`, `agent/produce.ts` | `composite-moments.test.ts`: the :80 r2 messages with the reply fire `SURFACE_MISSING` for ConfirmReceipt; the T-0480 tip-picker case still stands aside; replay of :80 | P4c |
| P5b (recurrence). An order ConfirmReceipt with a literal item quantity of 2 and no AmountPicker, the reply offering no quantity change | 1: `reach-shopkeeper-cart-amount-haiku-1` (:124) | (c) model, with a (b) check gap | :124 r2 ships `ConfirmReceipt` "Your order" with `items[0].quantity` 2 and no AmountPicker; the reply "Here's your order summary." has no `QUANTITY_OFFER`, so the T-0582 `unpickedLines` branch for literal quantities stays shut by design | (b) check: on the shopkeeper's `agent-ui` surfaces, a pending order receipt's literal quantity fires the AmountPicker row without the reply offer when the user asked for a quantity ("Add two") | `packages/agent-ui/a2ui/src/catalog/composite-moments.ts` | `composite-moments.test.ts` with the :124 r2 messages and the user ask; a booking receipt and a confirmed receipt still stand aside; replay of :124 with `--expect-component AmountPicker` | P5c |
| H. The GAME_HUD_MISSING repair says "Keep ask-1 as it is", and the last round sends only `updateComponents` for ask-1, which the rejected round had created | 1: `smoke-negotiator-first-offer-haiku-2` (:46) | (b) check wording, with (c) model | r1 a note-only ask (SURFACE_CLAIMED), r2 ask-1 alone (GAME_HUD_MISSING, detail "Keep ask-1 as it is and, in this same answer, create the game's HUD surface"), r3 a text round with `createSurface` hud-1 but no `createSurface` ask-1, so SURFACE_NOT_CREATED on the last round degraded the turn to text and `no-surface-loss` fails on ask-1 and hud-1 | (b) check: the GAME_HUD_MISSING detail asks to resend ask-1 whole, its `createSurface` included, beside the HUD (the produce.ts:1417 "resend it" wording) | `packages/agent-ui/a2ui/src/catalog/hidden-state-checks.ts` (line 496) | `hidden-state-checks.test.ts` asserts the detail asks to resend the ask surface with its createSurface; replay of :46 | H1 |
| Q. A product browse ("What lamps do you have?") answered with hand-built Cards holding a price Text and a Button, no ProductCard, and no check fires | in 1: `smoke-shopkeeper-browse-and-add-haiku-2` turn 1 (:42) | (c) model, with a (b) check gap | :42 r1 ships four Cards (CardHeader name, Badge, price Text "$189", Button) and passes with no failure code; the ProductCard row reads only priced Table columns and priced DescriptionList or List rows on a services ask | (b) check: a priced-Card arm on the ProductCard row (a Card whose texts carry a price and whose footer holds a Button), on a product ask as well as a services ask | `packages/agent-ui/a2ui/src/catalog/composite-moments.ts` | `composite-moments.test.ts` with the :42 messages fires PRODUCT_CARD_MISSING; a single order Card with a total does not; replay of :42 | Q1 |

**Observed against inferred:** codes, rounds, tool inputs, meta lines and replies are on the trace lines; every failure reproduces keylessly; the J verdicts are direct `JSON.parse`, `messagesParseNote` and `stringifiedMessages` runs on the recorded strings; the Z attribution is a direct run of both `produce.ts` literals; the P4b and P5b row verdicts are read from the `inputCue` and `unpickedLines` code against the recorded components. Inferred: that :43's SEMANTIC_UNCORRECTED is the ConfirmReceipt row's last-round fire, and that each proposed change would have saved its run (none is built here).

Bounded experiment for the proposed tickets: their unit tests and the keyless replays above, then `smoke-shopkeeper-browse-and-add-haiku`, `reach-shopkeeper-cart-amount-haiku`, `smoke-negotiator-first-offer-haiku` and `smoke-stylist-palette-haiku`, 3 samples each, before the next full round.

## Tickets
None filed by this round (the solo seat files none). Proposed: J1, P4c, P5c, H1 and Q1, as in the table above.

## Process notes
- **Batches:** five runner calls (`--max 12`, `--max 26`, `--max 12`, `--max 12`, then the rest). The `--max 26` batch again outran the 10 minute foreground limit and finished in the background; each restart skipped every run that already had a report, and `ledger.jsonl` merged the batches into one 69-run round. Keep batches at 12.
- **live-commands.sh:** round 20's file with the round slug changed and the hand-written section's comment rewritten for T-0589, kept under the task's run records and passed to `run-capped.ts` as a repo-relative path; a fresh `plan.ts` run matched its generated section. The runner copied it into the archive.
- **Worktree key:** the lane had no `.env`; a symlink to the main checkout's file was created (never read), and the first batch proved it.
- **README.md** is the runner's, written with the archive before this report existed; its `report.md` line was then added in the runner's own wording, as in round 20. The `.sdlc/evals/README.md` index row was written by the runner.
- **Replays:** a fixture replay does not carry the run-level `--expect-component` flags; pass them from `live-commands.sh` to reproduce a run-level failure.
