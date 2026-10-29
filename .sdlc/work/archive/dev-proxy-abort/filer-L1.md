<!-- role=filer level=L1 model=sonnet effort=medium -->
## Warnings
None

## PR title
Abort dev-proxy turns when the browser disconnects (GH #1797, gap a)

## PR body
### Summary
The Node dev proxy now aborts a turn when the browser disconnects mid-turn. The provider stream and in-flight tool calls are cancelled, as the production Worker already does with `request.signal`. This covers gap (a) of GH #1797 only.

### Changes
- `packages/agent-ui/a2ui/tools/agent/dev-proxy-plugin.ts`:
  - Both the `/chat` arm and the produce arm create one `AbortController` per request.
  - A guarded `res.on('close')` aborts only when `!res.writableEnded`, so a completed response never aborts.
  - The signal goes to `buildToolDispatch(active, env, controller.signal)`, to `provider.stream` on `/chat`, and to `produce(..., { signal })`.
  - `/chat` has a try/catch that stays quiet once the signal is aborted. The produce arm's inner catch is guarded with `!controller.signal.aborted`.
  - The two stale "no AbortSignal" comments are replaced.
- `packages/agent-ui/a2ui/src/live-agent/chat-route.test.ts`: the request-key pin at line 205 now includes `signal`. This follows from the Worker's `handleChat` already sending `signal`. The test still asserts that no integrations means no `tools`/`executeTool` keys.
- `packages/agent-ui/a2ui/tools/agent/integrations/tool-dispatch.ts`: JSDoc only (lines 44-45). It no longer says the Node route has no signal. No code changed.
- `packages/agent-ui/a2ui/src/live-agent/dev-proxy-abort.test.ts` (new): 4 tests. There is a disconnect test and a negative control for each of the `/chat` and produce arms.

No change to the Worker, `produce.ts`, `anthropic.ts`, or any prompt or baseline file. No new dependency and no ADR.

### Verification
The verifier passed all 12 criteria. All commands exited 0 and the verifier reran them.
- The new test file: `Tests 4 passed (4)`.
- **Red on base:** I ran the new test in a throwaway worktree at the base SHA. `Tests 2 failed | 2 skipped (4)`, both with `expected undefined to be an instance of AbortSignal`. These are assertion failures, not load errors.
- **Negative control:** with the `writableEnded` guard removed by a `perl` mutation, `Tests 2 failed | 2 skipped (4)`, both with `expected true to be false`. That shows the guard is what keeps a normal completion from aborting.
- `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent`: `704 passed | 1 skipped (705)`.
- `npx vitest run --project tools`: `366 passed (366)`.
- `npm run check`: exit 0, ends with `selftest: all green`.
- The changed-file set is limited to the four allowed files. There are no em dashes in the added lines.

The abort is proven through a fake `res` `close` event, not a real Vite/Node socket close.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Changelog entry
Dev proxy: closing the browser connection mid-turn now aborts the upstream provider stream and in-flight tool calls, matching the production Worker (GH #1797, gap a).

## Follow-ups
- note: The abort is tested with a fake `res` `close` event; a real Vite/Node socket close still needs manual acceptance.
- note: GH #1797 gaps (b) to (d) are untouched by this task, which covers only gap (a).
