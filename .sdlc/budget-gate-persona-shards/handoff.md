---
id: T-0254
title: "Prompt budget gate measures the persona example shards too"
type: chore           # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: [T-0240]          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-15
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
The prompt budget gate measures the persona example shards (`agent-ui--<persona>.jsonl`) as well as the base shard, so a large persona seed reds the gate.

## Context
T-0240 verifier note (`tools/agent/prompt-budget-matrix.ts`): the budget reads only the base shard. Today the two persona records (~46.6k chars) are under the base shard's largest (49.2k to 50.0k), so it holds, but nothing catches growth.

## Done when
- The budget matrix includes each persona shard's records for that persona's turns; a test plants an oversized persona record and the gate goes red.
- `npm run check` exit 0.
