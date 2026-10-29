# T-0584 live round 20: report

Round 20 ran on 2026-10-29 UTC (20:29 to 21:05) at `b97e7cf4` (main after T-0583, PR 2387, and T-0582, PR 2388), the round 19 matrix rerun unchanged to measure the round 19 cluster fixes: the widened `CHANGE_CLAIM_IN_REPLY` (cluster Z) and the widened AmountPicker and ConfirmReceipt rows in `composite-moments.ts` (clusters P5b and P4b). Kim approved the spend on 2026-10-29.

**69 of 69 runs, 64 passed and 5 failed, $0.68 in the ledger against the $5 cap, stop done, 0 cap skips.** Round 19 was 62 of 69 for $0.67; rounds 17 and 18 were 68 of 69. So the answer to the ticket's question is no: the matrix did not return to 68 or 69. The three cells round 19 lost to P5b and Z all recovered (cart-amount 0 to 3 of 3, negotiator 2 to 3, stylist 2 to 3), P5b is closed with one live save, and no widened check sent back a turn it should not have. Two other cells fell: `regress-concierge-facilities-then-tour-haiku` (3 to 1 of 3, a new cluster S) and `pick-croupier-game-deck-haiku` (2 to 1 of 3, now a recurring cluster G). The one shopkeeper fail is a Z recurrence in wording the widened regex still misses. No turn halted; all 156 turns have outcome ok. No judge run and no fog ingest: the analysis reads the trace lines (`traces/2026-10-29.jsonl`, cited as `:<line>`), the run reports and keyless replays.

