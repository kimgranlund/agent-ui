<!-- role=builder level=L3 model=opus effort=high -->
## Status
done

## Changes
- `packages/agent-ui/a2ui/tools/agent/dev-proxy-plugin.ts`: the edit was already in the tree when the build started. Per handoff item 1, this run did not touch it.
- `packages/agent-ui/a2ui/src/live-agent/chat-route.test.ts`: changed lines 204-205 only. The comment was rewritten without an em dash, and the key pin now includes `'signal'`.
- `packages/agent-ui/a2ui/tools/agent/integrations/tool-dispatch.ts`: changed JSDoc lines 44-45 only. No code changed.
- `packages/agent-ui/a2ui/src/live-agent/dev-proxy-abort.test.ts`: new file. It has 4 tests: two disconnect tests (`/chat` and produce) and two negative controls.

## Checks
1. `npx vitest run --project packages .../dev-proxy-abort.test.ts` (criterion 1): exit 0, `Tests 4 passed (4)`.
2. Base red check (criterion 2), run as written: exit 0, `Tests 2 failed | 2 skipped (4)`. Both failures are assertions: `expected undefined to be an instance of AbortSignal`.
3. Mutant negative-control check (criterion 3), run as written: exit 0, `Tests 2 failed | 2 skipped (4)`. Both failures are `expected true to be false`.
4. chat-route key pin and `executeTool` greps (criterion 4): exit 0.
5. tool-dispatch `GH #1797` grep, with the old phrase gone (criterion 5): exit 0.
6. (guard) tool-dispatch diff touches comment lines only (criterion 6): exit 0.
7. `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent` (criterion 7): exit 0, `Tests 704 passed | 1 skipped (705)`.
8. (guard) plugin structure greps (criterion 8): exit 0.
9. No em dash in the new file or in added diff lines (criterion 9): exit 0.
10. (guard) changed-file set (criterion 10): exit 0.
11. (guard) `npx vitest run --project tools` (criterion 11): exit 0, `Tests 366 passed (366)`.
12. (guard) `npm run check` (criterion 12): exit 0, ends with `selftest: all green`.

I ran criteria 2 and 3 verbatim as plain Bash tool commands, with no wrapper and no `cd` prefix. The shell's working directory was already this worktree, so `$PWD/node_modules` pointed to the right place.

## Notes
- I removed both throwaway worktrees (`abort-base`, `abort-mutant`) with `git worktree remove --force` after the runs. Criteria 2 and 3 recreate them, so a verifier rerun works.
- The live-agent folder went from the handoff's 699 passed / 1 failed to 704 passed. The C:205 pin now passes, and the 4 new tests are added.
- I did not touch `.sdlc/` and ran no formatter or `--fix` tool.
- The new test proves the abort through a fake `res` `close` event. A real Vite/Node socket close still needs manual acceptance, as the handoff says in item 5.
