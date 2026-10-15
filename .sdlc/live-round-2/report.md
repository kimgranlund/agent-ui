# T-0225 live round 2: report

42 live probes, 2026-10-15 (UTC): the Croupier's 8 games on Haiku 5.5, Sonnet 5.5 and Opus 5.5, and 3 scenarios each for the Concierge, Lexicographer and Admiral on Haiku and Sonnet, sample 1, default effort, at `6f740b0b`. The capped runner finished all 42 under the $20 cap; estimated spend $17.86 (the conductor's figure). 11 pass, 31 fail. Run folders: `runs/<preset>-<scenario>-<model>-1/` (`report.json`, `fixture.json`, `turn-<n>.png`; the pngs are git-ignored). Traces are `.agent-traces/2026-10-15.jsonl:<n>` in the wave-r2 worktree (git-ignored). Turn numbers below are 1-based and match `turn-<n>.png`.

The probe's live prose checks read the whole chat, so one leaking reply fails `no-json-as-prose` and `no-internal-leak` on every later turn (T-0235). The 27 and 33 fails of those two checks come from 13 replies (the 12 T-0229 leaks and :260); the tables count each by its first turn.

## Croupier: game x model
| Game | Haiku 5.5 | Sonnet 5.5 | Opus 5.5 |
|---|---|---|---|
| blackjack-rounds | fail t3 click Stand: the bet answer drops the moves, :1-:2; T-0229 T-0233 | fail t2 click 100: opened dealt at 50, :104; T-0232 | fail t7 click Stand after a bust, :209-:214; scenario defect |
| blackjack-moves | fail t6 leak, :3-:12; T-0229 | pass, :105-:114 | pass, :215-:224 |
| spanish-21 | fail t2 prose-only bet answer, t3 click Stand, :13-:14; T-0214 | pass, :115-:124 | pass, :225-:234 |
| pontoon | pass, :15-:25 | fail t2 click 100: opened dealt at 50, :125; T-0232 | pass, :235-:245 |
| texas-holdem | fail t1 opening in prose, :26-:35; T-0214 | pass, :126-:135 | pass, :246-:255 |
| omaha | fail t6 click Deal again: hand in prose, :36-:40; T-0214 T-0234 | pass, :136-:145 | fail t5 "table-2" in chat, :256-:265; T-0234 T-0214 |
| five-card-draw | fail t2 leak, :41-:50; T-0229 T-0234 T-0214 | pass, :146-:155 | pass, :266-:275 |
| seven-card-stud | fail t1 opening in prose, t3 leak, t7 click Deal again, :51-:56; T-0214 T-0229, scenario defect | fail t7 click Deal again, :156-:161; scenario defect | fail t7 click Deal again, :276-:281; scenario defect |

Per-turn `--expect-turn` (the table component on each deal): Haiku 14/16, Sonnet 18/18, Opus 21/21.

## Concierge, Lexicographer, Admiral: scenario x model
| Preset, scenario | Haiku 5.5 | Sonnet 5.5 |
|---|---|---|
| concierge spa-booking | fail, no surface on any turn, :57-:60; T-0231 T-0214 | fail, Calendar then a hand-built summary Card, :162-:165; T-0208 |
| concierge dinner-at-vela | fail, t3 leak, :61-:65; T-0229 T-0208 | fail, summary Card with a "Booked" Badge, :166-:170; T-0208 |
| concierge facilities-then-tour | fail, no hours ("I don't have"), :66-:70; T-0231 T-0208 | fail, ServiceCard once (t5), :171-:175; T-0231 T-0208 |
| lexicographer six-guesses | fail, no BoardGrid, :71-:76; T-0208 T-0230 | fail, marks in chat prose, :176-:181; T-0208 T-0230 |
| lexicographer give-up | fail, "lost track of the hidden word", :77-:80; T-0230 | fail, reveal fitted to the marks, :182-:185; T-0230 T-0208 |
| lexicographer invalid-then-replay | fail, "the marks were made up", t4 t5 leak, :81-:86; T-0230 T-0229 | fail, no BoardGrid, :186-:191; T-0208 |
| admiral opening-salvo | fail, no GameHud; fleet of 7 cells then 5, :87-:91; T-0208 T-0230 | fail, no GameHud; asks the player to call its shots, :192-:196; T-0208 T-0230 |
| admiral concede | fail, no ResultCard, :92-:95; T-0208 | fail, no ResultCard, :197-:200; T-0208 |
| admiral row-sweep | fail, no GameHud, t3 board in prose only, :96-:103; T-0208 T-0214 | fail, no GameHud, :201-:208; T-0208 |

