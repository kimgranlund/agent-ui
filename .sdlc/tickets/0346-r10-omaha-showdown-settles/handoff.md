---
id: T-0346
title: "A poker showdown reveals the opponent hand and settles in the same turn (round 10 cluster C)"
type: bug             # feature | bug | chore | spike | idea
status: ready     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-17
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
A Croupier check fires when a poker showdown ships unsettled (a 'Deal opponent's hand' button, no result).

## Intent
- Do: the fix in Context, one cause.
- Non-goals: other round 10 clusters.
- Done when: A croupier check test on the :108 round 2 payload fires; a settled showdown gives none. `npm run check` plus the touched folders' tests exit 0.

## Context
croupier/checks.ts. Round 10 :108 (regress-croupier-omaha-haiku-1). Round 10 report .sdlc/evals/rounds/2026-10-17-r10-targeted/report.md cluster C.

## Constraints
None beyond AGENTS.md.
