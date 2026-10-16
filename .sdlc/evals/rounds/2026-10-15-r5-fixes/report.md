# T-0287 live round 5: report

Round 5 ran 29 live probes on 2026-10-16 UTC (04:23 to 05:06) at `08da7dda`, sample 1 and default effort:
- **R:** the 26 runs that failed in round 4, rerun on the same model under the same name, from the current generators.
- **L:** 3 long flows not already among the reruns: the new Concierge facility-hours flow (T-0285) on Haiku and Sonnet, and the Lexicographer game through a give-up on Sonnet. The other long flows (booking-confirm, spa-services, Haiku game-give-up) failed in round 4, so they ran once, as reruns.

The capped runner finished 29 of 29 for an estimated $7.48, under the $15 cap. 19 runs passed and 10 failed. Of the 26 reruns, 16 now pass. Trace line numbers below (`:n`) are 1-based lines of `traces/2026-10-16.jsonl` in this folder. The generator is `scripts/e2e-admin/probe/scenarios/round5.ts`.

Sonnet now passes 9 of 10 runs, and its one failure is a stale oracle (T-0292). Opus fails only on the existing PlayingCard lint (T-0189). Every other failure is Haiku: it will not confirm a booking from chat (T-0289), it builds a booking form as a feed ask that the repairs then lose (T-0290), and it gives up or replays a word game in prose (T-0291). Haiku's own reasoning names a guidance conflict on most of these turns.

## Round 4 fixes, live
| Ticket | Verdict | Evidence |
|---|---|---|
| T-0276 NATURAL_ACTIONS on hold'em | fixed live | NATURAL_ACTIONS fired 0 times (round 4: 1). `regress-croupier-texas-holdem-haiku-1` passes; the opening table ships after one SURFACE_MISSING repair (:24). |
| T-0277 ambiguous spa ask | fixed live | Every spa booking ask names the Swedish massage, and every pre-filled form carries it (:7, :86, :105, :123, :170). Sonnet and Opus confirm every spa booking (:106, :124, :134, :137, :172). Haiku's refusals now have another cause (T-0289). |
| T-0278 confirm repairs force a false booking | partly | No repair pushed a blank-field confirm this round. The hold misfired once: a form with dotted field paths renders blank, so on :61 the hold keeps SURFACE_MISSING quiet while Haiku says the tour "is booked" in prose (T-0293). |
| T-0279 services list is ProductCard | fixed live | 13 of 13 "What spa services" asks draw a ProductCard grid: Haiku :4, :6, :21, :54, :81, :89; Sonnet :102, :104, :119, :122, :131, :139; Opus :169 (round 4: 0 of 13 ServiceCard). |
| T-0280 Haiku word moves in prose | partly | Every Haiku guess updates word-forge (:64, :92, :93). Give-ups :66 and :71 are saved by ACTION_NOT_APPLIED and ship ResultCard. The give-up at :94 declares no target and ships nothing, and neither does "Play again." (:72, :95). No code fires (T-0291). |
| T-0281 FEED_SCOPE repair drops the surface | partly | SURFACE_DROPPED fires (:17, :55), but its hint comes on the last round. :55 halts and shows "SURFACE_DROPPED at ask-1" to the guest. :17 ships a read-back Card instead of the form (T-0290). |
| T-0282 confirm vocabulary | fixed live | "Confirm it, the details are right." now fires SURFACE_MISSING (:18). Every "I'd like a table" ask draws a BookingForm (:12, :110, :120). The one miss is :61, the T-0293 hold. |
| T-0283 stud scenario | fixed live | `regress-croupier-seven-card-stud-opus-1` and `-haiku-1` pass. Opus plays all five steps of round 1 to showdown (:160-:164) and deals round 2 from Deal again (:165). |
| T-0284 Admiral opening GameHud | fixed live | Haiku's row-sweep opening ships GameHud in round 1 (:73), and the run passes (round 4: failed). |
| T-0285 facility hours info card | fixed live | 10 of 10 facility asks draw a Card holding a DescriptionList (Haiku :11, :15, :57, :58, :96; Sonnet :109, :113, :125, :126, :146). Haiku needed a SURFACE_MISSING repair on 3 of them, and all 3 were saved. Both facility-hours long flows pass. |
| T-0286 Croupier street moves in prose | fixed live | ACTION_NOT_APPLIED fired 6 times on Haiku Omaha and stud streets (:32, :36, :38, :47, :51, :53), and all 6 were saved. All three Haiku poker reruns pass. |
| T-0288 worktree vitest cap | not a live behavior | Lane infrastructure; the round ran from the main checkout. |

