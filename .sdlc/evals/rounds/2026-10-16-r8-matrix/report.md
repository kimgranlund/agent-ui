# T-0319 live round 8: report

Round 8 ran on 2026-10-16 UTC (20:47 to 22:53) at `910042aa`, sample 1, default effort. It is round 6's full matrix again: the same 87 runs, scenarios, models and order (`scripts/e2e-admin/probe/scenarios/round8.ts`). It measures the round 6 and 7 fixes (T-0296 to T-0305), the settings pane (T-0306), the stale-surface sweep (T-0307) and the routing review rulings (T-0308 to T-0317). Trace line numbers below (`:n`) are 1-based lines of `traces/2026-10-16.jsonl` in this folder.

The capped runner finished 87 of 87 for an estimated $36.18 against the $42 cap (stop: done, no stop at the cap). 77 runs passed and 10 failed (round 6: 76 and 11):
- **Sonnet:** 29 of 29 (round 6: 26). Every Sonnet failure from round 6 now passes.
- **Haiku:** 22 of 29 (round 6: 23). 4 of its 6 round 6 failures pass, but 5 runs that passed in round 6 now fail (clusters A to F).
- **Opus:** 26 of 29 (round 6: 27). Concede now passes. The PlayingCard type floor (H) and a scenario defect (G) fail.

No trace line is a provider error (no usage-limit or overload turn), so nothing was excluded.

## Pass rate, preset by model (rounds 6 and 7 for comparison)
| Preset | Haiku r8 | Sonnet r8 | Opus r8 | r6 (H / S / O) | r7 reruns (H / S / O) |
|---|---|---|---|---|---|
| Croupier | 9 of 11 | 11 of 11 | 8 of 11 | 9 / 9 / 10 of 11 | 2/3, 1/2, 1/1 |
| Concierge | 8 of 11 | 11 of 11 | 11 of 11 | 8 / 11 / 11 of 11 | 4/5, -, - |
| Lexicographer | 2 of 4 | 4 of 4 | 4 of 4 | 4 / 4 / 4 of 4 | 1/1, -, - |
| Admiral | 3 of 3 | 3 of 3 | 3 of 3 | 2 / 2 / 2 of 3 | 1/1, 1/1, 1/1 |
| All | 22 of 29 | 29 of 29 | 26 of 29 | 23 / 26 / 27 of 29 | 8/10, 2/3, 2/2 |

Round 7 reran only round 6's failures plus the Haiku long flows, so its cells are partial. A preset's row counts its preset, routing and long-flow runs, as in round 6.

Run by run against round 6:
- **8 failures now pass:** `blackjack-moves-haiku`, `spa-booking-haiku`, `concede-haiku`, `long-spa-services-haiku`, `omaha-sonnet`, `five-card-draw-sonnet`, `concede-sonnet`, `concede-opus`.
- **3 still fail:** `blackjack-rounds-haiku` (third round in a row, a new cause each time: F), `long-concierge-booking-haiku` (C) and `five-card-draw-opus` (H).
- **7 passed in round 6 and fail now:**
  - `five-card-draw-haiku` (E)
  - `facilities-then-tour-haiku` (D)
  - `invalid-then-replay-haiku` (C)
  - `long-booking-confirm-haiku` (B, also failed in round 7)
  - `long-game-give-up-haiku` (A)
  - `texas-holdem-opus` (G)
  - `omaha-opus` (H)

Probe checks: render-lint failed 20 turns, all of them in H. expect-component failed 13, click-target 3, action-updates-surface 1, and routing-expect 0. The 40 reasoning warnings ("no thinking text captured") are 32 Haiku turns, which include the thinking-off click turns of T-0310, plus 6 Sonnet and 2 Opus turns.

## Cheapest model that passes, per preset
| Preset | Cheapest | Why |
|---|---|---|
| Croupier | Sonnet | 11 of 11. Haiku is 9 of 11 (E, F). Opus is 8 of 11 (G, H) at about 1.7 times Sonnet's cost. |
| Concierge | Sonnet | 11 of 11, as is Opus. Haiku is 8 of 11 (B, C, D). |
| Lexicographer | Sonnet | 4 of 4. Haiku is 2 of 4 (A, C), down from 4 of 4. |
| Admiral | Haiku | 3 of 3 on every model for the first time (T-0296). |

