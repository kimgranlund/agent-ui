# T-0326 live round 9: report

Round 9 ran on 2026-10-17 UTC (10:38 to 12:49) at `acbbf572`, sample 1, default effort. It reran round 8's comparison set: the same 87 runs, scenarios, models and order (`scripts/e2e-admin/probe/scenarios/round9.ts`). It measures the round 8 fixes: T-0320 (a brace verdict), T-0321 (the forced SURFACE_DROPPED repair, where the fallback never ships a check-failed round), T-0322 (check gaps), T-0323 (poker on a Card frame), T-0324 (blackjack natural) and T-0325 (the hold'em scenario). Trace line numbers (`:n`) are 1-based lines of `traces/2026-10-17.jsonl` in this folder.

**Kim's T-0321 condition is met: halts rose from 0 to 6.** Every halt is a Haiku turn that ends `ProduceHalt` with SURFACE_DROPPED (:1, :120, :127, :128, :143, :147, in 5 runs; round 8: 0 of 548 lines). Five of the six are cluster A: a repair round rebuilt the flagged surface under a new surface id, which the drop rule counts as a loss. The sixth (:127) is the halt T-0321 chose on purpose: a text read-back that failed BOOKING_FORM_MISSING, a round cut at max_tokens (PARSE), then prose, and no round left that passed every check.

The capped runner finished 87 of 87 for an estimated $36.69 against the $42 cap (stop: done). 77 runs passed and 10 failed, the same totals as round 8 with 12 different runs:
- **Sonnet:** 28 of 29 (round 8: 29). One pass turned to a fail (E).
- **Haiku:** 22 of 29 (round 8: 22). 6 failures now pass, and 5 passes now fail (A, C).
- **Opus:** 27 of 29 (round 8: 26). Hold'em passes on its changed script. The PlayingCard type floor (F) still fails 2 runs.

No trace line is a provider error (no usage-limit, overload or auth turn), so nothing was quarantined or excluded.

## Comparison set
- **Set:** round 8's 87 runs (`round8Runs()`). The texas-holdem steps changed under T-0325 on all three models, so those 3 runs are a new baseline, not a comparison. The other 84 commands are identical apart from `--out`.
- **Prompt digests (`routing.sections[].digest`):** grammar `23564711cd22fba5` and the components and functions digests are unchanged from round 8. The Concierge and plain agent-ui persona digests are unchanged too. Only the Croupier's mini-skills and persona sections moved, which is the T-0323 text: on the blackjack opening, mini-skills `44aae564` became `f26c105c` and persona `ea09cdf4` became `0708fe4d`.
- **Analysis config:** the fog mapping hash is unchanged (`2dff31b70205`, as in round 8), so coverage compares directly.
- **Prices:** the round.json table, the same as round 8.

## Pass rate, preset by model (rounds 6 and 8 for comparison)
| Preset | Haiku r9 | Sonnet r9 | Opus r9 | r8 (H / S / O) | r6 (H / S / O) |
|---|---|---|---|---|---|
| Croupier | 7 of 11 | 10 of 11 | 9 of 11 | 9 / 11 / 8 | 9 / 9 / 10 |
| Concierge | 8 of 11 | 11 of 11 | 11 of 11 | 8 / 11 / 11 | 8 / 11 / 11 |
| Lexicographer | 4 of 4 | 4 of 4 | 4 of 4 | 2 / 4 / 4 | 4 / 4 / 4 |
| Admiral | 3 of 3 | 3 of 3 | 3 of 3 | 3 / 3 / 3 | 2 / 2 / 2 |
| All | 22 of 29 | 28 of 29 | 27 of 29 | 22 / 29 / 26 | 23 / 26 / 27 |

A preset's row counts its preset, routing and long-flow runs, as in rounds 6 and 8.