## Checks: fires, saves, extra cost (round 4 in brackets)
A save is a turn whose final round passed with no `*_UNCORRECTED` code. Extra cost is the cost of a turn's rounds after the first, split evenly when one turn fires several codes. Both rounds are computed the same way.

| Check | Fired (turns) | Saved | Extra USD | Models | Note |
|---|---|---|---|---|---|
| SURFACE_MISSING | 12 (11) | 9 (7) | 0.04 | Haiku 12 | 3 unsaved on confirm turns Haiku refuses (:8, :18, :87; T-0289) |
| FLOW_END_MISSING | 10 (8) | 6 (1) | 0.27 | Haiku 6, Sonnet 3, Opus 1 | 4 unsaved, all Haiku confirm refusals (:8, :14, :18, :87) |
| ACTION_NOT_APPLIED | 9 (16) | 9 (16) | 0.03 | Haiku 9 | Croupier streets 6, word give-ups 2, Admiral shot 1 |
| FEED_SCOPE | 4 (5) | 2 (5) | 0.02 | Haiku 4 | :22 uncorrected, :55 halted (T-0290) |
| SURFACE_DROPPED (new, T-0281) | 2 | 1 | 0.01 | Haiku 2 | :17 counts as saved but shipped a read-back Card, not the form |
| NARRATED_MECHANICS | 2 (9) | 2 (8) | 0.01 | Haiku 2 | |
| BOOKING_FORM_MISSING | 2 (1) | 1 (1) | 0.01 | Haiku 2 | :22 fights FEED_SCOPE (T-0290) |
| PARSE | 2 (5) | 2 (4) | 0.12 | Haiku 1, Sonnet 1 | |
| IDGRAPH | 1 (2) | 1 (2) | 0.06 | Sonnet 1 | |
| CATALOG | 1 (0) | 1 | 0.00 | Haiku 1 | |
| SCHEMA | 1 (1) | 1 (1) | 0.00 | Haiku 1 | |
| NATURAL_ACTIONS, BET_TABLE_MISSING, SHOT_RESULT_WRONG, BOARD_GRID_MISSING | 0 | | | | Round 4: 1, 2, 1 and 1 |

Repair rounds cost $0.57 of the $7.48. 35 of 46 code fires were saved (round 4: 50 of 63). All 11 unsaved fires are on Haiku booking turns: 5 on the T-0289 refusals (:8, :14, :87), 2 on :18 after T-0290 lost its form, and 4 on the T-0290 turns themselves (:22, :55).

## Cheapest model that passes, per preset (rounds 3 and 4 in brackets)
| Preset | Haiku 5.5 | Sonnet 5.5 | Opus 5.5 | Cheapest that passes |
|---|---|---|---|---|
| Croupier | 3 of 3 reruns (r4 3 of 6) | not rerun (r3 6 of 6) | 1 of 2 (r4 0 of 2) | Haiku for every game, poker included (round 4: Haiku for blackjack and five-card draw only, Sonnet for poker; round 3: Sonnet). |
| Concierge | 3 of 9 (r4 1 of 9, r3 0 of 7) | 8 of 9 (r4 1 of 9, r3 0 of 7) | 1 of 1 (r4 0 of 1) | Sonnet (round 3 and 4: none). Its one failure is the stale oracle (T-0292). Haiku passes the info and list flows but not a booking confirm (T-0289, T-0290). |
| Lexicographer | 1 of 3 (r4 0 of 3) | 1 of 1 (r4 3 of 3) | | Sonnet for a full game, Haiku for a short give-up only (T-0291). |
| Admiral | 1 of 1 (r4 1 of 2) | not rerun (r4 2 of 2) | | Haiku (round 4: Sonnet; round 3: none). |