## Round 6 and 7 fixes and the routing rulings, live (T-0296 to T-0317)
| Ticket | Verdict | Evidence |
|---|---|---|
| T-0296 surrender ResultCard | fixed live | Concede passes on all three models (round 6: 0 of 3). RESULT_CARD_MISSING fired on rounds 1 and 2 of :115 (Haiku), and round 3 shipped the ResultCard. |
| T-0297 case-insensitive surface id | not exercised | No surface id reached any final reply this round, in any case. NARRATED_MECHANICS fired twice, on a correction (:32) and a lowercase "table-2" (:259), and both were saved. |
| T-0298 plus T-0301 forced repair round, thinking off | partly | Of 40 Haiku repair rounds after a no-tool round, 33 ran forced with thinking off, and 37 of the 40 called render_surface (round 6: 0 forced, 38 of 65 called). The SURFACE_DROPPED path is never forced: 4 rounds at :155 and :169 ran with thinking on and no tool call (cluster B). |
| T-0299 last-round FEED_SCOPE, binding findings | fixed live (once) | FEED_SCOPE_RESCOPED fired once (:155). After FEED_SCOPE and two prose rounds, the rescoped round 1 BookingForm shipped and `routing-two-surfaces-haiku` passed. The binding path decided no turn. |
| T-0300 LONE_BUTTON_FRAME | not exercised | Fired 0 times. `omaha-sonnet` passes with render-lint clean. |
| T-0302 earlier-round fallback | partly | EARLIER_ROUND_SHIPPED fired twice and no turn halted. :155 shipped a good round. :169 shipped round 1, a DescriptionList read-back that BOOKING_FORM_MISSING had already failed (cluster B). |
| T-0303 live round 7 | n/a | The previous round. |
| T-0304 decode a `messages` string | partly | 17 render_surface calls (Haiku 4, Sonnet 13) sent `messages` as a string. None parse, so MESSAGES_STRING_DECODED fired 0 times. 14 are exactly one closing `}` short, and 3 (Haiku) lose an object opener. The pinpoint PARSE note works: 14 of 16 repair rounds sent a valid array. PARSE repair rounds cost $0.88 (round 6: $0.45), the costliest code (cluster A). |
| T-0305 SURFACE_NOT_CREATED | fixed live | Fired once (:23, `spanish-21-haiku`): round 2 sent text JSONL updates to table-2 with no create. Round 3 shipped it, and the run passes. |
| T-0306 settings pane | n/a live | No probe exercises the pane. Its own browser tests closed it. |
| T-0307 stale-surface sweep | n/a live | Static records only. No failure traces to a swept surface. |
| T-0308 drop the reference Badge | not exercised | No surface shipped a reference-code Badge (round 6: none either). |
| T-0309 FLOW_END_INFERRED | fixed live | Inferred on 10 closing turns (Haiku 2, Sonnet 4, Opus 4), every one a "Thanks, that's all." or similar. FLOW_END_MISSING fired 0 times (round 6: 9 turns, $0.67 of repair rounds). |
| T-0310 forced round 1 on Haiku clicks | fixed live | See the measurement below: 36 of 36. |
| T-0311 stopReason, maxTokens, prompt digests | fixed live | Every one of the 634 rounds carries `stopReason` and `maxTokens`, and every line carries `routing.sections[].digest`. Haiku now runs at max_tokens 5376 (round 7: 4096), with 3 stops at the cap, all saved. Sonnet and Opus stay at 4096 with none. |
| T-0312 persona type-name lint | n/a live | Static lint and pin tests. No persona text reached a reply as a type name. |
| T-0313 one matcher, structured-container, Play again | partly | structured-container is now framed on 0 of 24 confirm turns (round 6: 12 of 24). Admiral "Play again." is not in the matrix. Lexicographer "Play again." still retrieves nothing on 6 of 6 lines. A services ask answered with a priced DescriptionList passes, because the ProductCard row matches only a priced Table, a condition that dates from T-0279 (cluster D). |
| T-0314 check contract tests | n/a live | Test-only. |
| T-0316 check defects D1 to D3 | not exercised | No tic-tac-toe board, no a2ui-basic Concierge turn, and FRAMED_CHOICE fired 0 times. |
| T-0317 loop surface invariant | fixed live | No turn lost a surface silently: both SURFACE_DROPPED turns were tallied and shipped an earlier round. What the fallback ships is cluster B. |

