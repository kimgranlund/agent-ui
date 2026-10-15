---
id: T-0236
title: "chat:probe --from-trace labels a base-catalog preset's trace as croupier"
type: bug             # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P3         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-15
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
`--from-trace` writes the preset the trace came from, so a browser replay opens the right agent.

## Repro
1. `npm run chat:probe -- --from-trace 2026-10-15.jsonl:81 --name x` in the wave-r2 worktree (a Lexicographer turn), then read `"agent"` in the written fixture.

## Expected
`"agent": "lexicographer"`, or a setup error asking for `--agent` when the trace cannot name it.

## Actual
`"agent": "croupier"`. `scripts/e2e-admin/probe/trace.ts:168` sets `first.line.agent ?? 'croupier'`, and the dev proxy logs no `agent` for a preset on the base catalog (`agentLabel` in `packages/agent-ui/a2ui/tools/agent/trace-log.ts` derives it from a persona catalog id). Every Lexicographer and Admiral trace of live round 2 converts as croupier; `scripts/e2e-admin/probe/replays/lexicographer-haiku-no-secret.json` was hand-corrected.

## Context
Options: the admin sends its preset id as the request body's `agent` (then `agentLabel` already logs it), or `--from-trace` takes `--agent`. Found by T-0225 (`.sdlc/evals/rounds/2026-10-15-r2-presets/report.md`).

## Constraints
The failing test lands before or with the fix, never after. No em dashes.

## Acceptance criteria
- (red) A `--from-trace` test: a trace line with no `agent` and catalog `agent-ui` never yields agent croupier.
- `npm run check` exits 0.
