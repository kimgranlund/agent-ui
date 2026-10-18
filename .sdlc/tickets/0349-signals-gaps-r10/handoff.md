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

## Acceptance criteria
- `npm run check` exits 0.
- `npx vitest run --project scripts scripts/e2e-admin/` exits 0 (signals.test.mjs pins each gap on the fixture rounds and the r10 oracle: like-sample churn 7 / 4 / 1 / 11, halts 0 / 0 / 6, PARSE rounds 8 / 12 / 5, string `messages` 8 / 10 / 4, SURFACE_DEGRADED turns 1 / 2 / 0, reply-only NARRATED_MECHANICS repairs 8 of 8 / 9 of 9 / 6 of 14).
- `npm run eval:signals -- --round 2026-10-17-r10-targeted --against 2026-10-17-r9-matrix --min-samples 1` exits 0 and prints the like-sample churn, the rates table, the trace tallies and the retrieval comparison against r9.
