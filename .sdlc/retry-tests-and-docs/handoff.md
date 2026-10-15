---
id: T-0006
title: "Retry and deadline tests plus stale provider docs (GH #1815 items 1, 2, doc scrub)"
type: chore           # feature | bug | chore | spike | idea
status: done
size: S
priority: P2
depends: [file:packages/agent-ui/a2ui/src/live-agent/anthropic-retry.test.ts, file:packages/agent-ui/a2ui/src/live-agent/anthropic-timeouts.test.ts]
created: 2026-10-05
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Add the missing provider tests and repair the docs that PRs #1805 (first-byte deadline and stall guard) and #1806 (bounded transport retry) leave stale. Tracks GH #1815 items 1 and 2.

## Intent
- Do: (1) a test that a first-byte timeout is NOT retried: exactly one `fetch` call, message `anthropicProvider: no response within 60000 ms`, no sleep (`FirstByteTimeoutError` is not exported: observe it through the provider with fake timers and a `fetch` that never answers); (2) a test that a caller abort and a `doFetch` AbortError are rethrown as the same object; (3) a Retry-After cap case (`Retry-After: 3600` sleeps exactly 10000 ms); (4) the doc scrub below. Each new test needs a negative control (fails when the guard is removed).
- Non-goals: any change to `anthropic.ts` behavior, sidecar work, the tool-dispatch timeout.
- Done when: tests and docs land in one change and `npm run check` plus the a2ui package tests exit 0.

## Context (verified on `origin/fix/anthropic-transport-retry` and `origin/fix/anthropic-sse-deadline`)
`anthropic.ts` on #1806: `fetchWithRetry` (about lines 363-407), `ANTHROPIC_RETRY_AFTER_CAP_MS = 10_000` (317), `ANTHROPIC_RETRY_BACKOFF_MS = [500, 1500]`, private `FirstByteTimeoutError` (356) and `isAbortError` (358); the catch (about 395) rethrows abort or first-byte errors unwrapped with no sleep; `Math.min(hinted, CAP)` at about 405. `anthropic-retry.test.ts` (8 cases) exists only on #1806, and #1806 contains #1805's commits: merge #1805 first. No case asserts the first-byte non-retry, the cap, or a `doFetch` AbortError. This ticket is blocked until both PRs are on main (the `depends` file entries are met when `anthropic-timeouts.test.ts` and `anthropic-retry.test.ts` exist on main); branch from main then.

## Constraints
No em dashes; do not export `FirstByteTimeoutError`; docs edits append-only for ADRs (proposed amendments never self-ratified).

## Scrub and upsert list
`.claude/docs/lld/a2ui-live-agent.lld.md` (about line 166: the row says the `fetch` arm has "no standing test, MANUAL live acceptance", now stale; about lines 390-398: the impure `stream` sketch needs the deadline, stall guard and `fetchWithRetry`; about line 134 module line); `.claude/docs/spec/a2ui-live-agent.spec.md` (no provider retry or deadline wording today: consider a non-functional requirement for bounded upstream waits, unverified whether warranted; SPEC-N5 at about line 1575 is unaffected); `.claude/docs/adr/0073-a2ui-live-model-provider-seam.md` (about line 99: append an amendment pointer for retry and deadline, proposed); `.claude/docs/adr/0146-live-turn-lifecycle-progress-channel.md` (check whether the `retry` progress stage wording must distinguish self-correct retry from transport retry, unverified); `.claude/docs/plan.md` or `roadmap.md` (any #1797 gap tracking, unverified). No skill, agent or AGENTS.md states "no retry" or "no deadline" (grep clean).

## Dependencies and conflicts
Blocked on #1805 then #1806. T-0003 (budget and trace) edits the same LLD and spec after this lands, or concurrently on separate sections: land this scrub first. Independent of gap (b) (`tool-dispatch.ts`). The LLD edit can be its own lane.

## Size and lane
S, `solo` lane (two small lanes: tests, docs).

## Acceptance outline
New tests fail when the guard is removed and pass otherwise; docs repaired in the same change; `npm run check` and a2ui package tests exit 0; docs-only parts gate on `doc_lint` plus `check`.

## Closed

2026-10-05: merged as #1821
