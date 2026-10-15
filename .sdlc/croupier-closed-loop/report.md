# T-0184 Croupier closed-loop: live run report

16 live probes, 2026-10-15: sample 1 of each scenario on Haiku 5.5 and Sonnet 5.5, default effort, scenarios at `f72abda9`. Opus 5.5 is not in the picker, and sample 2 was not run. Estimated spend $9.25 (the conductor's figure), above the handoff's $5 cap. Run folders: `runs/<scenario>-<model>-1/`. Traces are `.agent-traces/2026-10-15.jsonl:<n>` in the wave-cl worktree (git-ignored).

## Game x model
| Game | Haiku 5.5 | Sonnet 5.5 |
|---|---|---|
| blackjack-rounds | fail click-target t5 (bet after Deal again), :1-:4; T-0211 T-0214 T-0215 | pass, :54-:63; T-0216 T-0217 |
| blackjack-moves | pass, :5-:14; T-0215 T-0217 | pass, :64-:73; T-0216 T-0217 |
| spanish-21 | pass, :15-:24; T-0216 T-0217 T-0219 | pass, :74-:83; T-0216 T-0217 |
| pontoon | fail click-target t6, :25-:29; T-0211 T-0214 | pass, :84-:94; T-0216 T-0217 T-0219 |
| texas-holdem | fail click-target t6, :30-:34; T-0214, scenario defect | pass, :95-:104 |
| omaha | pass, :35-:44; T-0214 T-0218 T-0219 | fail click-target t6, :105-:109; T-0218, scenario defect |
| five-card-draw | fail click-target t5, :45-:48; T-0214 | fail render-lint type-floor (T-0189), :110-:122; T-0220 T-0221 T-0222 |
| seven-card-stud | fail no-surface-loss t1 + click-target t6, :49-:53; T-0212 T-0213, scenario defect | fail click-target t6, :125-:129; scenario defect |

Screenshots: `runs/<run>/turn-<n>.png`. Bankroll arithmetic was checked by hand on every settled round. Every payout net was right; the defects are in when the debit happens.

## Findings (ticket: finding; evidence; check that fires today)
- **T-0211:** Deal again deals at the old bet and skips betting; Haiku 2 of 6 presses. :4, :29. Only click-target on the next bet.
- **T-0212:** BET_TABLE_MISSING fires on a poker bet step, costing 2 repair rounds; ask-1 is renamed. :49. no-surface-loss.
- **T-0213:** A meta-line inside the render_surface `reply` shows as raw JSON in chat. :49. None (no-json-as-prose misses that shape).
- **T-0214:** Haiku plays deals, typed moves and bet presses in prose with no table update. holdem t1-4, draw t1, t2, t4 (:48), omaha t1, :2, :26. Only downstream click-target.
- **T-0215:** Bankroll and settlement checks go blind without sendDataModel, so the Haiku deal never debits. :2, :6. None.
- **T-0216:** The first deal misses the debit, costing a BANKROLL_MISMATCH round. Sonnet in 4 of 4 blackjack-family runs, Spanish 21 Haiku twice. Producer retry only.
- **T-0217:** "Corrected: ..." and "Table-3 is open" appear in chat. :55, :65, :75, :85, :19, :12. None.
- **T-0218:** Poker hole cards are placeholders (four 2 of clubs; four aces swapped mid-hand, then settled on the swap). :105, :37-:41. None.
- **T-0219:** Narration and rule moves are unchecked: "Dealer 18 beats your soft 20", a bought card face up, pot-limit confusion. :20, :90, :43. None; the ticket proposes a rules-correctness check.
- **T-0220:** Server validation passes an update the renderer rejects (id-graph `acts->bBet`). :113, :114, :121, :122. None.
- **T-0221:** The admin fires one error turn per violation, in parallel. :113 and :114 in the same second. None.
- **T-0222:** chat:probe defects: step desync on page-fired turns, hidden buttons in `available`, run-level expect-component, and offline replay diverging from live on retry turns.
- **T-0189 (existing):** PlayingCard type floor, index-rank 7.875px, pip 8.4px. render-lint.

## Not a bug
- **Hidden old bet strip:** it is hidden, not clickable; this is a probe artifact (T-0222).
- **Bubble note replaced:** by design (tkt-0079).
- **Four poker Deal again misses:** scenario defects (blinds, pot-limit, stud's five streets). The models refused the illegal moves correctly. The scenarios are rewritten; the rewritten lines have not been run live.
- **Duplicate 3 of clubs in Spanish 21:** a multi-deck shoe; the rules entry doesn't set a deck count.
- **Sonnet reasoning warnings:** warn-level by design.

## Coverage gaps
These can't be scripted with random deals: no natural, no low bankroll, no split pair. A bust only happened on request, and there was one push. Also not covered: sample 2, Opus, and the rewritten poker lines.

## Replays (scripts/e2e-admin/probe/replays/)
- **Detect something offline:** croupier-stud-bet-table-missing (no-surface-loss), croupier-deal-again-old-bet (action-updates-surface; this is an offline divergence, T-0222).
- **Pin the trace only:** croupier-draw-haiku-prose-state, croupier-haiku-no-send-data-model, croupier-first-deal-debit, croupier-omaha-placeholder-hole, croupier-spanish-surrender-narration, croupier-draw-id-graph. Each ticket proposes the check that would turn its replay red.