## T-0310 measurement
Round 1 of every Haiku click turn now calls render_surface, with no thinking block:

| Round | Haiku click turns | Round 1 called render_surface | Round 1 with thinking | Round 1 failed a check |
|---|---|---|---|---|
| 6 | 31 | 9 | 31 | 14 |
| 7 | 17 | 3; 14 round 1s made no tool call (round 7's report counted 12 that wrote a target meta-line) | 17 | 6 |
| 8 | 36 | 36 | 0 | 4 (:9, :23, :65, :159), all saved |

The four failures are content checks on a tool call (BANKROLL_MISMATCH, NATURAL_ACTIONS with NEW_ROUND_NOT_BETTING, NEW_ROUND_NOT_BETTING, ACTION_NOT_APPLIED), not prose answers. One of them, :9, is where cluster F starts. Haiku say turns are unchanged: 81 of 145 round 1s make no tool call (round 6: 89 of 147).

## Tallies asked for
| Code | Fired (turns) | Note |
|---|---|---|
| FLOW_END_INFERRED | 10 | Haiku :168, :181; Sonnet :271, :333, :354, :367; Opus :452, :514, :535, :548. FLOW_END_MISSING 0. |
| SURFACE_NOT_CREATED | 1 | :23, saved on round 3 |
| EARLIER_ROUND_SHIPPED | 2 | :155 (rescoped form, run passes), :169 (failed read-back, run fails, B) |
| SURFACE_DROPPED | 2 | :155, :169; neither repair round was forced (B) |
| FEED_SCOPE_RESCOPED | 1 | :155 |
| MESSAGES_STRING_DECODED | 0 | 0 of 17 strings parse (A) |
| Pinpoint PARSE compliance | 14 of 16 | Repair rounds after a string PARSE that sent an array. :178 round 2 went to prose; :252 round 2 resent the same broken string. |
| Stop at the spend cap | 0 | stop: done at $36.18 |
| Round stopped at max_tokens | 3 | Haiku :61 r1, :113 r1, :115 r2, all at 5376, all saved |

**FLOW_END_INFERRED dollars:** in round 6, FLOW_END_MISSING sent 9 closing turns to a round 2 that cost $0.674 (Opus 5 of them). In round 8 the same 10 closing turns cost no repair round. So about $0.67 a matrix is saved, mostly Opus. That is an estimate from round 6's spend on the same scenarios, not a measured counterfactual.

## Checks: fires, saves, extra cost
A save is a turn whose final round passed with no `*_UNCORRECTED` or SURFACE_DEGRADED code. Fires count failed rounds. Extra USD is the cost of each repair round, split evenly across the codes of the round it answers. Prices are the round.json list prices.

| Check | Fired rounds (turns) | Saved | Extra USD | Models | Note |
|---|---|---|---|---|---|
| ACTION_NOT_APPLIED | 20 (20) | 19 | 0.17 | Haiku 19, Opus 1 | unsaved :178 (A) |
| PARSE | 17 (16) | 15 | 0.88 | Haiku 4, Sonnet 13 | the costliest; unsaved :178 (A) |
| SURFACE_MISSING | 14 (14) | 14 | 0.04 | Haiku 14 | |
| IDGRAPH | 5 (5) | 5 | 0.26 | Haiku 1, Sonnet 4 | |
| FEED_SCOPE | 5 (5) | 5 | 0.02 | Haiku 5 | |
| NEW_ROUND_NOT_BETTING | 3 (3) | 3 | 0.06 | Haiku 2, Sonnet 1 | |
| SURFACE_REQUESTED | 3 (3) | 3 | 0.16 | one per model | |
| CARD_DUPLICATE | 2 (2) | 2 | 0.20 | Sonnet 1, Opus 1 | |
| RESULT_CONTRADICTS_CARDS, SCHEMA | 1 each | 1 each | 0.23 together | Opus | |
| BANKROLL_MISMATCH, NARRATED_MECHANICS | 2 each | 2 each | 0.09 together | | :9 is saved but starts F |
| SURFACE_DROPPED, BOOKING_FORM_MISSING | 2 each | 1 each | 0.02 together | Haiku | unsaved :169 (B) |
| RESULT_CARD_MISSING | 2 (1) | 1 | 0.01 | Haiku | :115 |
| BET_CONTROL_DUPLICATE, NATURAL_ACTIONS, SURFACE_NOT_CREATED, BOOKING_CONFIRMATION_MISSING, GAME_HUD_MISSING, PRODUCT_CARD_MISSING, BET_TABLE_MISSING | 1 each | 1 each | 0.02 together | Haiku | :61 BET_CONTROL_DUPLICATE is E |

Repair rounds cost $2.14 of the $36.18 (round 6: $2.13 of $36.82).

**Codes first seen live this round:** FLOW_END_INFERRED, SURFACE_NOT_CREATED, EARLIER_ROUND_SHIPPED, FEED_SCOPE_RESCOPED, RESULT_CARD_MISSING, BET_CONTROL_DUPLICATE, NATURAL_ACTIONS, NEW_ROUND_NOT_BETTING, RESULT_CONTRADICTS_CARDS and SCHEMA.

## Spend (ledger.jsonl, list prices, an overestimate)
| Model | Runs | Passed | USD |
|---|---|---|---|
| Haiku 5.5 | 29 | 22 | 0.76 |
| Sonnet 5.5 | 29 | 29 | 12.94 |
| Opus 5.5 | 29 | 26 | 22.47 |
| Total | 87 | 77 | 36.18 |

The phase 1 estimate was $36.82 (round 6's spend).

## Why it failed and how to fix it
This is a decision analysis with the context-fog-of-war skill, fog report `62dbbb423e6e2d348a4444c9`.
- **Structure:** decisions d1 to d8 are clusters A to H, and d9 is the T-0310 measurement. They carry 17 guidance edges (g1a to g9a) and 6 reviewed findings (f1 to f6).
- **Citations:** every citation is an exact excerpt of a trace line event.
- **Coverage:** each of the 10 failed runs falls in exactly one cluster.

**What the traces rule out:**
- **Lost context:** `retrieved-not-submitted` found no omission in 542 linked pairs. 6 pairs were excluded: the "Play again." lines, whose retrieval returns nothing. `tool-result-not-propagated` found none in 14 pairs, and `truncation` found no signal in 562 envelopes. No failure is lost context on the way to the model.
- **The token cap:** the 3 max_tokens stops are recorded directly (`stopReason`), and the forced next round saved each of them. :61's stop is where cluster E starts, but the forced round 2 went on to call the tool.

| Cluster | Runs (any / only) | Class | Evidence | Fix layer | File (`audit.py link`) | Keyless test that proves it | Ticket |
|---|---|---|---|---|---|---|---|
| A. render_surface `messages` arrives as a JSON string one brace short, so T-0304 cannot decode it | 1 / 1 (`long-game-give-up-haiku`); 15 other turns repaired at $0.88 | (c) model ignored clear guidance | :178: round 1 sends a string whose `guessBtn` entry lost its `{"id":` opener (PARSE). Round 2 answers in prose (ACTION_NOT_APPLIED), and round 3 resends the same broken string, so SURFACE_DEGRADED ships no surface (g1a). :252 (Sonnet) repeats its broken string after the pinpoint note (g1b). :188 shows the common case: the next round sends an array (g1c). 14 of 17 strings are exactly one `}` short. | The tool input reader: when `messagesParseNote` finds exactly one missing closing `}` at a message boundary, insert it and decode, tallied (for example MESSAGES_STRING_REPAIRED). Anything else stays PARSE. | `packages/agent-ui/a2ui/src/agent/response-type.ts` (`link f1`: `response-type.ts:29-30` tool description), `prompts/grammar.md:194`, `produce.ts:649` and `:693` (TOOL_PARSE_HINT and the pinpoint note) | `replays/lexicographer-haiku-messages-brace.test.mjs` (pinned: turn 4 PARSE, SURFACE_DEGRADED, no surface line); a response-type test that the :188 string yields the array's JSONL | proposed, P1 (the costliest repair code; one Haiku turn lost) |
| B. A SURFACE_DROPPED repair round is not forced, and the fallback ships a round already judged wrong | 1 / 1 (`long-booking-confirm-haiku`; :155 took the same path and passed) | (d) loop defect | :169: round 1 builds a DescriptionList read-back and gets BOOKING_FORM_MISSING. Rounds 2 and 3 answer in prose with thinking on and no tool call. T-0302 then ships round 1 (EARLIER_ROUND_SHIPPED, SEMANTIC_UNCORRECTED), and the guest never sees a BookingForm (g2a, g2b). :155 had the same rounds, but its round 1 was rescoped, so a good form shipped (g2c). After a no-payload SURFACE_MISSING, the forced round calls the tool (:165, g2d). Read from source: `produce.ts:1711` sets no `forceSurfaceRound`, and `:1755` does. | Force render_surface with thinking off after a no-payload SURFACE_DROPPED. The fallback prefers a round with no semantic finding. | `packages/agent-ui/a2ui/src/agent/produce.ts` (`link f2`: `:1111` SURFACE_DROPPED_HINT, `:1711`, `:1773`) | `replays/concierge-haiku-fallback-ships-readback.test.mjs` (pinned: SURFACE_DROPPED, SEMANTIC_UNCORRECTED, EARLIER_ROUND_SHIPPED, DescriptionList, no BookingForm); a produce test that the :169 round 2 request forces the tool | proposed, P1 (the guest loses the booking form) |
| C. A say turn answered in prose that no check covers | 2 / 2 (`invalid-then-replay-haiku`, `long-concierge-booking-haiku`) | (d) check gap | :101: "New word game, please." gets a meta-line naming ask-1 and no tool call. Round 1 passes (g3a). Only Battleship and the Croupier games have an `opening:` SURFACE_MISSING. :166: "Make it 16:00 instead, same day." targets spa-booking and sends no update. Nothing fires, and at :167 Haiku itself says the change "never reached the form" (g3b). | A word-game opening SURFACE_MISSING. A Concierge ACTION_NOT_APPLIED for a say turn that targets an open BookingForm and sends it no update. | `packages/agent-ui/a2ui/src/catalog/hidden-state-checks.ts` (`link f3`: `:297-308`, the Battleship opening row to mirror); `catalog/personas/concierge/checks.ts` (`:133`, `:146`) | `replays/lexicographer-haiku-opening-prose.test.mjs`, `replays/concierge-haiku-edit-in-prose.test.mjs` (pinned: action-updates-surface:1) | proposed, P2 |
| D. A services ask answered with a priced DescriptionList passes the ProductCard check | 1 / 1 (`facilities-then-tour-haiku`) | (d) check gap | :90: "What services could I add" ships one Card holding a DescriptionList of priced treatments and passes with no code (g4a). Opus answers the same ask with a ProductCard grid (:457, g4b). The row's `tableColumn` condition matches only a priced Table (T-0279). In round 6 this Haiku turn shipped no surface on round 1 and got ProductCards after SURFACE_MISSING. | When the turn asks the services moment (`ask.cue`) and the surface lists priced rows in another type, fire PRODUCT_CARD_MISSING. | `packages/agent-ui/a2ui/src/catalog/composite-moments.ts:131-141` (`link f4`: `:132`, `:136`, `:141`) | a composite-moments test on the :90 surface with the services intent; the facility-hours DescriptionList stays clean | proposed, P2 |
| E. Poker opened in phase "betting", and the BET_CONTROL_DUPLICATE repair strips the moves | 1 / 1 (`five-card-draw-haiku`) | (b) ambiguous guidance | :61: round 1 stops at max_tokens with no tool call. The forced round 2 opens a CardTable in phase betting with Check, Bet and Fold. BET_CONTROL_DUPLICATE says to remove them, so round 3 ships a table that asks for a stake, with no dealt hand (g5a, g5b). :65 repeats it on deal-again (NEW_ROUND_NOT_BETTING). game-table-chrome reads "Phases: betting (`betAction` deal: its strip bets, deals; no Button or input), playing, settled", but a poker hand has betting rounds after the deal. | Teach that a post-deal poker betting round is phase playing. BET_CONTROL_DUPLICATE asks for phase playing when hands are already dealt. | `prompts/mini-skills/game-table-chrome.md:7`; `catalog/personas/croupier/checks.ts:392` (`link f5`) | a croupier check test on the :61 round 2 payload | proposed, P2 |
| F. A two-card 20 settled as a natural on the deal; the bankroll repair accepts the settle | 1 / 1 (`blackjack-rounds-haiku`) | (c) model ignored a clear rule, with a check gap | :9: round 1 deals A and 9, writes "Natural blackjack! Dealer checks for 21." and phase settled with only Deal again. BANKROLL_MISMATCH replies "The round settles as a win (20 over 17)", and round 2 writes 975, so the scripted Stand has no button (g6a). The persona says "a natural (two-card 21) settles on the deal". NATURAL_ACTIONS checks that a natural has no moves, not that a settled deal is a natural. | A croupier check: a deal turn that settles needs a two-card 21; otherwise phase playing with Hit and Stand. | `catalog/personas/croupier/checks.ts` (`link f6`: `:291` NATURAL_ACTIONS, `:555`, `:608`); `site/pages/agent-admin-presets.ts:250` | a croupier check test on the :9 round 1 payload | proposed, P3 |
| G. The fixed hold'em script assumes a showdown | 1 / 1 (`texas-holdem-opus`) | (d) scenario defect | :411: the dealer folds to "Bet 50" and the hand ends. The next scripted "Check" makes Opus deal round 2 on table-2 (:412, "Round 1 was already over, so I dealt round 2"), so the later "Deal again" click finds Check, Bet and Fold (g7a). The play is legal. | The scenario: no fixed click after a move that can end the hand, or a step that clicks Deal again only when it is present. | `scripts/e2e-admin/probe/scenarios/croupier.ts` (texas-holdem) | the scenario test pins the new steps | proposed, P3 |
| H. Opus PlayingCard type floor | 2 / 2 (`omaha-opus`, `five-card-draw-opus`) | (d) existing lint debt | :414 ships PlayingCard (g8a). Every turn of both runs fails render-lint at `span[index-rank]` 7.875px and `span[pip]` 8.4px (`runs/*/report.json`, outside the bundle). This is round 6 cluster F. No playing-card commit since round 7, where it did not recur. | The playing-card type floor | ui-playing-card | the T-0189 ruling's own test | T-0189 (existing) |

Bounded experiment per cluster (checklist step 9), each measured on the same brief:
- **A:** close one missing brace. Verified when the replay flips (turn 4 ships the new board) and a live rerun of the 13 Sonnet string turns costs no PARSE round.
- **B:** force the tool after SURFACE_DROPPED. Verified when the replay flips and `long-concierge-booking-confirm-haiku` passes live.
- **C:** add the two checks. Verified when both replays flip to a repair round.
- **D:** add the priced-rows trigger. Verified by the composite test, then live `facilities-then-tour-haiku`.
- **E:** settle the phase wording. Verified when live `five-card-draw-haiku` ships PlayingCard on turn 0.
- **F:** add the settled-deal check. Verified by the check test on :9.
- **G:** fix the script. Verified when `texas-holdem-opus` passes on the same model behavior.
- **H:** stays with T-0189.

Representative turns, with the exposure chain as recorded on the trace line (observed). Exemplars are `events.framedExemplarIds`, which equal `retrieval.chunkIds` on every assessed line.

| Turn | Model | Framed exemplars | Mini-skills | Retry codes, rounds | Shipped |
|---|---|---|---|---|---|
| :178 Play again | Haiku | none (retrieval empty) | none | PARSE, ACTION_NOT_APPLIED, 3 | nothing (SURFACE_DEGRADED) |
| :169 spa booking | Haiku | concierge-booking-request, service-gateway, commerce-product-card | none | BOOKING_FORM_MISSING, SURFACE_DROPPED, 3 | round 1's DescriptionList (EARLIER_ROUND_SHIPPED) |
| :101 new word game | Haiku | lexicographer-word-board, lexicographer-game-over, notification-status-stack | product-presentation, card-game-sheet, card-layout | none, 1 | nothing, and no code |
| :90 services ask | Haiku | concierge-booking-request, service-gateway, five-day-weather | product-presentation, nested-record-editor, greeting-card | none, 1 | Card with DescriptionList |
| :457 services ask | Opus | as :90 | as :90 | none, 1 | ProductCard grid |
| :61 five-card draw | Haiku | card-table-round, trivia-round-resume, round-outcome | card-layout, card-game-sheet, game-table-chrome | SURFACE_MISSING, BET_CONTROL_DUPLICATE, 3 | betting-phase CardTable, no cards |

**Observed against inferred:** the codes, rounds, tool inputs, stop reasons and replies above are recorded. These are read from source at `910042aa` and marked inferred in the fog findings: the producer paths in B, the check conditions in C, D and F, and the guidance wording in A and E.

## Context fog-of-war
- **Record:** `.sdlc/evals/fog/2026-10-16-r8-matrix.json`. The round was ingested with `.sdlc/evals/fog-manifest.json` (mapping hash `2dff31b70205`, engineering run `run-6cfdae29b69b0d5ba77fef14`) straight from this folder, with no line blanked. It was hydrated before its first publish and published as report `62dbbb423e6e2d348a4444c9`. The report holds 1744 events, 604 sources, 9 decisions, 17 guidance edges, 6 reviewed findings and 0 diagnostic findings.
- **Detectors:** `truncation` (562 envelopes), `retrieved-not-submitted` (542 pairs) and `tool-result-not-propagated` (14 pairs) gave no signal. `stop-at-cap` had no eligible candidate: all 634 rounds record a stop reason, which the detector treats as the direct evidence. The other five had no eligible trigger in a web-chat bundle.
- **Contract audit:** `audit.py scan` on HEAD with the committed mapping (`.sdlc/evals/fog/contract-audit/mapping.json`, T-0312). It now lists the producer repair text and the tool definition, which round 7 had to add by hand. It found 80 surfaces and 57 candidates. `audit.py link --finding` gave each finding its contract surfaces, cited in the table.
- **Outside the bundle:** `runs/*/report.json` (probe checks, render-lint) is not mapped. Every check verdict is cited from the round folder.

## Tickets (proposed, for the conductor to file)
- **A (P1):** close a `messages` string that is exactly one `}` short, tallied. PARSE is the costliest repair code, and it cost one Haiku turn.
- **B (P1):** force render_surface after a no-payload SURFACE_DROPPED, and make the fallback prefer a round with no semantic finding.
- **C (P2):** a word-game opening SURFACE_MISSING and a Concierge applied-edit check.
- **D (P2):** PRODUCT_CARD_MISSING on a services ask answered with priced rows in a non-Table type.
- **E (P2):** the poker phase wording in game-table-chrome and the BET_CONTROL_DUPLICATE repair.
- **F (P3):** a settled deal needs a natural.
- **G (P3):** fix the hold'em scenario after a dealer fold.
- **H:** T-0189 stays open.

## Replays (`scripts/e2e-admin/probe/replays/`, pinned to today's behavior, `// expectedFail: round 8 cluster X`)
| Replay | Cluster | Source lines |
|---|---|---|
| `lexicographer-haiku-messages-brace` | A | `.agent-traces` 1210 to 1214, this folder's :174 to :178 |
| `concierge-haiku-fallback-ships-readback` | B | `.agent-traces` 1205, :169 |
| `lexicographer-haiku-opening-prose` | C | `.agent-traces` 1137, :101 |
| `concierge-haiku-edit-in-prose` | C | `.agent-traces` 1201 to 1203, :165 to :167 |

## Skill notes
These are steps the ticket, not the skill, had to supply. They were run on the skill as read from disk on 2026-10-16.
- **A recorded max_tokens stop has no detector:** `stop-at-cap` excludes every round with a recorded stop reason, calling it "the direct evidence". `truncation` reads output markers. So 3 rounds with `stopReason: max_tokens` produced no signal, and the ticket counted them by hand. A detector, or a coverage line, that reports recorded `max_tokens` stop reasons would close the gap that T-0311 opened by recording them.
- **The mapping changed under the record:** the mapping hash moved from round 7's `8255a4d8d99d` to `2dff31b70205` because T-0311 added fields. The checklist says to reuse a prior mapping, but it does not say to record the hash change or to diff coverage against the prior round. This report did so by hand.
- **Excerpts in JSON-escaped evidence:** citations of tool inputs had to match the escaped form inside `evidence.text` (a string within pretty-printed JSON). The hydration helper tried 0, 1 and 2 escape levels. A `fog.py cite --event --raw` helper that returns the escaped excerpt would save every run that step.
- **Clusters from `report.json`:** the bundle mapping carries no probe verdicts. As in round 7, the failed runs and checks came from `runs/*/report.json` (checklist step 4 allows this) and are cited as outside the bundle.
- **Replays have no failing check for a no-check gap:** a gap cluster (C, the word-game opening) has no probe check that fails offline, because expect-component steps are not in a `--from-trace` fixture. So the pin is on the trace (rounds, codes, no surface line), not on `report.failed`. Test-loop lesson 24 could say so.
