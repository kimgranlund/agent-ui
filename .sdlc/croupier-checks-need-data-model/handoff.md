---
id: T-0215
title: "Croupier bankroll checks go blind when the table has no sendDataModel"
type: bug             # feature | bug | chore | spike | idea
status: proposed     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P1         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
The Croupier's bankroll and settlement checks judge every deal, also when the table surface was created without `sendDataModel`.

## Repro
1. `npx vitest run scripts/e2e-admin/probe/replays/croupier-haiku-no-send-data-model.test.mjs` (traces 2026-10-15.jsonl:5 and 6).

## Expected
A 250 deal from a 1,000 bankroll that writes 1,000 is sent back with BANKROLL_MISMATCH.

## Actual
Haiku 5.5 created table-1 with no `sendDataModel`, so the deal action carried no `dataModel`; `before` was undefined and both checks skipped. The table showed 1,000 with 250 on the felt, no retry. Same in blackjack-rounds-haiku-1 (:2). Sonnet always set `sendDataModel` and was caught every time.

## Context
`actionApplied` and `settleFinding` read the click-time bankroll from `action.dataModel` only. Guess: fall back to the server's merged view of that surface's data model before the turn, or require `sendDataModel` on a CardTable surface (a validator or semantic finding). Found by T-0184 (`.sdlc/croupier-closed-loop/report.md`); run folders and screenshots under `.sdlc/croupier-closed-loop/runs/` in the T-0184 lane commit; the trace file is git-ignored in the wave-cl worktree.

## Constraints
The failing test lands before or with the fix, never after. No em dashes.
