<!-- role=verifier level=L2 model=sonnet effort=high -->
## Verdict
pass

## Criteria
- Four test titles present in `anthropic-retry.test.ts`: pass. Evidence: the file exists and all four `grep -qF` calls returned 0.
- (guard) four-file vitest run (retry, timeouts, sse, tool-loop): pass. Evidence: 4 files and 32 tests passed. I ran the retry file alone in a detached worktree at HEAD with the new test file copied in, mutations reverted: 12 passed.
- LLD names `anthropic-retry.test.ts` and `fetchWithRetry`: pass. Evidence: both greps returned 0. The diff repairs the §2 row at line 166 and the `stream` sketch (three added comment lines), and the live-key leg is still described as manual.
- ADR-0073 names `fetchWithRetry`: pass. Evidence: grep returned 0. The diff is a pure append of an "Amendment (2026-10-05, proposed)" section with the four names, and the Status cell is untouched.
- (guard) no removed lines under `.claude/docs/adr`: pass. Evidence: the command returned 0 and the ADR diff is additions only.
- (guard) changed-file allowlist: pass. Evidence: the command returned 0. Changed files are the test, the LLD and ADR-0073, all on the allowlist.
- `grep -c 'Negative control' builder-L3.md`: pass. Evidence: the count is 4 and each of the four controls is named with its failing result.
- (guard) no em dash in added lines: pass. Evidence: the command returned 0, and `git diff -U0 HEAD -- .claude/docs | grep '^+' | grep -c '—'` printed 0.
- (guard) `doc_lint.py` on the LLD: pass. Evidence: exit 0.
- (guard) `npm run check`: pass. Evidence: exit 0.
- Negative controls bite (my own runs in a worktree at HEAD under `$SDLC_TMP_WORKTREES`, each mutation reverted before the next):
  - Removing `|| err instanceof FirstByteTimeoutError` from the `fetchWithRetry` catch fails `first-byte timeout is not retried` with `called 1 times, but got 2 times`.
  - Changing the `attempt` catch to `deadline.signal.aborted || signal?.aborted` fails `caller abort is rethrown unwrapped` with `expected Error: anthropicProvider: no response wit… to be Error: caller aborted`.
  - Changing `isAbortError`'s name test to `'Nope'` fails `doFetch AbortError is rethrown as the same object` with `expected true to be false`.
  - Replacing `Math.min(hinted, ANTHROPIC_RETRY_AFTER_CAP_MS)` with `hinted` fails `Retry-After above the cap sleeps the capped delay` with `called 2 times, but got 1 times`.
  - Each mutation gave exactly 1 failed and 11 passed, and the worktree was removed afterwards.
- Builder claims on the optional docs: pass.
  - `grep -n 1797 plan.md roadmap.md` returned nothing, so neither needs an edit.
  - ADR-0146 defines `retry` as the self-correct round ordinal (lines 86, 110 and 147), so no edit is needed.
  - The SPEC was left untouched, and the builder's reason (no NFR fits the new wording) is recorded in Notes.
- LLD wording matches the source: pass. `anthropic.ts:478` has the `stream stalled for … ms` message, and lines 285 and 315 define the stall timeout (60000) and `ANTHROPIC_MAX_RETRIES` (2).

## Out of scope changes
None. `git status` shows only the three in-scope files plus `.sdlc/`.

## For the next attempt
None. Steelman pass: I drafted a fail on the new tests lacking a blank line before the first added `it`. The builder's rebuttal would hold, because the handoff states no formatting criterion and `npm run check` is green, so I dropped it.
