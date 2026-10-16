# T-0303 live round 7: report

Round 7 ran on 2026-10-16 UTC (15:39 to 16:16) at `4ecdef58`, sample 1 and default effort. It reran round 6's 11 failed runs (same scenario, model and run name) and every Haiku long flow, one run each, cheapest first. The generator is `scripts/e2e-admin/probe/scenarios/round7.ts`. Trace line numbers below (`:n`) are 1-based lines of `traces/2026-10-16.jsonl` in this folder.

The capped runner finished 15 of 15 for an estimated $4.03, under the $6 cap. 12 runs passed and 3 failed:
- **Reruns:** 9 of round 6's 11 failures now pass. The 2 that still fail (`regress-croupier-blackjack-rounds-haiku-1`, `regress-croupier-five-card-draw-sonnet-1`) fail on a cause round 6 did not have (cluster A).
- **Haiku long flows:** 3 of the 4 that passed in round 6 pass again. `long-concierge-booking-confirm-haiku-1` now fails (cluster B), a regression on a run that was green.

**Excluded turns:** at run 13 the first workspace hit its API usage limit. Lines :62 to :70 are 9 upstream 400 "usage limits" error turns (15:54:12 to 15:57:10 UTC) with no usage. The conductor moved the two runs they belonged to (`regress-croupier-omaha-sonnet-1`, `regress-croupier-five-card-draw-sonnet-1`) out of the round and removed their ledger lines. Both were rerun clean on a new key (:71 to :80 and :91 to :96). The committed trace keeps lines :62 to :70, so the ledger's line ranges stay valid. They were blanked only in the copy the fog analysis ingested, and every count below excludes them.

## Round 6 fixes, live
| Ticket | Verdict | Evidence |
|---|---|---|
| T-0296 surrender ResultCard | fixed live | All three models ship a ResultCard on "I surrender. Reveal your fleet.": Sonnet :57 and Opus :61 in one round, Haiku :20 on round 3 after PARSE and ACTION_NOT_APPLIED. The three concede runs pass (round 6: 0 of 3). RESULT_CARD_MISSING fired 0 times, so the new concession check itself was not exercised live. |
| T-0297 case-insensitive surface id | not exercised | No capitalized surface id reached any reply this round ("Table-1" and "Table-3" appear only in reasoning, :15, :42, :52). NARRATED_MECHANICS fired once, on a lowercase id (:50, "The table-2 round ended", saved on round 2). Both round 6 cluster B runs have no surface id in prose: `regress-croupier-blackjack-moves-haiku-1` passes, and the Sonnet five-card draw fails on cluster A. The replay `croupier-haiku-surface-id-in-reply` holds the capitalized case. |
| T-0298 plus T-0301 forced render_surface, thinking off, on Haiku repair rounds | fixed live, with a caveat | Every Haiku repair round after a no-payload semantic finding ran with no thinking block and called render_surface: 16 of 16 (for example :8, :18, :20 round 3, :38). Round 6 left 2 turns where Haiku never called the tool, and this round 0. 12 Haiku first rounds still answer with a target meta-line and no tool call, and each was saved. The caveat is the cluster C run: `regress-croupier-blackjack-rounds-haiku-1` still fails, because the forced round at :16 called render_surface with `messages` as a string (cluster A, a different defect). |
| T-0299 last-round FEED_SCOPE, binding composite findings | not exercised | FEED_SCOPE fired twice, both mid-turn and saved on the next round (:22, :24). No FEED_SCOPE reached a last round, and FEED_SCOPE_RESCOPED fired 0 times. Binding: at :23 PRODUCT_CARD_MISSING is followed by a round 2 that ships the ProductCard grid. In round 6 (:161) the same turn shipped a DescriptionList card. No later round escaped a finding, so the binding path did not decide any turn. |
| T-0300 LONE_BUTTON_FRAME | not exercised | `regress-croupier-omaha-sonnet-1` passes every check, render-lint included (:71 to :80). LONE_BUTTON_FRAME fired 0 times: Sonnet did not frame a lone Deal again this time. |
| T-0302 earlier-round fallback | not exercised | EARLIER_ROUND_SHIPPED fired 0 times, and no turn halted (every outcome is ok). The one SURFACE_DROPPED (:24) was repaired on round 3. The three SURFACE_DEGRADED turns (:16, :95, :96) had no valid earlier round, since every round was PARSE, so the fallback had nothing to ship. |

