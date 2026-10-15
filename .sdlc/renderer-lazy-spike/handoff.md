---
id: T-0055
title: "Option D design: make the whole renderer lazy at ui-surface-host (read-only spike)"
type: spike
status: done
size: L2
priority: P3
depends: []
created: 2026-10-08
router: .sdlc/AGENTS.md
---

## Goal
The T-0026 design measured about -26.7 kB gz for making the whole renderer lazy at `ui-surface-host` and parked it as Option D. With the settle seam (#1861), the warm memo and the lazy default catalog (#1864) on main, decide whether it is worth building now.

## Intent
- Do: read-only: re-measure on current main (npm run size; adapt `.sdlc/default-lazy-slices/measure/` and `.sdlc/size-budget-split-design/measure/`), then write `.sdlc/renderer-lazy-spike/design.md`: the current import graph from the app entry to the renderer, what a lazy `ui-surface-host` loads and when (first surface), the exact async seam and how it composes with `settled()`/`pending` and the warm memo, measured bytes saved and the extra request cost on first use, every consumer and test that would change (named by file, counted), risks (SSR-less pages, focus-timing, flicker, the cold-surface path), a decomposition into ticketable children with disjoint file lists and merge order, what needs Kim's ruling, and the ADR route (name it, do not draft). End with a clear recommendation: build, defer, or reject, and why.
- Non-goals: any source edit, building a child, budget changes.
- Done when: design.md exists with measured numbers from real runs and per-child file lists; a small check script confirms every named path exists; no source file changed (`git status` clean outside `.sdlc/`). Before reporting run `git diff origin/main HEAD | grep '^+' | grep -v '^+++' | grep -c '—'` and expect 0 for added lines.

## Context
Kim approved this on 2026-10-08 ("do 1, 2, 3, 4"). Run everything in the foreground (never wait on a background monitor); `timeout` is not installed; machine load can be high, so use `--maxWorkers=4` and rerun a load-only timeout alone. Judge gates by exit code; never hand-edit generated files. Other tickets running in parallel own disjoint files.

## Constraints
Imports point inward only. Commit locally in the worktree; no push or PR.

## Acceptance criteria
1. The Do items are met and the evidence commands show it.
2. Gates in Done when are green; no em dashes added.

## Closed

2026-10-08: Spike delivered: design.md, verdict defer (verifier pass)
