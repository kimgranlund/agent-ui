# T-0360 live round 11: report

Round 11 ran on 2026-10-18 UTC (07:56 to about 10:00) at `8421bba9`, a targeted cycle measuring the round 10 cluster fixes: T-0344 (A, PARSE asks for an array), T-0346 (C, a showdown settles), T-0347 (D, a natural skips the rest of the hand), T-0348 (E, a playing card is not a UI card), plus T-0350 (DEAL_AGAIN_MISSING) and T-0357 (POKER_DEAL_MISSING on a hold'em opening). Trace line numbers (`:n`) are 1-based lines of `traces/2026-10-18.jsonl` in this folder; round 10's are marked r10.

**44 of 44 runs, 34 passed and 10 failed, $7.90 in the ledger against the $10 cap, stop done, 0 cap skips.** The judge added $0.74 (44 of 44 judged), so the round spent $8.64 at list prices, plus $0.02 of stray runs removed from the archive (below). No turn halted, no trace line is a provider error, so nothing was quarantined. Recorded `max_tokens` stops: 1 of 446 rounds (:227 round 1, repaired).

The tables below are generated: `signals.md` holds the round's own tables, and the churn and tally rows come from `npm run eval:signals -- --round 2026-10-18-r11-targeted --against 2026-10-17-r10-targeted --min-samples 1`.

## Comparison set
- **Set:** the croupier regression, routing and long cells, planned from tags with `plan.ts` (T-0343): Haiku 3 samples (33 runs), then Sonnet 1 sample (11 runs). `--samples` applies to every model of one plan, so `live-commands.sh` is the two `plan.ts` outputs concatenated unchanged, with both argv lines in their headers.
- **Against round 10:** 17 cells shared. 7 are new here (Sonnet blackjack-rounds, five-card-draw, omaha, pontoon, guidance-conflict, long-blackjack-hand, and Haiku five-card-draw); 8 round 10 cells are not run (concierge, admiral, Opus hold'em, routing-long-session). A targeted cycle: no claim below says a fix holds outside these runs.
- **Prompt digests:** grammar `23564711cd22fba5` and functions `47a0f7781dd9bec2` are round 10's, so a difference below is not a grammar change.
- **Analysis config:** the fog manifest is round 10's (hash `1999c4dd1cdc`), so detector coverage compares with round 10 directly.
- **Stray runs removed:** another lane wrote its own `live-commands.sh` to the shared session scratchpad while this round ran from that path, so one resume played its 3 Haiku smoke runs (mentalist, negotiator, dungeon-master, $0.02) into this folder. Their `runs/` folders, ledger rows and 6 trace lines were removed before the last 3 runs; the round then ran from `.sdlc/runtime/tasks/0360-live-round-11/live-commands.sh`, which is the copy in this folder.

## Churn against round 10 (generated)

| Transition | Cells | Sample 1 only |
| --- | --- | --- |
| fail to pass | 3: `long-croupier-blackjack-hand-haiku`, `regress-croupier-blackjack-rounds-haiku`, `regress-croupier-texas-holdem-sonnet` | 3: `omaha-haiku`, `texas-holdem-haiku`, `texas-holdem-sonnet` |
| pass to fail | 2: `regress-croupier-seven-card-stud-haiku`, `regress-croupier-spanish-21-haiku` | 1: `seven-card-stud-haiku` |
| fail to fail | 4: `regress-croupier-omaha-haiku`, `regress-croupier-pontoon-haiku`, `regress-croupier-texas-holdem-haiku`, `routing-guidance-conflict-haiku` | 2: `pontoon-haiku`, `guidance-conflict-haiku` |
| pass to pass | 6 | 9 |

As rates (round 10 to round 11): blackjack-rounds-haiku 1 of 3 to 3 of 3, long-blackjack-hand-haiku 2 of 3 to 3 of 3, omaha-haiku 0 of 1 to 2 of 3, pontoon-haiku 0 of 1 to 2 of 3, texas-holdem-haiku 0 of 1 to 2 of 3, seven-card-stud-haiku 1 of 1 to 1 of 3, spanish-21-haiku 1 of 1 to 2 of 3, guidance-conflict-haiku 2 of 3 to 0 of 3. Sonnet: 10 of 11, the one failure is guidance-conflict (cluster G).

## Round 10 fixes, live (one mechanism metric each)

| Ticket | Verdict | Mechanism metric (round 11, round 10 same cells) |
|---|---|---|
| T-0344 PARSE asks for an array (A) | holds on Sonnet, not on one Haiku turn | Sonnet: 8 of 8 string `messages` rounds answered by an array on the next round (r10: 3 of 4; r10 :193 sent three strings and degraded). PARSE turns: 16, 15 saved (r10: 10 turns, 2 degraded). The one degraded turn is Haiku :117 (`spanish-21-haiku-2`): three string rounds in a row, SURFACE_DEGRADED, and the run fails. String rounds per turn are unchanged (16 of 362, r10 8 of 175). |
| T-0346 showdown settles (C) | holds (no counter-case) | SHOWDOWN_UNSETTLED fired 0 times. Of 16 poker runs, every hand that reached its showdown offered Deal again on the same turn; the 3 poker runs that missed Deal again never reached the showdown (cluster H, a street-behind Omaha, and a stud run that misread a new table, below). `omaha-haiku` 2 of 3 (r10: 0 of 1). |
| T-0347 natural skips the hand (D) | fixed live | `--skip-if-phase settled` skipped 4 steps in 3 runs (`blackjack-rounds-haiku-2`, `-3`, `pontoon-haiku-3`), all 3 pass. `blackjack-rounds-haiku` 3 of 3 (r10: 1 of 3). The one pontoon failure is a different scenario defect (J). |
| T-0348 playing card is not a UI card (E) | fixed live, exposes an oracle defect | SURFACE_REQUESTED 0 of 4 hole-card turns (r10: 3 of 3). The correct text refusal now ships no table update, and the scenario step still expects one: 0 of 4 runs pass (cluster G). |
| T-0350 DEAL_AGAIN_MISSING | not exercised | Fired 0 times; no settled table shipped without Deal again. |
| T-0357 POKER_DEAL_MISSING | partly (one gap) | Fired 0 times. 3 of 4 hold'em openings dealt on turn 0. `texas-holdem-haiku-3` opened stake-first through a SURFACE_MISSING repair round whose PlayingCards are templates over empty hands, which the check exempts (cluster H). |
| T-0354 format asks force a surface | not exercised | A Concierge path; no Concierge cell ran. |

**Haiku blackjack openings (round 9 cluster B, T-0345 text change held):** round 1 BET_TABLE_MISSING on 7 of 15 openings in the five 3-sample cells (r10: 7 of 15), every one repaired, no halt. Unchanged, as expected with the text held.

**Still unmeasured:** the admiral opening-salvo count noted for T-0341 (no admiral cell ran).

## Judged checks (generated)

| Rubric | Model | Judged | Pass | Mean score |
| --- | --- | --- | --- | --- |
| croupier | haiku | 33 | 26 | 3.24 |
| croupier | sonnet | 11 | 11 | 4.64 |

C4 (reply agrees with the table) fails 7 of 44, C1 3, C2 3, C3 1. The 7 failed Haiku runs: `blackjack-moves-1`, `five-card-draw-2`, `omaha-1`, `omaha-2`, `seven-card-stud-1`, `seven-card-stud-3`, `texas-holdem-1`; 6 of them passed the probe. Five are poker runs whose pot and bankroll drift across turns (cluster K). The `blackjack-moves-1` C4 rationale contradicts itself (it finds every total consistent, then scores 2 for a turn with no surface), so treat that one as judge noise.

## Why it failed and how to fix it
A decision analysis with the context-fog-of-war skill, fog report `2b3686ac6ec777c349cb5600`: decision d1 is cluster A after T-0344, d2 to d6 are clusters G to K, with 3 guidance edges and 6 reviewed findings. Every citation is an exact excerpt of a trace line event. Verdicts and failing checks come from `runs/*/report.json`.

**What the traces rule out:** `retrieved-not-submitted` found no omission in 362 linked pairs and `truncation` no signal in 362 envelopes. No failure is lost context.

| Cluster | Runs | Class | Evidence | Fix layer | File | Keyless test that proves it | Ticket |
|---|---|---|---|---|---|---|---|
| A (round 10). A Haiku string `messages` survives the array ask | 1: `spanish-21-haiku-2` (:117) | (c) model does not follow clear repair guidance | Rounds 1 to 3 all send a string; PARSE sends 1 and 2 back; the turn ships SURFACE_DEGRADED with no table-3. Sonnet switches on the first ask 8 of 8. | none yet: one Haiku turn of 16 PARSE turns; Kim ruled out bracket repair (2026-10-17) | `packages/agent-ui/a2ui/src/agent/response-type.ts` `messagesParseNote` | measure again next round | none (T-0344 closed; watch) |
| G. The hole-card step expects a table update a correct refusal never sends | 4: `guidance-conflict-haiku-1` to `-3` (:83, :175, :258), `-sonnet-1` (:354) | (d) oracle defect | Each run fails only `expect-turn CardTable` on "Show me the dealer's hole card."; the reply refuses correctly and the table stays (the next step plays on table-1). Round 10's passes came from the SURFACE_REQUESTED false fire T-0348 removed. | scenario step | `scripts/e2e-admin/probe/scenarios/routing.ts:108` | the keyless replay of `guidance-conflict-haiku-1` passes | T-0367 (P2) |
| H. POKER_DEAL_MISSING exempts PlayingCard templates over empty hands | 1: `texas-holdem-haiku-3` (:222 to :226) | (d) check gap | :222 round 1 is prose (SURFACE_MISSING); round 2 ships `holdem-table-1` with `playerHand: []` and "Choose your bet below, then deal". `betStepWithoutTable` returns on any PlayingCard. :223 "There's no hand in progress yet" deals late, the hand runs a street behind, Deal again never appears. | croupier check | `packages/agent-ui/a2ui/src/catalog/personas/croupier/checks.ts` | a check test on the :222 round 2 payload fires POKER_DEAL_MISSING | T-0368 (P2) |
| I. LONE_BUTTON_FRAME misses a lone Button inside a one-child Row | 1: `seven-card-stud-haiku-2` (:164) | (d) check gap | The settled table leaves `actionCard` > `actionFooter` > `actionRow` > `againBtn`; the probe render lint fails turns 5 to 9, no producer code fires. | framed-choice check | `packages/agent-ui/a2ui/src/catalog/framed-choice-check.ts` | a test on the :164 shape fires LONE_BUTTON_FRAME | T-0369 (P3) |
| J. The pontoon scenario sticks under 15 | 1: `pontoon-haiku-1` (:37, :38) | (d) scenario defect | After Buy a card the hand is 14; "You can't stick on 14" is right by pontoon's rules, the hand never settles, and the Deal again click lands on the older table-1. The agent was right. | scenario steps | `scripts/e2e-admin/probe/scenarios/croupier.ts:60` | the keyless replay of `pontoon-haiku-1` passes; a hand that sticks on 15 or more is unchanged | T-0370 (P2) |
| K. No check reads poker pot and bankroll arithmetic | 0 probe failures; 5 judged C4 failures (`omaha-haiku-1`, `-2`, `texas-holdem-haiku-1`, `seven-card-stud-haiku-1`, `-3`) | (d) check gap, found by the judge | `omaha-haiku-2` (:139 to :146): the replies price one hand as a 30 loss, then a 10 loss, at the same 960 bankroll. BANKROLL_MISMATCH covers the blackjack family only. | croupier check | `packages/agent-ui/a2ui/src/catalog/personas/croupier/checks.ts` | a check test on the :139 to :146 sequence fires | T-0371 (P2) |

**Single-run model errors, no cluster:** `omaha-haiku-3` (:229) bets the pot and leaves the opponent's call pending ("The big blind has to call or fold"), so the scripted hand runs a street behind and ends on the river with no Deal again. `seven-card-stud-haiku-1` (:75, :76) deals the next hand on a new surface `table-2`, then answers "Fold." with "The hand is already over" about the settled `table-1`. Both are (c), Haiku, one run each; watch them next round before filing.

**Observed against inferred:** the codes, rounds, tool inputs, stop reasons and replies are recorded. Inferred: the early return in H and the matching rule in I (read from source), and the poker coverage in K (read from the check code list).

Bounded experiment per ticket, measured on the same runs:
- **G:** the replay, then `routing-guidance-conflict` Haiku 3 samples and Sonnet 1.
- **H:** the check test, then `texas-holdem-haiku` 3 samples.
- **I:** the check test, then `seven-card-stud-haiku` 3 samples.
- **J:** the replay, then `pontoon-haiku` 3 samples.
- **K:** the check test, then the judged C4 rate on the 9 Haiku poker runs.

## Context fog-of-war
- **Record:** `.sdlc/evals/fog/2026-10-18-r11-targeted.json`. Ingested with `.sdlc/evals/fog-manifest.json` (engineering run `run-f8c41dbaacffe13714c81124`) from this folder, no line blanked, hydrated and published as report `2b3686ac6ec777c349cb5600`: 1170 events, 334 sources, 6 decisions, 3 guidance edges, 6 findings, 0 diagnostic findings.
- **Detectors:** `truncation` (362 envelopes) and `retrieved-not-submitted` (362 pairs) gave no signal. `stop-at-cap` had no eligible candidate: every round records a stop reason (one `max_tokens`, :227). The other six had no eligible trigger in a web-chat bundle.

## Tickets filed
- **T-0367 (P2, G):** the hole-card step expects the table to persist, not to update.
- **T-0368 (P2, H):** POKER_DEAL_MISSING judges a PlayingCard template over an empty hand as undealt.
- **T-0369 (P3, I):** LONE_BUTTON_FRAME sees through a one-child Row.
- **T-0370 (P2, J):** the pontoon scenario survives a refusal to stick under 15.
- **T-0371 (P2, K):** a Croupier check for poker pot and bankroll arithmetic.

## Process notes
- **Shared scratchpad:** a commands file in the session scratchpad is not private to a lane; plan a round's `live-commands.sh` under its task folder (`.sdlc/runtime/tasks/<task>/`). `run-capped.ts` also copies the file into the round only when its path is repo-relative (an absolute path is joined to the root and skipped).
- **Plan header:** `plan.ts` writes no `# est` lines, so the cap is checked only before each run; the round stayed $2.10 under the cap.
