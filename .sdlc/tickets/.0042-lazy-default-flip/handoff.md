---
id: T-0042
title: "Option C child D: make the default catalog a lazy record, bundle gate, budget re-base, ADR-0241 amendment (design.md child D)"
type: feature
status: done
size: L2
priority: P2
depends: [T-0039, T-0040, T-0041]
created: 2026-10-08
router: .sdlc/AGENTS.md
---

## Goal
Option C child D of `.sdlc/tickets/.0037-default-lazy-slices/design.md` (make the default catalog lazy). Kim approved the whole plan on 2026-10-08 ("fix defect now, flip default too"). Implement the flip (default catalog becomes a lazy record), the bundle gate, the APP_MARGINAL_BUDGET re-base to measured plus 2,047 B, and the ADR-0241 amendment recorded as ratified by kimgranlund 2026-10-08 (Kim chose to flip on 2026-10-08, standing ratification grant). It merges LAST: do not start until children A, B and C are on main.

## Intent
- Do: read design.md sections 0, 3, 4 (your child), 5 and 7 first; follow your child's file list, gates and `(red)` criteria exactly; touch no file outside your child's list unless a gate forces it, and then say so. Depends on T-0039, T-0040 and T-0041.
- Non-goals: other children's files, any budget change except as child D defines, any paid call.
- Done when: your child's gates in design.md pass by exit code (at least `npm run check`, full `npm test`, `npm run size`, and the browser shards your touched tests need); no em dashes; stale records repaired.

## Context
Design and measurements are under `.sdlc/tickets/.0037-default-lazy-slices/` (copied into your worktree). T-0029 (#1858) and ADR-0241 are on main. Never hand-edit generated files. Do not use `timeout` (not installed). Run everything in the foreground.

## Constraints
Imports point inward only; Node fence on `src/agent/`; byte-pinned prompts must not move. Commit locally in the worktree; no push or PR.

## Acceptance criteria
1. The child's `(red)` controls are red before and green after (where the design names one).
2. Gates green; no em dashes.

## Closed

2026-10-08: Merged in #1864
