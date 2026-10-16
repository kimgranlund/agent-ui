# T-0294 live round 6: report

Round 6 ran the full matrix on 2026-10-16 UTC (11:31 to 13:43) at `a8ce4f55`, sample 1 and default effort. Each of Haiku, Sonnet and Opus 5.5 ran 29 scenarios:
- **Presets:** the 17 round scenarios of the four shipped presets, with round 3's routing oracles.
- **Routing:** the 6 routing pack scenarios.
- **Long flows:** the 6 long flows (blackjack hand, Concierge booking, booking-confirm, spa services, word game give-up, facility hours).

The capped runner finished 87 of 87 for an estimated $36.82, under the $42 cap. 76 runs passed and 11 failed. Trace line numbers below (`:n`) are 1-based lines of `traces/2026-10-16.jsonl` in this folder. The generator is `scripts/e2e-admin/probe/scenarios/round6.ts`.

Sonnet and Opus pass every Concierge and Lexicographer run. Every preset fails on at most two clusters. No model passes the Admiral surrender: all three reveal the fleet on the board, and none ships a ResultCard. The other failures:
- **Croupier:** Haiku and Sonnet each fail 2 runs, on a surface id in the reply and a move never applied. Opus fails 1, on the existing PlayingCard lint.
- **Concierge:** Haiku fails 3 runs, all where the last repair round loses or swaps the surface.

All 171 routing oracles pass, and no detector found lost context.

## Pass rate, preset by model (rounds 3 to 5 for comparison)
Runs that passed over runs, from each round's `ledger.jsonl`. Routing pack runs count under their agent. Rounds 3 to 5 reran only failures and different run sets, so read the rates, not the totals.

| Preset | Haiku r6 | Sonnet r6 | Opus r6 | r5 (H / S / O) | r4 (H / S / O) | r3 (H / S / O) |
|---|---|---|---|---|---|---|
| Croupier | 9 of 11 | 9 of 11 | 10 of 11 | 3/3, -, 1/2 | 3/6, -, 0/2 | 5/11, 6/6, 2/4 |
| Concierge | 8 of 11 | 11 of 11 | 11 of 11 | 3/9, 8/9, 1/1 | 1/9, 1/9, 0/1 | 0/7, 0/7, 0/1 |
| Lexicographer | 4 of 4 | 4 of 4 | 4 of 4 | 1/3, 1/1, - | 0/3, 3/3, - | 0/2, 0/2, - |
| Admiral | 2 of 3 | 2 of 3 | 2 of 3 | 1/1, -, - | 1/2, 2/2, - | 0/2, 0/2, - |
| All | 23 of 29 | 26 of 29 | 27 of 29 | 8/16, 9/10, 2/3 | | |

Per-turn `--expect-turn` passes (round 5 in brackets):

| Preset | Haiku 5.5 | Sonnet 5.5 | Opus 5.5 |
|---|---|---|---|
| Croupier | 32 of 32 (9 of 9) | 34 of 34 | 34 of 34 (6 of 6) |
| Concierge | 31 of 33 (18 of 29) | 34 of 34 (29 of 30) | 34 of 34 (4 of 4) |
| Lexicographer | 19 of 19 (11 of 14) | 19 of 19 (5 of 5) | 19 of 19 |
| Admiral | 15 of 16 (7 of 7) | 15 of 16 | 15 of 16 |

## Cheapest model that passes, per preset
| Preset | Cheapest | Why |
|---|---|---|
| Croupier | Haiku | Haiku and Sonnet both pass 9 of 11. Haiku's two fails are a surface id in prose (cluster B) and one unapplied deal (C). Opus passes 10 of 11 at about 27 times Haiku's cost. |
| Concierge | Sonnet | 11 of 11. Haiku passes 8 of 11: its three fails are the last repair round losing the surface (D). Haiku now confirms every booking (T-0289). |
| Lexicographer | Haiku | 4 of 4 on every model (round 5: Sonnet for a full game). |
| Admiral | none | Every model fails the surrender (A). Haiku passes opening-salvo and row-sweep, so it is the cheapest for play. |

