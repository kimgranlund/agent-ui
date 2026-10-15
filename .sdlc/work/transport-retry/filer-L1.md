<!-- role=filer level=L1 model=sonnet effort=medium -->
## Warnings
None

## PR title
Retry transient Anthropic upstream failures before streaming starts (GH #1797 gap d)

## PR body
### Summary
Gap (d) of GH #1797. The Anthropic provider made one `fetch` per round, so a 429 or 5xx at connection time failed the whole turn. The request is now retried a bounded number of times on transient failures. Tool execution is never retried.

### Changes
- `packages/agent-ui/a2ui/src/agent/providers/anthropic.ts`:
  - New block above `anthropicProvider` exporting `ANTHROPIC_MAX_RETRIES = 2`, `ANTHROPIC_RETRY_BACKOFF_MS = [500, 1500]`, `ANTHROPIC_RETRY_AFTER_CAP_MS = 10_000` and `fetchWithRetry(doFetch, opts)`. It has three private helpers: `abortableSleep`, `retryAfterMs`, `isAbortError`.
  - In `runRound`, the diff removes two lines. The `fetch(endpoint, {` opening line and its closing `})` now wrap the call in `fetchWithRetry(() => fetch(...), { signal })`. This keeps the merge small against `fix/anthropic-sse-deadline` (gap c), which edits the same function.
- `packages/agent-ui/a2ui/src/live-agent/anthropic-retry.test.ts`: new, 8 cases.

Behaviour:
- Retries on HTTP 429, 500, 502, 503, 504, 529 and on a thrown non-abort network error (a `TypeError`). Other 4xx, including 400, 401 and 403, are returned at once.
- A caller abort (aborted signal or `AbortError`) is rethrown at once, unwrapped, with no wait.
- At most 3 attempts. The delay is the base from `[500, 1500]` plus up to 20% jitter, with `random` and `sleep` injectable. `Retry-After` (seconds or HTTP-date) is honored and capped at 10 s. An unparseable `Retry-After` falls back to the jittered backoff.
- The sleep is abortable and leaves no timer behind.
- A discarded retryable response has its body cancelled before the wait.
- On exhaustion the last Response is returned unread, so the existing `anthropicProvider: upstream error <status>: <body>` throw fires unchanged. A network failure rethrows the original error.
- A healthy first attempt makes one `fetch` call with no added delay. Retry covers only the request up to the response, never the streamed body.
- The new exports reach the public `@agent-ui/a2ui/agent` API through the existing `export *` in `src/agent/index.ts`. No existing test was changed.

### Verification
- New file: 8 passed.
- Red then green: at base `38ed6721`, in a throwaway worktree, the new file gave 5 failed (retry 1, 2, 3, 5, 6) and 3 passed. Retry 4, 7 and 8 pin behaviour that already held.
- Mutant: adding 400 to the retryable set fails `retry 4` only. It was reverted.
- Verifier (independent) reproduced the base-red result and ran its own mutants. Removing `clearTimeout` fails retry 6, and allowing one extra attempt fails retry 3.
- Gates, by exit code:
  - `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent`: 0 (708 passed, 1 skipped).
  - `npx vitest run --project tools packages/agent-ui/a2ui/tools`: 0 (364 passed).
  - `npm run check`: 0.
- Diff touches only the two allowed files.

Needs Kim: confirm retries=2, backoff 500/1500 ms, Retry-After cap 10000 ms.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Changelog entry
- Anthropic provider: the upstream request is now retried up to 2 times (backoff 500/1500 ms with jitter, `Retry-After` honored up to 10 s) on HTTP 429, 500, 502, 503, 504, 529 and network errors. This happens only before streaming starts, is abortable, and leaves the existing error message unchanged on exhaustion. New exports: `fetchWithRetry`, `ANTHROPIC_MAX_RETRIES`, `ANTHROPIC_RETRY_BACKOFF_MS`, `ANTHROPIC_RETRY_AFTER_CAP_MS`.

## Follow-ups
- fix-now: Add tests for the `Retry-After` 10 s cap and for `doFetch` throwing an `AbortError`; the verifier's mutants that removed either behaviour went undetected.
- decide: Confirm the defaults (2 retries, 500/1500 ms backoff, 10000 ms `Retry-After` cap) in `anthropic.ts`; the builder flagged these as `Needs Kim`.
