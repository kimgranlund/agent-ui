---
id: T-0216
title: "Croupier first deal never takes the bet out of the bankroll and needs a repair round"
type: bug             # feature | bug | chore | spike | idea
status: proposed     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
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
Guess: the seed v12 rule ("the deal takes the bet out of /bankroll") sits in round-loop prose with no worked example, and the model learns it only from the repair message. Proposed: one worked deal example in the CardTable teaching, or the table owning the debit. Measure with the T-0184 scenarios (`scripts/e2e-admin/probe/scenarios/croupier.ts`). Found by T-0184 (`.sdlc/croupier-closed-loop/report.md`); run folders and screenshots under `.sdlc/croupier-closed-loop/runs/` in the T-0184 lane commit; the trace file is git-ignored in the wave-cl worktree.

## Constraints
The failing test lands before or with the fix, never after. No em dashes.
