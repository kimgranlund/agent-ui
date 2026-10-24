---
id: T-0435
title: "agent-admin-app-team.test.ts leaves no unhandled rejection after teardown"
type: bug             # feature | bug | chore | spike | idea
status: done     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-24
claimed_by: claude:a8ce3b21 2026-10-24
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 5
---

## Goal
site/pages/agent-admin-app-team.test.ts finishes with no unhandled rejection: the async content stamp in agent-admin.ts (#contentStampPending to #renderContextSystem to contextItem to foldItem at :5591) no longer runs after the jsdom environment is torn down.

## Context
CI on PR #2238 (run 39962606499) failed with all 17 383 tests passing and one Vitest unhandled rejection, ReferenceError: document is not defined, originating in agent-admin-app-team.test.ts. A rerun passed: a teardown race.

## Constraints
Fix the root cause (await or cancel the pending stamp, or guard on disconnect), not by swallowing errors globally.

## Done when
The test file passes 20 consecutive runs with no unhandled error (vitest --repeat or a loop); npm run check plus the agent-admin tests pass.
- Lane: solo because size L1 (steps.py lane); overnight goal 2026-10-21

## Outcome

2026-10-24 · lane: solo L1 · verdict: pass · verifier: verifier-L1 (opus) · base: b066d868331f
- Changed: agent-admin cancels its pending content stamp on disconnect, so the app-team test leaves no unhandled rejection
- Commits: none
- Check: 1 The test file passes 20 consecutive runs with no unhandled error: pass
- Check: 2 npm run check plus the agent-admin tests pass: pass
- Follow-up: note: the 20-run criterion cannot bite locally since the CI race never... -> notes.md
