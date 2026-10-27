# T-0475 live round 15: report

Round 15 ran on 2026-10-27 UTC (00:49 to 01:24) at `00655fd5` (main after T-0467 to T-0477), the round 14 matrix rerun unchanged to measure the round 14 fixes: T-0467 (a surface created earlier in the same turn is not superseded, cluster X), T-0468 (the SURFACE_CLAIMED repair asks a game for its GameHud, and GAME_HUD_MISSING, cluster W), T-0469 (a messages string broken only by a missing closer is closed in place, cluster S2), T-0470 and T-0474 (CHANGE_CLAIM_IN_REPLY covers add claims, cluster P3) and the wave 2 replay guards (T-0472, T-0476, T-0477). The folder keeps the `2026-10-26` date the ticket named: it was created before the first run, and `run-capped.ts` reuses a folder whose slug matches. The round itself started after midnight UTC, so its trace file is `traces/2026-10-27.jsonl`. Trace line numbers (`:n`) are 1-based lines of that file.

**69 of 69 runs, 65 passed and 4 failed, $0.66 in the ledger against the $5 cap, stop done, 0 cap skips.** No turn halted (round 14: 1); all 156 turns have outcome ok; no `max_tokens` stop. One plumbing probe ran before the round to prove the worktree's key link (in the task's runtime folder, about $0.004, outside this ledger), so the whole spend is about $0.67. No judge run and no fog ingest: the analysis reads the trace lines, the run reports, four keyless replays and the producer and catalog source.

## Comparison set
- **Plan:** the same 69 runs as round 14. The generated section is `plan.ts --tag smoke --tag regression --tag long --persona concierge --persona restaurant --persona travel --persona shopkeeper --persona negotiator --persona mentalist --model haiku --samples 3 --cap 5 --round r15-pattern` with no `--affected` filter; its 39 commands are round 14's byte for byte once `--out` is set aside.
- **Hand-written section, 30 runs:** round 14's 10 hand-written probes, 3 samples each, byte for byte, appended under a T-0475 comment in `live-commands.sh`.
- **Against round 14:** all 23 cells are shared and no oracle changed. With `--affected 2026-10-26-r14-pattern` the plan keeps only concierge (24 runs): "concierge content changed", the others read unchanged. That change is T-0477 (four em dashes in the concierge Surface style replaced, seed digests re-pinned), so the concierge cells carry a small prompt change; every other cell is like for like.
- **Prompt digests and exemplars:** `signals.md` (Section digests per persona, Exemplar retrieval per persona).

## Churn against round 14 (generated)

From `npm run eval:signals -- --round 2026-10-26-r15-pattern --against 2026-10-26-r14-pattern --min-samples 1`:

| Transition | Count | Cells | Sample 1 |
| --- | --- | --- | --- |
| fail to pass | 3 | `long-concierge-spa-services-haiku`, `pick-mentalist-answer-deck-haiku`, `smoke-mentalist-first-answer-haiku` | 3 |
| pass to fail | 3 | `reach-concierge-day-itinerary-haiku`, `smoke-negotiator-first-offer-haiku`, `smoke-shopkeeper-browse-and-add-haiku` | 2 (not `reach-concierge-day-itinerary-haiku`) |
| fail to fail | 1 | `reach-shopkeeper-cart-amount-haiku` | 0 |
| pass to pass | 16 | stable | 18 |

| Cell | Round 14 | Round 15 |
| --- | --- | --- |
| `long-concierge-spa-services-haiku` | 2 of 3 | 3 of 3 |
| `pick-mentalist-answer-deck-haiku` | 2 of 3 | 3 of 3 |
| `reach-concierge-day-itinerary-haiku` | 3 of 3 | 2 of 3 |
| `reach-shopkeeper-cart-amount-haiku` | 2 of 3 | 2 of 3 (a different failure) |
| `smoke-mentalist-first-answer-haiku` | 1 of 3 | 3 of 3 |
| `smoke-negotiator-first-offer-haiku` | 3 of 3 | 2 of 3 |
| `smoke-shopkeeper-browse-and-add-haiku` | 3 of 3 | 2 of 3 |
| The other 16 cells | 3 of 3 | 3 of 3 |

By preset: concierge 29 of 30 (round 14: 29), croupier 9 of 9 (9), mentalist 6 of 6 (3), negotiator 2 of 3 (3), restaurant 3 of 3 (3), shopkeeper 7 of 9 (8), stylist 3 of 3 (3), travel 6 of 6 (6). All: 65 of 69 (64).

Trace tallies, all samples, round 15 (round 14): halted turns 0 (1); PARSE 4 rounds on 4 turns, 4 saved (15 on 13, 11 saved); string `messages` rounds 3 (10); SURFACE_DEGRADED turns 0 (1); SURFACE_CLAIMED 10 rounds on 10 turns, 10 saved (5 on 4); CHANGE_CLAIMED 3 rounds, 3 saved (0); SURFACE_MISSING 17 on 17, all saved (12 on 12).

