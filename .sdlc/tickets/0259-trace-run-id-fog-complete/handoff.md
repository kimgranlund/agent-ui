---
id: T-0259
title: "Trace lines carry the probe run id; the fog mapping records turn completion"
type: chore           # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-15
branch: chore/trace-run-id-fog-complete
worktree: .claude/worktrees/wave-ri
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
Every producer trace line written during a probe or live round carries that run's id, and the context-fog-of-war bundle mapping (`.sdlc/evals/fog-manifest.json`) uses it as the conversation key and maps turn completion, so a round imports with one conversation per run and the bundle detectors run.

## Context
T-0248 (#2012) found two gaps: trace lines carry no probe-run id, so turns group by catalog (admiral and lexicographer share `agent-ui`), and `complete` is unmapped, so the bundle detectors abstain and "0 findings" is not evidence. Kim 2026-10-15: fix before round 3, ahead of the routing pressure pack (T-0260).

## Constraints
The run id travels as a request field or header from `chat:probe` / `run-capped.ts` to the dev proxy and into `trace-log.ts`; absent outside probe runs. No keys or content added to traces.

## Done when
- A probe selftest run writes trace lines whose `runId` matches its `report.json`; the ledger's trace line range agrees.
- `engineer.py ingest` of a round folder with the updated manifest yields one conversation per run and maps completion; `fog.py validate` exit 0; the bundle detectors run (a test or the ingest output shows them active).
- scripts/e2e-admin tests, the agent-trace tests and `npm run check` exit 0.
