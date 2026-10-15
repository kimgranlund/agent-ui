---
id: T-0215
title: "Croupier bankroll checks go blind when the table has no sendDataModel"
type: bug             # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
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
`actionApplied` and `settleFinding` read the click-time bankroll from `action.dataModel` only. Guess: fall back to the server's merged view of that surface's data model before the turn, or require `sendDataModel` on a CardTable surface (a validator or semantic finding). Found by T-0184 (`.sdlc/evals/rounds/2026-10-14-r1-croupier/report.md`); run folders and screenshots under `.sdlc/evals/rounds/2026-10-14-r1-croupier/runs/` in the T-0184 lane commit; the trace file is git-ignored in the wave-cl worktree.

## Constraints
The failing test lands before or with the fix, never after. No em dashes.

## Acceptance criteria
- (red) A deal or a settling move on a table created without `sendDataModel` is judged from the surface's replayed data model: `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/produce-semantic-checks.test.ts -t T-0215` exits 0 (the recorded 250 deal that writes 1,000 spends a repair round naming 750; a stand settling a win from 750 must read 1,250).
- The touched folders stay green: `npx vitest run --project packages packages/agent-ui/a2ui/src/catalog packages/agent-ui/a2ui/src/live-agent/produce-semantic-checks.test.ts packages/agent-ui/a2ui/src/agent/gates.test.ts` exits 0.
- The recorded fixture still replays: `npx vitest run --project scripts scripts/e2e-admin/probe/replays/croupier-haiku-no-send-data-model.test.mjs` exits 0.
- `npm run check` exits 0.
- Repro note: the offline replay builds `ProduceDeps` with no `semanticChecks`, so the handoff's Repro span is green on the broken tree too; it stays as recorded evidence, and the red control is the produce-level test above.

## Lane verify scope (conductor)
One batched verifier for this lane (Kim's ruling: one verifier per bundle). Verify this handoff AND each of these, criterion by criterion, in the same tree; give one verdict per ticket under Criteria and one overall Verdict:
- .sdlc/tickets/.0216-croupier-first-deal-debit/handoff.md
- .sdlc/tickets/.0211-croupier-deal-again-skips-bet/handoff.md
- .sdlc/tickets/.0212-croupier-bet-check-poker/handoff.md
- .sdlc/tickets/.0218-croupier-poker-placeholder-hole-cards/handoff.md
- .sdlc/tickets/.0219-croupier-rules-correctness-check/handoff.md

## Outcome

2026-10-14 · lane: full L1 · verdict: closed by reason (Merged in #1994; batched lane verifier L2 pass) · verifier: none · base: none
- Changed: see commits
- Commits: none
