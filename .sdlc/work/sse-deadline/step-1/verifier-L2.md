<!-- role=verifier level=L2 model=sonnet effort=high -->
## Verdict
pass

## Criteria
- `grep -qE '^export const ANTHROPIC_FIRST_BYTE_TIMEOUT_MS = 60_?000' anthropic.ts`: pass. Evidence: exit 0, and the `anthropic.ts` diff adds `export const ANTHROPIC_FIRST_BYTE_TIMEOUT_MS = 60_000`.
- `grep -qE '^export const ANTHROPIC_STALL_TIMEOUT_MS = 60_?000' anthropic.ts`: pass. Evidence: exit 0, and the diff adds the matching constant.
- `grep -q 'no response within' … && grep -q 'stream stalled for' …`: pass. Evidence: exit 0, and both messages appear in the diff.
- `npx vitest run --project packages …/anthropic-timeouts.test.ts` exits 0 with at least 5 passing tests covering cases 1 to 5: pass. Evidence: exit 0, 6 passed (the defaults test plus cases 1 to 5, all named in the verbose output).
  - The check can go red. In a throwaway worktree at `$SDLC_BASE_SHA` with the new test file copied in, 3 failed and 3 passed: the defaults test and cases 1 and 2 failed (cases 1 and 2 hit the 5 s vitest timeout, which is the hang this step fixes).
  - Cases 3 to 5 are controls and pass at base, as expected. Case 3 (healthy stream with gaps), case 4 (caller abort not relabelled) and case 5 (no timers left over) guard against regressions.
  - The builder's mutant claim (bare `reader.read()` fails case 2) is plausible. I did not re-run it. Case 2 already fails at base, and the code reads `await readOrStall()`.
- (guard) `npm run check`: pass. Evidence: exit 0, ending "selftest: all green".
- (guard) `npx vitest run --project packages …/live-agent`: pass. Evidence: exit 0, 41 files passed and 1 skipped, 706 tests passed and 1 skipped.
- (guard) `npx vitest run --project tools …/a2ui/tools`: pass. Evidence: exit 0, 24 files and 364 tests passed.
- (guard) `git diff --quiet "$SDLC_BASE_SHA" -- <4 existing anthropic/provider tests>`: pass. Evidence: exit 0.
- (guard) no em dash on added `anthropic.ts` lines: pass. Evidence: the negated pipeline exits 0.
- (guard) only the two allowed files changed outside `.sdlc`: pass. Evidence: the pipeline exits 0, and `git status` shows only `anthropic.ts` modified and `anthropic-timeouts.test.ts` added, apart from `.sdlc/`.

I did not run the gate criteria at base. Every one of them is green on the built tree, so there was no failure to compare.

I read the diff against the Do's design points.
- The first-byte deadline uses a local `AbortController` and `AbortSignal.any` for the fetch only. The timer is cleared in a `finally` around the fetch, and a caller abort keeps its original error.
- The stall guard is a per-read race against a fresh timer cleared on every settle. The throw lands inside the existing `try`, so the reader is cancelled. Case 2 asserts `cancel` was called once and no timers are left.
- No fragment is buffered; each read's frames are still parsed and yielded in the same iteration.
- The request body, headers and the other listed paths are untouched in the diff.

## Out of scope changes
None. Besides `.sdlc/`, only `packages/agent-ui/a2ui/src/agent/providers/anthropic.ts` (modified) and `packages/agent-ui/a2ui/src/live-agent/anthropic-timeouts.test.ts` (new) changed. `git status` shows no other files.

## For the next attempt
None. The builder's note "Needs Kim: confirm 60000 / 60000" is a decision for the user, not a defect.
