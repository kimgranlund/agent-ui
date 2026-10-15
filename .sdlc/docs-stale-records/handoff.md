---
id: T-0047
title: "Repair four stale doc statements found by the 2026-10-08 audit (ADR-0240 and ADR-0159 status, ActivityStep.details, swiper snap gate, coerceObjectFields)"
type: chore
status: done
size: L1
priority: P3
depends: []
created: 2026-10-08
router: .sdlc/AGENTS.md
---

## Goal
Four verified stale or incomplete statements in live docs.

## Intent
- Do: (1) `.claude/docs/references/agent-model.md` line ~264: ADR-0240 is accepted (ratified by kimgranlund 2026-10-07), not proposed. (2) same file lines ~189-190: the `ActivityStep` field list gains `details?: readonly string[]` (see `packages/agent-ui/app/src/controls/conversation/activity-step.ts:47`). (3) `packages/agent-ui/app/src/controls/conversation/conversation.md` lines ~35, ~100, ~286: the ADR-0159 step-mode amendment is ratified (by Kim 2026-10-06), not proposed. (4) `packages/agent-ui/components/src/controls/swiper/swiper.md` lines ~225-227: add that since #1859 the snap handler drops stale `scrollsnapchange` events while a programmatic animation owns the track (swiper.ts ~line 500). (5) add `coerceObjectFields` (anthropic.ts ~315, called ~791, T-0034, #1854: an object-typed tool input field that arrives as a JSON string is parsed, a non-object is rejected with an is_error result naming the field) to `.claude/docs/lld/a2ui-live-agent.lld.md` in the tool-loop section.
- Scope (the ONLY files this ticket may change): `.claude/docs/references/agent-model.md`, `packages/agent-ui/app/src/controls/conversation/conversation.md`, `packages/agent-ui/components/src/controls/swiper/swiper.md`, `.claude/docs/lld/a2ui-live-agent.lld.md` (plus regenerated files the gates name)
- Non-goals: any other doc, any code.
- Done when: `npm run check` exit 0; doc_lint clean on the touched `.claude/docs` files; the two descriptors `conversation.md` and `swiper.md` are L1 descriptors, so regenerate (`npm run generate:registry`, and the sitemap generator if indexes change) and run `site/lib/sitemap.test.ts` plus the descriptor and registry tests; full `npm test` exit 0. Em-dash rule for your own added lines: `git diff origin/main HEAD | grep '^+' | grep -v '^+++' | grep -c '—'` prints 0.

## Context
Source: the 2026-10-08 repo docs audit (three read-only auditors, every defect below was verified against the code). Dated records (accepted ADR bodies, `.claude/docs/archive`, reports, frozen tickets) are never rewritten. Other tickets from the same audit have disjoint file sets, so lanes can run in parallel. Run everything in the foreground; `timeout` is not installed. Judge gates by exit code; never hand-edit generated files.

## Constraints
Imports point inward only. Docs-only diffs gate on doc_lint plus `npm run check` (process.md section 1); a change that touches an ADR title, an L1 descriptor, the ADR log or the changelog also regenerates the sitemap indexes and runs `site/lib/sitemap.test.ts`. Commit locally in the worktree; no push or PR.

## Acceptance criteria
1. Each listed defect is fixed and the evidence command shows it.
2. Gates in Done when are green; no em dashes added.

## Closed

2026-10-08: Merged in #1870
