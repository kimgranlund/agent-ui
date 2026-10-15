---
id: T-0032
title: "Send output_config.effort low explicitly when effort is unset so Haiku 5.5 keeps the cheap 4.5 behavior"
type: chore
status: done
size: L1
priority: P3
depends: [T-0031]
created: 2026-10-07
router: .sdlc/AGENTS.md
---

## Goal
When effort is unset or low nothing is sent, so Haiku 5.5 runs adaptive thinking at its default medium; 4.5 ran with none. Send `output_config.effort` low explicitly for that case on models that take the adaptive arm, so cost and latency match the old behavior.

## Intent
- Do: decide from the code which unset or low cases map to an explicit low, change the request builder, keyless tests (red before) for haiku-5-5 and one Sonnet 5 control; update any doc that states the default.
- Non-goals: changing effort tiers or max_tokens, the 4.5 legacy arm, UI.
- Done when: `npm run check` and full `npm test` exit 0; no em dashes; LLD/spec lines that describe the behavior repaired.

## Context
Follow-up of T-0030 (#1851, Haiku 5.5). Provider code: `packages/agent-ui/a2ui/src/agent/providers/anthropic.ts` (tool loop near lines 656-668, request body near 254-310) and `anthropic-request-body.test.ts`. Never hand-edit generated files. Judge gates by exit code. Check claims against the Haiku 5.5 migration guide (platform.claude.com/docs/en/models/haiku-5-5/migration-guide) rather than assuming.

## Constraints
Imports point inward only. Keys never enter devtools. No paid call unless the Do names it. Commit locally in the worktree; no push or PR.

## Acceptance criteria
1. The new behavior is pinned by a keyless test that is red before and green after.
2. Gates in Done when are green; no em dashes; stale records repaired.

## Closed

2026-10-07: Merged in #1853
