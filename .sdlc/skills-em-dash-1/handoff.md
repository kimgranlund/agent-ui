---
id: T-0050
title: "No em dashes in live skills, part 1 of 3 (alphabetical third)"
type: chore
status: ready
size: S
priority: P3
depends: []
created: 2026-10-08
router: .sdlc/AGENTS.md
---

## Goal
The repo rule is "No em dashes anywhere". 9 items below still contain em dashes (part 1 of 3; the three parts are disjoint and the files owned by the harness-wiring-fix ticket are excluded).

## Intent
- Do: replace every em dash (U+2014) in the scoped files with a comma, colon, period or parentheses chosen so the sentence keeps its meaning (do NOT blindly swap for a hyphen); do not change anything else; frontmatter `description:` values are routing text, so keep their meaning exact and re-read each edited description. Do not touch other characters such as en dashes or ASCII hyphens.
- Scope (the ONLY files this ticket may change): `.claude/skills/a2ui-build/**`, `.claude/skills/a2ui-catalog-rendering-review/**`, `.claude/skills/a2ui-corpus-curation/**`, `.claude/skills/a2ui-multi-catalog/**`, `.claude/skills/a2ui-payload-authoring/**`, `.claude/skills/a2ui-prompt-authoring/**`, `.claude/skills/a2ui-review-standards/**`, `.claude/skills/admin-library-kinds/**`, `.claude/skills/app-composition/**`
- Non-goals: rewording beyond the dash, any file outside the scope, `.claude/docs` (dated historical records stay as they are).
- Done when: `grep -rl "—" .claude/skills/a2ui-build .claude/skills/a2ui-catalog-rendering-review .claude/skills/a2ui-corpus-curation .claude/skills/a2ui-multi-catalog .claude/skills/a2ui-payload-authoring .claude/skills/a2ui-prompt-authoring .claude/skills/a2ui-review-standards .claude/skills/admin-library-kinds .claude/skills/app-composition` prints nothing; the repo's harness wiring check (the one in the check:scripts chain) is no worse than before; `npm run check` exit 0. Em-dash rule for your own added lines: `git diff origin/main HEAD | grep '^+' | grep -v '^+++' | grep -c '—'` prints 0.

## Context
Source: the 2026-10-08 repo docs audit (three read-only auditors, every defect below was verified against the code). Dated records (accepted ADR bodies, `.claude/docs/archive`, reports, frozen tickets) are never rewritten. Other tickets from the same audit have disjoint file sets, so lanes can run in parallel. Run everything in the foreground; `timeout` is not installed. Judge gates by exit code; never hand-edit generated files.

## Constraints
Imports point inward only. Docs-only diffs gate on doc_lint plus `npm run check` (process.md section 1); a change that touches an ADR title, an L1 descriptor, the ADR log or the changelog also regenerates the sitemap indexes and runs `site/lib/sitemap.test.ts`. Commit locally in the worktree; no push or PR.

## Acceptance criteria
1. Each listed defect is fixed and the evidence command shows it.
2. Gates in Done when are green; no em dashes added.