## Round 5 fixes, live
| Ticket | Verdict | Evidence |
|---|---|---|
| T-0289 Haiku confirm from chat | fixed live | Haiku ships a BookingConfirmation alone on 8 of 8 confirm turns (round 5: 0 of 7): :76, :80, :86, :132, :138, :142, :164, :167. Each needed a SURFACE_MISSING round 2, and all 8 were saved. Sonnet and Opus are 8 of 8 each, in one round. |
| T-0290 feed-ask form, FEED_SCOPE against BOOKING_FORM_MISSING, halt leak | partly | The halt the user sees now names codes only: the probe's error line reads "(SURFACE_DROPPED)", while the trace keeps "at ask-1" (:170). FEED_SCOPE fired twice mid-turn and was saved twice (:121, :136). On the last round it still loses the form: :75 ships nothing after FEED_SCOPE then SURFACE_DEGRADED, and :170 halts after BOOKING_FORM_MISSING, PARSE and SURFACE_DROPPED (cluster D). |
| T-0291 word game give-up and replay in prose | fixed live | Haiku give-ups ship ResultCard (:97, :102, :174). "Play again." draws the board (:103 after IDGRAPH, :175 after ACTION_NOT_APPLIED, both saved). Haiku Lexicographer is 4 of 4 (round 5: 1 of 3). Retrieval still returns nothing on all 6 "Play again." lines (:103, :175, :289, :361, :475, :547), so the check, not exposure, carries it. |
| T-0292 services oracle | fixed live | "What services could I add" passes on all three models with a ProductCard grid: Haiku :87 after SURFACE_MISSING, Sonnet :273 after CATALOG, Opus :459 in one round. facilities-then-tour passes on all three. |
| T-0293 dotted-path BookingForm | not exercised | 31 BookingForms shipped this round with no dotted field path, and BOOKING_FIELD_PATH fired 0 times. Only the keyless replay `concierge-haiku-dotted-booking-paths` holds it. |

## Checks: fires, saves, extra cost (round 5 in brackets)
A save is a turn whose final round passed with no `*_UNCORRECTED` or SURFACE_DEGRADED code. Extra cost is the list-price cost of a turn's rounds after the first, split evenly when one turn fires several codes. Round 5 recomputed the same way gives its published 46 fires, 35 saved, $0.56.

| Check | Fired (turns) | Saved | Extra USD | Models | Note |
|---|---|---|---|---|---|
| ACTION_NOT_APPLIED | 30 (9) | 28 (9) | 0.11 | Haiku 30 | unsaved :2 (cluster C) and :27 (a pontoon BANKROLL_MISMATCH turn; the run passes) |
| SURFACE_MISSING | 19 (12) | 18 (9) | 0.07 | Haiku 19 | 8 Haiku confirms (T-0289); unsaved :75 (D) |
| PARSE | 12 (2) | 11 (2) | 0.45 | Haiku 6, Sonnet 6 | unsaved :170 (D) |
| FLOW_END_MISSING | 9 (10) | 9 (6) | 0.67 | Haiku 1, Sonnet 3, Opus 5 | the costliest code: Opus closes 5 flows on round 2 |
| IDGRAPH | 5 (1) | 5 (1) | 0.18 | Haiku 2, Sonnet 3 | 3 of them on "Play again." |
| NARRATED_MECHANICS | 4 (2) | 4 (2) | 0.12 | Haiku 3, Opus 1 | misses a capitalized surface id (B) |
| SURFACE_REQUESTED | 3 (0) | 3 | 0.16 | one per model | routing guidance-conflict, "Show me the dealer's hole card." |
| CARD_DUPLICATE | 2 (0) | 2 | 0.13 | Sonnet 2 | |
| BET_TABLE_MISSING, WORD_MARK_WRONG, GAME_HUD_MISSING, FEED_SCOPE, CATALOG | 2 each | 2 each | 0.11 together | | |
| PRODUCT_CARD_MISSING | 1 | 1 | 0.00 | Haiku 1 | :161 counts as saved but shipped a DescriptionList card (D) |
| BOOKING_CONFIRMATION_MISSING | 1 | 1 | 0.11 | Opus 1 | |
| BANKROLL_MISMATCH, BOOKING_FORM_MISSING, SURFACE_DROPPED | 1 each | 0 | 0.00 | Haiku | :27, :170, :170 |

Repair rounds cost $2.13 of the $36.82. 92 of 99 code fires were saved (round 5: 35 of 46).