Per-turn `--expect-turn` passes across all runs (round 4 in brackets; the run sets differ, so read the rates):

| Preset | Haiku 5.5 | Sonnet 5.5 | Opus 5.5 |
|---|---|---|---|
| Croupier | 9 of 9 (14 of 14) | | 6 of 6 (4 of 4) |
| Admiral | 7 of 7 (12 of 12) | | |
| Lexicographer | 11 of 14 (8 of 14) | 5 of 5 (14 of 14) | |
| Concierge | 18 of 29 (11 of 29) | 29 of 30 (15 of 29) | 4 of 4 (2 of 4) |

## Routing-expect
73 turns carried an oracle, and all 73 passed (round 4: 83 of 83). They include the facility-hours flow's `property-knowledge-base` loaded `full` (:96, :146). No oracle missed, so routing blocks no preset. The routing gap this round has no oracle: "Play again." frames no exemplar and no mini-skill on any model (:72, :95, :145). Sonnet builds the board without one and Haiku does not (T-0291).

## BookingConfirmation hand count
- **Sonnet:** 7 confirm turns, 7 BookingConfirmations, each alone on its surface (:106, :112, :116, :124, :129, :134, :137).
- **Opus:** 1 of 1 (:172).
- **Haiku:** 0 of 7.
  - It refuses or resends the form on a complete booking (:8, :14, :87; T-0289).
  - It says "Done ... confirmed" while shipping a BookingForm (:84; T-0289).
  - It has no form left to confirm after T-0290 dropped it (:18, :56).
  - It says "is booked" in prose over a blank dotted-path form (:61; T-0293).

## Spend (ledger.jsonl, list prices, an overestimate)
| Model | Runs | Passed | USD |
|---|---|---|---|
| Haiku 5.5 | 16 | 8 | 0.47 |
| Sonnet 5.5 | 10 | 9 | 3.43 |
| Opus 5.5 | 3 | 2 | 3.58 |
| Total | 29 | 19 | 7.48 |

By part: the 26 reruns cost $6.94 (the same runs cost $7.04 in round 4), and 16 of them pass. The 3 long flows cost $0.55, and all 3 pass.

## Why it failed and how to fix it
Decision analysis with the context-fog-of-war skill, fog report `4095416195875afe423e60ea` (decisions d1 to d6, guidance edges g1a to g6b, findings f1 to f6, every citation an exact excerpt of a trace line event). Each failed run is assigned to every cluster with a failing check in it. 8 runs fail on one cluster only, and 2 on two: `routing-long-session-haiku-1` (A and B) and `regress-concierge-facilities-then-tour-haiku-1` (D and F).

**What the traces rule out:** retrieved and framed exemplars match on all 169 assessed lines, and all 9 tool results reached the next request. No failure is lost context on the way to the model.

**What changed since round 4:** Haiku's reasoning now states which rule it follows. In clusters A, C and F the failing turn names a grammar or persona rule that contradicts the oracle (g1b, g3a, g6b). In B the two checks contradict each other on one turn (g2b). So most of these fails are (b) conflicting guidance, not (c).

