---
id: T-0048
title: "AGENTS.md and CLAUDE.md: add the components to icons DAG edge, retire the closed #1798 line"
type: chore
status: done
size: L1
priority: P3
depends: []
created: 2026-10-08
router: .sdlc/AGENTS.md
---

## Goal
The package DAG in the entry docs omits a real edge, and one Landmines line points at a closed issue.

## Intent
- Do: (1) `AGENTS.md` line ~23 and `CLAUDE.md` lines ~88-92: the DAG must show `components -> icons` (components/src imports @agent-ui/icons; its layering.test.ts names the edge `components -> icons, inward`); keep `icons` and `a2a` described as importing nothing themselves. (2) `AGENTS.md` line ~72: GH #1798 is closed; remove the line or reword to say the skills no longer name disabled plugin agents. Verify with `git grep -hoE "from '@agent-ui/[a-z0-9]+" -- packages/agent-ui/components/src ':!*.test.ts' | sort -u` and `gh issue view 1798 --json state`.
- Scope (the ONLY files this ticket may change): `AGENTS.md`, `CLAUDE.md`
- Non-goals: package.json dependency changes (separate spike), any other doc.
- Done when: `npm run check` exit 0; doc_lint clean; the per-package `layering.test.ts` files still pass. Em-dash rule for your own added lines: `git diff origin/main HEAD | grep '^+' | grep -v '^+++' | grep -c '—'` prints 0.

## Context
Source: the 2026-10-08 repo docs audit (three read-only auditors, every defect below was verified against the code). Dated records (accepted ADR bodies, `.claude/docs/archive`, reports, frozen tickets) are never rewritten. Other tickets from the same audit have disjoint file sets, so lanes can run in parallel. Run everything in the foreground; `timeout` is not installed. Judge gates by exit code; never hand-edit generated files.

## Constraints
Imports point inward only. Docs-only diffs gate on doc_lint plus `npm run check` (process.md section 1); a change that touches an ADR title, an L1 descriptor, the ADR log or the changelog also regenerates the sitemap indexes and runs `site/lib/sitemap.test.ts`. Commit locally in the worktree; no push or PR.

## Acceptance criteria
1. Each listed defect is fixed and the evidence command shows it.
2. Gates in Done when are green; no em dashes added.

## Closed

2026-10-08: Merged in #1868
