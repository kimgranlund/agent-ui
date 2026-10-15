---
id: T-0040
title: "Option C child B: site callers await the renderer settle seam (design.md child B)"
type: chore
status: done
size: L2
priority: P2
depends: []
created: 2026-10-08
router: .sdlc/AGENTS.md
---

## Goal
Option C child B of `.sdlc/tickets/.0037-default-lazy-slices/design.md` (make the default catalog lazy). Kim approved the whole plan on 2026-10-08 ("fix defect now, flip default too"). Implement the site callers: per the design section 3.4 audit the 11 production callers and edit only where a synchronous read after ingest actually exists (never turn a synchronous function async), plus the top-level warm-up in the three site test files.

## Intent
- Do: read design.md sections 0, 3, 4 (your child), 5 and 7 first; follow your child's file list, gates and `(red)` criteria exactly; touch no file outside your child's list unless a gate forces it, and then say so. Child A may merge first; rebase on origin/main before finishing and keep green either way.
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

2026-10-08: Merged in #1862
