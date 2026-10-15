---
id: T-0001
title: "Remove the legacy .claude/ops directory and repair its dependents"
type: chore
status: done
size: M
priority: P3
depends: []
created: 2026-10-05
---
## Goal
Remove the whole legacy `.claude/ops/` directory (108 tracked files) and repair every record it invalidates in the same change.

## Context
User-approved scope: delete all of `.claude/ops/`, repair references, no archive; git history keeps the content. Repo rules are in `CLAUDE.md` and `AGENTS.md` (stale context is a defect; judge gates by exit code; no em dashes anywhere).

Known dependents (find all with `grep -rIn --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.sdlc "\.claude/ops\|ops/fleet\|ops/handoff\|ops/plan\|ops/rulings\|ops/held\|ops/reports\|ops/adr-queue"`):
- `scripts/reap-worktrees.mjs` reads `.claude/ops/fleet.json` (`live_state.joined[]`, GH #1680) to protect standing fleet seats; it degrades to an empty set when the file is missing. Remove that branch and its header comments cleanly, keep the script's other behavior and any tests green.
- `.claude/skills/seat-map/SKILL.md` (fleet.json mention), `.claude/skills/doc-standards/references/adr-log-mechanics.md`.
- `.claude/docs/process.md`, `goals.md`, `product-brief.md`, PRDs, decompositions, dated reports under `.claude/docs/reports/`, accepted ADRs (0007, 0040, 0067, 0069, 0072, 0192, 0193), `.claude/overhaul-wave1-plan.json`.

Rules for repairs: accepted ADRs and dated reports are historical; do not rewrite their prose, leave a dangling path there unless a gate (doc_lint, link check) fails, then make the smallest fix. Live docs, skills, and scripts must not point at deleted paths.

Before deleting, read `rulings.md`, `plan.md`, `held-items.md`, `handoff-2026-10-04.md`, `fleet.json` in `.claude/ops/`. Any decision that exists nowhere else in `.claude/docs/` is reported as a risk in the builder Notes, not silently dropped.

## Constraints
Gates: `npm run check` exit 0, plus tests of anything touched (reap-worktrees selftest if present). Docs-only parts gate on doc_lint plus check. No push, no PR, no issue comments; publishing needs user approval. Do not touch `.sdlc/`.