## Churn against round 8 (the same 87 runs)
| Transition | Count | Runs (cluster or reason) |
|---|---|---|
| fail to pass | 6 | `five-card-draw-haiku` (T-0323: PlayingCard on turn 0), `texas-holdem-opus` (T-0325, a changed case and a new baseline), and four with no fix exercised: `invalid-then-replay-haiku`, `long-concierge-booking-haiku`, `long-booking-confirm-haiku`, `long-game-give-up-haiku`. Their round 8 conditions (a prose opening, an edit in prose, a SURFACE_DROPPED prose round, a broken `messages` string) did not recur, so treat these four as noise, not fixes. |
| pass to fail | 6 | `routing-domain-switch-haiku`, `routing-guidance-conflict-haiku`, `long-blackjack-hand-haiku`, `routing-long-session-haiku` (A); `long-spa-services-haiku` (C); `blackjack-moves-sonnet` (E) |
| fail to fail, same cause | 2 | `omaha-opus`, `five-card-draw-opus` (F, the PlayingCard type floor, T-0189) |
| fail to fail, new cause | 2 | `blackjack-rounds-haiku` (it failed rounds 6, 7 and 8 on a new cause each time, and round 9 on A; four rounds and four causes, so it is unstable: sample it N times before fixing it again); `facilities-then-tour-haiku` (round 8 D is fixed live at :86; it now fails on D) |
| pass to pass | 71 | stable |

Probe checks that failed: render-lint on 20 turns (all in F), no-halt on 6, expect-component on 8, click-target on 5 (4 after a turn-0 halt left no button) and routing-expect on 3 (a halted turn has no `routing.sections`).

## Round 8 fixes, live (one mechanism metric each, against round 8)
| Ticket | Verdict | Mechanism metric (round 9, round 8) |
|---|---|---|
| T-0320 brace verdict | n/a (diagnosis, no code change) | `messages` sent as a string: 6 calls (Haiku 2, Sonnet 4), round 8: 17. PARSE: 8 rounds on 7 turns, round 8: 17 on 16. PARSE repair cost: $0.30, round 8: $0.88. After a string PARSE, 5 of 6 repair rounds sent an array (round 8: 14 of 16). The model's error got rarer on its own. Nothing was decoded (MESSAGES_STRING_DECODED 0 both rounds). |
| T-0321 forced SURFACE_DROPPED round, narrowed fallback | mechanism fixed live, outcome regressed | Every round after a SURFACE_DROPPED round ran forced with thinking off and called render_surface: 7 of 7 (:1, :84, :120, :128, :143, :147, :157), round 8: 0 of 4. Clean saves: 0 of 7. Five resent a renamed surface and halted (A), :157 resent the rejected read-back (C) and :84 shipped a read-back no check catches (D). EARLIER_ROUND_SHIPPED: 1 (:74, a FEED_SCOPE-only round), round 8: 2. No semantically flagged round shipped as the fallback. Halts: 6, round 8: 0. |
| T-0322 C1 word-game opening | not exercised | The word-game opening SURFACE_MISSING fired 0 times. The opening shipped a surface, and `invalid-then-replay-haiku` passes. |
| T-0322 C2 concierge-edit-applied | not exercised | The Concierge ACTION_NOT_APPLIED fired 0 times. No Concierge edit turn went unapplied, and `long-concierge-booking-haiku` passes. |
| T-0322 D priced rows on a services ask | fixed live | PRODUCT_CARD_MISSING on a priced DescriptionList fired 2 times. :86 (Haiku, the round 8 D turn) shipped a ProductCard Grid on round 3. :257 (Sonnet) is not saved, because a BOOKING_CONFIRMATION_MISSING false fire (G) shipped the turn uncorrected. Round 8: 0 fires on this shape. |
| T-0323 poker on a Card frame | fixed live for poker; regressed blackjack | Poker: 12 of 12 runs open on a Card frame with PlayingCard on turn 0 (round 8: 10 on a Card frame and 11 with PlayingCard on turn 0; `five-card-draw-haiku` held a CardTable for 5 turns), and `five-card-draw-haiku` passes. DEALT_IN_BETTING fired 0 times (no poker CardTable, so not exercised). Blackjack: Haiku round 1 builds an ask Card with a Slider on 5 of 7 openings (round 8: 1 of 7), and BET_TABLE_MISSING went from 1 turn to 5 (B). |
| T-0324 blackjack natural | not exercised | SETTLED_WITHOUT_NATURAL fired 0 times. `blackjack-rounds-haiku` halted on turn 0, so its deal never ran. NATURAL_ACTIONS fired on two real naturals (:19, :27). |
| T-0325 hold'em scenario | fixed (scenario) | texas-holdem passes on 3 of 3 models (round 8: 2 of 3). It is a changed case, so it is a new baseline. `texas-holdem-opus` cost $1.36 (round 8: $0.64) on its longer script. |

