---
id: T-0216
title: "Croupier first deal never takes the bet out of the bankroll and needs a repair round"
type: bug             # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
The first deal of a session takes the bet out of /bankroll on round 1, so the first bet costs no repair round.

## Repro
1. `npx vitest run scripts/e2e-admin/probe/replays/croupier-first-deal-debit.test.mjs` (traces 2026-10-15.jsonl:64 and 65).

## Expected
The deal turn ships bankroll = bankroll before minus the bet on its first round.

## Actual
BANKROLL_MISMATCH on the first bet in every Sonnet 5.5 blackjack-family run (blackjack-moves :65, blackjack-rounds :55, spanish-21 :75, pontoon :85) and twice in spanish-21-haiku-1 (:16, :19); later deals in the same run were right. Each costs a full extra model round on the turn players notice most.

## Context
Guess: the seed v12 rule ("the deal takes the bet out of /bankroll") sits in round-loop prose with no worked example, and the model learns it only from the repair message. Proposed: one worked deal example in the CardTable teaching, or the table owning the debit. Measure with the T-0184 scenarios (`scripts/e2e-admin/probe/scenarios/croupier.ts`). Found by T-0184 (`.sdlc/evals/rounds/2026-10-14-r1-croupier/report.md`); run folders and screenshots under `.sdlc/evals/rounds/2026-10-14-r1-croupier/runs/` in the T-0184 lane commit; the trace file is git-ignored in the wave-cl worktree.

## Constraints
The failing test lands before or with the fix, never after. No em dashes.

## Acceptance criteria
- (red) The table owns the debit: a bet press sends `{bet, bankrollAfterBet}` (the bankroll less the bet), and the action check holds a deal to that figure with or without a click-time data model: `npx vitest run --project packages packages/agent-ui/a2ui/src/catalog/personas/croupier/card-table.test.ts packages/agent-ui/a2ui/src/catalog/personas/croupier/checks.test.ts -t T-0216` exits 0.
- The touched folders stay green: `npx vitest run --project packages packages/agent-ui/a2ui/src/catalog packages/agent-ui/a2ui/src/live-agent/produce-semantic-checks.test.ts` exits 0.
- The recorded fixture still replays: `npx vitest run --project scripts scripts/e2e-admin/probe/replays/croupier-first-deal-debit.test.mjs` exits 0.
- `npm run check` exits 0.
- Not measured live (no spend in this lane): whether Sonnet 5.5 now writes `bankrollAfterBet` on round 1 is a T-0184 scenario rerun (`scripts/e2e-admin/probe/scenarios/croupier.ts`). The offline replay runs no semantic checks, so the Repro span is green on the broken tree too; it stays as recorded evidence.

## Outcome

2026-10-14 · lane: full L1 · verdict: closed by reason (Merged in #1994; batched lane verifier L2 pass) · verifier: none · base: none
- Changed: see commits
- Commits: none
