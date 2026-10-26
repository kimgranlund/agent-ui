# T-0458 live round 14: report

Round 14 ran on 2026-10-26 UTC (00:16 to 00:53) at `ba3ab730` (main after T-0448 to T-0457), the round 13 matrix rerun unchanged to measure the round 13 fixes: T-0448 (CHANGE_CLAIMED and the SURFACE_CLAIMED meta target), T-0449 (BOOKING_VALUE_UNBOUND), T-0450 (the exact PARSE hint), T-0451 and T-0457 (StepFlow on a room ask), T-0452 (cart ConfirmReceipt with AmountPicker lines), T-0453 (shopkeeper cold compare) and T-0456 (the replay guards). Trace line numbers (`:n`) are 1-based lines of `traces/2026-10-26.jsonl` in this folder.

**69 of 69 runs, 64 passed and 5 failed, $0.65 in the ledger against the $12 cap, stop done, 0 cap skips.** One turn halted (:82); no trace line is a provider error; no `max_tokens` stop. No judge run and no fog ingest (neither is in the ticket's Done when): the analysis below reads the trace lines, the run reports, a keyless replay and the producer and host source.

## Comparison set
- **Plan:** the same 69 runs as round 13. The generated section is `plan.ts --tag smoke --tag regression --tag long --persona concierge --persona restaurant --persona travel --persona shopkeeper --persona negotiator --persona mentalist --model haiku --samples 3 --cap 12 --round r14-pattern` with no `--affected` filter (with `--affected 2026-10-24-r13-pattern` it keeps only concierge and shopkeeper, "content changed", 27 runs; the others read unchanged). Its 39 commands are round 13's byte for byte except one: T-0453 changed the shopkeeper smoke oracle, whose add turn now expects ConfirmReceipt instead of ProductCard.
- **Hand-written section, 30 runs:** round 13's 10 hand-written probes, 3 samples each, unchanged, appended under a comment in `live-commands.sh`.
- **Against round 13:** all 23 cells are shared, so the churn below is like for like, except `smoke-shopkeeper-browse-and-add-haiku`, whose fail to pass is against the stricter T-0453 oracle.
- **Prompt digests and exemplars:** `signals.md` (Section digests per persona, Exemplar retrieval per persona).

## Churn against round 13 (generated)

From `npm run eval:signals -- --round 2026-10-26-r14-pattern --against 2026-10-24-r13-pattern --min-samples 1`:

| Transition | Count | Cells | Sample 1 |
| --- | --- | --- | --- |
| fail to pass | 8 | `claim-croupier-rename-table-haiku`, `pick-croupier-game-deck-haiku`, `reach-concierge-day-itinerary-haiku`, `reach-concierge-room-stepflow-haiku`, `reach-shopkeeper-compare-haiku`, `regress-concierge-spa-booking-haiku`, `smoke-concierge-booking-haiku`, `smoke-shopkeeper-browse-and-add-haiku` | see `signals.md` |
| pass to fail | 2 | `pick-mentalist-answer-deck-haiku`, `smoke-mentalist-first-answer-haiku` | 3 (adds `long-concierge-spa-services-haiku`) |
| fail to fail | 2 | `long-concierge-spa-services-haiku`, `reach-shopkeeper-cart-amount-haiku` | 0 |
| pass to pass | 11 | stable | 16 |

| Cell | Round 13 | Round 14 |
| --- | --- | --- |
| `claim-croupier-rename-table-haiku` | 2 of 3 | 3 of 3 |
| `long-concierge-spa-services-haiku` | 2 of 3 | 2 of 3 |
| `pick-croupier-game-deck-haiku` | 2 of 3 | 3 of 3 |
| `pick-mentalist-answer-deck-haiku` | 3 of 3 | 2 of 3 |
| `reach-concierge-day-itinerary-haiku` | 2 of 3 | 3 of 3 |
| `reach-concierge-room-stepflow-haiku` | 0 of 3 | 3 of 3 |
| `reach-shopkeeper-cart-amount-haiku` | 0 of 3 | 2 of 3 |
| `reach-shopkeeper-compare-haiku` | 0 of 3 | 3 of 3 |
| `regress-concierge-spa-booking-haiku` | 1 of 3 | 3 of 3 |
| `smoke-concierge-booking-haiku` | 2 of 3 | 3 of 3 |
| `smoke-mentalist-first-answer-haiku` | 3 of 3 | 1 of 3 |
| `smoke-shopkeeper-browse-and-add-haiku` | 2 of 3 | 3 of 3 (stricter oracle) |
| The other 11 cells | 3 of 3 | 3 of 3 |

By preset: concierge 29 of 30 (round 13: 22), croupier 9 of 9 (7), mentalist 3 of 6 (6), negotiator 3 of 3, restaurant 3 of 3, shopkeeper 8 of 9 (2), stylist 3 of 3, travel 6 of 6.

## Pattern wave reach (one mechanism metric each)

| Control | Verdict | Metric (round 14, Haiku) |
|---|---|---|
| OptionDeck | holds; one answer deck goes dead in the host | Croupier "What games can we play?": 3 of 3 ship the deck (:115, :129, :144 after one PARSE round; round 13: 2 of 3), and each pick opens a CardTable (:116 after two HAND_BINDING rounds). Mentalist: 10 of 11 turns carry the answer deck (:82 halts). :117's deck is created before the HUD in the same turn, so the HUD supersedes it and the probe's press on "Yes" sends nothing (cluster X). |
| OptionCompare | holds on travel and now on shopkeeper, every turn after a repair | Travel leg compare 3 of 3 (:4, :41, :78), shopkeeper "Compare your two cheapest lamps." 3 of 3 (:121, :136, :151; round 13: 0 of 3). 0 of 6 ship in round 1: :4, :41, :78 and :121 need a PARSE repair (the unclosed `components` array of cluster S2), :136 a SURFACE_CLAIMED one, and :151 both. |
| ConfirmReceipt | holds on concierge and now on the shopkeeper cart | Concierge confirm turns: 18 of 18 ship one (round 13: 15 of 18), 12 in round 1 and 6 after a SURFACE_MISSING or PARSE repair (:13, :17, :23, :50, :54, :105). Shopkeeper add turns: 5 of 6 (:6, :43, :80, :123, :153; round 13: 0 of 6); :138 claims the add in prose (cluster P3). |
| AmountPicker | holds on negotiator and now on the shopkeeper cart | Negotiator deal sheet 6 of 6 (:9, :10, :46, :47, :83, :84). Shopkeeper cart lines 5 of 6, the same turns as ConfirmReceipt. Also inside the StepFlow on :118. |
| StepFlow | reached | "I'd like to book a room.": 3 of 3 (round 13: 0 of 3); :148 in round 1, :118 and :133 after one BOOKING_VALUE_UNBOUND repair. Each turn routes the `step-flow` mini-skill. |
| Itinerary | holds | Concierge day plan 3 of 3 (:119, :134, :149; round 13: 2 of 3), travel two-day trip 3 of 3 (:120, :135, :150), all in round 1. |

## The round 13 fixes, live

| Fix | Verdict | Evidence |
|---|---|---|
| T-0448 CHANGE_CLAIMED (round 13 P1) | not exercised; the one claim recorded slips the regex | 0 CHANGE_CLAIMED rounds. The three croupier renames (:125, :140, :155) send the CardTable update themselves, so the cell is 3 of 3 without the check firing. :138 "Added two Brass Arc Floor Lamps at $189 each, so your order comes to $378." targets `storefront-1` and ships with no update and no code: `CHANGE_CLAIM_IN_REPLY` (`produce.ts:1261`) has no "added" (cluster P3). |
| T-0448 SURFACE_CLAIMED on a meta target (round 13 P2) | not exercised | No meta-target claim this round. `ask` claims fired 5 rounds on 5 turns, 4 saved (:7, :8, :136, :151); the miss is :82, a last-round claim with no earlier valid round, which halts (cluster W). |
| T-0449 BOOKING_VALUE_UNBOUND (round 13 R) | holds | Fired 3, saved 3, 0 reply-only (:96, :118, :133); `smoke-concierge-booking-haiku` 3 of 3. |
| T-0450 exact PARSE hint (round 13 S) | no measurable movement | PARSE fired 15 rounds on 13 turns, 11 saved (round 13: 16 on 13, 10 saved); string `messages` rounds 10 (11). :33 resends the same broken string byte for byte on all three rounds and degrades (cluster S2). |
| T-0451 and T-0457 StepFlow (round 13 T) | holds | 3 of 3, above. |
| T-0452 cart ConfirmReceipt (round 13 U) | holds, one prose claim | 5 of 6 add turns, above. |
| T-0453 cold compare (round 13 V) | holds, after repairs | 3 of 3, 0 in round 1, above. |
| Stylist nested card (round 12 L) | holds | 3 of 3; CONTRAST_PAIR_WRAPPED still fires on every palette turn (:114, :128, :143), each saved, now 0 reply-only (round 13: 2 of 3). |

## Why it failed and how to fix it

**What the traces rule out:** each failing turn's `routing` block records its prompt sections and mini-skills. The mentalist "Yes." turns route no mini-skill in round 13 either (its :8, :45, :82), so the mentalist pass to fail is not a routing change; `--affected` also reads the mentalist content unchanged.

| Cluster | Runs | Class | Evidence | Fix layer | File | Keyless test that proves it | Proposed ticket |
|---|---|---|---|---|---|---|---|
| W. A Twenty Questions turn answered as a meta line with no tool call ships only the claimed ask deck, or halts | 2 failed runs: `smoke-mentalist-first-answer-haiku-1` (:7, :8), `smoke-mentalist-first-answer-haiku-3` (:82) | (c) model, with a (d) repair-path gap | :7 round 1 writes `{"a2uiMeta":{"note":"...Question 1 of 20: Is it a living thing?","ask":{"surfaceId":"ask-1"}}}` and prose, no tool; the SURFACE_CLAIMED repair builds `ask-1` alone (one OptionDeck), so the game never gets a GameHud and the smoke fails `expect-component`. :8 repeats it for `ask-2`. :82 round 1 is note-only with target `hud-1` (ACTION_NOT_APPLIED), round 2 is 830 output tokens with empty text and no tool call (coded PARSE), round 3 is note-only again and its SURFACE_CLAIMED on the last round halts. | producer repair wording, or a games check | `packages/agent-ui/a2ui/src/agent/produce.ts` (the SURFACE_CLAIMED repair), the games domain checks | replays of :7 and :82 (`--from-trace`) end with a GameHud on the surface, or a finding that names the missing HUD | "A game turn repaired after SURFACE_CLAIMED keeps its GameHud: the repair asks for the HUD with the ask deck" (L2) |
| X. An ask deck created before another surface in the same turn is superseded and its press sends nothing | 1 failed run: `pick-mentalist-answer-deck-haiku-1` (:117) | (d) host lifecycle | :117 creates `ask-1` (the OptionDeck) first and `hud-1` second in one `messages` array; the passing :131 and :146 create `hud-1` first. The probe presses "Yes" in `ask-1`, no produce request follows (`click-target` fail); the turn-2 screenshot shows the deck dimmed. A keyless replay of the run's `fixture.json` fails the same way. Source: `conversation.ts:1080-1088` (GH #1164) supersedes every other open surface when a new one mounts, including one created earlier in the same turn. | host, or producer | `packages/agent-ui/app/src/controls/conversation/conversation.ts` (the superseded sweep), or a producer check that the turn's `ask` surface is created last | the :117 replay (`npm run chat:probe -- --replay .sdlc/evals/rounds/2026-10-26-r14-pattern/runs/pick-mentalist-answer-deck-haiku-1/fixture.json`) passes `click-target` | "A surface created earlier in the same turn is not superseded, so an ask deck sent before its HUD stays answerable" (L2) |
| P3. A say reply that claims an add ("Added ...", "comes to") ships with no update | 1 failed run: `reach-shopkeeper-cart-amount-haiku-2` (:138) | (d) check gap | :138 meta `{"note":"Added two Brass Arc Floor Lamps at $189 each, so your order comes to $378. Adjust the quantity below any time.","target":{"surfaceId":"storefront-1"}}`, no tool call, rounds 1, codes none. The T-0448 regex matches "is now" and "updated", not "added"; round 13's P1 row named "Added" as a miss. T-0456's `shopkeeper-haiku-add-claim-no-id` replay guards the "is now" wording only. | producer | `packages/agent-ui/a2ui/src/agent/produce.ts` (`CHANGE_CLAIM_IN_REPLY`) | a replay of :138 gets a CHANGE_CLAIMED round with render_surface offered | "CHANGE_CLAIM_IN_REPLY covers an add claim (added, comes to)" (L1) |
| S2. Haiku resends a byte-identical broken `messages` string after the exact PARSE hint | 1 failed run: `long-concierge-spa-services-haiku-1` (:33); the same unclosed `components` array opens :4, :41, :78, :121 and :144, all saved | (c) model, with a (d) repair-path question | :33 sends a 1,774 character string whose `components` array is still open at character 1756 on all three rounds, identical bytes, and ships SURFACE_DEGRADED with no surface. `messagesParseNote` on that string returns the exact T-0450 sentence ("a closing ] is missing in message 3 (its updateComponents): its `components` array is still open at character 1756"); the trace records only a `userDigest`, so that the sentence reached round 2's prompt is inferred, not observed. | producer | `packages/agent-ui/a2ui/src/agent/produce.ts`, `packages/agent-ui/a2ui/src/agent/response-type.ts` (`messagesParseNote`) | the :33 replay ships the spa menu; a unit test heals a string whose only defect is one named unclosed array | "A messages string whose only defect is one unclosed array is closed in place, and an identical resend is never sent back unchanged" (L2) |

**Single-run errors, no cluster:** :117 also binds two GameHud `stats` item values as `{"path": ...}` objects; the catalog types an item `value` as string or number, no SCHEMA or CATALOG code fires, and the stats render blank in the screenshot. A deterministic validator gap on one turn: "A bound value inside a GameHud or ResultCard stats item is a schema finding" (L1). :98 recovers from CATALOG and SURFACE_NOT_CREATED in its third round and passes. Watch both next round.

**Observed against inferred:** codes, rounds, tool inputs, meta lines, mini-skills and replies are recorded on the trace lines; the :117 dead press is reproduced keylessly. Inferred from source: the superseded sweep behind X, and that the T-0450 sentence reached :33's repair rounds (S2).

Bounded experiment per proposed ticket, measured on the same runs:
- **W:** the :7 and :82 replays, then `smoke-mentalist-first-answer-haiku`, 3 samples.
- **X:** the :117 replay, then `pick-mentalist-answer-deck-haiku`, 3 samples.
- **P3:** the :138 replay, then `reach-shopkeeper-cart-amount-haiku`, 3 samples.
- **S2:** the :33 replay and the unit test, then the PARSE-saved rate on this round's 13 PARSE turns' cells.

## Tickets
None filed by this round (the solo seat files none). Proposed, one per cluster: W, X, P3 and S2, as in the table above, plus the single-run stats binding gap.

## Process notes
- **Batches:** a probe took 13 s to about 1 min; `--max 8` to `--max 12` batches fit the 10 minute foreground limit, and a restart skipped every run that already had a report.
- **live-commands.sh:** the runner did not copy the commands file in, because its source sat in the session scratchpad outside the repo root (`run-capped.ts` joins the root and the given path). It was copied in after the round with each `--out` retargeted to this folder, as the runner does, and `README.md` regenerated with `run-capped.ts --describe`.
- **Worktree key:** the lane worktree has no repo-root `.env`; it was linked to the main checkout's git-ignored file, and one plumbing probe written outside the round (the task's runtime folder, its spend outside this ledger) proved the link first. The :117 replay sits there too.
