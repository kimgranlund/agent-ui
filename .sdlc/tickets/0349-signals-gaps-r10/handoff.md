---
id: T-0349
title: "eval:signals follow-ups from round 10: like-sample churn, halt and failureCode tallies, retrieval table"
type: chore           # feature | bug | chore | spike | idea
status: ready     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P3         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-17
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
eval:signals covers the tables round 10's report still built by hand.

## Intent
- Do: the fix in Context, one cause.
- Non-goals: other round 10 clusters.
- Done when: Each listed gap has a signals.ts table with a fixture test; round 10's hand-built tables reproduce from the command. `npm run check` plus the touched folders' tests exit 0.

## Context
T-0342 follow-ups listed in Round 10 report .sdlc/evals/rounds/2026-10-17-r10-targeted/report.md section Signals gaps: churn mixes sample counts (compare like samples plus a rate), no halt or failureCodes tally, no string-messages tally, no retrieval table, and the others listed there.

## Constraints
None beyond AGENTS.md.
