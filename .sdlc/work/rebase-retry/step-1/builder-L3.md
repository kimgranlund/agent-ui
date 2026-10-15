<!-- role=builder level=L3 model=opus effort=high -->
## Status
done

## Changes
- `packages/agent-ui/a2ui/src/agent/providers/anthropic.ts`: resolved the rebase conflict in `runRound`. Each attempt now arms its own first-byte deadline: a fresh `AbortController` and timer around the single `fetch`, and `fetchWithRetry(attempt, { signal })` wraps that per-attempt closure. Added a module-private `class FirstByteTimeoutError extends Error {}`. `fetchWithRetry`'s catch rethrows it without retrying (`|| err instanceof FirstByteTimeoutError`). The stall guard on the body read is unchanged and sits outside the retry.
- `packages/agent-ui/a2ui/src/live-agent/anthropic-retry.test.ts`: the rebase carried it over byte-identical to `origin/fix/anthropic-transport-retry`. It needed no changes.

## Checks
- `git merge-base --is-ancestor origin/fix/anthropic-sse-deadline HEAD`: exit 0
- grep for `ANTHROPIC_FIRST_BYTE_TIMEOUT_MS` / `ANTHROPIC_STALL_TIMEOUT_MS` / `fetchWithRetry` / `ANTHROPIC_MAX_RETRIES` in anthropic.ts: exit 0
- No conflict markers in anthropic.ts: exit 0
- (guard) `git diff --quiet origin/fix/anthropic-sse-deadline HEAD -- .../anthropic-timeouts.test.ts`: exit 0
- (guard) diff vs `origin/fix/anthropic-sse-deadline` limited to the two allowed files: exit 0
- (guard) `git status --porcelain -- . ':(exclude).sdlc'` empty: exit 0, checked again after `npm run check`
- (guard) `npx vitest run --project packages` on the 4 anthropic test files: exit 0 (4 files, 28 tests passed)
- (guard) `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent`: exit 0 (42 passed, 1 skipped; 714 tests passed, 1 skipped)
- (guard) `npx vitest run --project tools packages/agent-ui/a2ui/tools`: exit 0 (24 files, 364 tests passed)
- (guard) `npm run check`: exit 0
- Throwaway probe `live-agent/zz-tmp-probe.test.ts`: exit 0, then deleted. A hanging fetch with 200 s of fake time rejects with `no response within 60000 ms`, fetch is called once, and no timers remain.

## Notes
- `git rebase --continue` rewrote the retry commit: `a5410f68` is now `b023bf52` on local `rebase/transport-retry`, on top of `747b7c15`. This was required: the step's Do says to rebase and criterion 1 needs the new ancestry. Nothing was pushed and no PR was touched. `.sdlc/` was not modified.
- The message `anthropicProvider: no response within <n> ms` is unchanged; only its error class is new. A caller abort still goes through `isAbortError` and is rethrown as is, never relabelled. On the healthy path, `fetch` runs once and every timer is cleared (retry test 7 and timeouts test 5 confirm this).
- No committed test covers "a first-byte timeout is not retried". I checked it only with the deleted probe above. Adding that test was out of this step's scope, so the planner may want a follow-up step for it.
