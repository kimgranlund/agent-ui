# T-0581 live round 19: report

Round 19 ran on 2026-10-29 UTC (18:30 to 19:04) at `6e1b2734` (main after T-0578, PR 2383), the round 18 matrix rerun unchanged to measure the cluster R fix: an unparseable forced-repair round keeps its repair ask and the forced `render_surface` (`produce.ts`). Kim approved the spend on 2026-10-29.

**69 of 69 runs, 62 passed and 7 failed, $0.67 in the ledger against the $5 cap, stop done, 0 cap skips.** Round 18 was 68 of 69 for $0.68. No turn halted; all 156 turns have outcome ok. Cluster R is closed at its mechanism (one live exercise, saved), but the round is 6 runs worse: 4 cells moved pass to fail. No code change between the two commits touches the failing paths (see Comparison set), so the drop is model-side sampling on known noisy shopkeeper cells plus three check gaps it exposed. No judge run and no fog ingest: the analysis reads the trace lines (`traces/2026-10-29.jsonl`, cited as `:<line>`), the run reports and keyless replays.

## Comparison set
- **Plan:** the same 69 runs as rounds 16 to 18. The generated section is `plan.ts --tag smoke --tag regression --tag long --persona concierge --persona restaurant --persona travel --persona shopkeeper --persona negotiator --persona mentalist --model haiku --samples 3 --cap 5 --round r19-pattern`; a fresh run at this commit matched round 18's 39 lines byte for byte once `--out` and the round slug are normalized.
- **Hand-written section, 30 runs:** round 18's 30 hand-written probes, byte for byte apart from the round paths, under a T-0581 comment. All 69 `chat:probe` lines equal round 18's once `--out` is normalized.
- **Against round 18:** all 23 cells are shared and no oracle changed. The prompt did not change: every persona's grammar, persona, components and functions section digests equal round 18's (grammar `5f9b7bf9c54c6206`); the only moved row is the croupier persona digest split across turns (12 and 6 in round 18, 10 and 8 here), and no exemplar's retrieval count moved (`eval:signals`, "None moved").
- **Code between the commits** (`git diff --stat 11d20e79 6e1b2734 -- packages/agent-ui/a2ui/src scripts`): `produce.ts` (T-0578, the forced-repair PARSE path only), `catalog/regex-guard.ts` (T-0577, a repeat cap on catalog patterns; `produce.ts` and `composite-moments.ts` do not use it, and `CHANGE_CLAIM_IN_REPLY` is a plain literal), tests, one replay fixture and `scripts/measure-size.mjs`. None of the 7 failures runs through a changed line except :154, where T-0578 worked as designed.
- **Prompt digests and exemplars:** `signals.md`.

## Churn against round 18 (generated)

From `npm run eval:signals -- --round 2026-10-29-r19-pattern --against 2026-10-29-r18-pattern --min-samples 1`:

| Transition | Count | Cells | Sample 1 |
| --- | --- | --- | --- |
| fail to pass | 0 | | 0 |
| pass to fail | 4 | `pick-croupier-game-deck-haiku`, `reach-shopkeeper-cart-amount-haiku`, `smoke-negotiator-first-offer-haiku`, `smoke-stylist-palette-haiku` | 3 |
| fail to fail | 1 | `smoke-shopkeeper-browse-and-add-haiku` | 0 |
| pass to pass | 18 | stable | 20 |

The fail to fail cell is not R still open: its round 19 failure (`-2`, :43) is a different shape (cluster P4b below) with no PARSE round.

## Per cell