| Cluster | Runs (any / only) | Class | Evidence | Fix layer | File | Keyless test that proves it | Ticket |
|---|---|---|---|---|---|---|---|
| A. Haiku will not confirm a complete booking from chat | 3 / 2 | (b) conflicting guidance | :87 (e177) reasoning: "the actual \"Book now\" action belongs to the user"; the FLOW_END_MISSING repair "looks like a fabricated system notice"; a BookingConfirmation "with a reference number" would be fabricating (g1b). :8 (e16) "I don't actually have a booking tool", the repair "suspicious" (g1c). Sonnet confirms the same ask in one round (:106, e217, g1d) | Persona houseFacts and the confirm repair message; the repair framing | `site/pages/agent-admin-presets.ts` houseFacts; `catalog/personas/concierge/checks.ts` SURFACE_MISSING confirm message; `agent/produce.ts` messagesFor; `grammar.md` Confirm before concluding | `replays/concierge-haiku-confirm-refusal.test.mjs` (pinned red, flips when the confirm ships); a checks test that the confirm message asks for no reference | T-0289 (new, P1) |
| B. Haiku builds the booking form on a feed ask, and the repairs lose it | 3 / 2 | (b) conflicting guidance, with (d) a check defect | :55 (e113) BookingForm on ask-1, FEED_SCOPE, then SURFACE_DROPPED, then a halt that names ask-1 (g2a). :22 (e47) BOOKING_FORM_MISSING against the hand-built form, then FEED_SCOPE against the BookingForm, uncorrected (g2b). :17 (e36) the last round ships a read-back Card (g2c) | FEED_SCOPE's own repair hint; a BOOKING_FORM_MISSING exemption after FEED_SCOPE; halt text with no surface id | `agent/produce.ts` (FEED_SCOPE hint, ProduceHalt), `catalog/personas/concierge/checks.ts`, `grammar.md` Confirm before concluding | `replays/concierge-haiku-feed-ask-halt.test.mjs` (pinned red: no-halt:1 naming ask-1); a produce-loop test where a FEED_SCOPE round 2 drops "ask" and ships the form | T-0290 (new, P1); follows T-0281 |
| C. Haiku word-game give-up and replay ship no surface, and no check fires | 2 / 2 | (b) conflicting guidance, plus (a) exposure and a (d) check gap | :94 (e191) "the rule that flow-ending turns should emit no UI at all ... the flow rule wins", with no target declared (g3a). :72 (e147), :95 (e193) and Sonnet's :145 (e298) frame no exemplar on "Play again." (g3b) | Grammar flow-completion wording for games; the word-move check (no-target fallback, replay case); retrieval for replay asks | `grammar.md` Flow completion; `catalog/hidden-state-checks.ts` wordMoveAppliedCheck; corpus retrieval | `replays/lexicographer-haiku-give-up-no-surface.test.mjs` (pinned: no codes on turns 3 and 4); hidden-state-checks test for a target-less give-up and a "Play again." with no update | T-0291 (new, P2); follows T-0280 |
| D. "What services could I add" expects ServiceCard | 2 / 1 | (d) scenario defect | :130 (e268) Sonnet ships the ProductCard grid that T-0279 ruled; :62 (e127) Haiku ships a DescriptionList card (g4a) | Scenario oracle | `scripts/e2e-admin/probe/scenarios/concierge.ts` facilities-then-tour | `npx vitest run scripts/e2e-admin/probe/scenarios` with the retargeted oracle | T-0292 (new, P2) |
| E. Opus Omaha PlayingCard type floor | 1 / 1 | (d) existing lint debt | :149 (e306) ships PlayingCard (g5a). Every turn's render-lint is `span[index-rank]` 7.875px and `span[pip]` 8.4px, from `runs/regress-croupier-omaha-opus-1/report.json` (outside the fog bundle) | The playing-card type floor | ui-playing-card | the T-0189 ruling's own test | T-0189 (existing) |
| F. A dotted-path BookingForm renders blank and a prose booking passes | 1 / 0 | (d) check defect | :60 (e123) value `/booking`, fields `booking.tour`, `booking.date` and so on, all rendered blank (screenshot `turn-3.png`). :61 (e125) no code fires and Haiku says the tour "is booked" with flowEnd and no surface (g6a, g6b) | A BookingForm prefill check; the T-0278 hold must not cover a form the model mis-pathed | `catalog/personas/concierge/checks.ts` | `replays/concierge-haiku-dotted-booking-paths.test.mjs` (pinned: no codes); a checks test where dotted paths raise the new finding | T-0293 (new, P2) |

Representative turns, exposure chain as recorded on the trace line (observed). Exemplars are `events.framedExemplarIds` (equal to `retrieval.chunkIds` on every assessed line). References not listed are `index-only`.