## The round 14 clusters, before and after

| Cluster (round 14) | Fix | Round 14 | Round 15 | Verdict | Evidence |
|---|---|---|---|---|---|
| W. A Twenty Questions turn repaired after SURFACE_CLAIMED ships only the ask deck, or halts | T-0468 | `smoke-mentalist-first-answer-haiku` 1 of 3; 1 halt | 3 of 3; 0 halts | holds on mentalist; the same shape now fails on negotiator (W2 below) | Both mentalist SURFACE_CLAIMED repairs (:132, :147) create `ask-1` and `hud-1` together. GAME_HUD_MISSING fired 0 times. |
| X. An ask deck created before another surface in the same turn is superseded, its press sends nothing | T-0467 | `pick-mentalist-answer-deck-haiku` 2 of 3 | 3 of 3 | holds, exercised twice | :132 and :147 create `ask-1` before `hud-1` in one turn, the order that broke round 14's :117, and `click-target` passes on "Yes" in both runs. |
| P3. A say reply that claims an add ships with no update | T-0470, T-0474 | `reach-shopkeeper-cart-amount-haiku` 2 of 3; CHANGE_CLAIMED 0 rounds | 2 of 3; CHANGE_CLAIMED 3 rounds, 3 saved | the check fires and the update lands; two new misses on the add turn (P4 below) | :139 r1 "Added two Brass Arc Floor Lamps. At $189 each, that's $378 so far." targeting `storefront-1` gets CHANGE_CLAIMED, and r2 updates the surface, but with an AmountPicker order column and no ConfirmReceipt. |
| S2. Haiku resends a byte-identical broken `messages` string after the PARSE hint | T-0469 | `long-concierge-spa-services-haiku` 2 of 3; PARSE 15 rounds, 11 saved; 1 SURFACE_DEGRADED | 3 of 3; PARSE 4 rounds, 4 saved; 0 SURFACE_DEGRADED | holds | String `messages` rounds fell from 10 to 3, and each string turn ships (:80, :87, :143). |
| GameHud or ResultCard stats item bound as `{"path": ...}` (single run, round 14 :117) | none filed | 1 turn | 0 of 14 GameHud and ResultCard components | not seen | Watch only. |

## Pattern controls (round 15, Haiku)

| Control | Verdict | Metric |
|---|---|---|
| OptionDeck | holds | Croupier and mentalist pick cells 6 of 6. |
| OptionCompare | holds, every turn after a repair | Travel 3 of 3 (:4, :41, :78), shopkeeper compare 3 of 3 (:122, :137, :152). 0 of 6 ship in round 1, as in round 14, but the repair moved: all six are SURFACE_CLAIMED (round 14: PARSE on the unclosed `components` array). |
| ConfirmReceipt | concierge holds; shopkeeper add turns slip | Shopkeeper add turns 4 of 6 (:43, :80, :124, :154; round 14: 5 of 6); :6 and :139 are P4. |
| AmountPicker | holds where a deal sheet opens | Negotiator deal sheet with its GameHud 4 of 6 turns (:46, :47, :83, :84; round 14: 6 of 6); :9 is W2. Shopkeeper cart lines on :80, :124, :139, :154; inside the StepFlow on :119 and :149. |
| StepFlow | holds | Room booking 3 of 3 (:119, :134, :149). |
| Itinerary | concierge slips once | Concierge day plan 2 of 3 (:120, :135; :150 is Y), travel trip 3 of 3 (:121, :136, :151). |

## Why it failed and how to fix it

All four failing runs reproduce keylessly: `npm run chat:probe -- --replay .sdlc/evals/rounds/2026-10-26-r15-pattern/runs/<run>/fixture.json` exits 1 with the same failed checks. Each row below is a proposal for Kim, not filed.

