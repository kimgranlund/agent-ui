# T-0445 live round 13: report

Round 13 ran on 2026-10-24 UTC (15:52 to 16:29) at `8c724c43` (main after T-0442), a targeted cycle measuring whether each persona reaches the 2026-10 pattern wave controls (OptionDeck, OptionCompare, ConfirmReceipt, AmountPicker, StepFlow, Itinerary) and probing the three known gaps the ticket names: the `CHANGE_CLAIM_IN_REPLY` regex (T-0428), Stylist's nested card on Haiku (round 12 cluster L) and SURFACE_CLAIMED (T-0442). Trace line numbers (`:n`) are 1-based lines of `traces/2026-10-24.jsonl` in this folder.

**69 of 69 runs, 52 passed and 17 failed, $0.67 in the ledger against the $12 cap, stop done, 0 cap skips.** One turn halted (:107); no trace line is a provider error; no `max_tokens` stop. No judge run and no fog ingest this round (neither is in the ticket's Done when): the decision analysis below reads the trace lines and the producer source directly.

## Comparison set
- **Plan:** `plan.ts --tag smoke --tag regression --tag long --persona concierge --persona restaurant --persona travel --persona shopkeeper --persona negotiator --persona mentalist --model haiku --samples 3 --cap 12 --round r13-pattern --affected 2026-10-19-r12-targeted`: 39 generated runs. The `--affected` header reads croupier, mentalist and negotiator "content changed", stylist "unchanged", and concierge, restaurant, travel and shopkeeper "no recorded resolution" (round 12 never ran them).
- **Hand-written section, 30 runs (10 probes, 3 samples each),** appended under a comment in `live-commands.sh` as T-0440 did: the croupier smoke cell (shared with round 12; the generated croupier set would have rerun 24 poker, long and routing runs that reach no wave control), the Stylist palette smoke (the `--affected` filter dropped it as unchanged, but the ticket names its gap), the two T-0440 OptionDeck picks (croupier game deck, mentalist answer deck), reach probes for StepFlow (concierge room booking), Itinerary (concierge day plan, travel two-day trip), OptionCompare and the cart ConfirmReceipt with AmountPicker lines (shopkeeper), and a croupier change claim (the T-0428 intent, "Rename the table to Kim's table and show my chips as euros.").
- **Against round 12:** 4 Haiku cells are shared (croupier, mentalist, negotiator and stylist smoke). Not rerun: round 12's 9 croupier regression and long cells and its 2 routing cells (no wave control in them). 19 cells are new. A targeted cycle: no claim below says a fix holds outside these runs.
- **Prompt digests and exemplars:** `signals.md` (Section digests per persona, Exemplar retrieval per persona).

## Churn against round 12 (generated)

From `npm run eval:signals -- --round 2026-10-24-r13-pattern --against 2026-10-19-r12-targeted --min-samples 1` (the two "only in" rows list their cells in that output; they are summarized here):

| Transition | Count | Cells | Sample 1 | Cells (sample 1) |
| --- | --- | --- | --- | --- |
| fail to pass | 1 | `smoke-stylist-palette-haiku` | 1 | `smoke-stylist-palette-haiku` |
| pass to fail | 0 |  | 0 |  |
| fail to fail | 0 |  | 0 |  |
| pass to pass | 3 | stable | 3 | stable |
| only in this round | 19 | the concierge, restaurant, travel and shopkeeper cells and the hand-written probes | | |
| only in 2026-10-19-r12-targeted | 11 | the croupier regression and long cells, `routing-domain-switch-haiku`, `routing-guidance-conflict-haiku` | | |

| Cell | 2026-10-19-r12-targeted | This round |
| --- | --- | --- |
| `smoke-croupier-blackjack-deal-haiku` | 3 of 3 | 3 of 3 |
| `smoke-mentalist-first-answer-haiku` | 3 of 3 | 3 of 3 |
| `smoke-negotiator-first-offer-haiku` | 3 of 3 | 3 of 3 |
| `smoke-stylist-palette-haiku` | 0 of 3 | 3 of 3 |

By preset: concierge 22 of 30, croupier 7 of 9, mentalist 6 of 6, negotiator 3 of 3, restaurant 3 of 3, shopkeeper 2 of 9, stylist 3 of 3, travel 6 of 6.

## Pattern wave reach (one mechanism metric each)

| Control | Verdict | Metric (round 13, Haiku) |
|---|---|---|
| OptionDeck | holds, one degraded turn | Croupier "What games can we play?": 2 of 3 ship the deck (:115 after two PARSE rounds, :130 in round 1); :145 sends `messages` as an invalid JSON string on all three rounds and ships no surface (cluster S). Mentalist: 11 of 12 turns carry the answer deck; :45 asks question 2 in prose with no deck and passes. |
| OptionCompare | holds on travel, not reached on shopkeeper | Travel leg compare 3 of 3 (:4, :41, :78). Shopkeeper "Compare your two cheapest lamps.": 0 of 3, a prose refusal with no surface (cluster V). |
| ConfirmReceipt | holds on concierge, with a repair round on half the confirm turns; not reached on the shopkeeper cart | Concierge confirm turns: 15 of 18 ship a ConfirmReceipt, 6 in round 1 and 9 after a SURFACE_MISSING or PARSE repair; 3 miss (:13, :50, :76; clusters R and S). Shopkeeper: 0 of 6 add-to-cart turns build one (cluster U). Restaurant: not reached (its smoke stops at the BookingForm, 3 of 3). |
| AmountPicker | holds on negotiator, not reached on shopkeeper | Negotiator deal sheet: 6 of 6 turns (:9, :10, :46, :47, :83, :84). Shopkeeper cart quantity: 0 of 3 (cluster U). |
| StepFlow | not reached | "I'd like to book a room.": 0 of 3; each opens one BookingForm of empty fields instead (:119, :134, :148; cluster T). |
| Itinerary | holds, one prose miss | Concierge day plan 2 of 3 (:120, :135; :149 is cluster P2), travel two-day trip 3 of 3 (:121, :136, and :150 after one SCHEMA and IDGRAPH repair). |

## Known gaps, live

| Gap | Verdict | Evidence |
|---|---|---|
| Stylist nested card (round 12 cluster L) | fixed live, at one repair round per turn | 3 of 3 pass (round 12 0 of 3). CONTRAST_PAIR_WRAPPED fires on every palette turn (:114, :129, :144) and each repair saves it, 2 of 3 as a reply-only round. |
| SURFACE_CLAIMED (T-0442) | holds | Fired on 3 rounds, 3 saved, 0 reply-only; e.g. :118, the mentalist answer click, ships `ask-2` after the repair. It reads the meta-line `ask` only: :149 claims a never-created `target` and ships prose (cluster P2). |
| `CHANGE_CLAIM_IN_REPLY` (T-0428) | not reached, a wider gap than the regex wording | 0 NARRATED_MECHANICS rounds in the round. :155 replies "Done, the table is now Kim's table" (the regex matches "Done," and "is now") with target `table-1` and no update: rounds 1, no code, and the run fails `action-updates-surface`. The regex test sits inside the `narratedMechanics` branch (`produce.ts:1987-1999`), so a claim that names no surface id never reaches it (cluster P1). |

## Why it failed and how to fix it

**What the traces rule out:** each failing turn's `routing` block records its prompt sections and reference loads. The gaps below are a reference left `index-only` (recorded) or a check that never ran (no code on the line), not a truncated or dropped prompt.

| Cluster | Runs | Class | Evidence | Fix layer | File | Keyless test that proves it | Proposed ticket |
|---|---|---|---|---|---|---|---|
| P1. A targeted say reply that claims a change ships with no update when it names no surface id | 2 failed runs: `claim-croupier-rename-table-haiku-3` (:155), `smoke-shopkeeper-browse-and-add-haiku-2` (:43) | (d) check gap | :155 meta `{"note":"Done, the table is now Kim's table...","target":{"surfaceId":"table-1"}}`, no tool call, rounds 1, codes none. :43 "Added the Brass Arc Floor Lamp ($189) to your order. Your total is now $189." with target `storefront-lamps` and no surface line. The T-0428 test runs only when `narratedMechanics` flags the note; "Added" and "is booked" also miss the regex. | producer | `packages/agent-ui/a2ui/src/agent/produce.ts` (note-only branch, `CHANGE_CLAIM_IN_REPLY`) | a keyless replay of :155 (`--from-trace`) gets the full repair round with render_surface offered | "A targeted say reply that claims a change gets the full repair even when it names no surface id" (L2) |
| P2. A note-only reply whose meta `target` names a surface never created ships as prose | 1: `reach-concierge-day-itinerary-haiku-3` (:149) | (d) check gap | After a `weather` call the model ends the turn with `{"a2uiMeta":{"note":"Here is your Saturday, 21 November 2026, in order.","target":{"surfaceId":"trip-saturday"}}}`; `trip-saturday` never exists, rounds 1, codes none. SURFACE_CLAIMED (T-0442) reads `ask`, not `target`. | producer | `packages/agent-ui/a2ui/src/agent/produce.ts` (the SURFACE_CLAIMED clause) | a replay of :149 fires SURFACE_CLAIMED and repairs | "SURFACE_CLAIMED also covers a meta target the session never created" (L1) |
| R. A BookingForm bound to a path the data model never writes renders blank and holds a confirm open | 1: `smoke-concierge-booking-haiku-3` (:75, :76) | (d) check gap | :75 writes `updateDataModel` value `{treatment, date, time, name}` at the root while the BookingForm binds `value: {"path":"/booking"}`, so every field renders empty; on :76 "Your Swedish massage is booked" ships note-only with `flowEnd`, no ConfirmReceipt and no code. Inferred from source: `confirmHeldOpen` (T-0278) reads the blank required fields and suppresses SURFACE_MISSING, and BOOKING_FIELD_PATH (T-0293) checks field paths against a bound value that exists, not a missing one. | hospitality check | `packages/agent-ui/a2ui/src/catalog/domains/hospitality/checks.ts` | a check test on the :75 payload fires a finding, and the :76 confirm is not held open | "A BookingForm whose bound value the data model never writes is a finding and never holds a confirm open" (L2) |
| S. Haiku sends the payload as an invalid JSON string or as text, and some turns degrade | 3 failed runs: `regress-concierge-spa-booking-haiku-1` (:13), `-2` (:50), `pick-croupier-game-deck-haiku-3` (:145) | (c) model, with a (d) repair-path question | 16 PARSE rounds on 13 turns, 10 saved (round 12: 3 on 3, all saved); 11 string `messages` rounds, against 2 in round 12's runs of the shared cells. :145 sends a string that does not parse on all three rounds and ships SURFACE_DEGRADED; :13 writes the payload as text, then answers SURFACE_MISSING with text again, then a string, and degrades; :50 ends on a reply-only round claiming "Your booking receipt is up to date above" with nothing sent (SEMANTIC_UNCORRECTED). | producer repair wording, or the tool schema | `packages/agent-ui/a2ui/src/agent/produce.ts` (`stringParseHint`, `TOOL_PARSE_HINT`), `packages/agent-ui/a2ui/src/agent/response-type.ts` | replays of :13, :50 and :145 reach a shipped surface or a refused claim | "Cut Haiku PARSE rounds on confirm and OptionDeck turns (string messages and text JSONL), measured on these 13 turns" (L2) |
| T. A bare room-booking ask never opens a StepFlow | 3 of 3: `reach-concierge-room-stepflow-haiku-1` to `-3` (:119, :134, :148) | (a) exposure | Each turn loads only the `product-presentation` mini-skill; the `booking-flow` workflow (the teaching that names StepFlow for a booking with missing details) stays `index-only`, and the `step-flow` mini-skill is not routed. Each answers with one BookingForm of empty fields. | prompt routing | `packages/agent-ui/a2ui/src/agent/prompts/mini-skills/step-flow.md` (its triggers), or the concierge persona's booking line | the composed prompt for "I'd like to book a room." holds the step-flow module | "A bare room-booking ask routes the step-flow teaching so the concierge opens a StepFlow" (L2) |
| U. The shopkeeper order summary is a hand-built Card, never a ConfirmReceipt with AmountPicker lines | 3 failed runs: `reach-shopkeeper-cart-amount-haiku-1` to `-3` (:123 to :124, :138 to :139, :152 to :153); every smoke add too (:6, :80) | (b) guidance not routed | The storefront opening (:123) hand-builds `orderCard`, a Card of Texts bound to `/order/summary` and `/order/total`, and each add sends one `updateDataModel` of `/order`. The `cart-summary` skill (ONE ConfirmReceipt with AmountPicker quantities) stays `index-only` on every shopkeeper turn; the persona body asks for "a running order summary" without naming it. The smoke passes because it expects only ProductCard. | persona teaching or routing, plus the smoke oracle | `site/agent-content/personas/shopkeeper/agent.md`, `site/agent-content/skills/cart-summary/SKILL.md`, `scripts/e2e-admin/probe/scenarios/shopkeeper.ts` | the composed storefront prompt holds the cart-summary body; the smoke's add step expects ConfirmReceipt | "Shopkeeper order summary renders as one ConfirmReceipt with AmountPicker lines" (L2) |
| V. A cold compare ask is refused for lack of prices | 3 of 3: `reach-shopkeeper-compare-haiku-1` to `-3` (:122, :137, :151) | (b) conflicting guidance, partly (d) probe | "I don't have our lamp prices in front of me, so I can't tell which two are cheapest without guessing." The `comparison-table` mini-skill loads; the same persona invents illustrative prices on every browse turn (:5, :123). The probe asks for a compare with no products on screen. | persona teaching, and the probe | `site/agent-content/personas/shopkeeper/agent.md`, a shopkeeper compare scenario | a browse-then-compare scenario reaches OptionCompare | "Shopkeeper compare: illustrative catalog prices apply, plus a browse-then-compare scenario" (L1) |

**Single-run errors, no cluster:** `long-concierge-spa-services-haiku-3` :107 halts SURFACE_DROPPED: round 1 hand-builds a Table (PRODUCT_CARD_MISSING), round 2 leaves its surface out (SURFACE_NOT_CREATED), round 3 is prose. `smoke-mentalist-first-answer-haiku-2` :45 asks question 2 with no answer deck and passes. Both (c), one run each; watch them next round.

**Observed against inferred:** codes, rounds, tool inputs, meta lines, reference loads and replies are recorded on the trace lines. Inferred from source: the `narratedMechanics` gate around the T-0428 test (P1), `confirmHeldOpen` holding :76 open (R), and why `step-flow` is not routed (T).

Bounded experiment per proposed ticket, measured on the same runs:
- **P1:** the :155 replay, then `claim-croupier-rename-table-haiku` and `smoke-shopkeeper-browse-and-add-haiku`, 3 samples.
- **P2:** the :149 replay, then `reach-concierge-day-itinerary-haiku`, 3 samples.
- **R:** the check test on :75, then `smoke-concierge-booking-haiku`, 3 samples.
- **S:** the three replays, then the PARSE-saved rate on the 13 turns' cells.
- **T:** the composed-prompt test, then `reach-concierge-room-stepflow-haiku`, 3 samples.
- **U:** the composed-prompt test, then `reach-shopkeeper-cart-amount-haiku`, 3 samples.
- **V:** the new scenario, 3 samples.

## Tickets
None filed by this round (the solo seat files none). Proposed, one per cluster: P1, P2, R, S, T, U and V, as in the table above.

## Process notes
- **Batches:** a probe took 13 s to about 1 min; `--max 8` batches fit the 10 minute foreground limit, and a restart skipped every run that already had a report.
- **Worktree key:** the lane worktree has no repo-root `.env`; it was linked to the main checkout's git-ignored file before the first run, and one plumbing probe written outside the round (`.sdlc/runtime/`) proved the link first.
