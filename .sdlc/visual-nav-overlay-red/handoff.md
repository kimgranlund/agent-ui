---
id: T-0046
title: "test:visual red on main: site/pages/_page.visual.browser.test.ts narrow nav OVERLAY-OPEN screenshot differs by 9502 px"
type: bug
status: done
size: L1
priority: P3
depends: []
created: 2026-10-08
router: .sdlc/AGENTS.md
---

## Goal
`npm run test:visual` exits 1 on main: `site/pages/_page.visual.browser.test.ts` ("narrow, nav OVERLAY-OPEN") differs from its golden screenshot by 9,502 px (ratio 0.05). The T-0042 builder and the L3 verifier both reproduced it on a clean d5dc33c5 checkout, so it predates the lazy-catalog work. It is probably a stale golden after the T-0043-era nav grouping change (#1600/#1616) or a real overlay regression.

## Intent
- Do: run the visual project test alone, view the actual vs golden image diff, decide whether the page changed deliberately (update the golden through the repo's documented flow, see component-testing skill and the visual project's README) or the overlay is genuinely broken (fix the cause); never raise a pixel tolerance to get green; say which it was and why.
- Non-goals: other visual goldens.
- Done when: `npm run test:visual` exits 0; `npm run check` and full `npm test` exit 0; em dash grep over added lines prints 0 (`git diff origin/main HEAD | grep '^+' | grep -v '^+++' | grep -c '—'`).

## Context
Run everything in the foreground; no `timeout` command on this machine. Judge gates by exit code. Never hand-edit generated files.

## Constraints
Imports point inward only. Commit locally in the worktree; no push or PR.

## Acceptance criteria
1. The visual test is green for a stated, justified reason.
2. Gates green; no em dashes.

## Closed

2026-10-08: Merged in #1866
