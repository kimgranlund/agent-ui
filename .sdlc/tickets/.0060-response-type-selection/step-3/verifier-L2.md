<!-- role=verifier level=L2 model=sonnet effort=high -->
## Verdict
pass

## Criteria
- (red) new test file, full run: pass. Evidence: `npx vitest run --project packages --maxWorkers=4 .../anthropic-terminal-tool.test.ts` exit 0, 8 passed. Bites: the same file copied into a throwaway worktree at f7ff6c64 (old adapter) fails 4 of 8 (tool_choice, stream carries toolChoice, terminal round live text, terminal call ends loop). red-checkpoint.jsonl holds 4 pre-edit red controls and an audit status ok; no process-deviations.md.
- (red) `-t "terminal round"` greps `Tests +[1-9][0-9]* passed`: pass. Evidence: exit 0, "Tests 2 passed | 6 skipped (8)"; red at base per red-checkpoint and the base-worktree run above.
- (red) buildRequestBody tool_choice node check: pass. Evidence: exit 0 (effort absent and `low` give `{type:'tool',name:'render_surface'}`, `high` gives none).
- (red) grep for `terminalTools?: readonly string[]` and `toolChoice?: { name: string }` in agent-transport.ts: pass. Evidence: exit 0; the diff shows both fields at agent-transport.ts with additive/ignorable docs.
- (guard) `anthropic-` vitest set: pass. Evidence: exit 0, 8 files, 75 tests. Also ran the other `providers/anthropic` dependents (build-key-safety, dev-proxy-abort, turn-deadline): exit 0, 25 tests passed.
- (guard) eval-agent-behavior selftest and testkit kit selftest: pass. Evidence: both exit 0.
- (guard) scope loop against the base sha: pass. Evidence: exit 0, only the three named files changed (`git diff --stat f7ff6c64 HEAD`: agent-transport.ts, providers/anthropic.ts, anthropic-terminal-tool.test.ts).
- Extra, regression of existing paths: pass. Evidence: `buildRequestBody` for 4 effort values x {tools, no tools} without `toolChoice` hashes identically at base and HEAD (sha 97cd405a...); `toolChoice` is read only after `buildArmBody` returns, so no-toolChoice output is the unchanged arm body. The `!useTools` path is untouched. `npx tsc --noEmit -p .` exit 0.
- Extra, terminal-only round yields text before the executor: pass. Evidence: test `terminal round` logs `['frag:Here is ','frag:your card.','chunk2','chunk3','exec']` (timer-delayed SSE chunks); anthropic.ts terminal-only branch does `yield* runRound(...)` then `execute(call)`, one request. Mutation control: in a throwaway HEAD copy, flushing mixed-round text before execute, and dropping the `stop_reason === 'tool_use'` guard, reddened "a terminal call ends the loop" (1 failed, 7 passed). Input is read from `collector.calls[n].inputJson` after the round stream ends (test splits the JSON mid-escape).

## Out of scope changes
None.

## For the next attempt
None
