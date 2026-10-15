---
id: T-0031
title: "Anthropic tool loop passes thinking blocks back unchanged (Haiku 5.5 and Sonnet 5 migration guide)"
type: bug
status: done
size: L2
priority: P3
depends: []
created: 2026-10-07
router: .sdlc/AGENTS.md
---

## Goal
In the tool loop the provider sends text and tool-call blocks back but drops thinking blocks; the migration guide says to pass them back unchanged (append-only conversations).

## Intent
- Do: carry thinking blocks (with their signatures, as the API returns them) through the tool-loop replay, never to the UI or trace as raw text beyond what ADR-0240 allows; keyless tests with a scripted stream containing a thinking block before a tool call.
- Non-goals: enabling thinking by default, UI changes, other providers.
- Done when: `npm run check` and full `npm test` exit 0; no em dashes; LLD/spec lines that describe the behavior repaired.

## Context
Follow-up of T-0030 (#1851, Haiku 5.5). Provider code: `packages/agent-ui/a2ui/src/agent/providers/anthropic.ts` (tool loop near lines 656-668, request body near 254-310) and `anthropic-request-body.test.ts`. Never hand-edit generated files. Judge gates by exit code. Check claims against the Haiku 5.5 migration guide (platform.claude.com/docs/en/models/haiku-5-5/migration-guide) rather than assuming.

## Constraints
Imports point inward only. Keys never enter devtools. No paid call unless the Do names it. Commit locally in the worktree; no push or PR.

## Acceptance criteria
1. The new behavior is pinned by a keyless test that is red before and green after.
2. Gates in Done when are green; no em dashes; stale records repaired.

## Closed

2026-10-07: Merged in #1852
