# T-0572 live round 18: report

Round 18 ran on 2026-10-29 UTC (15:26 to 16:02) at `11d20e79` (main after T-0530, T-0550, T-0552, T-0553, T-0555, T-0556, T-0563, T-0565 and T-0566), the round 17 matrix rerun unchanged to measure the October 28 and 29 A2UI renderer and check changes: the renderer applies only catalog-declared props (T-0552), media URL scheme gate and `media-src` format (T-0553, T-0563, T-0565), a2ui-basic defaults (T-0555), the dropped mapped-prop reset with the INERT_PROP and RECEIPT_TOTAL_PATH checks (T-0556), the AmountPicker receipt check for cluster P5 (T-0550) and the `./catalogs` subpath (T-0530). Kim approved the spend on 2026-10-29.

**69 of 69 runs, 68 passed and 1 failed, $0.68 in the ledger against the $5 cap, stop done, 0 cap skips.** Round 17 was 68 of 69 for $0.66. No turn halted; all 156 turns have outcome ok. No judge run and no fog ingest: the analysis reads the trace lines (`traces/2026-10-29.jsonl`, cited as `:<line>`), the run reports and one keyless replay.

## Comparison set
- **Plan:** the same 69 runs as rounds 16 and 17. The generated section is `plan.ts --tag smoke --tag regression --tag long --persona concierge --persona restaurant --persona travel --persona shopkeeper --persona negotiator --persona mentalist --model haiku --samples 3 --cap 5 --round r18-pattern`; a fresh run at this commit matched round 17's 39 lines byte for byte (only `--out` differs).
- **Hand-written section, 30 runs:** round 17's 30 hand-written probes, byte for byte, under a T-0572 comment. All 69 `chat:probe` lines equal round 17's once `--out` is normalized.
- **Against round 17:** all 23 cells are shared and no oracle changed. The prompt did not change: every persona's grammar, persona, components and functions section digests equal round 17's (grammar `5f9b7bf9c54c6206`); only the per-turn few-shot and mini-skill retrieval sets vary, and no exemplar's retrieval count moved (`eval:signals`, "None moved"). The changes under test are code-side (renderer, catalog formats, semantic checks).
- **Prompt digests and exemplars:** `signals.md`.

## Churn against round 17 (generated)

From `npm run eval:signals -- --round 2026-10-29-r18-pattern --against 2026-10-29-r17-pattern --min-samples 1`:

| Transition | Count | Cells | Sample 1 |
| --- | --- | --- | --- |
| fail to pass | 1 | `reach-shopkeeper-cart-amount-haiku` | 0 |
| pass to fail | 1 | `smoke-shopkeeper-browse-and-add-haiku` | 0 |
| fail to fail | 0 | | 0 |
| pass to pass | 21 | stable | 23 |

## Per cell

| Cell | Round 17 | Round 18 |
| --- | --- | --- |
| `claim-croupier-rename-table-haiku` | 3 of 3 | 3 of 3 |
| `long-concierge-booking-haiku` | 3 of 3 | 3 of 3 |
| `long-concierge-booking-confirm-haiku` | 3 of 3 | 3 of 3 |
| `long-concierge-facility-hours-haiku` | 3 of 3 | 3 of 3 |
| `long-concierge-spa-services-haiku` | 3 of 3 | 3 of 3 |
| `pick-croupier-game-deck-haiku` | 3 of 3 | 3 of 3 |
| `pick-mentalist-answer-deck-haiku` | 3 of 3 | 3 of 3 |
| `reach-concierge-day-itinerary-haiku` | 3 of 3 | 3 of 3 |
| `reach-concierge-room-stepflow-haiku` | 3 of 3 | 3 of 3 |
| `reach-shopkeeper-cart-amount-haiku` | 2 of 3 (sample 3, cluster P5) | 3 of 3 |
| `reach-shopkeeper-compare-haiku` | 3 of 3 | 3 of 3 |
| `reach-travel-trip-itinerary-haiku` | 3 of 3 | 3 of 3 |
| `regress-concierge-dinner-at-vela-haiku` | 3 of 3 | 3 of 3 |
| `regress-concierge-facilities-then-tour-haiku` | 3 of 3 | 3 of 3 |
| `regress-concierge-spa-booking-haiku` | 3 of 3 | 3 of 3 |
| `smoke-concierge-booking-haiku` | 3 of 3 | 3 of 3 |
| `smoke-croupier-blackjack-deal-haiku` | 3 of 3 | 3 of 3 |
| `smoke-mentalist-first-answer-haiku` | 3 of 3 | 3 of 3 |
| `smoke-negotiator-first-offer-haiku` | 3 of 3 | 3 of 3 |
| `smoke-restaurant-reserve-table-haiku` | 3 of 3 | 3 of 3 |
| `smoke-shopkeeper-browse-and-add-haiku` | 3 of 3 | 2 of 3 (sample 2, cluster R) |
| `smoke-stylist-palette-haiku` | 3 of 3 | 3 of 3 |
| `smoke-travel-compare-legs-haiku` | 3 of 3 | 3 of 3 |