| Cell | Round 18 | Round 19 |
| --- | --- | --- |
| `claim-croupier-rename-table-haiku` | 3 of 3 | 3 of 3 |
| `long-concierge-booking-haiku` | 3 of 3 | 3 of 3 |
| `long-concierge-booking-confirm-haiku` | 3 of 3 | 3 of 3 |
| `long-concierge-facility-hours-haiku` | 3 of 3 | 3 of 3 |
| `long-concierge-spa-services-haiku` | 3 of 3 | 3 of 3 |
| `pick-croupier-game-deck-haiku` | 3 of 3 | 2 of 3 (sample 1, single run) |
| `pick-mentalist-answer-deck-haiku` | 3 of 3 | 3 of 3 |
| `reach-concierge-day-itinerary-haiku` | 3 of 3 | 3 of 3 |
| `reach-concierge-room-stepflow-haiku` | 3 of 3 | 3 of 3 |
| `reach-shopkeeper-cart-amount-haiku` | 3 of 3 | 0 of 3 (sample 1 cluster Z, samples 2 and 3 cluster P5b) |
| `reach-shopkeeper-compare-haiku` | 3 of 3 | 3 of 3 |
| `reach-travel-trip-itinerary-haiku` | 3 of 3 | 3 of 3 |
| `regress-concierge-dinner-at-vela-haiku` | 3 of 3 | 3 of 3 |
| `regress-concierge-facilities-then-tour-haiku` | 3 of 3 | 3 of 3 |
| `regress-concierge-spa-booking-haiku` | 3 of 3 | 3 of 3 |
| `smoke-concierge-booking-haiku` | 3 of 3 | 3 of 3 |
| `smoke-croupier-blackjack-deal-haiku` | 3 of 3 | 3 of 3 |
| `smoke-mentalist-first-answer-haiku` | 3 of 3 | 3 of 3 |
| `smoke-negotiator-first-offer-haiku` | 3 of 3 | 2 of 3 (sample 3, cluster Z) |
| `smoke-restaurant-reserve-table-haiku` | 3 of 3 | 3 of 3 |
| `smoke-shopkeeper-browse-and-add-haiku` | 2 of 3 (sample 2, cluster R) | 2 of 3 (sample 2, cluster P4b) |
| `smoke-stylist-palette-haiku` | 3 of 3 | 2 of 3 (sample 1, single run) |
| `smoke-travel-compare-legs-haiku` | 3 of 3 | 3 of 3 |

## Per cluster and preset

By preset, round 19 (round 18): concierge 30 of 30 (30), croupier 8 of 9 (9), mentalist 6 of 6 (6), negotiator 2 of 3 (3), restaurant 3 of 3 (3), shopkeeper 5 of 9 (8), stylist 2 of 3 (3), travel 6 of 6 (6). All: 62 of 69 (68).

