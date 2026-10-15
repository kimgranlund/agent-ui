---
id: T-0053
title: "Audit the declared package.json dependencies against real imports (a2ui lists a2a and icons, components lists icons but not shared)"
type: spike
status: done
size: L1
priority: P3
depends: []
created: 2026-10-08
router: .sdlc/AGENTS.md
---

## Goal
The entry-docs audit found that `a2ui/package.json` lists `@agent-ui/a2a` and `@agent-ui/icons` as dependencies although no a2ui source file imports either (a2ui's layering test forbids a2a), and `components/package.json` lists `icons` but not `shared`, which its source never imports either.

## Intent
- Do: read-only: for each of the ten `packages/agent-ui/*/package.json`, compare declared dependencies, devDependencies and peerDependencies against real imports (source, tests, tools, build scripts, exports maps) with a script you keep in the task folder, and write `.sdlc/package-deps-audit/findings.md`: per package a table of declared-but-unused, imported-but-undeclared, and ones that are legitimately declared for a reason (tools, subpaths, workspace protocol), each with the evidence command; end with a recommended change list and which ones change published metadata (all ten packages are private: true) or the lockfile. No edits outside the task folder.
- Scope (the ONLY files this ticket may change): only `.sdlc/package-deps-audit/` (read-only audit)
- Non-goals: editing any package.json or lockfile.
- Done when: findings.md exists with evidence per row, and a check script confirms every path and package it names exists. Em-dash rule for your own added lines: `git diff origin/main HEAD | grep '^+' | grep -v '^+++' | grep -c '—'` prints 0.

## Context
Source: the 2026-10-08 repo docs audit (three read-only auditors, every defect below was verified against the code). Dated records (accepted ADR bodies, `.claude/docs/archive`, reports, frozen tickets) are never rewritten. Other tickets from the same audit have disjoint file sets, so lanes can run in parallel. Run everything in the foreground; `timeout` is not installed. Judge gates by exit code; never hand-edit generated files.

## Constraints
Imports point inward only. Docs-only diffs gate on doc_lint plus `npm run check` (process.md section 1); a change that touches an ADR title, an L1 descriptor, the ADR log or the changelog also regenerates the sitemap indexes and runs `site/lib/sitemap.test.ts`. Commit locally in the worktree; no push or PR.

## Acceptance criteria
1. Each listed defect is fixed and the evidence command shows it.
2. Gates in Done when are green; no em dashes added.

## Closed

2026-10-08: Audit delivered: .sdlc/package-deps-audit/findings.md (premise partly wrong; the real findings are minor)