Composite measurement (T-0200, T-0208), per-turn `--expect-turn` passes: Concierge Haiku 0/12, Sonnet 1/12; Lexicographer 0/14 on both; Admiral Haiku 14/16, Sonnet 15/16 (BoardGrid). Across these 18 runs no model drew BookingForm, BookingConfirmation, GameHud or ResultCard; BoardGrid only for the Admiral; ServiceCard once (Sonnet, :175). The Croupier's composites (CardTable, PlayingCard, GameHud) are drawn on every model.

## Findings (ticket: finding; evidence; check that fires today)
- **T-0229 (new):** Haiku 5.5 skipped `render_surface` on 28 of its 103 turns and wrote the text shape (prose, a meta-line, wire lines). `peelMetaLine` peels only a leading meta-line, so the trailing `{"a2uiMeta":...}`, with its surface id, shows in chat. All 12 leaking replies are this shape: :2, :8, :11, :12, :42, :44, :53, :54, :56 (4 of 8 Croupier games), :63, :84, :85. In :12 an `updateComponents` line that is not valid JSON also lands in chat. `five-card-draw-haiku-1/turn-2.png`, `blackjack-rounds-haiku-1/turn-2.png`. Only the probe's `no-json-as-prose`.
- **T-0230 (new):** No secret word and no fleet is ever committed: data models hold `rows`, `cells`, `shipsRemaining` only (:182, :186, :92). Haiku says the marks "were made up to look consistent" (:85) and "I've lost track of the hidden word" (:79); Sonnet's reveal SLAIN comes with "SWAIN also fits those clues" (:185); the Admiral's fleet goes from 7 cells to 5 (:91). The player's fleet is never placed, so Sonnet asks the player to call its return fire every turn (:193-:208). None.
- **T-0231 (new):** Skills, playbooks and resources reach the prompt as index lines only (ADR-0190), so the Concierge never sees its `property-knowledge-base`: both models say they lack the pool, gym and spa hours (:66, :171, :60, :165) and the late check-out rule (:67, :172) that the resource holds. Haiku never sees `booking-flow`: it reviews a spa booking in prose with no surface (:58), then "nothing has been reserved" (:59). The game presets' composite teaching (`word-tiles`, `board-grid`, `battle-rounds`) is index-only the same way. None.
- **T-0232 (new):** Sonnet opens blackjack (:104) and pontoon (:125) already dealt at a 50 stake, with no bet strip; NEW_ROUND_NOT_BETTING judges only a Deal again answer. Haiku and Opus opened in betting in every blackjack-family game. Only the next step's click-target.
- **T-0233 (new):** The ACTION_NOT_APPLIED repair of a Haiku bet answer resends the CardTable in phase playing with `children: []`; "Your move: hit or stand" shows with no Hit or Stand (:2, `blackjack-rounds-haiku-1/turn-2.png`). No check reads a playing table's moves. Only the next step's click-target.
- **T-0234 (new):** Ordinary turns narrate surface mechanics and confess earlier turns: Opus "I've built it now as table-2 ... removed the Deal again button" (:260); Haiku "I need to correct my last turn" (:44), "my earlier turns" (:40), "I made a mistake last turn" (:56), the Admiral and the Concierge the same (:91, :60); Sonnet "Q♥... correction: Q♦ Q♣" (:140). Most confess a T-0214 turn. Only the probe's `no-internal-leak`.
- **T-0235 (new, probe):** Live prose checks are cumulative (above).
- **T-0236 (new, probe):** `--from-trace` labels a Lexicographer or Admiral trace `croupier`: the trace has no `agent` for a base-catalog preset, and `trace.ts:168` defaults it.
- **T-0214 (existing, widened):** A move stated in prose with no table update is neither Haiku-only nor Croupier-only. Croupier Haiku: the opening in prose (:26, :51), the Omaha turn card (:38), the draw (:43), three prose-only rounds after a bet (:14, ACTION_NOT_APPLIED twice, shipped nothing). Opus played an Omaha round 2 flop in prose with no table (:259). The Admiral on Haiku says "my fleet board is now revealed below" with no surface touched (:98).
- **T-0208 (existing):** the composite measurement above. Every expect-component fail in the Concierge, Lexicographer and Admiral runs is this, with T-0231 for why the teaching never reaches the model.
- **T-0218 (done) held:** CARD_DUPLICATE fired on Haiku (:39), Sonnet (:156) and Opus (:276), and each repair dealt distinct cards. HOLE_CARD_CHANGED never fired.
- **T-0189, T-0226, T-0227:** no new evidence. `render-lint` passed on all 281 live turns, and no run raised a client error turn.