| Turn | Model | Framed exemplars | Mini-skills | Loaded `full` | Retry codes, rounds | Shipped |
|---|---|---|---|---|---|---|
| :87 confirm | Haiku | service-gateway, concierge-booking-request, booking-receipt | feature-collection, structured-container, greeting-card | none | FLOW_END_MISSING, SURFACE_MISSING, 3 | nothing (prose refusal) |
| :106 confirm | Sonnet | same as :87 | same as :87 | none | none, 1 | BookingConfirmation |
| :55 spa booking | Haiku | concierge-booking-request, service-gateway, commerce-product-card | not recorded (halt) | none | FEED_SCOPE, SURFACE_DROPPED, 3 | halt |
| :22 Vela table | Haiku | concierge-booking-request, service-gateway, result-card-win | master-detail-split, feature-collection, table-toolbar-pagination | none | BOOKING_FORM_MISSING, FEED_SCOPE, 3 | hand-built form, uncorrected |
| :94 give-up | Haiku | lexicographer-game-over, suggestions-chips, support-ticket-close-then-new | login-form, form-rhythm | none | none, 1 | nothing |
| :95 / :145 play again | Haiku / Sonnet | none | none | none | none, 1 / IDGRAPH, 2 | Haiku nothing; Sonnet board |
| :130 services | Sonnet | concierge-booking-request, service-gateway, five-day-weather | product-presentation, nested-record-editor, greeting-card | property-knowledge-base | none, 1 | Grid of ProductCard |
| :61 tour confirm | Haiku | service-gateway, concierge-booking-request, confirmation-view | feature-collection, greeting-card | property-knowledge-base | none, 1 | nothing ("is booked" in prose) |

**Observed against inferred:** the routing, codes, rounds, shipped components and Haiku's reasoning text above are recorded. The rest is inferred, and the fog findings mark it so:
- The specific prompt sentences Haiku is following. The trace records section sizes, not text, so "let the USER take the final action", "emitting NO A2UI at all" and "confirm once the guest submits it" are matched to Haiku's paraphrases from the source at `08da7dda`.
- That the repair framing (finding f2) is what Haiku distrusts, rather than the repair's content.

## Context fog-of-war
- **Record:** ingested with `.sdlc/evals/fog-manifest.json` (mapping hash `8255a4d8d99d`, run `run-47ffe687808419bff6e9ce02`), hydrated before its first publish, and published as report `4095416195875afe423e60ea`: 355 events, 202 sources, 6 decisions, 13 guidance edges, 6 reviewed findings, 0 diagnostic findings. The record is `.sdlc/evals/fog/2026-10-15-r5-fixes.json`.
- **Detectors:** `truncation` (182 envelopes) and `tool-result-not-propagated` (9 pairs) gave no signal. `retrieved-not-submitted` (169 pairs) is partial: the halted line :55 declares no complete request list. The other five had no eligible trigger in a web-chat bundle.
- **Outside the bundle:** `runs/*/report.json` (probe checks, render-lint) is not mapped, so cluster E's lint and every check verdict are cited from the round folder, not the fog report.

## Tickets filed (proposed)
- T-0289: Haiku will not confirm a complete booking from chat (P1)
- T-0290: a booking form built as a feed ask, FEED_SCOPE against BOOKING_FORM_MISSING, and the halt leaks the ask id (P1)
- T-0291: Haiku word-game give-up and replay in prose, no check (P2)
- T-0292: the "What services could I add" oracle still expects ServiceCard (P2)
- T-0293: a dotted-path BookingForm renders blank and a prose booking passes (P2)

## Replays (`scripts/e2e-admin/probe/replays/`, pinned to today's behavior, `// expectedFail: T-NNNN`)
- `concierge-haiku-confirm-refusal` (T-0289): the confirm is refused on all three rounds and ships uncorrected (:86-:87).
- `concierge-haiku-feed-ask-halt` (T-0290): FEED_SCOPE, SURFACE_DROPPED, then a halt that names ask-1 (:54-:55).
- `lexicographer-haiku-give-up-no-surface` (T-0291): the give-up and the replay ship nothing, with no code (:91-:95).
- `concierge-haiku-dotted-booking-paths` (T-0293): the dotted-path form and the prose booking pass with no code (:58-:61).
