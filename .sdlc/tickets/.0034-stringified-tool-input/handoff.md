---
id: T-0034
title: "Tool loop: an object-typed tool input field that arrives as a JSON string is parsed or rejected plainly (peer report on Haiku 5.5)"
type: bug
status: done
size: L1
priority: P3
depends: []
created: 2026-10-07
router: .sdlc/AGENTS.md
---

## Goal
A peer session reported that on claude-haiku-5-5 with forced tool_use, an object-typed field in the tool input can arrive as a JSON string instead of an object (stop_reason normal, only the shape differs). Our tool loop hands tool_use input to executors, so such a field could be read as missing.

## Intent
- Do: confirm from the Haiku 5.5 docs and migration guide whether this is documented; in the tool-call path (tool input assembly in anthropic.ts and/or the generic dispatch) coerce a string value to an object only where the tool schema says the field is an object and the string parses to one, otherwise reject with a plain-words tool error naming the field; keyless red-then-green tests with a scripted tool_use carrying a stringified object, a malformed string, and a normal object (control).
- Non-goals: coercing non-object fields, schema changes, any paid call.
- Done when: `npm run check` and full `npm test` exit 0; no em dashes; stale records (spec, LLD, comments naming the old behavior) repaired.

## Context
Kim approved this on 2026-10-07. Follow-up of T-0030 (#1851), T-0031 (#1852), T-0032 (#1853). Code: `packages/agent-ui/a2ui/src/agent/providers/anthropic.ts` and `tools/agent/integrations/tool-dispatch.ts`; tests `anthropic-request-body.test.ts`, `anthropic-tool-loop.test.ts`, `tool-dispatch.test.ts`. Another lane may edit anthropic.ts in a different region: keep edits small and rebase on origin/main before finishing. Check claims against the Haiku 5.5 docs, not the code comments.

## Constraints
Imports point inward only. Keys never enter devtools. No paid call. Commit locally in the worktree; no push or PR.

## Acceptance criteria
1. The behavior is pinned by keyless tests, red before and green after.
2. Gates green; no em dashes.

## Closed

2026-10-07: Merged in #1854
