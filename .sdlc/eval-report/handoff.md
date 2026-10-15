---
id: T-0177
title: "Agent eval framework 2: report page (matrix heatmap, failure codes, digest trends, links to trace and screenshots)"
type: feature         # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: [T-0176]    # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
One page shows what the eval runs mean: where agents fail, how often, on which model, and whether a prompt change made it better or worse.

## Intent
- Do:
  - `npm run eval:report` builds a self-contained HTML report from `.agent-evals/runs.jsonl` (and `.agent-traces`) into `.agent-evals/report/`, opened locally; built with agent-ui's own components where practical (dogfood), else plain HTML.
  - Views: scenario x model heatmap of pass rate with sample counts; flaky cells marked; failure-code histogram per persona and model; retry and retry-surface-loss rates; cost and latency per turn; trend lines by prompt bundle digest; each cell drills to its runs with trace summary, screenshots, transcript.
  - Diff mode: `--against <run id or date>` highlights cells that dropped more than a threshold.
- Done when: `npm run check` exit 0; the report builds from a seeded fixture store in a keyless test that asserts the heatmap counts and the diff highlight; screenshot of the report viewed; documented.

## Context
- Store schema from T-0176. Commit off origin/main, never push.

## Constraints
- Zero new dependencies; no network at view time. No em dashes.
