<!-- role=builder level=L3 model=opus effort=high -->
## Status
done

## Changes
- `packages/agent-ui/a2ui/src/live-agent/anthropic-retry.test.ts`: four new cases plus a `neverAnsweringFetch` helper. The import line now also pulls in `ANTHROPIC_FIRST_BYTE_TIMEOUT_MS` and `ANTHROPIC_RETRY_AFTER_CAP_MS`. The eight existing cases are unchanged.
- `.claude/docs/lld/a2ui-live-agent.lld.md`:
  - The §2 discovery-table row for the `fetch` arm (line 166) now names `anthropic-timeouts.test.ts` and `anthropic-retry.test.ts`; the live-key leg stays manual.
  - The impure `stream` sketch's label now says stubbed-fetch tests, and the sketch gets one line each for the first-byte deadline, the stall guard and `fetchWithRetry`.
  - The prose after the sketch now says the same thing: tests gate the arm and only the live-key leg is manual.
- `.claude/docs/adr/0073-a2ui-live-model-provider-seam.md`: appended a `## Amendment (2026-10-05, **proposed**)` section covering the deadlines and the bounded retry. It names `fetchWithRetry`, `ANTHROPIC_MAX_RETRIES`, `ANTHROPIC_FIRST_BYTE_TIMEOUT_MS` and `ANTHROPIC_STALL_TIMEOUT_MS`. Append-only; the Status cell is untouched.

## Checks
- `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/anthropic-retry.test.ts` (main tree, before the controls): 12/12 passed, exit 0.
- Throwaway worktree: `git worktree add --detach "$SDLC_TMP_WORKTREES/base" HEAD`, then `node scripts/bootstrap-scratch-clone.mjs "$SDLC_TMP_WORKTREES/base"` (ok). Copied the new test file in. Unmutated run: 12/12 passed.
- Five mutation runs in the worktree, each `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/anthropic-retry.test.ts`: each gave 1 failed, 11 passed (details in Notes). After each run, `git checkout -- anthropic.ts` restored the file.
- Removed the worktree with `git worktree remove --force` and `git worktree prune` before the final gates. No builder worktree is left.
- C1, the four title greps: exit 0.
- (guard) Four-file vitest run (retry, timeouts, sse, tool-loop): 4 files, 32 tests passed, exit 0.
- C3, LLD greps for `anthropic-retry.test.ts` and `fetchWithRetry`: exit 0.
- C4, ADR-0073 grep for `fetchWithRetry`: exit 0.
- (guard) No removed lines under `.claude/docs/adr`: exit 0.
- (guard) Changed-file allowlist: exit 0.
- (guard) No em dash in added lines: exit 0.
- (guard) `doc_lint.py` on the LLD: exit 0 ("not a functional document"). It also exits 0 on ADR-0073.
- (guard) `npm run check`: exit 0.

## Notes
Negative control (first-byte timeout is not retried): in `fetchWithRetry`'s catch, `if (isAbortError(err, signal) || err instanceof FirstByteTimeoutError || last) throw err` became `if (isAbortError(err, signal) || last) throw err`. Result: `AssertionError: expected "vi.fn()" to be called 1 times, but got 2 times`, 1 failed / 11 passed.

Negative control (caller abort is rethrown unwrapped): in the provider's `attempt` catch, `if (deadline.signal.aborted && !signal?.aborted)` became `if (deadline.signal.aborted || signal?.aborted)`, which relabels a caller abort as a first-byte timeout. Result: `AssertionError: expected Error: anthropicProvider: no response wit… to be Error: caller aborted // Object.is equality`, 1 failed / 11 passed.

Negative control (doFetch AbortError is rethrown as the same object): in `isAbortError`, `.name === 'AbortError'` became `.name === 'NotAnAbortError'`. Result: `AssertionError: expected true to be false // Object.is equality` (the error was retried and the turn succeeded), 1 failed / 11 passed.

Negative control (Retry-After above the cap sleeps the capped delay): `Math.min(hinted, ANTHROPIC_RETRY_AFTER_CAP_MS)` became `hinted`. Result: `AssertionError: expected "vi.fn()" to be called 2 times, but got 1 times`, 1 failed / 11 passed.

Extra probe, not one of the four controls:
- Removing `isAbortError(err, signal) ||` from `fetchWithRetry`'s guard leaves `caller abort is rethrown unwrapped` green. `abortableSleep` rejects at once with `signal.reason` when the signal is already aborted, so the same object still comes out and no timer is set.
- The same mutation fails `doFetch AbortError is rethrown as the same object` (`expected true to be false`). So that guard is covered by the third test.
- The caller-abort test catches the relabel branch in `attempt` instead. A verifier trying the obvious guard-removal mutation on test 2 should expect it to stay green.

Other items the handoff asked about:
- **SPEC:** not edited; none of its existing NFRs fits. SPEC-N5 is about keeping SSE parsing in one module, not about bounding waits. A bounded-wait requirement would be a new SPEC-N6 row, which means bumping the accepted spec's version and changelog and changing the LLD's "SPEC-N1..N5" Implements line. That is more than a short note.
- **ADR-0146:** not edited. Its `retry` stage is defined as the self-correct round ordinal on a failed round. `fetchWithRetry` takes no `onEvent`, so a transport retry emits nothing on the progress channel and the two cannot be confused.
- **plan.md and roadmap.md:** neither mentions `1797`, so both are untouched.
- I left the LLD §2 module-map line for `providers/anthropic.ts` (about line 134) as it was. It is still accurate, and the handoff's Do list does not name it.