Round 6 cluster F (Opus five-card draw PlayingCard type floor) did not recur. `regress-croupier-five-card-draw-opus-1` passes, and render-lint ran clean on every turn (:81 to :90). Nothing changed in the control since round 6, so the cause is not determined. T-0189 stays open.

## Tallies asked for
| Code | Fired | Note |
|---|---|---|
| FEED_SCOPE_RESCOPED | 0 | no FEED_SCOPE on a last round |
| EARLIER_ROUND_SHIPPED | 0 | no last round that would halt |
| LONE_BUTTON_FRAME | 0 | no lone framed button |
| RESULT_CARD_MISSING | 0 | every surrender shipped a ResultCard |

## Checks: fires and saves
A save is a turn whose final round passed with no `*_UNCORRECTED` or SURFACE_DEGRADED code. Fires are failed rounds.

| Check | Fired (turns) | Saved | Models | Note |
|---|---|---|---|---|
| ACTION_NOT_APPLIED | 11 (11) | 10 | Haiku 11 | unsaved :16 (cluster A) |
| PARSE | 6 (4) | 1 | Haiku 2, Sonnet 4 | unsaved :16, :95, :96 (cluster A); saved :20 |
| SURFACE_MISSING | 5 (5) | 5 | Haiku 5 | the confirm turns, as in round 6 |
| BET_TABLE_MISSING, FEED_SCOPE | 2 each | 2 each | Haiku | |
| IDGRAPH | 2 (2) | 2 | Sonnet 2 | |
| FLOW_END_MISSING, GAME_HUD_MISSING, SHOT_RESULT_WRONG, PRODUCT_CARD_MISSING, SURFACE_DROPPED, NARRATED_MECHANICS | 1 each | 1 each | Haiku | |
| BOOKING_FORM_MISSING | 1 | 1 | Haiku | :4 counts as saved, but the form was lost (cluster B) |
| CARD_DUPLICATE | 1 | 1 | Sonnet | |

Repair rounds cost $0.58 of the $4.03.

## Haiku output truncation
Yes, it recurs. Haiku round 1 stops at exactly 4096 output tokens twice, on two consecutive Admiral shots at medium effort with thinking on (:18 and :19). Neither made a tool call. Both turns are saved by the forced round 2. Round 6 had 5 such rounds (:34, :44, :120, and two at :170). Now that the forced round absorbs the stop, no truncation went unsaved this round. The fog `truncation` detector reports no signal on 87 envelopes, because the trace records output tokens per round but no stop reason, and the mapping carries neither.

## Spend (ledger.jsonl, list prices, an overestimate)
| Model | Runs | Passed | USD |
|---|---|---|---|
| Haiku 5.5 | 10 | 8 | 0.26 |
| Sonnet 5.5 | 3 | 2 | 1.87 |
| Opus 5.5 | 2 | 2 | 1.91 |
| Total | 15 | 12 | 4.03 |

The phase 1 estimate was $4.08. The 9 usage-limit error turns carry no usage, so they add nothing.

## Why it failed and how to fix it
This is a decision analysis with the context-fog-of-war skill, fog report `1e10193208c4414271381d65`. It holds decisions d1 to d4, guidance edges g1a to g4a and findings f1, f2 and f4. Every citation is an exact excerpt of a trace line event. Each of the 3 failed runs falls in exactly one cluster: A holds 2 runs, B holds 1.

**What the traces rule out:**
- **Lost context:** `retrieved-not-submitted` found no omission in 86 linked pairs. One pair was excluded: :32 "Play again.", whose retrieval returned nothing, as on every "Play again." line in round 6. `truncation` found no signal in 87 envelopes. No failure is lost context on the way to the model (lesson 6).
- **A framing gap in A:** the rule against a string payload is in the tool description and grammar.md, which every capture turn frames, and in the PARSE repair hint, which every repair round after a PARSE carries.

