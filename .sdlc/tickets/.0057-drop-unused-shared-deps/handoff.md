---
id: T-0057
title: "Drop `@agent-ui/shared` from code, data and router package.json (declared, never imported)"
type: chore
status: done
size: L1
priority: P3
depends: []
created: 2026-10-08
router: .sdlc/AGENTS.md
---

## Goal
The T-0053 audit (`.sdlc/tickets/.0053-package-deps-audit/findings.md`) found `@agent-ui/shared` is declared but never imported in `packages/agent-ui/code`, `data` and `router` (only their layering.test.ts files mention it). All ten packages are private, so no published metadata changes; the lockfile does.

## Intent
- Do: re-verify with `.sdlc/tickets/.0053-package-deps-audit/evidence.sh code shared` (and data, router; the scripts are in the main checkout's `.sdlc/tickets/.0053-package-deps-audit/`, copy them in) that no non-test import, CSS `@import` or exports-map reference to @agent-ui/shared exists in each of the three; check each package's `layering.test.ts` does not assert the declared dependency; if clean, remove `@agent-ui/shared` from the three `package.json` dependency lists and update `package-lock.json` with `npm install --package-lock-only` (inspect the lockfile diff: only those three workspace entries may change); run each package's layering test. Do NOT add the undeclared test-only edges (app to icons, a2a to a2ui): that would create devDependency cycles. If any of the three packages does use shared (CSS imports count), leave that one alone and say why.
- Non-goals: adding dependencies, other packages, any source change.
- Done when: `npm run check`, full `npm test` (--maxWorkers=4) and `npm run build` exit 0; the per-package layering tests pass; `git diff --stat` shows only the three package.json files and package-lock.json. Before reporting run `git diff origin/main HEAD | grep '^+' | grep -v '^+++' | grep -c '—'` and expect 0 for added lines.

## Context
Kim approved this on 2026-10-08 ("do 1, 2, 3, 4"). Run everything in the foreground (never wait on a background monitor); `timeout` is not installed; machine load can be high, so use `--maxWorkers=4` and rerun a load-only timeout alone. Judge gates by exit code; never hand-edit generated files. Other tickets running in parallel own disjoint files.

## Constraints
Imports point inward only. Commit locally in the worktree; no push or PR.

## Acceptance criteria
1. The Do items are met and the evidence commands show it.
2. Gates in Done when are green; no em dashes added.

## Closed

2026-10-08: Merged in #1872