## Corrections to the conductor's read
- Haiku's raw meta-line and JSON in chat: confirmed in 4 of 8 Croupier games (not 5), plus one Concierge and one Lexicographer run. The leaked line is a trailing meta-line, once with an unparsed `updateComponents` (T-0229). The "table-N" and "ask-N" leaks ride in that meta-line's `target`.
- Lost buttons after a bet: two causes. blackjack-rounds (:2) is the T-0229 shape plus a repair that drops the moves (T-0233); spanish-21 (:14) is three prose-only rounds that ship nothing (T-0214).
- Omaha Haiku: the 2 of spades was announced in prose at :38 with no table update (T-0214). At :39 the board's 2 of spades collided with a face-down dealer card, and the CARD_DUPLICATE repair replaced the board card, the right fix for the table; the next turn's prose then "corrected earlier turns" (:40, T-0234). The check worked; the prose had run ahead of the table.
- Lexicographer: confirmed on Haiku, and Sonnet commits no secret either (T-0230).
- Concierge Haiku: it reviews the booking in prose with no surface, and refuses to confirm because "nothing has been reserved"; a FLOW_END_MISSING repair (:59) keeps that answer (T-0231, T-0214).
- No composites: confirmed for the Concierge and the Lexicographer; the Admiral draws BoardGrid on 29 of 32 turns but never GameHud or ResultCard.
- Openings without the bet strip: Sonnet only (blackjack-rounds, pontoon). Opus opened every blackjack-family game in betting.
- "I need to correct my earlier turns": confirmed on all three models (T-0234).

## Scenario defects (fixed for the next round in this change)
- **seven-card-stud:** round 1 has five betting streets, and all three models were still on seventh street when the run clicked Deal again (:56, :161, :281). One more "Check, or call" step.
- **blackjack-rounds:** a Hit can bust; Opus busted and found no Stand (:214). The Stand after the Hit is now a `--say`.
- **Concierge dates:** the prompt carries no date, so "tomorrow" and "this Friday" cannot resolve; Haiku asked which Saturday (:69) and Sonnet wrote "Day: This Friday" on the summary. Each booking now names its date (November 2026).
- **Concierge hours:** the hours sit in an index-only resource (T-0231), so the two hours steps now name `property-knowledge-base`, which auto-attaches it.

The fixes go to `CROUPIER_ROUND_SCENARIOS` and the Concierge list, and `live-commands.sh` is regenerated; the script that ran is the one at `6f740b0b`. The T-0184 record is unchanged.

## Not a bug, or not filed
- **Omaha drift:** a dealer fold at "Bet the pot" ends the hand early, so later "Check" steps are out of phase (Opus, :258). Random; Opus handled it.
- **Sonnet's confirmed booking:** "The restaurant has received the reservation" (:168) though no booking system exists; the preset's flow treats the confirm as the booking. A ruling, not a defect.
- **Trace agent label:** a preset on the base catalog logs no `agent` (`agentLabel` reads the catalog id). Filed as T-0236's cause.
- **Reasoning warn:** Sonnet at high effort once captured no thinking text (concierge dinner t5). Warn-level by design.

## Replays (scripts/e2e-admin/probe/replays/)
The replay tests name turns by the probe's 0-based index (`no-json-as-prose:1` is `turn-2.png`).

- **Pinned to today's failures (flip to `toEqual([])` with the fix):** croupier-draw-haiku-meta-tail (T-0229), croupier-rounds-haiku-no-moves (T-0229, T-0233), lexicographer-haiku-no-secret (T-0229, T-0230; agent hand-set, T-0236), croupier-omaha-opus-narration (T-0234).
- **Pin the trace only (every check green today):** croupier-sonnet-opening-dealt (T-0232), concierge-haiku-spa-prose (T-0231, T-0214).
