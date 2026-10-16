---
id: T-0311
title: "Dev trace: content-addressed prompt store, stopReason and max_tokens per round, and the max_tokens tier floor (P3, P7)"
type: feature        # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L3             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-16
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
Kim 2026-10-16 (P7 allowed, P3 as revised): the dev trace records what reached the model and why a round stopped. Source: `.sdlc/work/routing-architecture-review/` (proposals, challenge and rebuttal under `.sdlc/runtime/tasks/routing-architecture-review/`).

## Scope
1. A local, git-ignored content-addressed prompt store beside the dev trace: each round's composed prompt sections stored once by hash, the trace line carries the hashes (reverses `tools/agent/trace-log.ts:19`; keys and `.env` never stored).
2. `stopReason` and the request's `max_tokens` on every trace round (`TraceRound`).
3. The max_tokens tier floor: medium must not cap below unset for current-family models (`agent/providers/anthropic.ts:382-418, 524-531`); repair RTS-R9 and RTS-P3.

## Done when
- Tests for each part, red at the base; the trace and live-agent tests and `npm run check` exit 0; the fog bundle mapping can read the new fields.
