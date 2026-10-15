---
id: T-0023
title: "Agent runtime: whole-turn and mid-stream stall deadline (GH #1797 gap, only the first-byte deadline exists)"
type: bug
status: done
size: M
priority: P3
depends: []
created: 2026-10-07
router: .sdlc/AGENTS.md
---

## Goal
GH #1797 listed "no deadline on a tool round or the whole turn". On main only a per-attempt first-byte deadline (`anthropic.ts`, ANTHROPIC_FIRST_BYTE_TIMEOUT_MS) and a 30 s per-call tool timeout (`tool-dispatch.ts`) exist. A stream that stalls after the first byte, or a turn that loops through tool rounds, is still unbounded. Add a mid-stream stall guard (no event for N seconds aborts with a distinct, non-retried error) and a whole-turn deadline in `produce()`/the dev proxy. Worktree `.claude/worktrees/wave-deadline`, branch `fix/turn-deadline` (conductor creates both).

## Intent
- Do 1: a stall timer armed after the first byte, reset on every SSE event, aborting with a distinct error class that `fetchWithRetry` never retries; the error line reaches the user in plain words.
- Do 2: a whole-turn deadline, default generous (for example 180 s), configurable on the request seam, covering provider rounds and tool rounds, aborting the same controller the dev-proxy abort uses; the Worker keeps propagating `request.signal`.
- Do 3: keyless red-then-green tests with fake timers for each (stall after first byte; turn exceeding the deadline across rounds); a healthy long stream that keeps emitting events is never aborted.
- Non-goals: retry policy changes, token accounting, UI changes beyond the existing error line.
- Done when: `npm run check` and full `npm test` exit 0; docs/descriptors that mention the guards repaired; no em dashes. If the guard changes the ADR-0073 trust boundary or a ruled contract, stop and report instead of editing an ADR.

## Context
Prior work: #1806 (first-byte timeout, retry), #1804 (dev-proxy abort), #1797 and #1815. Files: `packages/agent-ui/a2ui/src/agent/providers/anthropic.ts`, `packages/agent-ui/a2ui/tools/agent/dev-proxy-plugin.ts`, `tools/agent/integrations/tool-dispatch.ts`, `produce.ts`, the worker under site. Never hand-edit generated files. Judge gates by exit code.

## Constraints
Imports point inward only. Keys and `produce()` never enter devtools. Commit locally in the worktree; no push or PR without approval.

## Acceptance criteria
1. A stream silent for the stall window after its first byte aborts with a non-retried, plain-words error; one that keeps emitting does not.
2. A turn past the deadline aborts across provider and tool rounds.
3. Red-then-green tests; gates green.

## Closed

2026-10-07: Merged in #1846
