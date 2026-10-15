---
id: T-0054
title: "CLAUDE.md: remove its 26 em dashes by hand, keep meaning exact"
type: chore
status: done
size: L1
priority: P3
depends: []
created: 2026-10-08
router: .sdlc/AGENTS.md
---

## Goal
`AGENTS.md` says "No em dashes anywhere"; `CLAUDE.md` (the project entry file) still has 26. A blanket scripted replacement failed twice on skills this week, so this is by hand and reviewed.

## Intent
- Do: rewrite each em dash in `CLAUDE.md` by hand, one at a time, reading the sentence: pick a colon, semicolon, parentheses, comma or a period so the meaning, negation scopes, and list structure stay exactly as before; keep verbatim any literal that a script, test or cited source requires (check with `git grep` over scripts, tests and site/lib for the exact text before keeping or changing a quoted phrase); do not change anything except dash sites; leave en dashes and hyphens alone; keep every command, path and ADR number as is. In your report list every kept em dash with the reason, and show the old and new text of each changed line pair so a reviewer can read them.
- Non-goals: AGENTS.md (already clean), any other file.
- Done when: `grep -c "—" CLAUDE.md` prints 0 or only listed justified literals; a pairwise check (strip whitespace and `,;:()` and em dashes from old and new line) shows only dash sites changed; `npm run check` exit 0; any docs test touching CLAUDE.md (`git grep -l CLAUDE.md -- site/lib scripts`) passes. Before reporting run `git diff origin/main HEAD | grep '^+' | grep -v '^+++' | grep -c '—'` and expect 0 for added lines.

## Context
Kim approved this on 2026-10-08 ("do 1, 2, 3, 4"). Run everything in the foreground (never wait on a background monitor); `timeout` is not installed; machine load can be high, so use `--maxWorkers=4` and rerun a load-only timeout alone. Judge gates by exit code; never hand-edit generated files. Other tickets running in parallel own disjoint files.

## Constraints
Imports point inward only. Commit locally in the worktree; no push or PR.

## Acceptance criteria
1. The Do items are met and the evidence commands show it.
2. Gates in Done when are green; no em dashes added.

## Closed

2026-10-08: Merged in #1871