| Cluster | Runs (any / only) | Class | Evidence | Fix layer | File (`audit.py link`) | Keyless test that proves it | Ticket |
|---|---|---|---|---|---|---|---|
| A. render_surface `messages` arrives as one JSON string on every round of a turn, so each round is PARSE and the turn degrades to text | 2 / 2 | (c) model ignored clear guidance | :16 (Haiku stand click): round 1 answers in prose (ACTION_NOT_APPLIED), then the forced round 2 and round 3 both call render_surface with `"messages": "[{\"version\"...` as a string. Both rounds are PARSE, and the turn ships SURFACE_DEGRADED (g1a). :95 and :96 (Sonnet deal-again click and "Fold."): three string calls each, PARSE, SURFACE_DEGRADED (g1b, g1d). Opus answers the same scenario's deal_again click (:85) in one round with an array, on near-identical framing (g1c). Haiku sent 3 string calls this round and Sonnet 6; round 6 had 9. Haiku also sent `target` as a JSON string 6 times. | The tool input reader: decode a string `messages` that parses as a JSON array of objects, tallied (for example MESSAGES_STRING_DECODED); anything else stays PARSE | `packages/agent-ui/a2ui/src/agent/response-type.ts` `renderSurfaceJsonl`. `link --finding f1` lists the three places the rule is already framed: `response-type.ts:29` (tool description), `prompts/grammar.md:194`, `produce.ts:648` (TOOL_PARSE_HINT) | `replays/croupier-sonnet-messages-string.test.mjs` (pinned: action-updates-surface:4, turns 4 and 5 PARSE plus SURFACE_DEGRADED with no surface line); a response-type test that a stringified array yields the same JSONL as the array | proposed, P1 (it blocks a click on Haiku and Sonnet) |
| B. A repair round sends the form as updates to a failure-named new surface without creating it, and the round passes | 1 / 1 | (d) check defect in the repair loop | :4 round 1 creates ask-1 with a DescriptionList and gets BOOKING_FORM_MISSING at `ask-1:summary`. Round 2 sends the BookingForm as updateDataModel and updateComponents on ask-1 with no createSurface, and its `target` is a JSON string. That round passes. The trace shows only BOOKING_FORM_MISSING, and the probe reports ask-1 "created in a round but never shipped". The next turn confirms a booking whose form the guest never saw (g2a). Read from source: `surfacesToKeep` skips a surface a failure names, and the validator opens an epoch for an update to a surface that was never created. This shape slips past the T-0281, T-0290 and T-0302 surface-drop fixes because the drop is hidden by updates to the same id. In contrast, at :24, on identical framing, a round that dropped ask-1 in prose gets SURFACE_DROPPED, and round 3 ships the form (g2b). | The drop check: keep every surface an earlier round of the turn created, failure-named or not, or fail an update to a surface that neither the session nor this output creates | `packages/agent-ui/a2ui/src/agent/produce.ts` `surfacesToKeep` and the SURFACE_DROPPED check (`link --finding f2`: `produce.ts:1120`, `:1369`, `:1779`); `packages/agent-ui/a2ui/src/renderer/validate.ts` `openEpoch` | `replays/concierge-haiku-orphan-update.test.mjs` (pinned: no-surface-loss:0, no createSurface on turn 0, updates to ask-1); a produce test on the :4 rounds that round 2 gets SURFACE_DROPPED | proposed, P1 (the guest loses the booking form) |

Bounded experiment per cluster (checklist step 9), each measured on the same brief:
- **A:** decode a stringified `messages` array. Verified when the replay flips (turns 4 and 5 ship the redealt table with the tally) and a live rerun of `regress-croupier-blackjack-rounds-haiku` and `regress-croupier-five-card-draw-sonnet` passes.
- **B:** keep failure-named created surfaces in the drop check, or fail orphan updates. Verified when the replay flips (round 2 gets SURFACE_DROPPED, round 3 resends createSurface) and `long-concierge-booking-confirm-haiku` passes live.

Representative turns, with the exposure chain as recorded on the trace line (observed). Exemplars are `events.framedExemplarIds`, equal to `retrieval.chunkIds` on every assessed line.

| Turn | Model | Framed exemplars | Mini-skills | Loaded `full` | Retry codes, rounds | Shipped |
|---|---|---|---|---|---|---|
| :16 stand click | Haiku | card-table-round, result-card-win, trip-summary | card-layout, game-hud, table-toolbar-pagination | blackjack | ACTION_NOT_APPLIED, PARSE, 3 | nothing (SURFACE_DEGRADED) |
| :95 deal-again click | Sonnet | card-table-round, round-outcome, agent-roster-drawer | card-layout, dashboard-kpi-grid, table-toolbar-pagination | five-card-draw | PARSE x2, 3 | nothing (SURFACE_DEGRADED) |
| :85 deal-again click | Opus | card-table-round, round-outcome, greet-card | card-layout, game-hud, greeting-card | five-card-draw | none, 1 | Card with PlayingCard |
| :4 spa booking | Haiku | concierge-booking-request, service-gateway, commerce-product-card | none | none | BOOKING_FORM_MISSING, 2 | updates to ask-1, never created |
| :24 spa booking | Haiku | same as :4 | none | none | FEED_SCOPE, SURFACE_DROPPED, 3 | BookingForm |