## T-0321 halt count
| | Round 8 | Round 9 |
|---|---|---|
| Halted turns (`outcome: halt`) | 0 of 548 | 6 of 534 (all Haiku) |
| Runs with a halt | 0 | 5: `blackjack-rounds`, `routing-domain-switch`, `routing-guidance-conflict`, `long-blackjack-hand`, `routing-long-session` (all Haiku) |
| Halts on a renamed surface (A) | 0 | 5 (:1, :120, :143, :147 on BET_TABLE_MISSING; :128 on BOOKING_FORM_MISSING) |
| Halts with no clean round, by T-0321's design | 0 | 1 (:127: a flagged text read-back, a max_tokens PARSE round, then prose. Round 8's T-0302 would have shipped round 1 as EARLIER_ROUND_SHIPPED.) |

Halted turns carry no `trace` and no `routing.sections`, so their prompt digests are missing (see Skill notes).

## R8 round-1 count (T-0310)
| Round | Haiku click turns | Round 1 called render_surface | Round 1 with thinking | Round 1 failed a check |
|---|---|---|---|---|
| 8 | 36 | 36 | 0 | 4 (:9, :23, :65, :159) |
| 9 | 24 | 24 | 0 | 3 (:14, :19, :27): BANKROLL_MISMATCH, NATURAL_ACTIONS with BANKROLL_MISMATCH, and the pontoon payout (H) |

There are fewer click turns because 4 runs halted on turn 0, and their scripted clicks found no surface. Haiku say turns are unchanged: 80 of 141 round 1s make no tool call (round 8: 81 of 145).

## Tallies asked for
| Code | Fired (turns) | Saved | Note |
|---|---|---|---|
| DEALT_IN_BETTING (T-0323) | 0 | | no poker CardTable shipped |
| SETTLED_WITHOUT_NATURAL (T-0324) | 0 | | the turn-0 halt in `blackjack-rounds-haiku` |
| concierge-edit-applied (ACTION_NOT_APPLIED on a Concierge say turn, T-0322) | 0 | | the edit landed |
| SURFACE_MISSING, word-game opening (T-0322) | 0 | | 12 SURFACE_MISSING fires, all on Concierge turns, all saved |
| PRODUCT_CARD_MISSING, priced rows (T-0322) | 2 | 1 | :86 saved; :257 shipped uncorrected because of G |
| SURFACE_DROPPED | 13 rounds (8 turns) | 1 by the trace's definition | :84 counts as saved, but it shipped an uncaught read-back (D) |
| NARRATED_MECHANICS | 14 (14) | 14 | round 8: 2. Now the costliest repair code ($0.47). See E. |
| FLOW_END_INFERRED | 9 | | round 8: 10 |
| SEMANTIC_UNCORRECTED | 4 (:27, :157, :257, :491) | | round 8: 1. Three of the four are check defects (G, H). |
| Stop at the spend cap | 0 | | stop: done at $36.69 |
| Round stopped at max_tokens | 2 (:111 r2, :127 r2, Haiku at 5376) | | round 8: 3; :127's is inside a halt |

## Checks: fires, saves, extra cost
A save is a turn that did not halt and shipped with no `*_UNCORRECTED` or SURFACE_DEGRADED code. Fires count failed rounds. Extra USD is the cost of each repair round, split evenly across the codes of the round it answers, at the round.json prices.

| Check | Fired rounds (turns) | Saved | Extra USD | Models | Unsaved |
|---|---|---|---|---|---|
| NARRATED_MECHANICS | 14 (14) | 14 | 0.47 | Haiku 8, Sonnet 5, Opus 1 | :182 is saved, but its repair dealt a new round (E) |
| PARSE | 8 (7) | 5 | 0.30 | Haiku 4, Sonnet 4 | :127 (halt), :257 (G) |
| BOOKING_CONFIRMATION_MISSING | 5 (3) | 1 | 0.27 | Haiku 2, Sonnet 1, Opus 2 | :257, :491 (G, false fires) |
| IDGRAPH | 13 (6) | 6 | 0.25 | Haiku 3, Sonnet 10 | |
| ACTION_NOT_APPLIED | 15 (15) | 15 | 0.22 | Haiku 13, Sonnet 1, Opus 1 | |
| SURFACE_REQUESTED, CATALOG | 2 each | 2 each | 0.30 together | | |
| NEW_ROUND_NOT_BETTING | 3 (2) | 2 | 0.13 | Sonnet 3 | |
| BANKROLL_MISMATCH | 6 (4) | 3 | 0.09 | Haiku 4, Sonnet 2 | :27 (H, a false fire) |
| CARD_DUPLICATE, PRODUCT_CARD_MISSING, SURFACE_MISSING, FEED_SCOPE, SURFACE_NOT_CREATED, RETURN_FIRE_WRONG, HAND_BINDING | | all but :257 | 0.18 together | | |
| SURFACE_DROPPED, BET_TABLE_MISSING, BOOKING_FORM_MISSING | 13, 5, 3 | 1, 1, 0 | 0.05 together | Haiku | A, C |