## Routing-expect
171 turns carried an oracle, and all 171 passed (round 5: 73 of 73). No oracle missed, so routing blocks no preset. One exposure gap has no oracle. Retrieval returns nothing on every "Play again." line on every model, which the bundle records as 6 excluded retrievals. The ACTION_NOT_APPLIED and IDGRAPH checks rebuild the board anyway.

## Spend (ledger.jsonl, list prices, an overestimate)
| Model | Runs | Passed | USD |
|---|---|---|---|
| Haiku 5.5 | 29 | 23 | 0.85 |
| Sonnet 5.5 | 29 | 26 | 12.49 |
| Opus 5.5 | 29 | 27 | 23.48 |
| Total | 87 | 76 | 36.82 |

By part:
- **Presets:** 51 runs, 42 passed, $24.98.
- **Routing:** 18 runs, 18 passed, $7.02.
- **Long flows:** 18 runs, 16 passed, $4.82.

The phase 1 estimate was $41.26.

## Why it failed and how to fix it
This is a decision analysis with the context-fog-of-war skill, fog report `d242f3e13e7408d0d5327c38`. It holds decisions d1 to d6, guidance edges g1a to g6a and findings f1 to f6, and every citation is an exact excerpt of a trace line event. Each failed run is assigned to every cluster with a failing check in it. 10 runs fail on one cluster only. 1 run, `regress-concierge-spa-booking-haiku-1`, fails on two (C and D): 10 plus 1 makes the 11 failures.

**What the traces rule out:**
- **Lost context:** `retrieved-not-submitted` found no omission in 543 linked pairs, `tool-result-not-propagated` found none in 14 and `truncation` found none in 564 envelopes. No failure is lost context on the way to the model (lesson 6).
- **One model ignoring guidance (except C):** in A all three models get identical framing and fail identically. In B, C and D, a larger model passes on the identical framed ids, so only C, where the guidance was framed, meets lesson 11's bar for class (c).

| Cluster | Runs (any / only) | Class | Evidence | Fix layer | File | Keyless test that proves it | Ticket |
|---|---|---|---|---|---|---|---|
| A. A surrender reveals the fleet on the board and ships no ResultCard | 3 / 3 | (b) ambiguous guidance, with (a) exposure | :112, :298 and :484 all frame `domain-admiral-battleship-board`, `backable-wizard` and `frontier-breadcrumb-trail`, with no mini-skill (`"miniSkills": []`). All three ship BoardGrid and GameHud (g1a, g1b). The only End-state rule says "when a fleet is sunk" (g1c, inferred from source). | A ruling first, then the board-grid End state plus a concession check | `site/pages/agent-admin-libraries.ts` board-grid; `site/pages/agent-admin-presets.ts` admiral; a RESULT_CARD_MISSING check | `replays/admiral-surrender-board-reveal.test.mjs` (pinned: no ResultCard, no code) | proposed, P2 (needs a ruling; a revealed board may be an acceptable end, which would make this (d)) |
| B. A capitalized surface id reaches the chat prose | 2 / 2 | (d) check defect | :11 "Table-3 is dealt." (Haiku, after an ACTION_NOT_APPLIED round); :244 "Table-2 is open.", :246 "Table-3 is open." (Sonnet, no code) (g2a, g2b). Opus on identical framing writes no id (:373, g2c). `narratedMechanics` matches the id case-sensitively. | The NARRATED_MECHANICS id match | `packages/agent-ui/a2ui/src/agent/produce.ts` narratedMechanics | `replays/croupier-haiku-surface-id-in-reply.test.mjs` (pinned red on no-internal-leak, no NARRATED_MECHANICS); a produce test with reply "Table-3 is dealt." | proposed, P2 |
| C. Haiku writes the target meta-line but never calls render_surface, through every repair round | 2 / 1 | (c) model ignored clear guidance | :2: three rounds with no tool call, while Haiku's reasoning says "I realize I need to actually" send the update. The turn ships with SEMANTIC_UNCORRECTED (g3a, g3b). :75 misses rounds 1 and 2 the same way. Opus on identical framing (same 3 exemplars, 3 mini-skills, blackjack full) applies the deal in one round (:366, g3c). 33 failed Haiku rounds this round had a target meta-line and no tool call; the checks saved every turn but these two. | The repair round request: a forced render_surface tool_choice for Haiku with thinking off | `packages/agent-ui/a2ui/src/agent/produce.ts`, `providers/anthropic.ts` toolChoice | a produce test that a no-tool ACTION_NOT_APPLIED round builds a Haiku round 2 request with tool_choice render_surface | proposed, P2 |
| D. The last repair round drops or swaps the surface on Haiku Concierge turns | 3 / 2 | (d) loop defect (lesson 20), with (c) underneath | :75 round 3 builds the form on ask-3, then FEED_SCOPE and SURFACE_DEGRADED ship nothing (g4a). :170 has BOOKING_FORM_MISSING, PARSE, then a SURFACE_DROPPED halt (g4b). :161 has PRODUCT_CARD_MISSING, PARSE, then a DescriptionList card with no code (g4c). Sonnet ships the ProductCard grid on identical framing (:347, g4d). | Final-round handling: re-scope a feed-ask form instead of degrading it; keep an earlier round's missing-composite finding binding | `agent/produce.ts` (FEED_SCOPE on the last round, SURFACE_DEGRADED); `catalog/personas/concierge/checks.ts` | `replays/concierge-haiku-final-round-feed-scope.test.mjs` (pinned: FEED_SCOPE, SURFACE_DEGRADED, ask-3 lost) | proposed, P1; follows T-0290 |
| E. A settled Omaha table frames Deal again alone in a Card | 1 / 1 | (b) guidance gap | :234 leaves `actionsFooter` holding only `dealBtn` (g5a). The T-0172 lone-button rule is stated for a game pick only, and no producer check carries it. Opus on identical framing has no lone frame (:420, g5b). The render-lint result is in `runs/regress-croupier-omaha-sonnet-1/report.json`, outside the bundle. | A LONE_BUTTON_FRAME producer check | `catalog/` semantic checks; `site/pages/agent-admin-presets.ts` croupier | a semantic-check test on the :234 payload | proposed, P3 |
| F. Opus five-card draw PlayingCard type floor | 1 / 1 | (d) existing lint debt (lesson 22) | :426 ships PlayingCard (g6a). Every turn's render-lint is `span[index-rank]` 7.875px and `span[pip]` 8.4px (report.json, outside the bundle). | The playing-card type floor | ui-playing-card | the T-0189 ruling's own test | T-0189 (existing) |

