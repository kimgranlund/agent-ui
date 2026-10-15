---
id: T-0030
title: "Move agent-ui's Haiku pins to claude-haiku-5-5 (agent-admin model row and default, providers.json, arena seat, provider thinking arm)"
type: chore
status: done
size: L2
priority: P3
depends: []
created: 2026-10-07
router: .sdlc/AGENTS.md
---

## Goal
Claude Haiku 5.5 is released (API id and alias `claude-haiku-5-5`, 1M context, 128K output, default effort medium). Kim chose, on 2026-10-07, to move agent-ui's live Haiku pins to it as a solo ticket, keeping 4.5 listed as a selectable model.

## Intent
- Do: in `agent-admin-schema.ts` add a `claude-haiku-5-5` row (label "Haiku 5.5") and make it `DEFAULT_MODEL_ID`; keep the 4.5 row; update `providers.json`, the arena seat in `packages/agent-ui/a2a/tools/arena/run-flagship.ts`, the tests that assert the default (`agent-admin.test.ts`, `agent-admin-authoring.test.ts`, anything else a grep for the old default id finds), and `.claude/docs/spec/agent-model.spec.md` where it names the default. Check `providers/anthropic.ts`: the Haiku 4.5 legacy thinking-budget arm applies only to models that still accept it; decide from the repo's own code and tests whether 5.5 takes the current `output_config: {effort}` arm or the legacy arm, and pin that with a keyless test. Keep effort values as they are; do not move to the new default effort.
- Non-goals: dated records (goals.md, old tickets, ADR text, archive, reports) stay untouched; no paid live call; no persona behavior change.
- Done when: `npm run check` and full `npm test` exit 0; `npm run test:browser` shard for agent-admin if its browser test is touched; seedVersion or manifest digests regenerated if the persona seed changes; no em dashes; stale records repaired.

## Context
Pins found by grep: agent-admin-schema.ts lines ~54 and ~64, providers.json line ~12, run-flagship.ts line ~45, anthropic.ts lines ~254 to ~301 (Haiku 4.5 legacy arm), agent-admin tests ~4500 and ~1278. Never hand-edit generated files.

## Constraints
Imports point inward only. Keys never enter devtools. Commit locally in the worktree; no push or PR.

## Acceptance criteria
1. `claude-haiku-5-5` is selectable and the default; 4.5 stays selectable.
2. The provider arm choice for 5.5 is pinned by a keyless test.
3. Gates green; dated records untouched.

## Closed

2026-10-07: Merged in #1851
