<!-- role=builder level=L3 model=opus effort=high -->
## Status
blocked

## Changes
None

## Checks
- `for f in anthropic-timeouts anthropic-retry; do test -f "packages/agent-ui/a2ui/src/live-agent/$f.test.ts" ...; done`: both files are missing from the worktree (MISSING anthropic-timeouts, MISSING anthropic-retry).
- `git ls-tree -r --name-only HEAD packages/agent-ui/a2ui/src/live-agent | grep -E "anthropic-(timeouts|retry)"`: no match (exit 1). HEAD is `f348f2bb` on `feat/context-budget-trace`, which is the same commit as `SDLC_BASE_SHA` and local `main`.
- `git ls-tree -r --name-only origin/main ...`: both `anthropic-retry.test.ts` and `anthropic-timeouts.test.ts` are on origin/main, whose tip is `afa231ae` and includes `c549abba` (#1806).

## Notes
Blocked on dependency: PRs #1805/#1806 have not been synced into the lane. The handoff's Do step 1 says to stop here in that case.

- The lane branch and local `main` both sit at `f348f2bb`, which is before #1805, #1806 and #1819.
- To unblock, resync the lane with `origin/main` first. Then re-run step 3, because its `runRound` changes must be built on top of #1805's `readOrStall` and first-byte deadline and #1806's `fetchWithRetry`. Neither is in the current `anthropic.ts`.
- After the resync, `SDLC_BASE_SHA` for this step should move to the resynced commit, or the scope-guard diff will pick up the merged upstream files.
- I made no edits. The uncommitted step 1/2 work already in the tree is untouched.
