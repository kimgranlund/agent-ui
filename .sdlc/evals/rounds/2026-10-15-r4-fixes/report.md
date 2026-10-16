# T-0275 live round 4: report

Round 4 ran 37 live probes on 2026-10-16 UTC (00:29 to 01:32) at `5a803d13`, sample 1 and default effort:
- **R:** the 31 runs that failed in round 3, rerun on the same model under the same name, from the current generators.
- **L:** 6 long flows on Haiku and Sonnet: a Concierge booking through confirmation, a spa services ask then a booking, and a Lexicographer game through a give-up and a replay.

The capped runner finished 37 of 37 under the $15 cap. 11 runs passed and 26 failed. Of the 31 reruns, 10 now pass. Trace line numbers below (`:n`) are 1-based lines of `traces/2026-10-16.jsonl` in this folder. Turn numbers (`t<n>`) are the probe's 0-based turn index. The generator is `scripts/e2e-admin/probe/scenarios/round4.ts`.

Most of the 26 failures are not model failures. 9 of the 9 spa confirm turns fail because the scenario ask became ambiguous (T-0277). 13 of the 13 services asks miss ServiceCard because of a guidance conflict (T-0279). Three check defects push models the wrong way (T-0276, T-0278, T-0281).

## Round 3 fixes, live
| Ticket | Verdict | Evidence |
|---|---|---|
| T-0258 Haiku Card per choice | holds | FRAMED_CHOICE never fired. No Haiku starter turn framed choices in their own Cards (the greeting at :5 is a Row of Buttons). |
| T-0262 BookingConfirmation repair | fixed live | BOOKING_CONFIRMATION_MISSING fired 0 times (round 3: 9, 2 saved) and CATALOG 0 (round 3: 9). Every BookingConfirmation ships unwrapped with no Card around it (:112, :137, :141, :156). |
| T-0263 fleet check on a word board | fixed live | FLEET_SECRET_MISSING fired 0 times (round 3: 4, 2 on a word board). |
| T-0264 repair round drops the surface | partly | ACTION_NOT_APPLIED retries now always ship: 16 fired, 16 saved (round 3: 12, 11). A FEED_SCOPE retry still passes with prose only and drops the round 1 BookingForm (:12, :24): T-0281. The NATURAL_ACTIONS misfire also loses table-1 (:46): T-0276. |
| T-0265 Haiku no-surface turns | partly | SURFACE_MISSING fired 11 times, all Haiku, and saved 7. All 4 unsaved turns are spa confirm turns that cannot be confirmed (T-0277, T-0278). Openings and Admiral shots are covered. Still uncaught in prose: Lexicographer guesses and give-ups (:87-:89, :91-:95, :120-:123), the Omaha river (:55) and the stud streets (:67), all T-0280; and "Confirm it" with a boat tour "booked" in prose (:84), T-0282. |
| T-0266 Concierge booking guidance | fixed live | Every booking ask on all three models draws a pre-filled BookingForm (16 turns, for example :7, :130, :155, :214). Round 3 drew BookingForm once in 83 Concierge turns. BOOKING_FORM_MISSING fired once and was saved (:25). |
| T-0267 spa treatment list | content fixed, composite not | Every model now lists the six treatments with durations and prices (Opus :213, Haiku :117). ServiceCard drew 0 of 13 times: a Table on Haiku, a Table or a ProductCard Grid on Sonnet, a ProductCard Grid on Opus (T-0279). The list has two 60-minute massages, which makes the scenarios' "a 60-minute massage" ambiguous (T-0277). |
| T-0268 Lexicographer opening | fixed live | Every opening ranks `domain-lexicographer-word-board` first (routing-expect passes, :119, :191) and draws BoardGrid. Haiku's long-flow opening drew it after one BOARD_GRID_MISSING repair (:119). 20 of 30 Lexicographer turns hold the word board (round 3: 10 of 20); the other 10 are give-ups that rank the game-over exemplar first. |
| T-0269 BoardGrid glyph type floor | fixed live | No render-lint failure on any BoardGrid (round 3: 33 turns). The 10 render-lint failures left are all Opus Omaha PlayingCard (`span[index-rank]` 7.875px), the existing T-0189. |
| T-0270 doc-only oracle | fixed live | `routing-doc-only` passes on Haiku and Sonnet. |
| T-0271 click-target detail | fixed live | All 3 click-target failures name the buttons actually on the table ("buttons: Check, Bet 20, Fold"), which shows the hand had not ended. |
| T-0272 stud scenario | still failing | Opus ends the hand on the fourth "Check, or call" (it calls the house's seventh-street bet for the player, :210), reads the fifth as "deal again" and opens round 2 in prose with no table (:211). Deal again is then missing: T-0283. |
| T-0273 Hit ranks the battleship board | fixed live | 0 of 68 Croupier turns hold a game board from another preset. All 68 lead with `domain-croupier-card-table-round`. |
| T-0274 game-over exemplar | fixed on Sonnet | `domain-lexicographer-game-over` ranks first on every give-up turn (routing-expect passes, :122, :194). Sonnet draws ResultCard on 3 of 3 give-ups (:161, :166, :194). Haiku draws none: prose at :89 and :94, a hand-built Card at :122 (T-0280). |

## Checks: fires, saves, extra cost (round 3 in brackets)
A save is a turn whose final round passed with no `*_UNCORRECTED` code. Extra cost is the cost of a turn's rounds after the first, split evenly when one turn fires several codes. Round 3's numbers are recomputed the same way from its traces.

| Check | Fired (turns) | Saved | Extra USD | Models | Note |
|---|---|---|---|---|---|
| ACTION_NOT_APPLIED | 16 (12) | 16 (11) | 0.06 | Haiku 16 | :67 counts as saved but updated only the actions Row (T-0280) |
| SURFACE_MISSING (new, T-0265) | 11 | 7 | 0.04 | Haiku 11 | 4 unsaved on spa confirm turns that cannot be confirmed (T-0278) |
| NARRATED_MECHANICS | 9 (9) | 8 (9) | 0.03 | Haiku 9 | :14 unsaved, together with FLOW_END |
| FLOW_END_MISSING | 8 (4) | 1 (4) | 0.18 | Haiku 6, Sonnet 1, Opus 1 | 7 of 8 on bookings that are rightly not done (T-0278) |
| FEED_SCOPE | 5 (2) | 5 (2) | 0.02 | Haiku 5 | :12 and :24 "save" by dropping the surface (T-0281) |
| PARSE | 5 (10) | 4 (6) | 0.17 | Haiku 3, Sonnet 1, Opus 1 | |
| BET_TABLE_MISSING | 2 (1) | 2 (1) | 0.01 | Haiku | |
| IDGRAPH | 2 (1) | 2 (0) | 0.06 | Haiku 1, Sonnet 1 | |
| NATURAL_ACTIONS | 1 (0) | 1 | 0.01 | Haiku | :46 is a misfire on a hold'em hand and its "save" settles it as blackjack (T-0276) |
| BOARD_GRID_MISSING | 1 (7) | 1 (2) | 0.00 | Haiku | :119 |
| BOOKING_FORM_MISSING | 1 (0) | 1 | 0.00 | Haiku | :25 |
| SHOT_RESULT_WRONG | 1 (0) | 1 | 0.00 | Haiku | :104 |
| SCHEMA | 1 (3) | 1 (2) | 0.22 | Opus | :217 |
| BOOKING_CONFIRMATION_MISSING, CATALOG, FLEET_SECRET_MISSING, GAME_HUD_MISSING, RESULT_CARD_MISSING, FRAMED_CHOICE | 0 | | | | Round 3: 9, 9, 4, 1, 1 and none |

No check fired on Sonnet except FLOW_END_MISSING (:188), PARSE (:173) and IDGRAPH (:195). Every fire on a Haiku game move was saved, but the Haiku game turns that matter most (word guesses, give-ups) trip no check at all (T-0280).

## Cheapest model that passes, per preset (round 3 in brackets)
| Preset | Haiku 5.5 | Sonnet 5.5 | Opus 5.5 | Cheapest that passes |
|---|---|---|---|---|
| Croupier | 3 of 6 reruns | not rerun (6 of 6) | 0 of 2 reruns | Haiku for blackjack and five-card draw (blackjack-rounds, blackjack-moves and five-card-draw now pass). Sonnet for poker. Haiku's hold'em fails on T-0276 and its Omaha and stud on T-0280; Opus fails only on T-0189 (lint) and T-0283 (scenario). |
| Concierge | 1 of 9 (0 of 7) | 1 of 9 (0 of 7) | 0 of 1 (0 of 1) | None, and the blockers are not the model: T-0277 (scenario) and T-0279 (guidance). Apart from those, Sonnet does every booking step (:135-:141, :155-:156). |
| Lexicographer | 0 of 3 (0 of 2) | 3 of 3 (0 of 2) | | Sonnet (round 3: none). Haiku: T-0280. |
| Admiral | 1 of 2 (0 of 2) | 2 of 2 (0 of 2) | | Sonnet (round 3: none). Haiku misses GameHud once (T-0284). |

Per-turn `--expect-turn` passes across all runs (round 3 in brackets; the run sets differ, so read the rates):

| Preset | Haiku 5.5 | Sonnet 5.5 | Opus 5.5 |
|---|---|---|---|
| Croupier | 14 of 14 (24 of 27) | | 4 of 4 (12 of 12) |
| Admiral | 12 of 12 (8 of 12) | 12 of 12 (12 of 12) | |
| Lexicographer | 8 of 14 (4 of 9) | 14 of 14 (4 of 9) | |
| Concierge | 11 of 29 (1 of 25) | 15 of 29 (1 of 25) | 2 of 4 (1 of 4) |

## Routing-expect
83 turns carried an oracle, and all 83 passed (round 3: 96 of 100, all 4 failures the doc-only oracle fixed by T-0270). These include the new long-flow oracles: the word board on "Start a new word game." (:119, :191), the game-over exemplar on "I give up." (:122, :194), and the booking exemplar on every Concierge booking ask. There are no misses to explain. Routing is not what blocks any preset this round.

## BookingConfirmation hand count
No probe check counts BookingConfirmations, so these were counted by hand from the traces.
- **Shipped:** 4 turns, each holding exactly one BookingConfirmation, never inside a Card: Haiku :112 (spa, after two repair rounds), and Sonnet :137 (Vela table), :141 and :156 (boat tour). No run shipped two.
- **Spa confirm turns:** 9, and only 1 shipped a BookingConfirmation (Haiku :112). On the other 8 (:8, :79, :115, :131, :151, :184, :187, :216) the model refuses to confirm because the treatment is blank: "Which 60-minute massage should I book?" (:187). That is the right answer to an ambiguous ask (T-0277). The confirmation at :112 was itself pushed by the repairs: round 1 said "the booking hasn't been submitted yet", then it confirmed (T-0278).
- **Other confirm turns:** Sonnet confirms all 3 tour and table bookings with one BookingConfirmation each. Haiku confirms none of 3: it sends the form back (:14), refuses (:18), or says the boat tour "is booked" in prose with no surface (:84, T-0282).

## Long flows (new this round)
- **booking-confirm** (Haiku :114-:116, Sonnet :186-:188): both draw a pre-filled BookingForm on the ask (T-0266 holds). Neither confirms, because "a 60-minute massage" leaves the treatment blank (T-0277). Haiku's refusal is then sent back twice (T-0278).
- **spa-services** (Haiku :117-:118, Sonnet :189-:190): the list is a Table on both (T-0279). The booking from it ("Book the first one") draws a BookingForm pre-filled with the Swedish massage on both.
- **game-give-up** (Haiku :119-:123, Sonnet :191-:195): Sonnet passes every step: board, guesses, ResultCard, replay. Haiku draws the board only after a repair, puts it on an `ask-2` Card, answers both guesses in prose, gives up in a hand-built Card and replays in prose (T-0280).

## Failure classes
- **Model:** Haiku game moves in prose (T-0280), Haiku's Admiral opening with no GameHud (T-0284), Haiku's Omaha table reduced to a Text (:52-:54), and Opus calling a bet for the player (:210, folded into T-0283).
- **Check or runtime defects:**
  - T-0276: NATURAL_ACTIONS has no game gate.
  - T-0278: the confirm repairs demand a confirmation the booking cannot have.
  - T-0281: a FEED_SCOPE retry drops the surface.
  - T-0282: SURFACE_MISSING's booking vocabulary is too narrow.
- **Scenario defects:** T-0277 (the ambiguous spa ask, a side effect of T-0267's list) and T-0283 (stud has one check too many).
- **Guidance conflict:** T-0279 (ServiceCard or ProductCard for a priced services list). It needs a ruling.
- **Existing:** T-0189 (PlayingCard type floor) still fails every Opus Omaha turn.

## Why it failed and how to fix it
Decision analysis with the context-fog-of-war skill, fog report `ffe6d0ef720852da99edbff0` (decisions d1 to d5, findings f1 to f6, every citation an exact excerpt of a trace line event). Each failed run is assigned to every cluster with a failing check in it: 18 runs fail on one cluster only, 8 on two or three (A with B on 6, A with C on 1, A, B and C on 1).

What the traces rule out: retrieved and framed exemplars match on 217 of 217 lines, and all 10 tool results on the 9 integration lines were submitted to the next request, so no failure is an exemplar or tool result dropped on the way to the model. The exposure that differs between a passing and a failing turn is which guidance is loaded in full (mini-skills, persona, a reference loaded `full`) against what is only an index line (every skill and workflow is `index-only` on every turn this round).

| Cluster | Runs (any / only) | Class | Evidence | Fix layer | File | Keyless test that proves it | Ticket |
|---|---|---|---|---|---|---|---|
| A. Services list and facility hours never draw the oracle's ServiceCard | 15 / 7 | (b) conflicting guidance, with (a) exposure: both ServiceCard skills are index-only | :6 Haiku Table and :129 Sonnet ProductCard grid have the same routing (`amenity-service-card` index-only, `product-presentation` in miniSkills, same 3 exemplars), fog g1a. :153 DescriptionList with `facility-info-card` index-only and the knowledge base `full`, g1c | Loaded guidance plus the scenario oracle. Editing the index-only skill alone cannot move a live turn | `mini-skills/product-presentation.md`, `catalog/composite-moments.ts`, `agent-admin-libraries.ts` skills, `agent-admin-presets.ts:332` surfaceStyle; oracles in `scenarios/{concierge,routing,round3,round4}.ts` | `composite-moments.test.ts` row that fails on a Table and passes on a ProductCard grid; `npx vitest run scripts/e2e-admin/probe/scenarios` pinning the retargeted oracles | T-0279 (services, ruled ProductCard; its Done when does not list the 6 oracles yet), T-0285 (facility hours, new) |
| B. Confirm turn on an incomplete or unmatched booking | 9 / 2 | (d) scenario and check defects | :187 "Which 60-minute massage should I book?" after a blank-treatment form (explicit, g2a); :115 SURFACE_MISSING demands a BookingConfirmation over a refusal, 3 rounds, uncorrected (g2b); :84 "Confirm it" booked in prose, no code (g2c) | Scenario generator; concierge checks | `scenarios/*.ts` spa asks; `catalog/personas/concierge/checks.ts` | scenarios test (every spa ask names Swedish massage); concierge `checks.test.ts`: blank-field confirm raises no code, complete one does, three new phrases fire | T-0277, T-0278, T-0282 |
| C. A repair round loses or corrupts the surface | 3 / 1 | (d) check defects | :46 NATURAL_ACTIONS twice on hold'em; round 2 refuses ("two cards don't end the hand"), round 3 settles it as blackjack, table-1 never ships (g3a). :24 FEED_SCOPE retry accepted with no surface, then :25 BOOKING_FORM_MISSING (g3b) | Check gate; retry acceptance in produce | `catalog/personas/croupier/checks.ts`; `agent/produce.ts` | croupier checks test (hold'em, Omaha, stud A K: no NATURAL_ACTIONS; blackjack natural: fires); produce test (FEED_SCOPE retry with no surface after a surface round 1 is not accepted); replays `croupier-haiku-holdem-natural`, `concierge-haiku-feed-scope-drop` | T-0276, T-0281 |
| D. Haiku game moves in prose, no check sends them back | 6 / 6 | (c) model ignored clear, loaded guidance | :87 Haiku and :159 Sonnet "My guess: audio." frame the same word-board exemplar with the same references; Haiku sends a note and no update (g4a). :89 "The board now shows the result." with no surface, :161 Sonnet ships ResultCard (g4b). :101 opening with BoardGrid and no GameHud, battleship exemplar the only one framed | A check (more context will not help: the guidance is already framed) | a Lexicographer word-board check (none today); the Admiral GameHud check | checks test: a guess or give-up with no board update is sent back, an updating guess passes; a battleship opening without GameHud is sent back; replay `lexicographer-haiku-guess-prose` | T-0280, T-0284 |
| E. Opus poker leftovers | 2 / 2 | (d) scenario defect and an existing lint | :210 Opus calls the house bet for the player on the fourth check; :211 "Round 1 is over, so I'm treating that as "deal again."" (g5a). Omaha render-lint is in `runs/*/report.json`, outside the fog bundle; the trace shows only that PlayingCard shipped (:196) | Scenario generator; the playing-card type floor | `scenarios/croupier.ts:101`; ui-playing-card | `croupier.test.mjs` pins the stud steps to the betting rounds | T-0283, T-0189 |

Representative turns, exposure chain as recorded on the trace line (observed). Exemplars are `events.framedExemplarIds` (equal to `retrieval.chunkIds` on every line); references not listed are `index-only`.

| Turn | Model | Framed exemplars | Mini-skills | Loaded `full` | Retry codes, rounds | Shipped |
|---|---|---|---|---|---|---|
| :6 services | Haiku | concierge-booking-request, service-gateway, backable-wizard | greeting-card, product-presentation | none | none, 1 | Table |
| :129 services | Sonnet | same as :6 | same as :6 | none | none, 1 | Grid of ProductCard |
| :153 facility hours | Sonnet | concierge-booking-request, service-gateway, booking-reservation | greeting-card, nested-record-editor, feature-collection | property-knowledge-base | none, 1 | Card with DescriptionList |
| :115 spa confirm | Haiku | service-gateway, concierge-booking-request, booking-receipt | feature-collection, structured-container, greeting-card | none | FLOW_END_MISSING, SURFACE_MISSING, 3 | nothing (prose refusal) |
| :84 tour confirm | Haiku | service-gateway, concierge-booking-request, confirmation-view | feature-collection, greeting-card | property-knowledge-base | none, 1 | nothing ("is booked" in prose) |
| :46 hold'em opening | Haiku | croupier-card-table-round, round-outcome, wallet-summary-card | card-game-sheet, card-layout, login-form | texas-holdem | NATURAL_ACTIONS x2, 3 | table-1 built, never shipped |
| :24 Vela table | Haiku | concierge-booking-request, service-gateway, result-card-win | master-detail-split, feature-collection, table-toolbar-pagination | none | FEED_SCOPE, 2 | nothing (ask-1 dropped) |
| :87 / :159 guess | Haiku / Sonnet | lexicographer-word-board, media-tour, wallet-summary-card | none | none | none, 1 | Haiku nothing; Sonnet board update |
| :89 / :161 give-up | Haiku / Sonnet | lexicographer-game-over, travel-itinerary, support-ticket-close-then-new | login-form, form-rhythm, greeting-card | none | none, 1 | Haiku nothing; Sonnet ResultCard |
| :211 stud | Opus | croupier-card-table-round, booking-reservation, button-icon-actions | game-hud | seven-card-stud | none, 1 | nothing (round 2 opened in prose) |

Observed against inferred: the routing, codes, rounds and shipped components above are recorded. Inferred, and marked so in the fog findings: that the persona's houseFacts rows pull the services list toward a Table and its `surfaceStyle` line toward a DescriptionList for hours (the trace records the persona section size, not its text; the text is unchanged since `5a803d13`), and that only a check, not more context, moves Haiku in cluster D (the guidance is already framed and Sonnet passes on it).

## Spend (ledger.jsonl, list prices, an overestimate)
| Model | Runs | Passed | USD |
|---|---|---|---|
| Haiku 5.5 | 20 | 5 | 0.62 |
| Sonnet 5.5 | 14 | 6 | 4.62 |
| Opus 5.5 | 3 | 0 | 3.48 |
| Total | 37 | 11 | 8.72 |

By part: the 31 reruns cost $8.00, against $9.07 for the same runs in round 3, and 10 of them pass. The 6 long flows cost $0.72, and 1 passes. Repair rounds cost $0.80 of the total.

## Context fog-of-war
Ingested with `.sdlc/evals/fog-manifest.json` and first published as report `862735193f488fbfb993b3b9` (444 events, 252 sources, 0 diagnostic findings; run `run-1a1c4bf71a57b5fa3c9fadd0`). The decision analysis (5 decisions, 11 guidance edges, 6 reviewed findings, diagnostics rerun) is published as report `ffe6d0ef720852da99edbff0`, recorded in `.sdlc/evals/fog/2026-10-15-r4-fixes.json`. Zero diagnostic findings is not a clean bill of health:
- `retrieved-not-submitted` (213 pairs), `tool-result-not-propagated` (10) and `truncation` (227) were assessed and gave no signal.
- The other five detectors had no eligible trigger in a web-chat bundle.
- The bundle does not map `runs/*/report.json` (probe checks, render-lint) or `retries`, so cluster E's lint and every check verdict are cited from the round folder, not the fog report.

## Tickets filed (proposed)
- T-0276: NATURAL_ACTIONS on hold'em (P1)
- T-0277: ambiguous spa booking ask (P1)
- T-0278: confirm repairs force a false booking (P1)
- T-0279: ServiceCard against ProductCard for the services list, a ruling (P2)
- T-0280: Haiku game moves in prose (P1)
- T-0281: a FEED_SCOPE repair drops the surface (P2)
- T-0282: SURFACE_MISSING confirm vocabulary (P2)
- T-0283: stud scenario has an extra check (P2)
- T-0284: Haiku Admiral opening with no GameHud (P3)
- T-0285: facility hours never draw ServiceCard, filed by the decision analysis (P2)

## Replays (`scripts/e2e-admin/probe/replays/`, pinned to today's behavior, `// expectedFail: T-NNNN`)
- `croupier-haiku-holdem-natural` (T-0276): NATURAL_ACTIONS twice on hold'em, and table-1 is lost (:46).
- `concierge-haiku-confirm-no-treatment` (T-0278): the refusal is sent back twice and ships uncorrected (:114-:115).
- `concierge-haiku-feed-scope-drop` (T-0281): the FEED_SCOPE retry passes with no surface (:23-:24).
- `lexicographer-haiku-guess-prose` (T-0280): two guesses and a give-up with no board update and no code (:86-:89).
