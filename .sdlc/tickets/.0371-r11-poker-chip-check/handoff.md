---
id: T-0371
title: "A Croupier check reads poker pot and bankroll arithmetic (round 11 cluster K)"
type: feature        # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-18
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
A Croupier check catches a poker table whose bankroll and pot do not conserve chips across a hand, the drift the round 11 judge found and no check fired on.

## Acceptance
- A croupier check test on the `regress-croupier-omaha-haiku-2` sequence (trace :139 to :146 of `.sdlc/evals/rounds/2026-10-18-r11-targeted/``traces/2026-10-18.jsonl`, the bankroll 960 after a 10 blind and a 20 bet that the reply prices as a 30 loss and then a 10 loss) fires the new code; a hand whose chips conserve gives none.
- `npm run check` and the croupier checks tests exit 0.

## Context
Judged checks, round 11: croupier Haiku 26 of 33 pass, Sonnet 11 of 11; C4 (reply agrees with the table) fails 7 of 44, 5 of them poker runs (omaha-haiku-1 and -2, texas-holdem-haiku-1, seven-card-stud-haiku-1 and -3). BANKROLL_MISMATCH reads the blackjack family only. Report: `.sdlc/evals/rounds/2026-10-18-r11-targeted/``report.md` cluster K; judged files in `judged/`.

## Kim ruling (2026-10-18, close-out round)
Promoted to ready; run as a keyless solo lane with one verifier, no live spend.

## Outcome

2026-10-18 · lane: full L2 · verdict: pass · verifier: verifier-L3 (fable) · base: 71e92246ca19
- Changed: Croupier checks poker pot and bankroll arithmetic (#2148)
- Commits: none
- Check: 1 A croupier check test on the `regress-croupier-omaha-haiku-2` sequence (trace :139 to :146) fires...: pass
- Check: 2 `npm run check` and the croupier checks tests exit 0: pass
- Follow-up: decide: packages/agent-ui/a2ui/src/catalog/personas/croupier/checks.ts:1311... -> notes.md
- Follow-up: decide: packages/agent-ui/a2ui/src/catalog/personas/croupier/checks.ts:767... -> notes.md
- Follow-up: decide: packages/agent-ui/a2ui/src/catalog/personas/croupier/checks.ts:1335... -> notes.md
- Follow-up: decide: packages/agent-ui/a2ui/src/catalog/personas/croupier/checks.ts:1216... -> notes.md
- Follow-up: decide: .sdlc/evals/rounds note: sweep of every recorded croupier round 20... -> notes.md
