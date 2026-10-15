<!-- role=builder level=L3 model=opus effort=high -->
## Status
done

## Changes
- `packages/agent-ui/a2ui/src/agent/providers/anthropic.ts`: added the exported constants `ANTHROPIC_FIRST_BYTE_TIMEOUT_MS = 60_000` and `ANTHROPIC_STALL_TIMEOUT_MS = 60_000`. Added a first-byte deadline using a local `AbortController` and a `setTimeout` that is cleared in a `finally` around `fetch`. Added a per-read stall guard (`readOrStall`) that replaces `await reader.read()`.
- `packages/agent-ui/a2ui/src/live-agent/anthropic-timeouts.test.ts` (new): 6 tests, which are a defaults check plus cases (1) to (5) from the Do.

## Checks
- `grep -qE '^export const ANTHROPIC_FIRST_BYTE_TIMEOUT_MS = 60_?000' ...anthropic.ts`: exit 0
- `grep -qE '^export const ANTHROPIC_STALL_TIMEOUT_MS = 60_?000' ...anthropic.ts`: exit 0
- `grep -q 'no response within' ... && grep -q 'stream stalled for' ...`: exit 0
- `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/anthropic-timeouts.test.ts --reporter=verbose`: exit 0. 6 passed: the defaults test and cases (1), (2), (3), (4), (5).
- (guard) `npm run check`: exit 0
- (guard) `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent`: exit 0 (41 files passed, 1 skipped; 706 tests passed, 1 skipped)
- (guard) `npx vitest run --project tools packages/agent-ui/a2ui/tools`: exit 0 (24 files, 364 tests passed)
- (guard) `git diff --quiet "$SDLC_BASE_SHA" -- <4 existing anthropic/provider test files>`: exit 0
- (guard) em-dash check on added lines in anthropic.ts: exit 0. The new test file also has 0 em dashes.
- (guard) stray-file check (only the two allowed paths changed outside `.sdlc`): exit 0

## Notes
- Needs Kim: confirm 60000 / 60000
- Red-then-green proof: I created a throwaway worktree at `$SDLC_BASE_SHA` with `git worktree add --detach "$SDLC_TMP_WORKTREES/base" "$SDLC_BASE_SHA"`, symlinked node_modules into it and copied in the new test file. Running the focused vitest command there gave 3 failed and 3 passed.
  - Red at base: the defaults test, case 1 and case 2. Cases 1 and 2 hit the 5 s vitest timeout, which is the hang this step fixes.
  - Green at base: cases 3, 4 and 5. That is expected because they are controls: a healthy stream with gaps, a caller abort passing through unchanged, and no leaked timers in a file that had no timers. They guard against regressions; they are not meant to be red at base.
  - I removed the worktree with `git worktree remove` and confirmed it is gone with `git worktree list`.
- Mutant proof: swapping `await readOrStall()` for a bare `await reader.read()` made case 2 fail (5 s timeout) while the other 5 passed. I restored the code (grep count of `await readOrStall()` = 1), and the final runs above are green.
- Design:
  - `AbortSignal.any([signal, deadline.signal])` is used only when the caller passes a signal; otherwise `fetch` gets `deadline.signal`, as the handoff specified.
  - A caller abort rethrows the original error, so it keeps the AbortError name; case 4 asserts this.
  - The stall error is thrown inside the existing `try`, so the existing `finally` cancels the reader. Case 2 asserts the source's `cancel` is called exactly once.
  - The `anthropicProvider(opts)` signature and its callers are unchanged, and no existing test was edited.
- Housekeeping outside the tree:
  - `npx prettier --check` ran on the two files and reported style differences. Prettier is not a repo dependency and the base `anthropic.ts` also fails that check, so I wrote nothing.
  - A backup copy of anthropic.ts briefly went to `/tmp/x/anthropic.ts` (an existing directory). I removed it after `cmp` showed it matched the working file.
