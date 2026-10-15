---
id: T-0227
title: "agent-admin-click-turn GH #63 browser test needs a new poisoned producer (T-0172 made its poison legal)"
type: bug             # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
The GH #63 error-loop test in agent-admin-click-turn.browser.test.ts uses a producer payload that still causes an error loop, so it proves the loop guard again.

## Context
Found by lane 2 (T-0221): T-0172 made a same-type root resend legal, so the test's poisoned producer no longer errors. It fails on base already. Pick a payload the renderer rejects after T-0220 (an id-graph violation is one).

## Done when
- The test is green and fails when the loop guard is removed (negative control).
- The packages browser shard file passes.

## Outcome

2026-10-15 · lane: full L1 · verdict: closed by reason (Merged in #2006 (lane D)) · verifier: none · base: none
- Changed: see commits
- Commits: none
