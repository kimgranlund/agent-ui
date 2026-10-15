---
id: T-0221
title: "Agent admin fires one error turn per renderer violation, in parallel"
type: bug             # feature | bug | chore | spike | idea
status: proposed     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
One renderer rejection sends one error turn, with every violation in it.

## Repro
1. Mount an update with two dangling children in agent-admin Test Chat; or read traces 2026-10-15.jsonl:113 and 114 (same second).

## Expected
One client `error` message naming both ids, one heal turn.

## Actual
Two error messages, one per id, sent in parallel; two heal turns ran (both replied "Fixed..."), doubling cost, and the probe recorded every later step one exchange late (T-0222). Again at :121 and :122.

## Context
Guess: the admin's renderer error hook fires per violation. Owner: `packages/agent-ui/app/src/controls/agent-admin/agent-admin.ts` client-message path. Found by T-0184 (`.sdlc/croupier-closed-loop/report.md`); run folders and screenshots under `.sdlc/croupier-closed-loop/runs/` in the T-0184 lane commit; the trace file is git-ignored in the wave-cl worktree.

## Constraints
The failing test lands before or with the fix, never after. No em dashes.

## Acceptance criteria
- (red) `npx vitest run --project packages packages/agent-ui/app/src/controls/agent-admin/agent-admin-error-turn.test.ts` exits 0: an update with two dangling children drives one client error turn whose message names both ids.
- `npm run check` exits 0.
