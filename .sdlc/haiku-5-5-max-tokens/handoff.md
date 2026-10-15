---
id: T-0035
title: "Raise the Haiku 5.5 max_tokens tiers about 30 percent for the heavier tokenizer"
type: chore
status: done
size: L1
priority: P3
depends: []
created: 2026-10-07
router: .sdlc/AGENTS.md
---

## Goal
Haiku 5.5 tokenizes about 30 percent more tokens for the same text, and the max_tokens tiers (3072, 4096, 6144 at medium, high, xhigh; 4096 default) leave replies proportionally less room. Kim chose to raise the Haiku 5.5 tiers about 30 percent.

## Intent
- Do: scale the tiers for haiku-5-5 (and its Bedrock id) only, roughly 30 percent, rounded to sensible numbers, keeping the rule that max_tokens stays strictly above any thinking budget; Sonnet 5 and Haiku 4.5 unchanged; keyless tests red before; update any doc that lists the tiers.
- Non-goals: changing effort values, other models, UI.
- Done when: `npm run check` and full `npm test` exit 0; no em dashes; stale records (spec, LLD, comments naming the old behavior) repaired.

## Context
Kim approved this on 2026-10-07. Follow-up of T-0030 (#1851), T-0031 (#1852), T-0032 (#1853). Code: `packages/agent-ui/a2ui/src/agent/providers/anthropic.ts` and `tools/agent/integrations/tool-dispatch.ts`; tests `anthropic-request-body.test.ts`, `anthropic-tool-loop.test.ts`, `tool-dispatch.test.ts`. Another lane may edit anthropic.ts in a different region: keep edits small and rebase on origin/main before finishing. Check claims against the Haiku 5.5 docs, not the code comments.

## Constraints
Imports point inward only. Keys never enter devtools. No paid call. Commit locally in the worktree; no push or PR.

## Acceptance criteria
1. The behavior is pinned by keyless tests, red before and green after.
2. Gates green; no em dashes.

## Closed

2026-10-08: Merged in #1856
