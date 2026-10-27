# T-0483 round 15 recheck: report

The four round 15 failing cells, rerun on Haiku (`claude-haiku-5-5`), 3 samples each, at `be31c52e` (main after T-0478 to T-0482). All four now pass 3 of 3. 12 of 12 runs passed, 21 of 21 turns have outcome ok, no halt. Cost $0.10 in the ledger (estimated at list prices, an overestimate) against the 1 USD cap, stop done, 0 cap skips. No judge run.

## Cells

| Cell | Round 15 | Recheck | Fix under test |
|---|---|---|---|
| `smoke-negotiator-first-offer-haiku` | 2 of 3 | 3 of 3 | T-0479, T-0482 (GameHud check, grammar.md:44) |
| `smoke-shopkeeper-browse-and-add-haiku` | 2 of 3 | 3 of 3 | T-0478, T-0481 (ConfirmReceipt, in-your-order claim, claim negatives) |
| `reach-shopkeeper-cart-amount-haiku` | 2 of 3 | 3 of 3 | T-0478, T-0481 |
| `reach-concierge-day-itinerary-haiku` | 2 of 3 | 3 of 3 | T-0480 (Itinerary) |

All 12 commands are round 15's, byte for byte (`live-commands.sh` here is the extract; each `--out` retargeted by `run-capped.ts`). Sample 1 of each cell passes with no code at all on every turn except the negotiator's second.

## Codes fired (trace lines, per cell)

| Cell | Samples | Codes on the turns |
|---|---|---|
| negotiator first offer | 3 | `TEXT_JSONL_ROUTED` on turn 2 of samples 1 and 3; `PARSE` on turn 1 of samples 2 and 3 (each saved by one repair) |
| shopkeeper browse and add | 3 | none |
| shopkeeper cart amount | 3 | sample 2 turn 2: `CHANGE_CLAIMED` repair then `PARSE`, 3 rounds, shipped (saved); samples 1 and 3 none |
| concierge day itinerary | 3 | none |

Round totals (`signals.md`): `PARSE` 4 rounds on 3 turns, 3 saved; `CHANGE_CLAIMED` 1 round, 1 saved; 0 `SURFACE_DEGRADED`. The new checks `GAME_HUD_MISSING`, `CONFIRM_RECEIPT_MISSING` and `ITINERARY_MISSING` fired 0 times and `SURFACE_CLAIMED` 0 times: the round 15 failures began as a SURFACE_CLAIMED note-only reply (negotiator, concierge) or a prose claim with no update (shopkeeper), and none of those first-round shapes recurred in 12 runs, so these samples show the end state passing but do not exercise the new check paths. Their keyless replays (T-0478 to T-0482) remain the proof for those paths.

## Reading

- Round 15's four failures were one run each in a 3-sample cell. 3 of 3 on a rerun is consistent with the fixes and also with Haiku variance, since no new check fired; the evidence is the absence of the failing first-round shapes, not a caught-and-repaired one.
- `TEXT_JSONL_ROUTED` on the negotiator's turn 2 ("I offer 20.") is a pre-existing routed-text code that ships and passes. Watch only.
- No cell fails, so no fix layer or keyless test is proposed and nothing is filed.

## Spend

| Item | USD |
|---|---|
| 12 runs (`ledger.jsonl`, `round.json` totals) | 0.098 |
| Cap | 1.00 |

Tokens: input 132069, output 61077, cache read 468733, cache creation 56612.

## Reproduce

`node --experimental-strip-types scripts/e2e-admin/probe/run-capped.ts .sdlc/evals/rounds/2026-10-27-r15-recheck/live-commands.sh --cap 1 --round r15-recheck`. Keyless replay of any run: `npm run chat:probe -- --replay .sdlc/evals/rounds/2026-10-27-r15-recheck/runs/<run>/fixture.json`.
