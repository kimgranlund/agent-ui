---
id: T-0335
title: "Replace confirmation-view and backable-wizard, which read back a booking before confirming"
type: chore           # feature | bug | chore | spike | idea
status: done     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-17
branch: chore/0335-readback-records
worktree: ../agent-ui.worktrees/wave-w335
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
No corpus record teaches a pre-commit booking read-back with a confirm button; booking confirm turns stop retrieving one.

## Intent
- Do: the fix in Context, one cause.
- Non-goals: other round 9 clusters.
- Done when: Retrieval test red first on the old records; import-seeds, corpus vitest, dogfood-compose --gate and npm run check exit 0. `npm run check` plus the touched folders' tests exit 0.

## Context
Kim 2026-10-17: replace both the way T-0318 did (judged --replace, fresh a2ui-review-agent, retrieval test that booking confirm turns on agent-ui and agent-ui--concierge do not retrieve them). grammar.md:76-87 stays as is (Kim). Precedent: T-0318 (frontier-booking-receipt became a post-commit receipt). Rulings T-0266, T-0289.

## Constraints
grammar.md is byte-pinned; do not touch it.

## Outcome

2026-10-17 · lane: full L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: 67c6b1ff3d49
- Changed: confirmation-view is a settled plan record, backable-wizard a time-off request; booking confirm turns no longer retrieve them (#2084)
- Commits: none
- Check: 1 import-seeds no-op: pass
- Check: 2 corpus, tools/corpus and examples vitest: pass
- Check: 3 dogfood gate: pass
- Check: 4 npm run check: pass
- Follow-up: decide: Goal check: confirmation-view composition-pack-a.ts is now a... -> notes.md
- Follow-up: decide: Retrieval: the old records are what the T-0335 test fails on 10 of... -> notes.md
- Follow-up: note: the judge verdict files carry only judgedBy: a2ui-review-agent, so... -> notes.md
- Follow-up: note: the solo report records that backable-wizard's final review scene... -> notes.md
- Follow-up: note: composition-patterns.md cites grammar.md:138 for the card-anatomy... -> notes.md
