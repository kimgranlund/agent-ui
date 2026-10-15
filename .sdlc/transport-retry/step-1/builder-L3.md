<!-- role=builder level=L3 model=opus effort=high -->
## Status
done

## Changes
- `packages/agent-ui/a2ui/src/agent/providers/anthropic.ts`: new block above `anthropicProvider` exporting `ANTHROPIC_MAX_RETRIES = 2`, `ANTHROPIC_RETRY_BACKOFF_MS = [500, 1500]`, `ANTHROPIC_RETRY_AFTER_CAP_MS = 10_000` and `fetchWithRetry`, plus three private helpers: `abortableSleep`, `retryAfterMs`, `isAbortError`. In `runRound`, only two lines changed: the opening `fetch(endpoint, {` line and its closing `})` line now wrap the call in `fetchWithRetry(() => fetch(...), { signal })`.
- `packages/agent-ui/a2ui/src/live-agent/anthropic-retry.test.ts`: new file with the 8 required cases, titles copied byte for byte.

## Checks
- `npx vitest run --project packages .../anthropic-retry.test.ts`: exit 0, 8 passed.
- Criterion 2 (verbose reporter plus the title loop): exit 0. Every title has a passing ✓ line.
- Criterion 3 (export greps): exit 0.
- Criterion 4 (`await fetchWithRetry(` present, at most 2 removed lines): exit 0. The diff removes exactly 2 lines.
- Criterion 5 (only the two allowed files changed outside `.sdlc`): exit 0.
- Criterion 6 (no new em dashes in either file): exit 0.
- Base red run, in a worktree from `git worktree add --detach "$SDLC_TMP_WORKTREES/base" HEAD` with HEAD = base 38ed6721 and the new test file copied in: `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/anthropic-retry.test.ts` gave 5 failed (retry 1, 2, 3, 5, 6) and 3 passed (retry 4, 7, 8).
- Mutant run with 400 added to the retryable set: 1 failed (`retry 4: a 400 and a 401 are not retried`), 7 passed. Reverted afterwards.
- (guard) `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent`: exit 0, 708 passed, 1 skipped, 41 files.
- (guard) `npx vitest run --project tools packages/agent-ui/a2ui/tools`: exit 0, 364 passed, 24 files.
- (guard) `npm run check`: exit 0.

## Notes
Needs Kim: confirm retries=2, backoff 500/1500 ms, Retry-After cap 10000 ms

- **Red-then-green at base:**
  - The worktree was created with `git worktree add --detach "$SDLC_TMP_WORKTREES/base" HEAD`, with `node_modules` symlinked in. The new test file failed there: 5 failed, 3 passed.
  - The test file imports only `anthropicProvider`, so missing exports are not why it fails at base, despite what Do 5.2 says. The failing retry cases (1, 2, 3, 5, 6) are the cause.
  - Cases 4, 7 and 8 pass at base by design. They pin behaviour that already held: no retry on a 4xx, one call on a healthy 200, and a mid-stream body error surfaced.
- **Mutant:** I ran `sed -i '' 's/new Set(\[429, 500/new Set([400, 429, 500/'` on `anthropic.ts`, and only `retry 4` failed. I then restored the file from a backup copy, and `grep -c "new Set(\[400"` returned 0.
- **Worktree cleanup:** I removed it with `git worktree remove --force`. `git worktree list` shows no entry under the tmp prefix.
- **Behaviour of `fetchWithRetry`:**
  - A discarded retryable response's body is cancelled before the wait (`await res.body?.cancel().catch(() => {})`).
  - An abort (`signal.aborted` or `name === 'AbortError'`) is rethrown at once, unwrapped and with no wait.
  - The default sleep rejects at once with `signal.reason` if the signal is already aborted. Otherwise an abort clears its timer, the listener is registered with `{ once: true }`, and the timer callback removes the listener when it fires.
  - When retries run out, it returns the last Response with its body unread, so `runRound`'s existing `upstream error <status>: <body>` throw fires unchanged.
- **Unparseable `Retry-After`:** a header that is neither whole seconds nor an HTTP-date falls back to the jittered backoff. The handoff did not specify this case.
- **Public API:** `ANTHROPIC_MAX_RETRIES`, `ANTHROPIC_RETRY_BACKOFF_MS`, `ANTHROPIC_RETRY_AFTER_CAP_MS` and `fetchWithRetry` are now exported from `@agent-ui/a2ui/agent` through `export * from './providers/anthropic.ts'`, as the handoff expected.
- **Formatting:** I ran no formatter on `anthropic.ts`. The call-site shape is deliberate, because it keeps the diff at 2 removed lines.
- **Existing tests:** none were changed.
