---
id: T-0051
title: "No em dashes in live skills, part 2 of 3 (alphabetical third)"
type: chore
status: dropped
size: S
priority: P3
depends: []
created: 2026-10-08
router: .sdlc/AGENTS.md
---

## Goal
The repo rule is "No em dashes anywhere". 9 items below still contain em dashes (part 2 of 3; the three parts are disjoint and the files owned by the harness-wiring-fix ticket are excluded).

## Intent
- Do: replace every em dash (U+2014) in the scoped files with a comma, colon, period or parentheses chosen so the sentence keeps its meaning (do NOT blindly swap for a hyphen); do not change anything else; frontmatter `description:` values are routing text, so keep their meaning exact and re-read each edited description. Do not touch other characters such as en dashes or ASCII hyphens.
- Scope (the ONLY files this ticket may change): `.claude/skills/component-build/**`, `.claude/skills/component-catalog/**`, `.claude/skills/component-design/**`, `.claude/skills/component-packaging/**`, `.claude/skills/component-patterns/**`, `.claude/skills/component-standards/**`, `.claude/skills/component-testing/**`, `.claude/skills/composition-patterns/**`, `.claude/skills/doc-standards/**`
- Non-goals: rewording beyond the dash, any file outside the scope, `.claude/docs` (dated historical records stay as they are).
- Done when: `grep -rl "—" .claude/skills/component-build .claude/skills/component-catalog .claude/skills/component-design .claude/skills/component-packaging .claude/skills/component-patterns .claude/skills/component-standards .claude/skills/component-testing .claude/skills/composition-patterns .claude/skills/doc-standards` prints nothing; the repo's harness wiring check (the one in the check:scripts chain) is no worse than before; `npm run check` exit 0. Em-dash rule for your own added lines: `git diff origin/main HEAD | grep '^+' | grep -v '^+++' | grep -c '—'` prints 0.

## Context
Source: the 2026-10-08 repo docs audit (three read-only auditors, every defect below was verified against the code). Dated records (accepted ADR bodies, `.claude/docs/archive`, reports, frozen tickets) are never rewritten. Other tickets from the same audit have disjoint file sets, so lanes can run in parallel. Run everything in the foreground; `timeout` is not installed. Judge gates by exit code; never hand-edit generated files.

## Constraints
Imports point inward only. Docs-only diffs gate on doc_lint plus `npm run check` (process.md section 1); a change that touches an ADR title, an L1 descriptor, the ADR log or the changelog also regenerates the sitemap indexes and runs `site/lib/sitemap.test.ts`. Commit locally in the worktree; no push or PR.

## Acceptance criteria
1. Each listed defect is fixed and the evidence command shows it.
2. Gates in Done when are green; no em dashes added.

## Dropped

2026-10-08: dropped after two failed independent L2 verifications. The blanket replacement of em dashes in skill and agent text kept breaking meaning in routing descriptions (a semicolon or colon ends a NOT scope or detaches a gloss), table placeholder cells, and literals that scripts or cited sources require. The rule is style; the cost is risk to routing text. Reports: verifier-L2.md and verifier-L2-2.md in this folder. If revisited, do it by hand per file with a reviewer, not by script, and amend the done-when to allow listed literal exceptions.
