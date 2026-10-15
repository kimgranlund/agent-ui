---
id: T-0043
title: "site-nav.browser.test.ts fails on main (2 tests, chromium and webkit): expected the section labels to include 'Components'"
type: bug
status: done
size: L1
priority: P2
depends: []
created: 2026-10-08
router: .sdlc/AGENTS.md
---

## Goal
`npm run test:browser:packages:components` exits 1 on main: `site-nav.browser.test.ts` ("renders section context-labels and the wide name|tag row", chromium and webkit) fails with AssertionError expected [ 'Feed & status', ... (23 items) ] to include 'Components' at line 92. The T-0038 verifier reproduced it at f5b38eea in a clean worktree, so it is not caused by that change.

## Intent
- Do: reproduce in isolation, find the root cause (a nav section rename or reorder without updating the test, a descriptor or registry change, or a real nav bug), fix it where the cause lives with the test red before and green after, repair any record that names the section.
- Non-goals: other nav features.
- Done when: the test passes in both engines; `npm run test:browser:packages:components` exits 0; `npm run check` and full `npm test` exit 0; no em dashes.

## Context
Judge gates by exit code; never hand-edit generated files; no `timeout` command on this machine.

## Constraints
Imports point inward only. Commit locally in the worktree; no push or PR.

## Acceptance criteria
1. Red before and green after.
2. Gates green; no em dashes.

## Closed

2026-10-08: Merged in #1860
