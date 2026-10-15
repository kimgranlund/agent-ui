---
id: T-0228
title: "Browser-test __screenshots__ folders break selection.test and the merge queue"
type: chore           # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
A failed browser test's `__screenshots__` folder never fails an unrelated gate: `registry/selection.test.ts` (sidecar scan) ignores folders that are not catalogs, `__screenshots__` is git-ignored repo-wide, and the merge queue removes them before its affected-test run.

## Context
Hit three times on 2026-10-15 (PRs 1991, 1997 and a lane run): vitest browser writes `__screenshots__` beside the failing test, and the sidecar scan in `packages/agent-ui/a2ui/src/registry/selection.test.ts` reads every folder under `catalog/personas/` as a persona.

## Done when
- A test plants a `__screenshots__` folder under catalog/personas and selection.test.ts still passes; it failed before.
- `npm run check` plus the touched tests exit 0.

## Lane bundle
This solo lane delivers these tickets in order, one commit each, then one batched verifier checks all of them:
- .sdlc/stray-screenshots-dirs/handoff.md
- .sdlc/validate-dropped-child-same-payload/handoff.md
- .sdlc/gh63-poison-producer/handoff.md
- .sdlc/persona-silent-drop/handoff.md

## Acceptance criteria
Lane base 73b567b2. One verifier checks all four tickets.
- T-0228: `npx vitest run packages/agent-ui/a2ui/src/registry/selection.test.ts` exits 0; its `__screenshots__` case failed with the old `!n.includes('.')` filter. `.gitignore` keeps `**/__screenshots__/`; seat-map's merge-queue trap names the removal command.
- T-0226: `npx vitest run packages/agent-ui/a2ui/src/agent/surface-seeds.test.ts` exits 0; its two T-0226 dangling cases (seeded and unseeded, each with a real-renderer agreement) fail with `validate.ts` at 73b567b2.
- T-0227: `npx vitest run --config vitest.browser.config.ts --project packages packages/agent-ui/app/src/controls/agent-admin/agent-admin-click-turn.browser.test.ts` exits 0; the GH #63 case fails when the `ERROR_TURN_BUDGET` halt in `agent-admin.ts` is disabled.
- T-0224: `npx vitest run packages/agent-ui/a2ui/src/live-agent/persona-cap.test.ts site/lib/admin-live-runner.test.ts` exits 0; the dev proxy, Worker and runner cases fail with the three source files at 73b567b2.
- `npm run check` exits 0.

## Lane verify scope
One batched verifier checks every ticket in ## Lane bundle against its own handoff criteria, from base 73b567b2: .sdlc/stray-screenshots-dirs, .sdlc/validate-dropped-child-same-payload, .sdlc/gh63-poison-producer, .sdlc/persona-silent-drop. One verdict per ticket, then one overall verdict.
## Outcome

2026-10-15 · lane: full L2 · verdict: closed by reason (Merged in #2006 (lane D)) · verifier: none · base: none
- Changed: see commits
- Commits: none