## Per cluster and preset

By preset, round 18 (round 17): concierge 30 of 30 (30), croupier 9 of 9 (9), mentalist 6 of 6 (6), negotiator 3 of 3 (3), restaurant 3 of 3 (3), shopkeeper 8 of 9 (8), stylist 3 of 3 (3), travel 6 of 6 (6). All: 68 of 69 (68).

| Cluster | Round 17 | Round 18 |
| --- | --- | --- |
| M (moved child, `smoke-negotiator-first-offer-haiku`) | 3 of 3, 0 failed runs | 3 of 3, 0 failed runs |
| Q (empty repair round, `regress-concierge-spa-booking-haiku`) | 3 of 3, 0 failed runs | 3 of 3, 0 failed runs |
| P5 (cart receipt without its AmountPicker, `reach-shopkeeper-cart-amount-haiku`) | 2 of 3, 1 failed run | 3 of 3, 0 failed runs |
| R (new: an unparseable forced-repair round loses the repair ask, `smoke-shopkeeper-browse-and-add-haiku`) | 3 of 3, 0 failed runs | 2 of 3, 1 failed run |

Trace tallies, all samples, round 18 (round 17), fired rounds and saved: halted turns 0 (0); SURFACE_MISSING 17, 17 saved, 0 reply-only (21, 21, 0); PARSE 4 on 4 turns, 3 saved (4, 4); CATALOG 5, saved (3); SURFACE_CLAIMED 4, saved (2); CHANGE_CLAIMED 2, 1 saved (3, 3); ACTION_NOT_APPLIED 4, saved (4); IDGRAPH 2, saved (1); PRODUCT_CARD_MISSING 3, saved (2); BOOKING_VALUE_UNBOUND 2, saved (2); SURFACE_NOT_CREATED 2, saved (0); CONTRAST_PAIR_WRAPPED 3, saved (3); SURFACE_DROPPED 0 (2); OPTION_DECK_COUNT 0 (1); RECEIPT_TOTAL_PATH 1, saved (new code); SCHEMA 1, saved (0); NARRATED_MECHANICS 1, saved (0); string `messages` rounds 6 (8). The one unsaved turn is :43, PARSE after CHANGE_CLAIMED (cluster R).

## Cost

$0.678246 estimated at list prices in `round.json` `totals.costUsd` (156 trace lines; 1,040,271 input, 311,772 output, 3,662,489 cache read and 416,668 cache creation tokens), against the $5 cap; round 17 was $0.66. Per turn $0.004, latency p50 8.2 s and p90 16.6 s (round 17: 8.3 s and 15.4 s; `signals.md`). The keyless replay costs nothing.

## Is P5 closed

**Yes for this round, with the new check not exercised live.** `reach-shopkeeper-cart-amount-haiku` is 3 of 3, and every cart turn (:124, :139, :154) ships ConfirmReceipt plus AmountPicker in round 1 with no repair. The T-0550 AmountPicker row in `composite-moments.ts` never fired: no failed round in the round names a ConfirmReceipt quantity path. So the pass is the model's own round 1 shape (round 17's slip was 1 in 3 on the repair path), and the keyless proof of the check stays T-0550's own `composite-moments.test.ts` cases. One adjacent shape to watch: :43 r2's (unparsed) receipt gives its item a literal `quantity: 1` while the reply says "where you can change the quantity"; the T-0550 row reads bound quantity paths only, so it would not have fired on that payload had it parsed.

## Did the new checks cause a regression

**No.** Evidence per change:

| Change | Live signal | Verdict |
|---|---|---|
| T-0556 RECEIPT_TOTAL_PATH | Fired once, :76 r2 (`spa-booking:receipt` has `totalLabel` and no `totalPath`, so no total row draws); r3 ships and the run passes | a true finding, saved; one extra round, not a false send-back |
| T-0556 INERT_PROP | Fired 0 times | not exercised |
| T-0550 AmountPicker receipt row | Fired 0 times (see P5 above) | not exercised |
| T-0563, T-0565 `media-src` format; T-0553 media scheme gate | No media prop drew a CATALOG or SCHEMA finding; the 5 CATALOG paths are `tmpl.actionLabel` (:70, :99), `service-card.actionLabel` (:98), `root.action` (:34) and `datesField.required` (:134) | no effect; `tmpl.actionLabel` already fired in round 17 (:48, :62), and the catalog entries for these props did not change since round 17's commit (only media `src`, `poster`, `image` and `url` gained `media-src`) |
| T-0552 declared props only, T-0555 basic defaults, T-0556 mapped-prop reset | `no-renderer-rejection` passes on all 156 turns; no run report holds a page-fired step | no renderer rejection to catch |
| T-0530 `./catalogs` subpath | Every turn produced against its catalog (`catalogId` set on all 156 lines, no halt) | no effect |

