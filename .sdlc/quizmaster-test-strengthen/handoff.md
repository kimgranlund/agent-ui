---
id: T-0045
title: "Quizmaster seed test: 'a current store keeps its edits' seeds a persisted seedVersion 2 store (T-0036 follow-up)"
type: chore
status: done
size: L1
priority: P3
depends: []
created: 2026-10-08
router: .sdlc/AGENTS.md
---

## Goal
In `site/pages/agent-admin-presets.test.ts` the test "a current store keeps its edits" writes and reads the same cached store, so it would pass with no seedVersion logic at all (the T-0036 verifier proved the real case with a probe).

## Intent
- Do: rewrite it to seed a persisted store at the current Quizmaster seedVersion (2) with an edited temperature and model, build the persona store the way the app does, and assert both edits survive; prove it red when the migration is forced to run (a throwaway copy where the wanted version is raised) and green otherwise.
- Non-goals: product behavior changes.
- Done when: `npx vitest run site/pages/agent-admin-presets.test.ts` passes; `npm run check` and full `npm test` exit 0. No em dashes anywhere in added lines: run `git diff origin/main HEAD | grep '^+' | grep -v '^+++' | grep -c '—'` and expect 0 before you report (solo agents keep missing this).

## Context
Kim approved this ticket on 2026-10-08. Run everything in the foreground; `timeout` is not installed. Machine load is high: a load-only timeout that passes alone is not a fail. Never hand-edit generated files.

## Constraints
Imports point inward only. Commit locally in the worktree; no push or PR.

## Acceptance criteria
1. The new test is red when the code it guards is removed (prove it in a throwaway copy) and green otherwise.
2. Gates green; no em dashes.

## Closed

2026-10-08: Merged in #1865
