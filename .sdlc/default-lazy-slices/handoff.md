---
id: T-0037
title: "Option C: design slice 6 (default catalog lazy) as ticketed children, after T-0029 merges"
type: spike
status: done
size: L2
priority: P2
depends: []
created: 2026-10-08
router: .sdlc/AGENTS.md
---

## Goal
Option C of .sdlc/size-budget-split-design/design.md: make the default catalog lazy too (about -14 kB gz) by turning slice 6 into ticketed children now that T-0029 (#1858) is on main. Kim chose to design it as slices on 2026-10-08.

## Intent
- Do: read-only: re-measure on current main (npm run size, and the design prototype under .sdlc/size-budget-split-design/measure/ adapted to the merged code), then write `.sdlc/default-lazy-slices/design.md` with: the exact async seam for the default path (surface-host kick, the 13 non-test callers, the 26 test files named by file), a decomposition into children that can run in PARALLEL lanes with disjoint file sets (state each child file list and the merge order for anything that must be serial), per-child size and gates, the risk list, and what needs Kim ruling before any child starts (the async default path). No source edits.
- Non-goals: building any child, raising any budget, drafting the ADR (name it).
- Done when: design.md exists with measured numbers and per-child file lists, and a check script or manual check confirms every named path exists.

## Context
Kim asked on 2026-10-08 to fast-track anything parallelizable. Judge gates by exit code; never hand-edit generated files; do not use `timeout` (not installed).

## Constraints
Imports point inward only. Commit locally in the worktree; no push or PR.

## Acceptance criteria
1. As in Done when, red-then-green where a test is involved.
2. No em dashes; stale records repaired.

## Closed

2026-10-08: Design delivered: .sdlc/default-lazy-slices/design.md
