# T-0261 live round 3: report

Round 3 ran 44 live probes on 2026-10-15 (UTC 20:45 to 22:07) at `f0c91033`, all at sample 1 and default effort:
- **A:** the T-0260 routing pressure pack, 12 runs.
- **B:** 26 reruns of round 2 failures.
- **C:** 6 long flows.

The capped runner finished 44 of 44 under the $20 cap. 13 runs passed and 31 failed. Trace line numbers below (`:n`) are 1-based lines of `traces/2026-10-15.jsonl` in this folder. Turn numbers (`t<n>`) are the probe's 0-based turn index. The generator is `scripts/e2e-admin/probe/scenarios/round3.ts`.

## Spend (ledger.jsonl, list prices, an overestimate)
| Model | Runs | USD |
|---|---|---|
| Haiku 5.5 | 22 | 0.62 |
| Sonnet 5.5 | 17 | 8.69 |
| Opus 5.5 | 5 | 5.07 |
| Total | 44 | 14.38 |

By part: the routing pack cost $2.86 (4 of 12 runs passed), the regressions $9.03 (6 of 26 passed), and the long flows $2.49 (3 of 6 passed). Repair rounds cost $2.35 of the total, on 59 of 287 turns.

## Round 2 fixes, live
| Ticket | Verdict | Evidence |
|---|---|---|
| T-0229 text-shape leak | fixed live | `no-json-as-prose` passed 292 of 292 turns. Haiku still writes the text shape on 39 turns (TEXT_JSONL_ROUTED 35, IGNORED 5), but it is routed and never reaches the chat. |
| T-0230 hidden state | fixed live, new defect | Every Lexicographer and Admiral game commits `secret` at the start (:96 onward). The fleet check also fires on a word board: T-0263. |
| T-0231 preset knowledge | partly | Facts hold: every model answers the hours and the late check-out (14:00) without naming the resource (:25, :164, :99). The composite teaching (`booking-flow`, `amenity-service-card`, `facility-info-card`) is index-only on 83 of 83 Concierge turns (T-0266, T-0267). |
| T-0232 opening skips the bet | fixed live | Sonnet blackjack-rounds and pontoon pass and open in betting. NEW_ROUND_NOT_BETTING fired once (:57) and the repair saved it. |
| T-0233 table with no moves | fixed live | MOVES_MISSING never fired. Haiku's bet answer carries Hit, Stand and Double (:35). |
| T-0234 narrated mechanics | fixed live | `no-internal-leak` passed 292 of 292 turns. NARRATED_MECHANICS fired 9 times and every repair saved the turn. |
| T-0236 trace agent label | fixed | `--from-trace 2026-10-15.jsonl:149` on a Lexicographer line stops with "names no agent (catalog agent-ui); pass --agent <preset id>". |
| T-0214 state in prose | partly | Croupier moves are fixed: ACTION_NOT_APPLIED fired 12 times and saved 11. Haiku still deals openings in prose (:68 texas-holdem), fires Admiral shots with no board update, and runs a whole Concierge booking with no surface (:96-:99): T-0265. The one unsaved repair shipped no surface: T-0264. |
| T-0238 off-domain exemplars | fixed live | 158 of 158 Croupier turns lead with `domain-croupier-card-table-round`, 83 of 83 Concierge turns hold `domain-concierge-booking-request`, and 26 of 26 Admiral turns hold the battleship board. |
| T-0240 domain exemplars | partly | Only 10 of 20 Lexicographer turns hold the word board, and none of the openings do (T-0268). |
| T-0253 games ranked by family | mostly | No Croupier turn holds the word board. The battleship board ranks second on three Haiku "Hit" turns (:42, :43, :55): T-0273. |

The two round 2 scenario fixes:
- **blackjack-rounds on Opus:** the fix holds. The run passes, and the Stand after a Hit is a `--say`.
- **seven-card-stud:** still stopped on seventh street on Haiku and Opus, now for a different reason. The steps do not fit the fixed-limit house rules that Opus states, and it refuses "Bring it in" and "Bet 25" (:270, :271): T-0272. Sonnet passes.

## New checks: fires, saves, extra cost
A save is a turn whose final round passed with no `*_UNCORRECTED` code. The extra cost is that of the turn's rounds after the first, split evenly when one turn fires several codes.

| Check | Fired (turns) | Saved | Extra USD | Models | Note |
|---|---|---|---|---|---|
| ACTION_NOT_APPLIED | 12 | 11 | 0.05 | Haiku 12 | :36 is unsaved and ships no surface (T-0264) |
| NARRATED_MECHANICS | 9 | 9 | 0.14 | Haiku 8, Sonnet 1 | |
| NEW_ROUND_NOT_BETTING | 1 | 1 | 0.00 | Haiku | :57 |
| MOVES_MISSING | 0 | | | | |
| FLEET_SECRET_MISSING | 4 | 2 | 0.08 | Haiku 3, Sonnet 1 | 2 of the 4 fired on a Lexicographer word board (T-0263) |
| WORD_SECRET_MISSING | 0 | | | | Every word game committed its secret |
| BOOKING_CONFIRMATION_MISSING | 9 | 2 | 0.48 | Sonnet 6, Haiku 2, Opus 1 | 7 end in CATALOG at `rows`, and Opus nests the composite in a Card (T-0262) |
| BOARD_GRID_MISSING | 7 | 2 | 0.32 | Sonnet 5, Haiku 2 | Lexicographer only (T-0268) |
| GAME_HUD_MISSING | 1 | 0 | 0.00 | Haiku | :110 is the fleet misfire turn |
| RESULT_CARD_MISSING | 1 | 1 | 0.00 | Haiku | :113 |
| BET_TABLE_MISSING | 1 | 1 | 0.00 | Haiku | :37 |
| FLOW_END_MISSING | 4 | 4 | 0.11 | Haiku 2, Sonnet 2 | |
| CARD_DUPLICATE | 1 | 1 | 0.06 | Sonnet | :194 |

