---
id: T-0044
title: "Swiper: a deterministic test for the disconnect-mid-animation reset of #animFrame (T-0038 follow-up)"
type: chore
status: done
size: L1
priority: P3
depends: []
created: 2026-10-08
router: .sdlc/AGENTS.md
---

## Goal
`ui-swiper#disconnected()` cancels the scroll animation and sets `#animFrame = null` so the T-0038 snap gate is released (swiper.ts around lines 241-245). Nothing tests it: the builder could not make a disconnect-mid-animation test deterministic because the engine's own snap settle after a reconnect fires at different times.

## Intent
- Do: add a test in `packages/agent-ui/components/src/controls/swiper/swiper.browser.test.ts` (focus-timing project, Chromium) that does not wait on the engine: write `active`, disconnect the element one frame into the animation, reconnect, then dispatch a SYNTHETIC `scrollsnapchange` naming another slide and assert it commits (the gate is released); and show it red when the `#animFrame = null` line in `disconnected()` is removed (throwaway copy). Skip WebKit as the existing test does.
- Non-goals: product behavior changes.
- Done when: the swiper browser file passes in the focus-timing project; `npm run check` and full `npm test` exit 0. No em dashes anywhere in added lines: run `git diff origin/main HEAD | grep '^+' | grep -v '^+++' | grep -c '—'` and expect 0 before you report (solo agents keep missing this).

## Context
Kim approved this ticket on 2026-10-08. Run everything in the foreground; `timeout` is not installed. Machine load is high: a load-only timeout that passes alone is not a fail. Never hand-edit generated files.

## Constraints
Imports point inward only. Commit locally in the worktree; no push or PR.

## Acceptance criteria
1. The new test is red when the code it guards is removed (prove it in a throwaway copy) and green otherwise.
2. Gates green; no em dashes.

## Closed

2026-10-08: Merged in #1867
