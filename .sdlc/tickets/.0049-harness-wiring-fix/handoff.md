---
id: T-0049
title: "Clear the two harness wiring failures and the stale lane and ticket wording in four live skill and agent files"
type: chore
status: done
size: L1
priority: P3
depends: []
created: 2026-10-08
router: .sdlc/AGENTS.md
---

## Goal
`python3 scripts/harness_wiring_check.py` passes 37 of 39 and two live skills carry stale wording.

## Intent
- Do: (1) `.claude/agents/a2ui-payload-authoring-agent.md` description must state a trigger (the D1 check needs the word `use`): begin it with 'Use when dispatched to compose one A2UI message stream...' with no behavior change. (2) `.claude/agents/a2ui-review-agent.md`: description 'Use PROACTIVELY at definition-of-done...' (D1); reword 'never touches the artifact it grades' at line ~25 to 'does not touch ...' (D7, the tools list already enforces it); add `".claude/agents/a2ui-review-agent.md": ["D9 name suffix is a registered role"]` to `ACCEPTED_DIVERGENCES` in `scripts/harness_wiring_check.py` (~line 134), matching the payload agent which is already accepted; do NOT rename the agent. (3) `.claude/skills/seat-map/SKILL.md` line ~27: replace 'size S and M: the `sdlc-lite:solo` agent' with 'lane picked by `steps.py lane`: solo-L1/L2/L3'. (4) `.claude/skills/fleet-review/SKILL.md` lines ~8, 45, 59, 60, 77, 80: ADR-0145 makes work items GitHub issues, so 'ticket' becomes 'GitHub issue' and `<ticket id>` becomes `<issue #>`. (5) Remove every em dash from these four files and `scripts/harness_wiring_check.py` lines you touch (a comma, colon or period, keeping meaning).
- Scope (the ONLY files this ticket may change): `.claude/agents/a2ui-payload-authoring-agent.md`, `.claude/agents/a2ui-review-agent.md`, `.claude/skills/seat-map/SKILL.md`, `.claude/skills/fleet-review/SKILL.md`, `scripts/harness_wiring_check.py`
- Non-goals: other skills or agents (the em-dash sweep tickets own those).
- Done when: `python3 scripts/harness_wiring_check.py` exits 0 with all checks passing; `npm run check` exit 0; `npm run check:scripts` exit 0; doc_lint clean. Em-dash rule for your own added lines: `git diff origin/main HEAD | grep '^+' | grep -v '^+++' | grep -c '—'` prints 0.

## Context
Source: the 2026-10-08 repo docs audit (three read-only auditors, every defect below was verified against the code). Dated records (accepted ADR bodies, `.claude/docs/archive`, reports, frozen tickets) are never rewritten. Other tickets from the same audit have disjoint file sets, so lanes can run in parallel. Run everything in the foreground; `timeout` is not installed. Judge gates by exit code; never hand-edit generated files.

## Constraints
Imports point inward only. Docs-only diffs gate on doc_lint plus `npm run check` (process.md section 1); a change that touches an ADR title, an L1 descriptor, the ADR log or the changelog also regenerates the sitemap indexes and runs `site/lib/sitemap.test.ts`. Commit locally in the worktree; no push or PR.

## Acceptance criteria
1. Each listed defect is fixed and the evidence command shows it.
2. Gates in Done when are green; no em dashes added.

## Closed

2026-10-08: Merged in #1869
