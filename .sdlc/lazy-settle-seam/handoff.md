---
id: T-0039
title: "Option C child A: renderer settle seam (pending, settled), warm-memo, and the cold-lazy-catalog data-empty-final defect in ui-surface-host"
type: bug
status: done
size: L2
priority: P2
depends: []
created: 2026-10-08
router: .sdlc/AGENTS.md
---

## Goal
Option C child A of `.sdlc/default-lazy-slices/design.md` (make the default catalog lazy). Kim approved the whole plan on 2026-10-08 ("fix defect now, flip default too"). Implement the settle seam (RendererHost pending and settled), the warm-memo, and the live defect where ui-surface-host.finalize() reads the mount synchronously on a surface whose catalog body is still loading and leaves data-empty-final set forever (cold a2ui-basic and persona surfaces on main today). Include the `(red)` control the design names.

## Intent
- Do: read design.md sections 0, 3, 4 (your child), 5 and 7 first; follow your child's file list, gates and `(red)` criteria exactly; touch no file outside your child's list unless a gate forces it, and then say so. Children B, C and D wait for this to merge only where the design says so.
- Non-goals: other children's files, any budget change except as child D defines, any paid call.
- Done when: your child's gates in design.md pass by exit code (at least `npm run check`, full `npm test`, `npm run size`, and the browser shards your touched tests need); no em dashes; stale records repaired.

## Context
Design and measurements are under `.sdlc/default-lazy-slices/` (copied into your worktree). T-0029 (#1858) and ADR-0241 are on main. Never hand-edit generated files. Do not use `timeout` (not installed). Run everything in the foreground.

## Constraints
Imports point inward only; Node fence on `src/agent/`; byte-pinned prompts must not move. Commit locally in the worktree; no push or PR.

## Acceptance criteria
1. The child's `(red)` controls are red before and green after (where the design names one).
2. Gates green; no em dashes.

## Closed

2026-10-08: Merged in #1861
