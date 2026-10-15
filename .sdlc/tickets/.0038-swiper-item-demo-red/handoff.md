---
id: T-0038
title: "site browser test swiper-item-demo.browser.test.ts fails on main: expected 'welcome' to be 'rules' (programmatic active write by KEY vs INDEX)"
type: bug
status: done
size: L1
priority: P2
depends: []
created: 2026-10-08
router: .sdlc/AGENTS.md
---

## Goal
`site/pages/swiper-item-demo.browser.test.ts` fails on main (reproduced on a clean df7b73c0 checkout by the T-0029 builder and verifier): "a programmatic active write resolves by KEY on the tour and by INDEX on the unkeyed deck", AssertionError expected welcome to be rules. It reds `npm run test:browser:site` for everyone.

## Intent
- Do: run it in isolation (npx vitest run --config vitest.browser.config.ts --project site site/pages/swiper-item-demo.browser.test.ts), diagnose the root cause (product bug in swiper active-write resolution, a stale demo, or a timing race under load; repeat the run at low load to tell), fix it where the cause lives with the test red before and green after, repair any record that describes the behavior; if it is a pure load-time race, make the test wait on the real signal, never add a sleep.
- Non-goals: unrelated swiper features.
- Done when: the test passes 3 of 3 in isolation and in the site shard; `npm run check` and full `npm test` exit 0.

## Context
Kim asked on 2026-10-08 to fast-track anything parallelizable. Judge gates by exit code; never hand-edit generated files; do not use `timeout` (not installed).

## Constraints
Imports point inward only. Commit locally in the worktree; no push or PR.

## Acceptance criteria
1. As in Done when, red-then-green where a test is involved.
2. No em dashes; stale records repaired.

## Closed

2026-10-08: Merged in #1859