Bounded experiment per cluster (checklist step 9), each to be measured on the same brief:
- **A:** after the ruling, add the concession End state and a RESULT_CARD_MISSING check, then rerun `regress-admiral-concede` on Haiku. Verified when a ResultCard ships, or a code fires on round 1 and round 2 ships one.
- **B:** make the id match case-insensitive. Verified when the replay flips (NARRATED_MECHANICS on turn 8, no-internal-leak green after a repair round in a live rerun).
- **C:** force tool_choice on Haiku repair rounds. Verified when `regress-croupier-blackjack-rounds-haiku` ships the deal on round 2, and the count of Haiku no-tool rounds drops on a rerun of this round's Haiku cells.
- **D:** keep the last-round form. Verified when the replay ships one BookingForm.
- **E:** add the check. Verified when the Sonnet Omaha run passes render-lint.
- **F:** T-0189.

Representative turns, with the exposure chain as recorded on the trace line (observed). Exemplars are `events.framedExemplarIds`, equal to `retrieval.chunkIds` on every assessed line. References not listed are `index-only`.

| Turn | Model | Framed exemplars | Mini-skills | Loaded `full` | Retry codes, rounds | Shipped |
|---|---|---|---|---|---|---|
| :484 surrender | Opus (Haiku :112, Sonnet :298 the same) | admiral-battleship-board, backable-wizard, breadcrumb-trail | none | none | none, 1 | BoardGrid, GameHud |
| :11 third deal | Haiku | card-table-round, round-outcome, agent-roster-drawer | game-hud, table-toolbar-pagination, comparison-table | blackjack | ACTION_NOT_APPLIED, 2 | CardTable; reply "Table-3 is dealt." |
| :373 third deal | Opus | same as :11 | same as :11 | blackjack | none, 1 | CardTable; no id |
| :2 deal | Haiku | same as :11 | same as :11 | blackjack | ACTION_NOT_APPLIED x2, 3 | nothing (SEMANTIC_UNCORRECTED) |
| :366 deal | Opus | same as :11 | same as :11 | blackjack | none, 1 | CardTable |
| :75 spa booking | Haiku | concierge-booking-request, service-gateway, commerce-product-card | none | none | SURFACE_MISSING x2, then FEED_SCOPE, SURFACE_DEGRADED, 3 | nothing |
| :161 spa services | Haiku | concierge-booking-request, service-gateway, backable-wizard | greeting-card, product-presentation | none | PRODUCT_CARD_MISSING, PARSE, 3 | Card with a DescriptionList |
| :347 spa services | Sonnet | same as :161 | same as :161 | none | none, 1 | Grid of ProductCard |
| :234 showdown | Sonnet | card-table-round, booking-reservation, button-icon-actions | game-hud | omaha | none, 1 | Card holding only Deal again |