The new or higher counts are model-side and saved: SURFACE_NOT_CREATED 2 (:12 r2, :38 r2: a BOOKING_VALUE_UNBOUND repair resent only the data patch for a surface the turn never created, or answered in prose; r3 ships; the code dates from T-0304 and fired in rounds 14 and 16 too), SCHEMA 1 (:149 r1, an `updateDataModel` with a bad `surfaceId`), NARRATED_MECHANICS 1 (:136 r2), SURFACE_CLAIMED 4 (the known `ask-1` shape, :4, :7, :78, :145).

## Why it failed and how to fix it

The failing run reproduces keylessly: `npm run chat:probe -- --replay .sdlc/evals/rounds/2026-10-29-r18-pattern/runs/smoke-shopkeeper-browse-and-add-haiku-2/fixture.json --expect-component ConfirmReceipt` exits 1 with the same three failed checks. A replay plays the recorded wire lines, so it shows recorded behaviour, not a fix. The row below is a proposal for Kim, not filed.

| Cluster | Runs | Class | Evidence | Fix layer | File | Keyless test that proves it | Proposed ticket |
|---|---|---|---|---|---|---|---|
| R. A forced CHANGE_CLAIMED repair round that comes back unparseable is filed plain PARSE, so the last round loses the repair ask and the forced `render_surface`, answers note-only, and the change ships tallied CHANGE_CLAIM_UNCORRECTED with no surface | 1 failed run: `smoke-shopkeeper-browse-and-add-haiku-2` (:42, :43) | (c) model, with a (d) producer repair-loop gap | :43 r1 ("Add the first one to my order.") answers a `target: storefront` meta line and a note only, so CHANGE_CLAIMED fires (a forced repair). r2 calls `render_surface` with `messages` as a string holding the right repair (the storefront plus an `order` ConfirmReceipt) but one closing brace short after the `updateComponents` message (`JSON.parse` fails at position 2028), so the turn files PARSE. r3, the last round, gets the PARSE ask unforced and returns the same meta line and note; `changeClaimFedBack` is already set, so the claim ships tallied and the probe sees no update to `storefront`. T-0499 and T-0501 keep a forced repair's ask only for an empty round (`raw.trim() === ''`, `produce.ts` near line 2086); an unparseable non-empty round falls through to plain PARSE. | producer repair loop | `packages/agent-ui/a2ui/src/agent/produce.ts`: when `forcedRepair` is set and `assembleFromRaw` fails on a non-empty round while a round is left, keep the failure being repaired plus a PARSE failure carrying `parseNote`, and keep `forceSurfaceRound` and `forcedRepairPending`, so the next round is still forced to `render_surface` with the original ask and the parse location. On the last round it stays PARSE as today. | a `produce-empty-repair.test.ts` case whose scripted model answers r1 note-only with a change claim (CHANGE_CLAIMED), r2 a `render_surface` whose string `messages` is :43 r2's (one brace short), and r3 a valid update: asserts r3's request forces `render_surface` and its feedback names CHANGE_CLAIMED and the parse location, and the turn ships the ConfirmReceipt; the negative is today's code, where r3 is unforced with a PARSE-only ask. Plus a fixture re-derived from :43 with `--from-trace` (as T-0498 did) | "An unparseable forced-repair round keeps its repair ask and the forced render_surface" (L2) |

**Single-run notes, no cluster:** :68 and :126 are round 1 PARSE rounds saved the usual way. CONTRAST_PAIR_WRAPPED fires on all three stylist turns again (:114, :129, :144), each saved: a standing cost. :6 (sample 1 of the same cell) ships its ConfirmReceipt after a CHANGE_CLAIMED repair, so a note-only r1 answer to "Add the first one" is common on this cell (2 of 3 add turns), and only the malformed repair turned it into a fail.

**Observed against inferred:** codes, rounds, tool inputs, meta lines and replies are on the trace lines; the failure reproduces keylessly; the brace error is a `JSON.parse` of :43 r2's `messages`. Inferred: that the proposed change would have saved :43 (r3 would have had to call `render_surface`; it is not run).

Bounded experiment for the proposed ticket: the unit test and the re-derived :43 replay, then `smoke-shopkeeper-browse-and-add-haiku` and `reach-shopkeeper-cart-amount-haiku`, 3 samples each.

## Tickets
None filed by this round (the solo seat files none). Proposed: R, as in the table above.

## Process notes
- **Batches:** a probe took about 15 s to 1.5 min; `--max 12` to `--max 14` batches fit the 10 minute foreground limit (14 runs took 8.5 min), and each restart skipped every run that already had a report. `ledger.jsonl` merged the six batches into one 69-run round.
- **live-commands.sh:** assembled in the session scratchpad from a fresh `plan.ts` run plus round 17's hand-written section with the round paths changed and the T-0572 comment. The runner did not copy it into the archive: given an absolute path, `runRound` joins it onto the root (`join(o.root, o.liveCommands)`), finds no file and skips the copy, though `round.json` names the archive path. The file was written into the archive by hand with the same `--out` retargeting the runner applies, and its README line was taken from `--describe` output (the rest of the README is the runner's). A runner that resolves an absolute path would avoid this; a note, not a fix here.
- **Worktree key:** the lane had no `.env`; a symlink to the main checkout's file was created (never read), and the first batch proved it.
