## Goal
Rebase the transport-retry change (GH #1797 gap d, PR #1806) onto the first-byte-deadline and stall-guard change (gap c, PR #1805), resolving the one conflict in `packages/agent-ui/a2ui/src/agent/providers/anthropic.ts`, keeping BOTH features.

## Context
Branch `rebase/transport-retry` (local) points at `origin/fix/anthropic-transport-retry` (one commit: `fetchWithRetry` helper, `ANTHROPIC_MAX_RETRIES`, `ANTHROPIC_RETRY_BACKOFF_MS`, `ANTHROPIC_RETRY_AFTER_CAP_MS`, new `anthropic-retry.test.ts`). `origin/fix/anthropic-sse-deadline` has one commit adding `ANTHROPIC_FIRST_BYTE_TIMEOUT_MS`, `ANTHROPIC_STALL_TIMEOUT_MS`, a first-byte `AbortController` around the `fetch` in `runRound`, a stall guard on `reader.read()`, and `anthropic-timeouts.test.ts`. Both edit `runRound`. `git merge-tree origin/fix/anthropic-sse-deadline origin/fix/anthropic-transport-retry` reports a content conflict in `anthropic.ts` only.
Read both commits first (`git show origin/fix/anthropic-sse-deadline`, `git show origin/fix/anthropic-transport-retry`).

Design for the combination (follow it; if it is impossible, stop and say so in Notes):
- Each attempt is a full request: the first-byte deadline applies PER ATTEMPT (a fresh `AbortController` and timer per `fetch` call), so the deadline wraps the single `fetch(...)`, and `fetchWithRetry` wraps that per-attempt function.
- A first-byte timeout error is NOT retried (it already waited its full limit) and keeps the message `anthropicProvider: no response within <n> ms`. A caller abort is rethrown at once, unwrapped, never relabelled. The stall guard stays on the body read and is never retried (retry applies only before the response body is consumed).
- Healthy path unchanged: one `fetch`, no added delay.

## Constraints
- Do it as a rebase onto `origin/fix/anthropic-sse-deadline` (`git rebase origin/fix/anthropic-sse-deadline`), resolve the conflict by hand, `git rebase --continue`. Do NOT push, do not open or edit PRs, do not force anything remote: the conductor publishes. Leave the result as the rebased local branch `rebase/transport-retry` with a clean tree.
- Files that may differ from `origin/fix/anthropic-sse-deadline` afterwards: `packages/agent-ui/a2ui/src/agent/providers/anthropic.ts` and `packages/agent-ui/a2ui/src/live-agent/anthropic-retry.test.ts` ONLY. If the retry tests need an adjustment to pass with the deadline in place, make it minimal and list it in Notes; the timeouts test file must stay byte-identical.
- No conflict markers may remain. No em dashes in lines you add. Do not touch `.sdlc/`.
- Gates: `npm run check`, `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent`, `npx vitest run --project tools packages/agent-ui/a2ui/tools` all exit 0.