## Comparison set
- **Plan:** the same 69 runs as rounds 16 to 19. The generated section is `plan.ts --tag smoke --tag regression --tag long --persona concierge --persona restaurant --persona travel --persona shopkeeper --persona negotiator --persona mentalist --model haiku --samples 3 --cap 5 --round r20-pattern`; a fresh run at this commit matched round 19's 49 lines byte for byte once `--out` was given the round path and the slug normalized.
- **Hand-written section, 30 runs:** round 19's 30 hand-written probes with the round paths changed, under a T-0584 comment. All 69 `chat:probe` lines equal round 19's once the round slug is normalized.
- **Against round 19:** all 23 cells are shared and no oracle changed. Prompt section digests equal round 19's (grammar `5f9b7bf9c54c6206`; every persona's persona, components and functions digests unchanged; `signals.md`). Exemplar retrieval moved on one croupier row only (`frontier-option-compare-legs`, 2 to 3 turns, all samples).
- **Code between the commits** (`git diff --stat 6e1b2734 b97e7cf47 -- packages/agent-ui/a2ui/src scripts`): `produce.ts` `CHANGE_CLAIM_IN_REPLY` (T-0583: the `'ve got ... in your order`, `total is $` and `come down to $` branches), `catalog/composite-moments.ts` (T-0582: the AmountPicker row reads a literal `items[].quantity` and a `rows[].path` line, the ConfirmReceipt row's words gate reads the reply), their tests and replay fixtures. None of the 5 failures runs through a changed line (see Regression check).

## Churn against round 19 (generated)

From `npm run eval:signals -- --round 2026-10-29-r20-pattern --against 2026-10-29-r19-pattern --min-samples 1`:

| Transition | Count | Cells | Sample 1 |
| --- | --- | --- | --- |
| fail to pass | 3 | `reach-shopkeeper-cart-amount-haiku`, `smoke-negotiator-first-offer-haiku`, `smoke-stylist-palette-haiku` | 3 (`pick-croupier-game-deck-haiku`, `reach-shopkeeper-cart-amount-haiku`, `smoke-stylist-palette-haiku`) |
| pass to fail | 1 | `regress-concierge-facilities-then-tour-haiku` | 0 |
| fail to fail | 2 | `pick-croupier-game-deck-haiku`, `smoke-shopkeeper-browse-and-add-haiku` | 0 |
| pass to pass | 17 | stable | 20 |

Both fail to fail cells fail for a different reason than in round 19: the shopkeeper cell was P4b in round 19 and is Z here; the croupier cell was a single run in round 19 and the same shape twice here (cluster G).

## Per cell

| Cell | Round 19 | Round 20 |
| --- | --- | --- |
| `claim-croupier-rename-table-haiku` | 3 of 3 | 3 of 3 |
| `long-concierge-booking-haiku` | 3 of 3 | 3 of 3 |
| `long-concierge-booking-confirm-haiku` | 3 of 3 | 3 of 3 |
| `long-concierge-facility-hours-haiku` | 3 of 3 | 3 of 3 |
| `long-concierge-spa-services-haiku` | 3 of 3 | 3 of 3 |
| `pick-croupier-game-deck-haiku` | 2 of 3 | 1 of 3 (samples 2 and 3, cluster G) |
| `pick-mentalist-answer-deck-haiku` | 3 of 3 | 3 of 3 |
| `reach-concierge-day-itinerary-haiku` | 3 of 3 | 3 of 3 |
| `reach-concierge-room-stepflow-haiku` | 3 of 3 | 3 of 3 |
| `reach-shopkeeper-cart-amount-haiku` | 0 of 3 (Z, P5b, P5b) | 3 of 3 |
| `reach-shopkeeper-compare-haiku` | 3 of 3 | 3 of 3 |
| `reach-travel-trip-itinerary-haiku` | 3 of 3 | 3 of 3 |
| `regress-concierge-dinner-at-vela-haiku` | 3 of 3 | 3 of 3 |
| `regress-concierge-facilities-then-tour-haiku` | 3 of 3 | 1 of 3 (samples 2 and 3, cluster S) |
| `regress-concierge-spa-booking-haiku` | 3 of 3 | 3 of 3 |
| `smoke-concierge-booking-haiku` | 3 of 3 | 3 of 3 |
| `smoke-croupier-blackjack-deal-haiku` | 3 of 3 | 3 of 3 |
| `smoke-mentalist-first-answer-haiku` | 3 of 3 | 3 of 3 |
| `smoke-negotiator-first-offer-haiku` | 2 of 3 (Z) | 3 of 3 |
| `smoke-restaurant-reserve-table-haiku` | 3 of 3 | 3 of 3 |
| `smoke-shopkeeper-browse-and-add-haiku` | 2 of 3 (P4b) | 2 of 3 (sample 2, cluster Z, new wording) |
| `smoke-stylist-palette-haiku` | 2 of 3 (single run) | 3 of 3 |
| `smoke-travel-compare-legs-haiku` | 3 of 3 | 3 of 3 |

## Per cluster and preset

By preset, round 20 (round 19): concierge 28 of 30 (30), croupier 7 of 9 (8), mentalist 6 of 6 (6), negotiator 3 of 3 (2), restaurant 3 of 3 (3), shopkeeper 8 of 9 (5), stylist 3 of 3 (2), travel 6 of 6 (6). All: 64 of 69 (62).

| Cluster | Round 19 | Round 20 |
| --- | --- | --- |
| P5b (a cart receipt's literal or `rows` quantity with no AmountPicker) | 2 failed runs | 0 failed runs; the widened row fired once live and saved the run (:154 r2) |
| P4b (an order read back as a hand-built Card, "order" only in the reply) | 1 failed run | 0 failed runs; no turn shipped that shape, so the reply-words branch had no occasion to fire |
| Z (a note-only say reply claims a change in wording `CHANGE_CLAIM_IN_REPLY` misses) | 2 failed runs | 1 failed run, `smoke-shopkeeper-browse-and-add-haiku-2` (:43), in a wording the T-0583 branches do not cover |
| S (new: a third-round message-local SCHEMA or CATALOG slip after a PRODUCT_CARD_MISSING repair degrades the turn to text) | 0 | 2 failed runs, `regress-concierge-facilities-then-tour-haiku-2` (:61) and `-3` (:98) |
| G (a game pick answered with no CardTable; round 19's single run) | 1 failed run | 2 failed runs, `pick-croupier-game-deck-haiku-2` (:131) and `-3` (:146) |
| Single runs, no cluster | 2 failed runs | 0 |

Trace tallies, all samples, round 20 (round 19), fired rounds and saved: halted turns 0 (0); SURFACE_MISSING 21, 21 saved (17, 17); PARSE 11 on 11 turns, 10 saved (4, 4); PRODUCT_CARD_MISSING 4, 2 saved (4); SURFACE_CLAIMED 4, saved (5); CHANGE_CLAIMED 3, 3 saved (8 on 7 turns, 7 saved); CONTRAST_PAIR_WRAPPED 3, saved (2); SURFACE_NOT_CREATED 3, 2 saved (1); ACTION_NOT_APPLIED 1, saved (3); BOOKING_VALUE_UNBOUND 1, saved (1); CATALOG 1, saved (0); CONTAINMENT 1, not saved (0); IDGRAPH 1, not saved (2); OPTION_DECK_COUNT 1, saved (0); SCHEMA 0 (1); SURFACE_DROPPED 0 (1). String `messages` rounds 9 (5). SURFACE_DEGRADED ships on 2 turns (0), both cluster S. PARSE nearly tripled with identical prompt digests; 10 of 11 were saved, so it costs rounds, not runs, but it is the round's biggest moved tally.

## Cost

$0.682764 estimated at list prices in `round.json` `totals.costUsd` (156 trace lines; 1,047,156 input, 320,548 output, 3,679,533 cache read and 398,569 cache creation tokens), against the $5 cap; round 19 was $0.67. Per turn $0.004, latency p50 8.7 s and p90 17.4 s (round 19: 8.1 s and 16.9 s; `signals.md`). The keyless replays and offline validations cost nothing.

## Are P5b, P4b and Z closed

- **P5b: yes, at the mechanism, with one live exercise.** :154 (`reach-shopkeeper-cart-amount-haiku-3`) r1 is a note-only "Two Brass Desk Lamps are in your order" (CHANGE_CLAIMED, forced repair); r2 ships the receipt with a fixed quantity while the reply says "You can change the quantity below", and the widened T-0582 row files `SURFACE_MISSING storefront-1:order` ("reads back order (a ConfirmReceipt) with a fixed quantity ... and no AmountPicker"); r3 ships the AmountPicker and the run passes. The cell is 3 of 3.
- **P4b: closed by absence only.** No turn this round shipped an order as a hand-built Card, so the reply-words gate never had a case. The cell P4b was found on is 2 of 3 again for a different shape (Z below). The T-0582 unit tests and replay fixtures remain the only evidence the branch works.
- **Z: not closed.** The three T-0583 branches never fired live: all three CHANGE_CLAIMED fires (:80 "I've added", :154 "are in your order", :156 "Done:") also match the round 19 regex, run directly against `git show 6e1b2734:packages/agent-ui/a2ui/src/agent/produce.ts`. The cell round 19 lost to Z on (negotiator) passed 3 of 3 without needing them. The one shopkeeper fail is a new Z wording: :43 r1 answers "Add the first one to my order." note-only with prose "A Brass Dome Table Lamp is $64, so I've started your order on this same page. You can change the quantity below, and the total will follow." and a meta-line note "Added the Brass Dome Table Lamp to your order." targeting `storefront-1`. The regex is false on the prose and true on the meta note (observed, direct run), but the check reads the prose: `produce.ts` line 1893 sets `note = reply` when the text channel has prose, so the model's own "Added" declaration is never tested. No code fired; the turn shipped note-only, and `action-updates-surface` and `expect-component ConfirmReceipt` fail.

## Regression check: the widened checks

No false sends-back. Every fire of a changed path was a true positive: CHANGE_CLAIMED fired 3 times (:80, :154, :156), each a note-only claim of a change the surface did not carry, each saved by its repair round; the T-0582 AmountPicker row fired once (:154 r2), on a receipt whose reply offered a quantity change and that had no picker, and was saved. The new T-0583 branches and the T-0582 ConfirmReceipt reply-words branch fired 0 times. None of the 5 failed runs passes through a changed line: S fails on PRODUCT_CARD_MISSING (an older row) followed by SCHEMA or CATALOG, G involves no shopkeeper row, and Z at :43 is a non-fire.

## Why they failed and how to fix them

Every failing run reproduces keylessly (a replay plays the recorded wire lines, so it shows recorded behaviour, not a fix): `npm run chat:probe -- --replay .sdlc/evals/rounds/2026-10-29-r20-pattern/runs/<name>/fixture.json` exits 1 with the same failed checks for all five (`pick-croupier-game-deck-haiku-2` and `-3` on `expect-component CardTable`; `regress-concierge-facilities-then-tour-haiku-2` and `-3` on `no-surface-loss` and `expect-component ProductCard`; `smoke-shopkeeper-browse-and-add-haiku-2` on `action-updates-surface` and `expect-component ConfirmReceipt`). The rows below are proposals for Kim, not filed.

| Cluster | Runs | Class | Evidence | Fix layer | File | Keyless test that proves it | Proposed ticket |
|---|---|---|---|---|---|---|---|
| S. "What services could I add" spends the 3-round bound: r1 hand-builds priced DescriptionList rows (PRODUCT_CARD_MISSING) or fails PARSE, the next round fixes that, and the last round carries a message-local slip, so the turn degrades to text and the surface it created is lost | 2: `regress-concierge-facilities-then-tour-haiku-2` (:61), `-3` (:98) | (c) model, with an (a) catalog contract gap and a (d) heal gap | :61: r1 PRODUCT_CARD_MISSING `stay-services:spaList`; r2 sends text-channel JSONL with dangling ids (IDGRAPH, CONTAINMENT, SURFACE_NOT_CREATED); r3 sends the ProductCard Grid, but its `updateDataModel` has `surfaceId` beside the op instead of inside it: `validate-payload.ts` on r3's messages exits 1 with `SCHEMA [1].updateDataModel.surfaceId` (observed). :98: r1 PARSE, r2 PRODUCT_CARD_MISSING `stay-services:list`, r3 templates `ProductCard` with `actionLabel: {path: "actionLabel"}`: `validate-payload.ts --catalog agent-ui--hospitality` exits 1 with `CATALOG service-card.actionLabel` (observed). In `catalog/default/catalog.json` ProductCard's `title`, `price` and `priceNote` are `bindable: true` and `actionLabel` is not. The same binding also failed `long-concierge-spa-services-haiku-3` r2 (`CATALOG tmpl.actionLabel`, saved), so it is 2 fires this round. `git grep surfaceId packages/agent-ui/a2ui/src/corpus/heal.ts` finds no heal arm for a misplaced `surfaceId`. Both final turns ship SURFACE_DEGRADED. | catalog contract (S1), heal arm (S2) | S1: `packages/agent-ui/a2ui/src/catalog/default/catalog.json` ProductCard `actionLabel` (mark it `bindable: true` like its siblings, with the descriptor and renderer reading a bound value). S2: `packages/agent-ui/a2ui/src/corpus/heal.ts`, a closed-list arm (ADR-0061) that moves an envelope-level `surfaceId` into the one op object that lacks it | S1: `validate-payload.ts` on :98 r3's three messages with `--catalog agent-ui--hospitality` goes from exit 1 to exit 0, plus a catalog conformance case binding `actionLabel` in a templated Grid. S2: a `heal.test.ts` case from :61 r3's `updateDataModel` message heals to a valid op with the repair named; negative: a message whose envelope and op `surfaceId` disagree is left for SCHEMA | "ProductCard actionLabel binds like title and price" (L2); "Heal moves a stray envelope surfaceId into its op" (L2, needs Kim's word on widening the ADR-0061 closed list) |
| Z (recurrence). A note-only say reply whose prose claims the change in wording the regex misses ships unrepaired, although the meta-line note matches | 1: `smoke-shopkeeper-browse-and-add-haiku-2` (:43) | (c) model, with a (d) producer heuristic gap | :43 r1 prose "...so I've started your order on this same page. You can change the quantity below, and the total will follow." (regex false), meta note "Added the Brass Dome Table Lamp to your order." with `target: storefront-1` (regex true). `note = reply` at `produce.ts` line 1893 means only the prose is tested at line 2035. No code fired. | producer repair loop (heuristic) | `packages/agent-ui/a2ui/src/agent/produce.ts`: test `CHANGE_CLAIM_IN_REPLY` against the peeled meta-line note as well as the prose (the model's own declaration), and add a `\b(?:I['’]ve\|I have) started your (?:order\|cart\|basket)\b` branch; the claim still needs a say turn and a target surface | a `produce-narration.test.ts` case: a scripted model answers :43's r1 text (prose plus meta note plus target) note-only, then a valid update; asserts r2 is forced to `render_surface` with CHANGE_CLAIMED. A second case with the prose alone. Negatives: a meta note "Here are our lamps." with prose that claims nothing stays clean; "Shall I start your order?" stays clean. Then the :43 fixture replay as the end-to-end check | "A change claim in the meta-line note, or 'I've started your order', is sent back" (L1) |
| G. A game picked from the croupier's OptionDeck is answered by restyling the deck (or a text Column) with no CardTable | 2: `pick-croupier-game-deck-haiku-2` (:131), `-3` (:146); round 19 `-1` (:116) | (c) model, with a (b) check gap | :131: the `pick_game` action (`context.value: blackjack`) is answered by one `updateComponents` on `ask-1` that relabels the OptionDeck "Blackjack selected" and disables it; reply "Place your bet to deal"; no code fires. :146: r1 shrinks the deck to 1 option (OPTION_DECK_COUNT, whose hint says to drop the deck and offer a Button), r2 replaces `game-pick-1` with a Column of two Texts; no CardTable. Round 19's :116 updated `hud-1` alone. No check covers a game pick that opens no table. | catalog semantic check (croupier) | `packages/agent-ui/a2ui/src/catalog/composite-moments.ts`, a croupier row: an action turn whose action is `pick_game` (or whose context value names a card game) and whose reply invites a bet or deal, answered with no CardTable on any surface, asks for the CardTable (SURFACE_MISSING) | `composite-moments.test.ts` cases from :131's and :146's payloads with the pick action and reply: each yields SURFACE_MISSING for CardTable; negatives: the same pick answered with a CardTable stays clean, and a mentalist pick on an OptionDeck answered with a GameHud stays clean. Then the two fixture replays | "A picked card game with no CardTable asks for its table" (L2) |

**Observed against inferred:** codes, rounds, tool inputs, meta lines and replies are on the trace lines; every failure reproduces keylessly; the S verdicts are direct `validate-payload.ts` runs on the last rounds' messages; the Z miss and the old-regex matches are direct runs of the `produce.ts` literal (current and at `6e1b2734`). Inferred: that each proposed change would have saved its run (none is run), and that the PARSE rise is model-side variance (the prompt digests are identical; the cause is not shown). One trace oddity, observed and not explained: :61 and :98 record their last round with `status: passed` although the turn ships SCHEMA or CATALOG plus SURFACE_DEGRADED.

Bounded experiment for the proposed tickets: their unit tests and the keyless replays above, then `regress-concierge-facilities-then-tour-haiku`, `pick-croupier-game-deck-haiku` and `smoke-shopkeeper-browse-and-add-haiku`, 3 samples each, before the next full round.

## Tickets
None filed by this round (the solo seat files none). Proposed: S1, S2, Z (recurrence) and G, as in the table above.

## Process notes
- **Batches:** five runner calls (`--max 12`, `--max 26`, `--max 13`, `--max 13`, then the rest). The `--max 26` batch outran the 10 minute foreground limit and finished in the background; each restart skipped every run that already had a report, and `ledger.jsonl` merged the batches into one 69-run round. Keep batches at 12 to 15.
- **live-commands.sh:** assembled from a fresh `plan.ts` run (its `--out runs/<name>` rewritten to the round path) plus round 19's hand-written section with the round paths changed and a T-0584 comment, kept under the task's run records and passed to `run-capped.ts` as a repo-relative path; the runner copied it into the archive.
- **Worktree key:** the lane had no `.env`; a symlink to the main checkout's file was created (never read), and the first batch proved it.
- **README.md** is the runner's, written with the archive before this report existed; its `report.md` line was then added in the runner's own wording (`run-capped.ts --describe` prints it, but rewrote the replay path relative to the round, so only that line was taken). Rounds 18 and 19 never listed their report. The `.sdlc/evals/README.md` index row was written by the runner.
