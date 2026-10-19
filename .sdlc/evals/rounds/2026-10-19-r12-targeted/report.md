# T-0376 live round 12: report

Round 12 ran on 2026-10-19 UTC (00:50 to 01:53) at `76aa91fb` (main `97fe7a8d2` plus the handoff cap line), a targeted cycle measuring the round 11 wave: T-0345 (croupier openings deal on the first turn), T-0359 (Stylist palettes on a token surface), T-0363 (a game's HUD beside its ask), T-0367 (hole-card oracle), T-0368 (POKER_DEAL_MISSING over empty-hand templates), T-0369 (LONE_BUTTON_FRAME through one-child wrappers), T-0370 (pontoon stick under 15), T-0371 (poker chip check) and T-0375 (no Row around a lone action Button). Trace line numbers (`:n`) are 1-based lines of `traces/2026-10-19.jsonl` in this folder; round 11's are marked r11.

**45 of 45 runs, 39 passed and 6 failed, $1.15 in the ledger against the $12 cap (Kim, 2026-10-18), stop done, 0 cap skips.** The judge added $0.58 (36 of 36 croupier runs judged; two replies did not parse on the first pass and were judged on a rerun), so the round spent $1.73 at list prices. No turn halted, no trace line is a provider error, nothing was quarantined. No `max_tokens` stop.

The tables below are generated: `signals.md` holds the round's own tables, and the churn rows come from `npm run eval:signals -- --round 2026-10-19-r12-targeted --against 2026-10-18-r11-targeted --min-samples 1`.

## Comparison set
- **Set:** planned with `plan.ts --tag smoke --tag regression --tag routing --tag long --persona croupier --persona stylist --persona mentalist --persona negotiator --model haiku --samples 3 --cap 12 --round r12-targeted --affected 2026-10-18-r11-targeted`: 45 Haiku runs, 3 samples each. The `--affected` header reads croupier "content changed"; stylist, mentalist and negotiator entered as "no recorded resolution" (round 11 never ran them), not as a measured content change.
- **Against round 11:** the 11 croupier Haiku cells are shared. New here: the croupier, stylist, mentalist and negotiator smoke cells. Not run: round 11's 11 Sonnet cells (the Goal measures on Haiku). A targeted cycle: no claim below says a fix holds outside these runs.
- **Prompt digests:** grammar is `b792c80264762074` (r11 `23564711cd22fba5`; T-0363 edited grammar.md), functions `47a0f7781dd9bec2` is unchanged.
- **Analysis config:** the fog manifest is round 11's (hash `1999c4dd1cdc`), so detector coverage compares with round 11 directly.
- **Archive date:** the round started after midnight UTC, so the folder is `2026-10-19-r12-targeted`.

## Churn against round 11 (generated)

| Transition | Cells | Sample 1 only |
| --- | --- | --- |
| fail to pass | 4: `regress-croupier-omaha-haiku`, `regress-croupier-pontoon-haiku`, `regress-croupier-spanish-21-haiku`, `routing-guidance-conflict-haiku` | 2: `pontoon-haiku`, `guidance-conflict-haiku` |
| pass to fail | 1: `regress-croupier-five-card-draw-haiku` | 2: `five-card-draw-haiku`, `texas-holdem-haiku` |
| fail to fail | 2: `regress-croupier-seven-card-stud-haiku`, `regress-croupier-texas-holdem-haiku` | 1: `seven-card-stud-haiku` |
| pass to pass | 4 | 6 |

As rates (round 11 to round 12): guidance-conflict 0 of 3 to 3 of 3, omaha 2 of 3 to 3 of 3, pontoon 2 of 3 to 3 of 3, spanish-21 2 of 3 to 3 of 3, seven-card-stud 1 of 3 to 2 of 3, texas-holdem 2 of 3 to 2 of 3, five-card-draw 3 of 3 to 2 of 3; the other four shared cells stay 3 of 3. Croupier 33 of 36, mentalist 3 of 3, negotiator 3 of 3, stylist 0 of 3.

## Round 11 wave, live (one mechanism metric each)

| Ticket | Verdict | Mechanism metric (round 12, round 11 Haiku same cells) |
|---|---|---|
| T-0345 openings deal on the first turn | holds | Blackjack-family openings with a CardTable in round 1: 17 of 18 (r11 9 of 15); BET_TABLE_MISSING 0 rounds (r11 8). The one miss is a string `messages` round repaired by PARSE (:94, cluster A). Poker openings with PlayingCards on turn 0: 12 of 12, hold'em 3 of 3. |
| T-0359 Stylist palette on a token surface | holds, exposes a render defect | 3 of 3 palette turns ship Swatch, Ramp and ContrastPair in round 1 with no repair (:3, :96, :197; the smoke round's :9 was prose). All 3 runs fail only the render lint nested-card: the ContrastPair is a ui-card inside the root Card (cluster L). |
| T-0363 HUD beside the ask | holds | 6 of 6 Mentalist and Negotiator openings put the GameHud on `hud-1` beside `ask-1` (:4, :6, :97, :99, :198, :200); FEED_SCOPE, FEED_SCOPE_RESCOPED and GAME_HUD_MISSING fired 0 times; 6 of 6 runs pass. No earlier live baseline. |
| T-0367 hole-card oracle | fixed live | guidance-conflict 3 of 3 (r11 0 of 3); each hole-card turn refuses in text with no table update (:85, :186, :288). |
| T-0368 POKER_DEAL_MISSING over empty-hand templates | not exercised | Fired 0 times; no poker opening shipped an empty `playerHand` (r11 1, texas-holdem-haiku-3 :222). |
| T-0369 LONE_BUTTON_FRAME through one-child wrappers | not exercised | Fired 0 times and no probe render lint flagged a lone-button frame (r11 1 run, :164). |
| T-0370 pontoon stick under 15 | fixed live | pontoon 3 of 3 (r11 2 of 3); the refusal path ran once: "You can't stick on 14" at :139, and `pontoon-haiku-2` passes. |
| T-0371 poker chip check | partly | POKER_CHIPS_MISMATCH fired on 3 rounds (:58, :60, :155), all repaired. The judged C4 failure rate on the 9 hold'em, Omaha and stud runs is 5 of 9, as in round 11; the judge cites reply prose that drifts across turns and hands (cluster K stays open). |
| T-0375 no Row around a lone action Button | not reached | Turns sending a Deal again Button inside a one-child Row: 12 of 44 (r11 14 of 53), all on poker tables. 11 of the 12 loaded neither card-game-sheet nor game-table-chrome (their mini-skills: game-hud or none), so the reworded teaching never reached them (cluster O). Where it was present, 1 of 2 poker Deal again turns conform (:277 in the CardFooter directly, :144 still in a one-child Row): too few to judge the wording itself. |

**Round 11 watch items:** cluster A (Haiku string `messages`): 3 PARSE repairs on 3 turns, all saved, 0 degraded (r11 Haiku 10 on 8 turns, 1 degraded). The single-run errors (an Omaha hand a street behind, a stud run that misread a new table) did not recur.

## Judged checks (generated)

| Rubric | Model | Judged | Pass | Mean score |
| --- | --- | --- | --- | --- |
| croupier | haiku | 36 | 28 | 3.75 |

Round 11 Haiku: 26 of 33, mean 3.24. C4 (reply agrees with the table) fails 8 of 36, C3 1, C1 and C2 0. The 8 failed runs: `blackjack-moves-2`, `blackjack-rounds-1`, `five-card-draw-3`, `omaha-1`, `omaha-2`, `omaha-3`, `seven-card-stud-2`, `texas-holdem-1`; 7 of them passed the probe. The `texas-holdem-1` rationale finds the reply consistent with the surface and scores it 2 for wording ("lose 50, bankroll stays at 950" after the stake was taken), so treat that one as judge strictness.

## Why it failed and how to fix it
A decision analysis with the context-fog-of-war skill, fog report `6bae5f5b20e6a9741951dd4a`: d1 is T-0359 and cluster L, d2 to d3 are clusters M and N, d4 is T-0371 against cluster K, d5 is T-0375 and cluster O, d6 the T-0367 and T-0370 oracles, with 1 guidance edge and 6 reviewed findings. Every citation is an exact excerpt of a trace line event. Verdicts and failing checks come from `runs/*/report.json`.

**What the traces rule out:** `retrieved-not-submitted` found no omission in 293 linked pairs and `truncation` no signal in 296 envelopes. No failure is lost context.

| Cluster | Runs | Class | Evidence | Fix layer | File | Keyless test that proves it | Proposed ticket |
|---|---|---|---|---|---|---|---|
| K (round 11). Poker chip drift in reply prose | 0 probe failures; 5 judged C4 failures on 9 hold'em, Omaha and stud runs (`omaha-haiku-1` to `-3`, `seven-card-stud-haiku-2`, `texas-holdem-haiku-1`) | (d) check gap, found by the judge | `omaha-haiku-3`: "You bet the pot at $15. The opponent calls, so the pot is $30."; `seven-card-stud-haiku-2` (C4 1): the judge finds the reply admitting a bankroll mismatch with the table (1,015 against 1,030). POKER_CHIPS_MISMATCH reads one turn's table. | croupier check | `packages/agent-ui/a2ui/src/catalog/personas/croupier/checks.ts` | a check test on the `omaha-haiku-3` sequence fires | P2: read the reply's stated pot and bankroll against the table and carry the bankroll across Deal again |
| L. A ContrastPair inside a root Card is a card in a card | 3: `smoke-stylist-palette-haiku-1` to `-3` (:3, :96, :197) | (d) render defect exposed by a fix | Each payload roots a Card > CardContent > Column holding ContrastPairs; the ContrastPair factory renders a `ui-card`, so the probe render lint fails nested-card on turn 0 and the run fails. | stylist factory, or a check, or the Stylist teaching | `packages/agent-ui/a2ui/src/catalog/personas/stylist/factories.ts` | a keyless replay of :3 passes render-lint, or a stylist check test on the :3 payload fires | P2 |
| M. A poker hand settled by data model only offers no Deal again | 2: `texas-holdem-haiku-1` (:52), `seven-card-stud-haiku-1` (:77, :78) | (d) check gap | The showdown comes in an ACTION_NOT_APPLIED repair round that sends only `updateDataModel` (`"phase": "Showdown"`, `"street": "Showdown"`); Check, Bet and Fold stay, the Deal again click fails. DEAL_AGAIN_MISSING reads CardTable phases only, and SHOWDOWN_UNSETTLED passes once the hand is face up with a result stated. | croupier check | `packages/agent-ui/a2ui/src/catalog/personas/croupier/checks.ts` `dealAgainMissing` | a check test on the :52 round 2 payload fires DEAL_AGAIN_MISSING | P2 |
| N. PlayingCard size sm renders under the type floor | 1: `five-card-draw-haiku-1` (:63 to :72) | (d) component defect | The opening sizes every PlayingCard `sm` (the croupier catalog allows it); the render lint reads the index at 7.875px and the pip at 8.4px on all 10 turns. The only run in rounds 11 and 12 that chose sm. | playing-card CSS, or the catalog enum | `packages/agent-ui/components/src/controls/playing-card/` | a browser test renders PlayingCard sm at the widget tier with the index at or above the floor | P3 |
| O. The lone-Button rule does not reach poker Deal again turns | 0 probe failures; 12 turns in 8 runs (five-card-draw 7, Omaha 3, hold'em 2) | (b) guidance not routed | :57 sends `actions` Row > `againBtn`; 11 of 12 such turns load game-hud or no mini-skill, card-game-sheet once (:144), game-table-chrome never. grammar.md:188 says a lone action carries no Row. | prompt routing | `packages/agent-ui/a2ui/src/agent/prompts/mini-skills/game-hud.md` (or a check) | the composed prompt of the :57 turn holds the one-Button rule | P3 |

**Single-run model errors, no cluster:** `pontoon-haiku-1` (:45) lets a bought hand of 22 stick and calls it bust on stick instead of on the buy; no check fired and the run passes. `five-card-draw-haiku-3` prices a 100-chip pot after replies that kept it at 0 (judged C4). Both are (c), Haiku, one run each; watch them next round.

**Observed against inferred:** the codes, rounds, tool inputs, stop reasons, mini-skill loads and replies are recorded. Inferred: the ContrastPair factory rendering a ui-card and the CardTable-only reach of DEAL_AGAIN_MISSING (read from source), the CSS cause in N, and the Row in O persisting from the opening's actions Row.

Bounded experiment per proposed ticket, measured on the same runs:
- **K:** the check test, then the judged C4 rate on the 9 Haiku hold'em, Omaha and stud runs.
- **L:** the replay or check test, then `smoke-stylist-palette-haiku` 3 samples.
- **M:** the check test, then `texas-holdem-haiku` and `seven-card-stud-haiku` 3 samples.
- **N:** the browser test; no live cell needed.
- **O:** the composed-prompt test, then the one-child Row count on the 12 poker Haiku runs.

## Context fog-of-war
- **Record:** `.sdlc/evals/fog/2026-10-19-r12-targeted.json`. Ingested with `.sdlc/evals/fog-manifest.json` (engineering run `run-6a2d889e7fc9714bdce95b65`) from this folder, no line blanked, hydrated and published as report `6bae5f5b20e6a9741951dd4a`: 954 events, 299 sources, 6 decisions, 1 guidance edge, 6 findings, 0 diagnostic findings.
- **Detectors:** `truncation` (296 envelopes) and `retrieved-not-submitted` (293 pairs, 3 unsuccessful returns excluded) gave no signal. `stop-at-cap` had no eligible candidate: every round records a stop reason. The other six had no eligible trigger in a web-chat bundle.

## Tickets
None filed by this round (the solo seat files none). Proposed, one per cluster: K (reopen as a reply-side chip check), L, M, N, O, as in the table above.

## Process notes
- **Batches:** a probe run took 30 s to 2.5 min; batches of 3 to 5 under `--max` fit the 10 minute foreground limit, and a restart skipped every run that already had a report.
- **Worktree key:** a lane worktree has no repo-root `.env`; the first batch exited 2 on setup with $0 spent until the conductor linked it.