**Observed against inferred:** the routing, codes, rounds, shipped components, replies and reasoning above are recorded. The rest is inferred, and the fog findings mark it so:
- The board-grid End-state sentence (A) and the case-sensitive regex (B) are read from source at `a8ce4f55`. The trace records section sizes and mini-skill ids, not text.
- That a forced tool_choice would move Haiku (C) is a hypothesis for the experiment, not a measurement.

## Skill improvements, verified
Run on the context-fog-of-war skill as revised on 2026-10-16 (`updates-log/20261016-runtime-harness-learnings`, `20261016-skill-md-restructure`), read fresh from disk.

| # | Change | Verdict | Evidence |
|---|---|---|---|
| 1 | The Autonomous run checklist alone reaches the published report id and the why-and-fix table | partly | Steps 1 to 10 ran in order with no step list from the conductor. The run went ingest, coverage, clusters, exposure chains, hydrate (6 decisions, 16 edges, 6 findings, every excerpt checked), cause classes, `diagnostics.py`, `fog.py validate`, `library.py publish` (id `d242f3e13e7408d0d5327c38`), one experiment per cluster, then this table. The ticket supplied steps at five points: (i) the mapping manifest, reused from `.sdlc/evals/fog/2026-10-15-r5-fixes.json`, since step 1 does not say where a prior mapping is found; (ii) the check verdicts and render-lint used to cluster, which come from `runs/*/report.json` outside the bundle, since step 4 does not say where pass and fail come from when the mapping cannot carry them; (iii) the matrix against earlier rounds and the fix-ticket verdicts; (iv) keyless replays (lesson 24 is in the learnings, not the checklist); (v) proposed tickets and the fog record file. |
| 2 | The routing table picks the right entry for a runtime-harness bundle | held | The row "Runtime-harness bundle (folder of JSON, log or ledger output)" led to `engineer.py ingest FOLDER --out DIR --mapping M`, then `bundles.md` and the learnings, which is what this round folder needed. The CLI-trace and v2 rows did not apply. One gap: the row's visualize cell says "the ingest `session.json`, then `library.py publish`", but the hydrate and validate steps that must come between are only in the checklist. |
| 3 | The Prerequisites block, coverage lines against the traces | held | Every count matches the traces. `retrieved-not-submitted` is 543 pairs: 550 lines, minus the 6 "Play again." lines whose retrieval `success` is false, minus the halted :170 with no `complete`. That makes it `partial` with nextEvidence "Record complete=true only for an exhaustive target request identity list". `tool-result-not-propagated` is 14 pairs, equal to the 14 `toolResults` and 14 submitted ids in the traces. `truncation` covers 564 envelopes. The five CLI detectors are `no-eligible-candidates`, correctly. The blocked prerequisite this run reports is guidance text and load mode: the trace keeps mini-skill ids and reference load modes, but the mapping cannot carry them, and no line records the persona, skill or grammar text it framed (lesson 4). Clusters A and E therefore cite their rules as inferred from source. |
| 4 | Script fixes on a real trace (`diagnostics.py` `lookup_request`, `wrapped.py`) | not exercised | The bundle has 550 model_request, 550 retrieval and 14 tool_result events and 0 tool calls. `failed-discovery` reports "0 matched lookup results", and no shell command reaches `lookup_request` or `wrapped.parse_calls`. A web-chat bundle exercises neither fix; a Claude Code or Codex session trace is needed. |
| 5 | The learnings: each cluster maps to a lesson with a fitting "Applies to" tag | held | A maps to lesson 9 (index-only guidance; here no mini-skill at all) and lesson 13 (one home for the End-state rule), both tagged both. B maps to lesson 17 and lesson 15 (a rule needs a check), runtime harness. C maps to lessons 29 and 11, runtime harness and both. D maps to lesson 20 (judge the final turn as a whole), runtime harness. E maps to lesson 15, runtime harness. F maps to lesson 22, runtime harness. Lesson 6 ruled out lost context first, lesson 8 gave the any and only counts, and lesson 11 set the bar for (c). Every tag fits a runtime harness. B is the first case of a check that exists but is too narrow; no lesson names it. |
| 6 | The round 5 repo fixes live | see above | T-0289 fixed live, T-0290 partly, T-0291 fixed live, T-0292 fixed live, T-0293 not exercised (section "Round 5 fixes, live"). |