| Cluster | Round 18 | Round 19 |
| --- | --- | --- |
| M (moved child, `smoke-negotiator-first-offer-haiku`) | 0 failed runs | 0 failed runs of this shape (the cell's one fail is cluster Z) |
| Q (empty repair round, `regress-concierge-spa-booking-haiku`) | 3 of 3, 0 failed runs | 3 of 3, 0 failed runs |
| P5 (receipt quantity bound to a path no AmountPicker binds) | 0 failed runs | 0 failed runs of the bound `items` shape the T-0550 row reads |
| R (an unparseable forced-repair round loses the repair ask) | 1 failed run | 0 failed runs; exercised live once at :154 and saved |
| P4b (new: an order read back as a hand-built Card with no ConfirmReceipt, the word "order" only in the reply and ids) | 0 | 1 failed run, `smoke-shopkeeper-browse-and-add-haiku-2` (:43) |
| P5b (new: a cart receipt with no AmountPicker whose quantity is a literal or a `rows` path, so the T-0550 row does not read it) | 0 | 2 failed runs, `reach-shopkeeper-cart-amount-haiku-2` (:139) and `-3` (:154) |
| Z (new: a note-only say reply that changes surface state in words `CHANGE_CLAIM_IN_REPLY` misses ships unrepaired) | 0 | 2 failed runs, `reach-shopkeeper-cart-amount-haiku-1` (:124) and `smoke-negotiator-first-offer-haiku-3` (:84) |
| Single runs, no cluster | 0 | 2 failed runs, `smoke-stylist-palette-haiku-1` (:114) and `pick-croupier-game-deck-haiku-1` (:115, :116) |

One observed shift behind the shopkeeper drop: 0 of 6 shopkeeper add turns called `render_surface` in round 1 this round, against 3 of 6 in round 18, with identical prompt digests. Every failure on the two shopkeeper cells starts from that note-only round 1; the checks then decide whether a repair saves it. That is model-side variance at Haiku, observed, not caused by a code change.

Trace tallies, all samples, round 19 (round 18), fired rounds and saved: halted turns 0 (0); SURFACE_MISSING 17, 17 saved (17, 17); CHANGE_CLAIMED 8 on 7 turns, 7 saved (2 on 2, 1 saved); SURFACE_CLAIMED 5, saved (4); PARSE 4 on 4 turns, 4 saved (4, 3); PRODUCT_CARD_MISSING 4, saved (3); ACTION_NOT_APPLIED 3, saved (4); CONTRAST_PAIR_WRAPPED 2, saved (3); IDGRAPH 2, saved (2); BOOKING_VALUE_UNBOUND 1, saved (2); SURFACE_NOT_CREATED 1, saved (2); SCHEMA 1, not saved (1, saved); SURFACE_DROPPED 1, not saved (0); CATALOG 0 (5); RECEIPT_TOTAL_PATH 0 (1); NARRATED_MECHANICS 0 (1); string `messages` rounds 5 (6). The two unsaved codes are both :114.

## Cost

$0.666646 estimated at list prices in `round.json` `totals.costUsd` (156 trace lines; 1,035,350 input, 304,898 output, 3,562,075 cache read and 435,637 cache creation tokens), against the $5 cap; round 18 was $0.68. Per turn $0.004, latency p50 8.1 s and p90 16.9 s (round 18: 8.2 s and 16.6 s; `signals.md`). The keyless replays cost nothing.

## Is R closed

**Yes, at the mechanism, with one live exercise.** :154 (`reach-shopkeeper-cart-amount-haiku-3`, "Add two of the first one to my order and show me my cart.") is the round 18 R shape: r1 answers a note-only meta line ("Added two Brass Arc Floor Lamps...") targeting `storefront-1`, so CHANGE_CLAIMED fires (forced repair). r2 calls `render_surface` with `messages` as a string that fails `JSON.parse` at position 1737. Under T-0578 the round files CHANGE_CLAIMED plus PARSE (`retries[1]`, not plain PARSE as round 18's :43 r2 did), and r3 answers with `render_surface`, shipping the `storefront-1` update with an `order` ConfirmReceipt; `action-updates-surface` passes on that run. That the r3 request was forced to `render_surface` is inferred from T-0578's code and the r3 tool call; the trace line does not record the tool choice. The run still fails, on a different check (no AmountPicker, cluster P5b). `smoke-shopkeeper-browse-and-add-haiku`, the cell R was found on, is 2 of 3 again for a different shape (P4b) with no PARSE round.

## Why they failed and how to fix them

Every failing run reproduces keylessly (a replay plays the recorded wire lines, so it shows recorded behaviour, not a fix): `npm run chat:probe -- --replay .sdlc/evals/rounds/2026-10-29-r19-pattern/runs/<name>/fixture.json` exits 1 with the same failed checks for `smoke-shopkeeper-browse-and-add-haiku-2`, `smoke-negotiator-first-offer-haiku-3`, `smoke-stylist-palette-haiku-1`, `pick-croupier-game-deck-haiku-1` and `reach-shopkeeper-cart-amount-haiku-1`; `reach-shopkeeper-cart-amount-haiku-2` and `-3` need `--expect-component AmountPicker` added (the live command's end-of-run oracle) and then exit 1 on `expect-component`. The rows below are proposals for Kim, not filed.

| Cluster | Runs | Class | Evidence | Fix layer | File | Keyless test that proves it | Proposed ticket |
|---|---|---|---|---|---|---|---|
| P5b. A cart receipt ships without its AmountPicker when the quantity is a literal or read through `rows`, so the T-0550 row stays silent while the reply says the quantity can be changed | 2: `reach-shopkeeper-cart-amount-haiku-2` (:139), `-3` (:154) | (c) model, with a (b) check gap | :139 r2 (the CHANGE_CLAIMED repair) ships `order` ConfirmReceipt with `items: [{label, quantity: 2, amount: "$378"}]` (a literal) and no AmountPicker; reply "You can change the quantity below". :154 r3 ships the receipt with `rows: [{label, path: "/order/brass"}]` and data `/order/brass = 2`, no `items`, no AmountPicker; reply "Adjust the quantity below". The T-0550 `unpickedLines` row reads only `items[].quantity` bound to a path (`composite-moments.ts` near line 717), so neither shape is a finding. Round 18's report flagged the literal shape at :43 r2 as one to watch. | catalog semantic check | `packages/agent-ui/a2ui/src/catalog/composite-moments.ts`, the T-0550 AmountPicker row: also count a ConfirmReceipt `rows[].path` line, and a literal `items[].quantity`, as an unpicked quantity line when the turn's reply offers to change the quantity (the row already sits behind the order, cart or basket words gate) | `composite-moments.test.ts` cases from :139 r2 and :154 r3's payloads with their replies: each yields SURFACE_MISSING for AmountPicker; negatives: the same payloads with a reply that offers no quantity change, and a receipt whose `status` is not pending, yield none | "A cart receipt's literal or rows quantity with a quantity-change reply asks for its AmountPicker" (L2) |
| Z. A note-only say reply that changes surface state in wording `CHANGE_CLAIM_IN_REPLY` does not match ships with no surface update and no repair | 2: `reach-shopkeeper-cart-amount-haiku-1` (:124), `smoke-negotiator-first-offer-haiku-3` (:84) | (c) model, with a (d) producer heuristic gap | :124 r1 answers a `target: storefront-1` meta line and prose "You've got two Brass Desk Lamps in your order, at $68 each. Your cart total is $136."; no failure code, the turn ships note-only and `action-updates-surface` fails. :84 r1 answers a meta note targeting `ask-1` (the GameHud deal) "...I come down to $165, and not one coin lower..."; no code, no update. Running the `CHANGE_CLAIM_IN_REPLY` literal from `produce.ts` (line 1274) against both texts returns false (observed); it is true on :139 and :154's notes ("Added...") and on :43's prose, which is why those turns got CHANGE_CLAIMED. "'ve got ... in your order" misses the `is|are|'s|'re ... in your order` branch, and "total is $136" misses `comes to $`. | producer repair loop (heuristic) | `packages/agent-ui/a2ui/src/agent/produce.ts` `CHANGE_CLAIM_IN_REPLY`: add a `(?:'ve|have) got [^.?!]* in your (?:order|cart|basket)` branch, a `\btotal is (?:now )?\$?\d` branch, and a price-move branch (`(?:come|comes|coming) down to \$?\d`); the claim still needs a target surface and a say turn, so plain Q and A turns stay clean | a `produce-narration.test.ts` (or `produce-empty-repair.test.ts`) case per text: a scripted model answers :124's and :84's r1 text note-only with their targets, then a valid update: asserts r2 is forced to `render_surface` with CHANGE_CLAIMED; negatives: "Is there anything in your order you want to change?" and "Late check-out is possible until 13:00" stay unflagged | "Change claims in 'you've got', 'total is' and 'come down to' wording are sent back" (L1) |
| P4b. An order read back as a hand-built Card (DescriptionList, AmountPicker, total Text) with no ConfirmReceipt passes the T-0478 row because the surface's words never say order, cart or basket | 1: `smoke-shopkeeper-browse-and-add-haiku-2` (:43) | (c) model, with a (b) check gap | :43 r1 is note-only ("Added the Brass Desk Lamp..."), CHANGE_CLAIMED fires; r2 ships `shop-1` with an `order` Card holding `order_lines` DescriptionList, `order_picker` AmountPicker (label "Brass Desk Lamp quantity") and Text "Total: $68"; reply "Your order summary is below the shelf". The T-0478 ConfirmReceipt row's `inputCue` matches the AmountPicker label ("quantity") but its `words` gate (`/\b(order|cart|basket)\b/i`) tests `surfaceWords` only (`composite-moments.ts` near line 648); "order" appears only in component ids and the reply, so no finding. | catalog semantic check | `packages/agent-ui/a2ui/src/catalog/composite-moments.ts`, the T-0478 row: let the `inputCue.words` gate also read the turn's reply, as the Swatch row's `prose` check does | `composite-moments.test.ts` case from :43 r2's payload with its reply: SURFACE_MISSING for ConfirmReceipt; negatives: the T-0480 tip AmountPicker bill with a "Total" Text and a reply naming no order stays clean, and a negotiator GameHud deal sheet stays clean | "An order the reply names asks for its ConfirmReceipt even when the surface words do not" (L2) |

**Single runs, no cluster (watch, no ticket proposed yet):**
- `smoke-stylist-palette-haiku-1` (:114), round budget spent before the standing cost was repaired. r1 ships the palette under a root Card with an `updateDataModel` whose `surfaceId` is null: SCHEMA. r2 is note-only: SURFACE_DROPPED. r3, the last round, ships the palette still under the root Card holding both ContrastPairs, so it ships tallied SEMANTIC_UNCORRECTED and the probe's `render-lint` fails `nested-card`. The trace does not name the uncorrected finding; that it is CONTRAST_PAIR_WRAPPED is inferred from the payload (the same root Card shape drew CONTRAST_PAIR_WRAPPED at :129 r1 and :144 r1, both saved in r2). The produce chain runs validate before semantic checks (`produce.ts` lines 80 to 82), so r1's SCHEMA failure hid the wrap until no round was left (inferred from that order). CONTRAST_PAIR_WRAPPED fires on all three stylist turns again (rounds 17, 18 and 19), a standing cost. Candidate layer if it recurs: the stylist prompt (no Card around a ContrastPair), or a producer change that reports semantic findings beside a message-local SCHEMA failure; the producer one has a keyless `produce` test (r1 SCHEMA plus a wrapped ContrastPair, assert r2's feedback names both).
- `pick-croupier-game-deck-haiku-1` (:115, :116), a pick answered with a GameHud. :115 r1 is a note-only ask (SURFACE_CLAIMED), r2 creates both `ask-1` (OptionDeck) and `hud-1` (GameHud). The Blackjack click (:116) updates `hud-1` alone ("Place your bet below to deal the first hand") and opens no CardTable, so `expect-component CardTable` fails. No check covers a game pick that opens no table. Candidate layer if it recurs: a croupier composite-moments row (a chosen card game with only a GameHud asks for its CardTable), tested with :116's payload.

**Observed against inferred:** codes, rounds, tool inputs, meta lines and replies are on the trace lines; every failure reproduces keylessly with the flags above; the regex misses for cluster Z are a direct run of the `produce.ts` literal against :84, :124, :139, :154 and :43; the :154 parse error is a `JSON.parse` of its r2 `messages`. Inferred: that r3 at :154 was forced (code, not trace), that :114's uncorrected finding is CONTRAST_PAIR_WRAPPED, that SCHEMA hid it in r1, and that each proposed change would have saved its run (none is run).

Bounded experiment for the proposed tickets: their unit tests and the keyless replays above, then `reach-shopkeeper-cart-amount-haiku`, `smoke-shopkeeper-browse-and-add-haiku` and `smoke-negotiator-first-offer-haiku`, 3 samples each, before the next full round.

## Tickets
None filed by this round (the solo seat files none). Proposed: P5b, Z and P4b, as in the table above.

## Process notes
- **Batches:** `--max 12` to `--max 15` batches fit the 10 minute foreground limit; each restart skipped every run that already had a report, and `ledger.jsonl` merged the five batches into one 69-run round.
- **live-commands.sh:** assembled from a fresh `plan.ts` run plus round 18's hand-written section with the round paths changed and a T-0581 comment, kept under the task's run records and passed to `run-capped.ts` as a repo-relative path. This time the runner copied it into the archive itself (round 18's absolute path was the cause of the hand copy noted there).
- **Worktree key:** the lane had no `.env`; a symlink to the main checkout's file was created (never read), and the first batch proved it.
- **README.md** is the runner's, written with the archive before this report existed, so its file list does not name `report.md` (as in round 18).
