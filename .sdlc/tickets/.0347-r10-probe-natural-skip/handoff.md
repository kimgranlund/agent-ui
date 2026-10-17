---
id: T-0347
title: "Scripted card scenarios skip the rest of a hand when a natural settles it (round 10 cluster D)"
type: chore           # feature | bug | chore | spike | idea
status: done     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-17
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
Probe scenarios stop failing a correct agent when a natural settles the hand on the deal.

## Intent
- Do: the fix in Context, one cause.
- Non-goals: other round 10 clusters.
- Done when: Keyless replays of :80 and :101 pass the scenario; a run without a natural is unchanged. `npm run check` plus the touched folders' tests exit 0.

## Context
scripts/e2e-admin/probe croupier scenario steps. Round 10 :80 (blackjack-rounds-haiku-3), :101 to :103 (pontoon-haiku-1): NATURAL_ACTIONS settled correctly (T-0324, T-0334) and the next scripted step had no button. Round 10 report .sdlc/evals/rounds/2026-10-17-r10-targeted/report.md cluster D.

## Constraints
None beyond AGENTS.md.

## Outcome

2026-10-17 · lane: full L1 · verdict: pass · verifier: verifier-L1 (opus) · base: 7b9382202d30
- Changed: Scripted card steps skip once a natural settles the hand; round records untouched (#2109)
- Commits: e6078e3 T-0347: Scripted card scenarios skip the rest of a hand when a natural settles it (#2109)
- Check: 1 Keyless replays of :80 and :101 pass the scenario: pass
- Check: 2 A run without a natural is unchanged: pass
- Check: 3 `npm run check` plus touched folders' tests exit 0: pass
- Check: 4 Goal: committed round records r2 to r10 not rewritten: pass
- Follow-up: note: the remaining :101 failure settled pontoon natural on table-2... -> notes.md
- Follow-up: note: the replays did not exist at the base, so red-first for #1 was not... -> notes.md
