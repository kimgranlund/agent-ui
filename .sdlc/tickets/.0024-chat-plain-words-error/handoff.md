---
id: T-0024
title: "Prose /chat arm: deadline and stall errors reach the user in plain words, not a 500 with raw text"
type: bug
status: done
size: S
priority: P3
depends: []
created: 2026-10-07
router: .sdlc/AGENTS.md
---

## Goal
After #1846 the produce route maps `AgentTimeoutError` to a plain-words line via `failureMessageFor` (`tools/agent/chat-validation.ts`), but the prose `/chat` arm still returns a 500 whose body is the raw `err.message` (Worker outer catch `tools/agent/worker/index.ts` near line 370, dev-proxy rethrow near line 355).

## Intent
- Do: route both hosts' prose arm failures through `failureMessageFor`; keep the status code semantics; add red-then-green tests in the existing host tests (deadline and stall on `/chat`).
- Non-goals: produce route, retry policy, UI.
- Done when: `npm run check` and full `npm test` exit 0; no em dashes; LLD-C3 row repaired if it names the arm.

## Context
Prior: #1846, #1806. Worktree and branch are made by fanout. Judge gates by exit code.

## Constraints
Keys and `produce()` never enter devtools. Imports point inward only.


## Closed

2026-10-07: Merged in #1848