**Observed against inferred:** the codes, rounds, tool inputs, shipped components and replies above are recorded. Two things are read from source at `4ecdef58` and marked inferred in the fog findings: the producer and validator paths in B, and the guidance wording in A.

## Context fog-of-war
- **Record:** ingested with `.sdlc/evals/fog-manifest.json` (mapping hash `8255a4d8d99d`, engineering run `run-925852ff3dce18af004a8831`) from a copy of this folder with lines :62 to :70 blanked. It was hydrated before its first publish and published as report `1e10193208c4414271381d65`: 174 events, 104 sources, 4 decisions, 8 guidance edges, 3 reviewed findings, 0 diagnostic findings. The record is `.sdlc/evals/fog/2026-10-16-r7-fails.json`.
- **Detectors:** `truncation` (87 envelopes) and `retrieved-not-submitted` (86 pairs) gave no signal. The other six had no eligible trigger in a web-chat bundle.
- **Contract audit:** `audit.py scan` on HEAD with the contract-audit field run's topics mapping, plus two surfaces this run added: producer repair text (`produce.ts` string literals) and the render_surface tool definition (`response-type.ts`). It found 79 surfaces and 11 candidates, the same 11 as the field run. `audit.py link --finding` gave each cluster its contract surfaces, cited in the table. `link --finding f4` (truncation) matched no contract surface, which is right: max_tokens is a request setting, not guidance.
- **Outside the bundle:** `runs/*/report.json` (probe checks, render-lint) is not mapped. Every check verdict is cited from the round folder, not from the fog report.

## Tickets (proposed, for the conductor to file)
- Cluster A: decode a render_surface `messages` string that parses as a JSON array, tallied. Haiku and Sonnet send the array as a string on every round of a turn, and the turn degrades (P1).
- Cluster B: a repair round that updates a failure-named new surface without creating it passes, and the guest never sees the form (P1). It follows the T-0281, T-0290 and T-0302 line.
- Haiku round 1 at max_tokens 4096 (f4): measure only. Raise the Haiku medium tier only when a 4096 stop goes unsaved (P3, or a note).

## Replays (`scripts/e2e-admin/probe/replays/`, pinned to today's behavior, `// expectedFail: round 7 cluster X`)
- `croupier-sonnet-messages-string` (A): from `.agent-traces` lines 1031 to 1036 (this folder's :91 to :96, Sonnet).
- `concierge-haiku-orphan-update` (B): from `.agent-traces` lines 944 to 946 (this folder's :4 to :6, Haiku).

## Skill notes
Steps the ticket, not the skill, had to supply, run on the skill as read from disk on 2026-10-16 (including `updates-log/20261016-contract-audit`, verified):
- **Provider-error turns:** the checklist has no step for excluding them from a bundle. The ticket said to drop the usage-limit lines. Blanking them in an ingested copy kept the line numbers, and the ingest skipped the blank lines (87 envelopes from 96 lines).
- **Audit mapping coverage:** the reused contract-audit mapping did not list the producer's repair text or the tool definition. `link --finding f1` matched only CardTable entity hits until those two surfaces were added. Contract-audit step 4 names repair messages as surfaces, but the reused mapping predates that.
- **`include` type:** `audit.py` crashed with `TypeError: unhashable type: 'list'` when a surface's `include` was a list. `contract-audit.md` says "`include` and `exclude` regexes", which reads as a list. A single regex string works.
- **`link` phrase match:** the five-word phrase match runs over the whole file, not the mapped statements. A finding whose `target` names a path under `packages/agent-ui/a2ui/src/agent/` matches the `import.meta.glob` lines `site/pages/agent-admin-libraries.ts:28` and `:70` on every query, f4 included.
- **`link` input:** `link --finding` ranks by the finding's own words. It reached the three guidance homes in A only once f1's hypothesis quoted them, so a finding should quote the guidance it suspects.
- **Truncation:** the max_tokens question came from the ticket. The `truncation` detector cannot see a stop at the token cap when the trace records no stop reason. The skill could name `outputTokens` equal to the request's `max_tokens` as the evidence to map.