Repair rounds cost $2.24 of the $36.69 (round 8: $2.14 of $36.18). Cost shifted by the fixes: PARSE fell $0.58 with no code change. NARRATED_MECHANICS rose $0.39. BOOKING_CONFIRMATION_MISSING false fires (G) took about $0.25, mostly on Opus.

**Codes not seen in round 8:** CATALOG, HAND_BINDING, RETURN_FIRE_WRONG, and `ProduceHalt` as a turn outcome.

## Spend (ledger.jsonl, list prices, an overestimate)
| Model | Runs | Passed | USD |
|---|---|---|---|
| Haiku 5.5 | 29 | 22 | 0.75 |
| Sonnet 5.5 | 29 | 28 | 12.62 |
| Opus 5.5 | 29 | 27 | 23.32 |
| Total | 87 | 77 | 36.69 |

The phase 1 estimate was $36.18 (round 8's spend). The halted runs cost less than in round 8, because their scripts stopped at turn 0.

## Why it failed and how to fix it
This is a decision analysis with the context-fog-of-war skill, fog report `f45df100a61db66dc502558c`.
- **Structure:** decisions d1 to d8 are clusters A to H, and d9 is the T-0310 measurement. They carry 18 guidance edges (g1a to g9a) and 7 reviewed findings (f1 to f7).
- **Citations:** every citation is an exact excerpt of a trace line event.
- **Coverage:** each of the 10 failed runs falls in exactly one cluster, A, C, D, E or F. B, G and H failed no run of their own.

**What the traces rule out:**
- **Lost context:** `retrieved-not-submitted` found no omission in 522 linked pairs. 6 pairs were excluded as empty retrievals, and the 6 halted turns are gaps (no `complete`). `tool-result-not-propagated` found none in 14 pairs, and `truncation` found no signal in 548 envelopes. No failure is lost context on the way to the model.
- **Changed prompts outside the Croupier:** only the Croupier's mini-skills and persona digests moved since round 8. Concierge clusters C and D come from the producer and checks, not from new text.

| Cluster | Runs (any / only) | Class | Evidence | Fix layer | File (`audit.py link`) | Keyless test that proves it | Ticket |
|---|---|---|---|---|---|---|---|
| A. A repair that rebuilds the flagged surface under a new id is SURFACE_DROPPED, and the turn halts | 6 turns / 4 runs (`blackjack-rounds-haiku`, `routing-domain-switch-haiku`, `routing-guidance-conflict-haiku`, `long-blackjack-hand-haiku`; `routing-long-session-haiku` :128 too); :74 saved by its fallback | (d) loop defect | :1: round 1 is a Slider Card on ask-1 (BET_TABLE_MISSING). Round 2 sends a correct CardTable on table-1, judged SURFACE_DROPPED for ask-1 (g1a). The forced round 3 resends table-1, and the turn halts (g1b, g1c). :128 moves a BookingForm to ask-2 (g1e). Round 8 :157 got the same code and kept ask-1, so the switch is the model's choice (g1d, inferred). The dropped ask-1 never shipped, so the drop itself cost the guest nothing. | Either: a round that creates one new surface passing every check supersedes a same-turn surface that only a flagged round built (tallied, for example SURFACE_REPLACED). Or: the composite repair text names the surface id to keep. The first changes the T-0317 rule, so it needs Kim's ruling. | `packages/agent-ui/a2ui/src/agent/produce.ts` (`link f1`: `:1724`, `:1843`, the `dropped` rule; SURFACE_DROPPED_HINT `:1111`); `catalog/personas/croupier/checks.ts` (BET_TABLE_MISSING `:393`) | `replays/croupier-haiku-rename-halts` from :1 (pinned: ProduceHalt, SURFACE_DROPPED on rounds 2 and 3, table-1); a produce test that the :1 rounds ship round 2 or keep ask-1 | proposed, P1 (5 halts, the T-0321 revisit) |
| B. The T-0323 wording moved Haiku blackjack openings off the CardTable | 5 / 0 (it starts 4 of A's halts and passes `blackjack-moves-haiku` after repair) | (b) ambiguous guidance, inferred | Round 1 builds an ask Card with a Slider and Deal on 5 of 7 Haiku openings (round 8: 1 of 7), and BET_TABLE_MISSING went from 1 turn to 5. Sonnet and Opus stay on CardTable 14 of 14. The only changed sections are the Croupier mini-skills and persona: "In blackjack, if the catalog has CardTable" and "betting is the stake pick before the deal" (g2a, g2b). Sample 1. | Restore the round 8 phrasing of the blackjack betting phase and keep poker on the Card frame. This changes what the model reads, so the debate rule applies. | `prompts/mini-skills/game-table-chrome.md:7`, `card-layout.md:6`; `site/pages/agent-admin-presets.ts:219` to `:243` (`link f2`) | sample "Blackjack, please." on Haiku N=10 with both texts and count round 1 CardTables; the T-0323 poker tests stay green | proposed, P1 (feeds A) |
| C. The SURFACE_DROPPED repair asks for the rejected surface back | 1 / 1 (`long-spa-services-haiku`) | (b) conflicting guidance | :157: the round 1 read-back gets BOOKING_FORM_MISSING, and round 2 answers in prose (SURFACE_DROPPED) (g3a). The forced round 3 resends the same read-back, and it ships SEMANTIC_UNCORRECTED (g3b). SURFACE_DROPPED_HINT says "Resend that surface with its components and data" and does not restate the earlier finding (g3c, read from source). | When the dropped surface carries a bound composite finding (T-0299), feed that finding with SURFACE_DROPPED. | `produce.ts` (`link f3`: `:697`, `:1111`, `:1724`) | a produce test that the :157 round 3 request holds the BOOKING_FORM_MISSING repair | proposed, P2 |
| D. The BookingForm read-back check misses a "Book now" button | 1 / 1 (`facilities-then-tour-haiku`) | (d) check gap | :84: round 1 is a BookingForm (FEED_SCOPE), round 2 is prose, and the forced round 3 ships a DescriptionList read-back with "Book now" and no code (g4a). Checked offline: the composite checks give nothing on this payload, and BOOKING_FORM_MISSING on :157 round 3 ("Confirm booking"). The readBack cue is `/\bconfirm\b/i` on the label. | Match a booking verb (book, confirm, reserve) or a `confirm_booking` action. | `catalog/composite-moments.ts:88` (`link f4`) | a composite-moments test on the :84 round 3 payload | proposed, P2 |
| E. The narration repair deals a new round on a turn that needed no change | 1 / 1 (`blackjack-moves-sonnet`) | (b) ambiguous guidance, inferred | :182: "Hit me again." after a bust. Round 1 rightly says there is no hand to hit but names table-2. The repair round opens table-3 in betting, so the scripted Deal again finds no button (g5a). NARRATION_HINT ends "a fix is made silently on the surface". | Say that a reply needing no change leaves the surface as it is and only drops the id from its words. | `produce.ts:1136` to `:1140` (`link f5`) | a produce replay of :182 that keeps table-2 settled with Deal again | proposed, P3 |
| F. Opus PlayingCard type floor | 2 / 2 (`omaha-opus`, `five-card-draw-opus`) | (d) existing lint debt | :400 ships PlayingCard (g6a). Every turn fails render-lint at `span[index-rank]` 7.875px and `span[pip]` 8.4px (`runs/*/report.json`, outside the bundle). Rounds 6 and 8, unchanged. | The playing-card type floor | ui-playing-card | the T-0189 ruling's test | T-0189 (existing) |
| G. BOOKING_CONFIRMATION_MISSING fires on a caption that mentions booking | 2 / 0 (:257 Sonnet, :491 Opus) | (d) check defect | :491 "Which restaurants and bars": the caption "Opening hours can be confirmed with the front desk." fires it twice, and the turn ships uncorrected (g7a). :257's caption is "booked at least a day ahead" (g7b). | Fire on a confirm turn (the row's ask cue) or a read-back of a booking, not on caption words. | `catalog/composite-moments.ts:93` to `:108` (`link f6`) | a composite-moments test: :491 and :257 give no finding, :85 still fires | proposed, P2 (about $0.25 a round on Opus and Sonnet) |
| H. BANKROLL_MISMATCH prices a pontoon at 3:2 | 1 / 0 (:27) | (d) check defect | The pontoon deal: the check asks for 1250, the model pays 2:1 (1300) as the pontoon rules say (`site/pages/agent-admin-libraries.ts:409`), and the turn ships uncorrected (g8a). | Price the natural per game: pontoon 2:1, blackjack and Spanish 21 at 3:2, with NATURAL_ACTIONS' message to match. | `catalog/personas/croupier/checks.ts:672` `payout()`, `:295` (`link f7`) | a croupier check test on :27: 1300 passes for pontoon | proposed, P3 |

**Unresolved, not a cluster:** NARRATED_MECHANICS fired on 14 turns (round 8: 2) with no narration code change since round 8. The diff `910042aa..acbbf572` of produce.ts has no narration line. Two fires are on the changed hold'em step (:42, :207, "I've left table-1 as it is."). The other 12 are on unchanged scripts, mostly say turns after a settled hand ("Hit me again.", "Stick.", "Fold."). The cause is open at sample 1. The next evidence is a 5-sample rerun of `blackjack-moves` and `pontoon` on Haiku and Sonnet.

Bounded experiment per cluster, each measured on the same comparison set:
- **A:** after Kim's ruling, ship round 2 or keep ask-1. Verified when the :1 replay flips to a shipped CardTable and the 7 Haiku blackjack openings halt 0 times live.
- **B:** restore the phrasing. Verified when, on 10 Haiku samples, round 1 CardTable is at round 8's rate or better, with poker unchanged.
- **C:** feed the bound finding. Verified when `long-spa-services-haiku` ships a BookingForm live.
- **D:** widen the cue. Verified by the composite test, then live `facilities-then-tour-haiku`.
- **E:** reword the hint. Verified by the :182 replay, then `blackjack-moves-sonnet` live.
- **F:** stays with T-0189.
- **G and H:** check tests on the recorded payloads. Verified when no SEMANTIC_UNCORRECTED fires on those turns live.

Replays to add, each pinned to today's behavior (`scripts/e2e-admin/probe/replays/`, `// expectedFail: round 9 cluster X`), one per ticket: A from :1 (`routing-domain-switch-haiku` :120 is the 1-turn twin), C from :155 to :157, D from :82 to :84, E from :176 to :182. This ticket makes no code change, so they belong to the cluster tickets.

Representative turns, with the exposure chain as recorded (observed):

| Turn | Model | Framed exemplars | Retry codes, rounds | Shipped |
|---|---|---|---|---|
| :1 Blackjack, please. | Haiku | domain-croupier-card-table-round, frontier-round-outcome, frontier-result-card-win | BET_TABLE_MISSING, SURFACE_DROPPED x2, 3 | nothing (ProduceHalt) |
| :128 confirm the booking | Haiku | frontier-service-gateway and others | BOOKING_FORM_MISSING, SURFACE_DROPPED x2, 3 | nothing (ProduceHalt) |
| :157 book the first one | Haiku | concierge booking exemplars | BOOKING_FORM_MISSING, SURFACE_DROPPED, 3 | round 3's read-back (SEMANTIC_UNCORRECTED) |
| :84 book the boat tour | Haiku | concierge booking exemplars | FEED_SCOPE, SURFACE_DROPPED, 3 | a "Book now" read-back, no code |
| :182 Hit me again. | Sonnet | domain-croupier-card-table-round and others | NARRATED_MECHANICS, 2 | table-3 in betting |

**Observed against inferred:** the codes, rounds, tool inputs, stop reasons and replies above are recorded. These were read from source at `acbbf572` and are marked inferred in the fog findings: the drop rule in A, the guidance wording in B, C and E, and the check conditions in D, G and H. D's check result is a direct run of `compositeMomentChecks` on the recorded payloads.

## Context fog-of-war
- **Record:** `.sdlc/evals/fog/2026-10-17-r9-matrix.json`. The round was ingested with `.sdlc/evals/fog-manifest.json` (mapping hash `2dff31b70205`, unchanged from round 8; engineering run `run-19d7a496c6511c650c95c0d9`) straight from this folder, with no line blanked. It was hydrated before its first publish and published as report `f45df100a61db66dc502558c`. The report holds 1711 events, 599 sources, 9 decisions, 18 guidance edges, 7 reviewed findings and 0 diagnostic findings.
- **Detectors:** `truncation` (548 envelopes), `retrieved-not-submitted` (522 pairs; 6 excluded as empty retrievals; 6 gaps on the halted turns) and `tool-result-not-propagated` (14 pairs) gave no signal. `stop-at-cap` had no eligible candidate: all 629 rounds record a stop reason, including the 2 `max_tokens` stops. The other five had no eligible trigger in a web-chat bundle.
- **Contract audit:** `audit.py scan` on HEAD with the committed mapping (`.sdlc/evals/fog/contract-audit/mapping.json`) found 81 surfaces and 61 candidates (round 8: 80 and 57). `audit.py link --finding` gave each finding its contract surfaces, cited in the table.
- **Outside the bundle:** `runs/*/report.json` (probe checks, render-lint) is not mapped. Every check verdict is cited from the round folder.

## Tickets (proposed, one cause each, for the conductor to file)
- **A (P1):** a same-turn repair that rebuilds a flagged surface under a new id must not halt. Needs Kim's ruling on the T-0317 drop rule, or a repair text that names the id to keep. This is the T-0321 revisit.
- **B (P1):** restore the blackjack betting-phase phrasing that T-0323 changed (debate rule), measured on 10 Haiku samples.
- **C (P2):** feed a dropped surface's bound composite finding with SURFACE_DROPPED.
- **D (P2):** the BookingForm read-back cue matches "Book now" and the `confirm_booking` action.
- **E (P3):** NARRATION_HINT keeps the surface as it is when the reply needs no change.
- **G (P2):** BOOKING_CONFIRMATION_MISSING needs a confirm turn or a read-back, not caption words.
- **H (P3):** BANKROLL_MISMATCH and NATURAL_ACTIONS price a pontoon at 2:1.
- **F:** T-0189 stays open.
- **Not a ticket yet:** `blackjack-rounds-haiku` is unstable (four causes in four rounds): sample it 5 times before another fix. The NARRATED_MECHANICS rise is unresolved: a 5-sample rerun first.

## Skill notes
These are the steps the tooling could not do, which this ticket did by hand. The skills were read from disk on 2026-10-17, after the `progressive-discovery` and `project-reconciliation` change sets (context-fog-of-war) and `experiment-series` (closed-loop-run).

- **Repeat from round 8, still open: a recorded max_tokens stop has no detector.** `stop-at-cap` still excludes every round with a recorded stop reason. So :111 r2 and :127 r2 (`stopReason: max_tokens`) give no signal, and they were counted by hand again. Experiment-series section 6 says to fix a gap before the next cycle needs it. Round 9 is that cycle, so the gap has now cost two rounds.
- **A halted turn has no prompt digests.** The 6 ProduceHalt lines carry no `trace` and no `routing.sections`, so a digest comparison skips exactly the failing turns. Here the digests came from the next turn in the same run (:2). This is a product trace gap (T-0311 records digests only on completed turns), and the fog mapping cannot see it.
- **Progressive discovery worked for this task.** SKILL.md's route table sent "Explain failures and propose fixes" straight to `references/investigation.md`, and the bundle route to `bundles.md`. That took two reads where round 8 needed the old checklist, and no step needed the removed blanket prerequisites. The provider-error default (preserve, classify, filter only when needed) settled the quarantine step in one line: there was nothing to quarantine.
- **No route from a cycle report to the series method.** A "cycle N+1 against cycle N" task (churn, mechanism metrics, the halt condition) has no row in fog SKILL.md and no link from `investigation.md`. The method lives in closed-loop-run `references/experiment-series.md`, which links back only to fog's learnings. Under the progressive-context lens, that is a missing route edge: the task reaches its governing method only because the brief named it.
- **Experiment-series has no step for a changed case inside a full cycle.** Section 1 says a changed set is a new set, but a full cycle where 3 of 87 cases changed (T-0325's scenario fix) is common. The report had to decide by hand to keep the 84 identical cases comparable and mark the 3 as a new baseline.
- **The mechanism metric and the outcome can disagree.** T-0321's metric was fully met (7 of 7 forced rounds called the tool), but no forced round saved its turn and halts rose. Section 4's verdict set (fixed live, partly, not exercised, regressed) has no verdict for "mechanism fixed live, outcome regressed", so this report wrote both.