### Proposed note for the skill's `updates-log/`
These are proposed, not applied. One new dated entry, front matter per the skill's `AGENTS.md`:

```markdown
---
date: 2026-10-16
slug: round-6-field-test
requested_by: Kim Granlund
harness: Claude Code CLI (sdlc-lite 0.24.0, solo-L2 for agent-ui T-0294)
project: agent-ui (nonoun), live round 6 (87 runs) analyzed with this skill
verification: proposed; not applied
---

# 2026-10-16: field test of the autonomous checklist on a runtime-harness bundle

## Open
- Checklist step 1: say where a reused mapping manifest is found (a prior run record or the project's records), not only "create or reuse".
- Checklist step 4: when the mapping cannot carry pass and fail verdicts (per-run reports outside the vocabulary), say to cluster from those files and cite them as outside the bundle.
- Checklist: add "turn each useful failure into a keyless replay" (learnings lesson 24) before step 10, or say it is the project's step.
- Routing table, runtime-harness bundle, Visualize cell: name hydrate and `fog.py validate` before `library.py publish`.
- Learnings, validation-and-repair: a candidate lesson, "a check that exists can still be too narrow (here a case-sensitive id match); test each check against the live failure that motivated it". Confirm on a second project before adding it.
- The 2026-10-16 script fixes (`lookup_request`, `wrapped.py`) are still unproven on a real trace: web-chat bundles have no tool calls.
```

## Context fog-of-war
- **Record:** ingested with `.sdlc/evals/fog-manifest.json` (mapping hash `8255a4d8d99d`, engineering run `run-1338070f7980c30ca7be8a13`) and hydrated before its first publish. Published as report `d242f3e13e7408d0d5327c38`: 1114 events, 601 sources, 6 decisions, 16 guidance edges, 6 reviewed findings, 0 diagnostic findings. The record is `.sdlc/evals/fog/2026-10-15-r6-matrix.json`.
- **Detectors:** `truncation` (564 envelopes) and `tool-result-not-propagated` (14 pairs) gave no signal. `retrieved-not-submitted` (543 pairs) is partial, since the halted line :170 declares no complete request list. The other five had no eligible trigger in a web-chat bundle.
- **Outside the bundle:** `runs/*/report.json` (probe checks, render-lint) is not mapped. Every check verdict, and clusters E and F's lint, are cited from the round folder, not the fog report.

## Tickets (proposed, for the conductor to file)
- Cluster D: the last repair round drops a feed-ask BookingForm (SURFACE_DEGRADED) or halts, and a last-round payload escapes an earlier missing-composite finding (P1, follows T-0290).
- Cluster B: NARRATED_MECHANICS matches a surface id case-sensitively, so "Table-3 is ..." reaches the chat (P2).
- Cluster C: Haiku repair rounds with no render_surface call; try a forced tool_choice on Haiku repair rounds (P2).
- Cluster A: a surrender ends on a revealed board with no ResultCard. Ruling first: is a concession ONE ResultCard? (P2)
- Cluster E: a lone Deal again button framed in a Card on a settled poker table; a LONE_BUTTON_FRAME producer check (P3).
- Cluster F is T-0189 (existing).

## Replays (`scripts/e2e-admin/probe/replays/`, pinned to today's behavior, `// expectedFail: round 6 cluster X`)
- `admiral-surrender-board-reveal` (A): the surrender ships BoardGrid with no ResultCard and no code (:481-:484, Opus).
- `croupier-haiku-surface-id-in-reply` (B): "Table-3" reaches the prose, pinned red on no-internal-leak, with no NARRATED_MECHANICS (:3-:11, Haiku).
- `concierge-haiku-final-round-feed-scope` (D): FEED_SCOPE then SURFACE_DEGRADED in round 3, and ask-3 is never shipped (:74-:75, Haiku).