| Cluster | Runs | Class | Evidence | Fix layer | File | Keyless test that proves it | Proposed ticket |
|---|---|---|---|---|---|---|---|
| W2. A Negotiator opening answered note-only is repaired as its offer card alone, with no GameHud | 1 failed run: `smoke-negotiator-first-offer-haiku-1` (:9, :10) | (c) model, with a (d) check gap | :9 r1 is a meta note with `ask: ask-1` and no tool (SURFACE_CLAIMED). The T-0468 hint's "In a game, also send the game's HUD" did not land: r2 builds `ask-1` alone, a Card holding an AmountPicker. GAME_HUD_MISSING cannot fire: `gameAskHudCheck` needs a new OptionDeck, and its `GAME_WORDS` test finds none of its words (quest, quiz, deal sheet and the like) in "I'd like to buy your brass lantern. What's your price?" or the reply. :10 then answers "I offer 20." in prose with no tool and no code: with no deal sheet open, T-0366's board-less move check has nothing to judge. | catalog check | `packages/agent-ui/a2ui/src/catalog/hidden-state-checks.ts` (`gameAskHudCheck`: judge a new ask surface holding any play control, AmountPicker included, and know the game from the session's game persona or `HUD_GAME_WORDS`, not `GAME_WORDS` alone) | the :9 replay gets GAME_HUD_MISSING and ends with a GameHud; a unit test in `hidden-state-checks.test.ts` with a new AmountPicker ask card and no HUD on a negotiator turn | "GAME_HUD_MISSING also judges a Negotiator offer card with no GameHud" (L2) |
| P4. A shopkeeper add turn ships no ConfirmReceipt: no update at all, or a CHANGE_CLAIMED repair that builds bare AmountPicker lines | 2 failed runs: `smoke-shopkeeper-browse-and-add-haiku-1` (:6), `reach-shopkeeper-cart-amount-haiku-2` (:139) | (d) check gap | :6 answers "Add the first one to my order." with meta `target: shop-1`, prose "The Brass Arc Floor Lamp is in your order at $189." and no tool, in one round with no code: "is in your order" is outside `CHANGE_CLAIM_IN_REPLY` (`produce.ts:1268`). :139 is caught by CHANGE_CLAIMED, but the repair's update holds a Column with one AmountPicker line and no ConfirmReceipt, and no check names the missing receipt: `COMPOSITE_MOMENTS` has no ConfirmReceipt row. | catalog check, plus the regex | `packages/agent-ui/a2ui/src/catalog/composite-moments.ts` (a ConfirmReceipt row for an add-to-order say turn on a storefront), `packages/agent-ui/a2ui/src/agent/produce.ts` (`CHANGE_CLAIM_IN_REPLY`: "is in your order", "in your cart") | the :6 replay gets CHANGE_CLAIMED and the :139 replay a missing-ConfirmReceipt finding, each ending with a ConfirmReceipt; a unit test per wording | "A shopkeeper add turn is held to a ConfirmReceipt, and 'is in your order' counts as an add claim" (L2) |
| Y. A fully specified day plan is answered with a clarifying ask deck and no Itinerary | 1 failed run: `reach-concierge-day-itinerary-haiku-3` (:150) | (c) model, or prompt drift from T-0477 (concierge content changed), with a (d) repair-path gap | The guest gave the date and all three times. :150 r1 writes the plan as a prose list plus a meta note asking how many guests, with `ask: ask-1` and no tool (SURFACE_CLAIMED). r2 builds `ask-1` alone (an OptionDeck of party sizes), so the plan in r1's prose never reaches a surface. The repair names only the claimed surface, as W did before T-0468, and no composite-moment row covers an Itinerary. | catalog check | `packages/agent-ui/a2ui/src/catalog/composite-moments.ts` (an Itinerary row: a say turn that plans a day with two or more timed stops and writes no Itinerary) | the :150 replay gets the missing-Itinerary finding and ends with an Itinerary; a unit test in `composite-moments.test.ts` | "A day plan with timed stops answered with no Itinerary is a missing composite" (L2) |

**Single-run notes, no cluster:** :148 recovers from SURFACE_DROPPED in round 3 and passes; :84 recovers from IDGRAPH in round 3 and passes; :61 needs two rounds for PARSE and passes. Every OptionCompare turn still needs one repair round (above): no fail, but a cost to watch.

**Observed against inferred:** codes, rounds, tool inputs, meta lines and replies are on the trace lines, and the four failures reproduce keylessly. Inferred from source: why GAME_HUD_MISSING stays silent on :9 (`gameAskHudCheck` and `GAME_WORDS`), why :6 slips the claim regex, and that no row names ConfirmReceipt or Itinerary.

Bounded experiment per proposed ticket, measured on the same runs:
- **W2:** the :9 replay and the unit test, then `smoke-negotiator-first-offer-haiku`, 3 samples.
- **P4:** the :6 and :139 replays, then `smoke-shopkeeper-browse-and-add-haiku` and `reach-shopkeeper-cart-amount-haiku`, 3 samples each.
- **Y:** the :150 replay, then `reach-concierge-day-itinerary-haiku`, 3 samples.

## Tickets
None filed by this round (the solo seat files none). Proposed, one per cluster: W2, P4 and Y, as in the table above.

## Process notes
- **Batches:** a probe took about 10 s to 1 min; `--max 10` to `--max 12` batches fit the 10 minute foreground limit, and each restart skipped every run that already had a report.
- **live-commands.sh:** written to the task's runtime folder inside the worktree, so the runner copied it in and retargeted each `--out`; `README.md` regenerated with `run-capped.ts --describe` after this report.
- **Worktree key:** the lane worktree has no repo-root `.env`; it was linked to the main checkout's git-ignored file (never read), and the plumbing probe proved the link before the round.