Fires of codes that are not new checks: PARSE 10 (saved 6), CATALOG 9 (follows BOOKING_CONFIRMATION_MISSING), SCHEMA 3, SURFACE_REQUESTED 2, FEED_SCOPE 2, HAND_BINDING 1, IDGRAPH 1. Opus tallied TEXT_JSONL_IGNORED on 19 of its 20 turns. This is a tally, not a retry, and nothing it wrote reached the chat.

## Cheapest model that passes, per preset
| Preset | Haiku 5.5 | Sonnet 5.5 | Opus 5.5 | Cheapest that passes |
|---|---|---|---|---|
| Croupier | 5 of 12 | 6 of 6 | 2 of 4 | Sonnet. Opus fails only on T-0189 (PlayingCard lint) and T-0272 (scenario). |
| Concierge | 0 of 7 | 0 of 7 | 0 of 1 | None. The blockers are guidance and content (T-0266, T-0267), not the model. |
| Lexicographer | 0 of 2 | 0 of 2 | | None (T-0268, T-0263). |
| Admiral | 0 of 2 | 0 of 2 | | Sonnet once T-0269 lands: its only failure is the BoardGrid glyph lint. Haiku also misses shot updates (T-0265). |

Per-turn `--expect-turn` passes, across all runs:

| Preset | Haiku 5.5 | Sonnet 5.5 | Opus 5.5 |
|---|---|---|---|
| Croupier | 24 of 27 | 19 of 19 | 12 of 12 |
| Admiral | 8 of 12 | 12 of 12 | |
| Lexicographer | 4 of 9 | 4 of 9 | |
| Concierge | 1 of 25 | 1 of 25 | 1 of 4 |

## Routing-expect
100 turns carried an oracle: 96 passed and 4 failed. All 4 failures are `routing-doc-only` (t0 and t1, Haiku and Sonnet): "reference property-knowledge-base loaded index-only, not full". The cause is the oracle. T-0231 delivers those facts in the persona section (the House facts; `routing.sections` holds `persona`, and the resource stays `index-only, via index`), and both models answer correctly (:25, :164). This is filed as T-0270.

Every exemplar oracle held, including:
- domain-switch: the dinner ask on a Croupier table framed no booking exemplar.
- decoy-words: no game board for "board", "deals" or "read my mind".
- guidance-conflict.
- The regression openings and the Concierge booking asks.

The Lexicographer oracle sits on the first guess, because a keyless check before the round showed the opening ranks no word board (T-0268).

## The Opus Concierge long flow
`long-concierge-booking-opus-1` (:283-:287) shows nested cards and no ServiceCard or BookingForm. It is a guidance, content and check gap, not a model gap or a routing gap.
- **Routing is right:** the booking exemplar ranks first on every turn, and routing-expect passes.
- **No ServiceCard:** the preset holds no spa treatment list. Opus says "I don't have the spa's full treatment menu with me, so I won't guess", and so do Haiku and Sonnet (T-0267).
- **No BookingForm:** the ask carries every detail, so every model answers with `booking-flow`'s scene 5 read-back (a Card with DescriptionList and a confirm Button on `ask-1`). BookingForm's moment is "collect booking details", and its composite check needs 2 or more inputs (T-0266).
- **Nested cards:** the BOOKING_CONFIRMATION_MISSING repair at :286 put BookingConfirmation inside the hand-built Card. No semantic check reads nesting; only the browser render-lint does (T-0262).

## Other failures
- **render-lint type-floor:** fails on every BoardGrid with intents (`span[intent]` at 8px, 33 turns on Lexicographer and Admiral, T-0269) and on PlayingCard in Opus Omaha (`span[index-rank]` at 7.875px, existing T-0189).
- **click-target on Omaha Haiku t7:** "no button reading Deal again" while it lists Deal again. The click landed and no turn followed (T-0271).

## Tickets filed (proposed)
T-0262 BookingConfirmation repair · T-0263 fleet check on a word board · T-0264 repair round drops the surface · T-0265 Haiku no-surface turns · T-0266 Concierge booking guidance conflict · T-0267 Concierge has no spa menu · T-0268 Lexicographer opening and give-up composites · T-0269 BoardGrid glyph type floor · T-0270 routing pack doc-only oracle · T-0271 click-target detail · T-0272 stud scenario · T-0273 "Hit" ranks the battleship board.

## Replays (`scripts/e2e-admin/probe/replays/`, pinned to today's behavior, `// expectedFail: T-NNNN`)
- `concierge-sonnet-confirmation-rows` (T-0262): CATALOG after the repair, then SEMANTIC_UNCORRECTED (:205-:207).
- `concierge-opus-nested-confirmation` (T-0262): the repair keeps the wrapping Card (:283-:286).
- `lexicographer-haiku-fleet-check` (T-0263): FLEET_SECRET_MISSING twice on a word board (:109-:110).
- `croupier-haiku-stand-no-update` (T-0264): the ACTION_NOT_APPLIED retry ends with no surface (:34-:36).
