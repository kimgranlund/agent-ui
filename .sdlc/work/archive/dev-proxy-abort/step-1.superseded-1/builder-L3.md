<!-- role=builder level=L3 model=opus effort=high -->
## Status
blocked

## Changes
- `packages/agent-ui/a2ui/tools/agent/dev-proxy-plugin.ts`: both arms now carry the abort wiring from Do 1-3. Each has a per-request `AbortController` and a guarded `res.on('close')` that aborts only when `!res.writableEnded`, and calls `buildToolDispatch(active, env, controller.signal)`. `/chat` passes `signal` into `provider.stream` and wraps the stream and response in a try/catch that returns silently when aborted. The produce arm passes `signal` into `produce()`, and its inner catch is guarded by `!controller.signal.aborted`. Both stale comments are rewritten. This change is left uncommitted in the tree.

## Checks
- `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent` with the change: exit 1. One failure: `chat-route.test.ts:205` "an ABSENT integrations field leaves the stream request byte-identical". The received keys include `signal`.
- Same test at `$SDLC_BASE_SHA`, run in the throwaway worktree `$SDLC_TMP_WORKTREES/base` (since removed): `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/chat-route.test.ts` exit 0, 18/18 passed. The red is caused by this step, so it is not inherited.
- The plugin-file grep criteria all exit 0:
  - `new AbortController()` appears at least twice.
  - `buildToolDispatch(active, env, controller.signal)` appears exactly twice.
  - The "AbortSignal exists on this Node route" text is gone.
  - No added line has an em dash.
- Not run because the step is blocked: the new test file criterion, the red-on-base criterion, the em-dash criterion on the test file, the untracked-files guard, `npx vitest run --project tools`, and `npm run check`.

## Notes
plan defect: guard `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent` contradicts Do 1 together with the changed-files guard. Do 1 requires `signal: controller.signal` in the `/chat` `provider.stream` request. `chat-route.test.ts:205` pins the exact request keys as `['effort','messages','model','system']`. The changed-files guard forbids editing `chat-route.test.ts`. These three cannot all hold.

- **Suggested repair:** let the step edit `chat-route.test.ts:205` to expect `['effort','messages','model','signal','system']`, and update its "pre-amendment shape" comment. Then add `packages/agent-ui/a2ui/src/live-agent/chat-route.test.ts` to the changed-files guard's allowlist. The Worker's `handleChat` already sends `signal` in the same request object, so the new key set matches the Worker.
- **Not viable:** making `signal` non-enumerable, or leaving it out of the `/chat` request. Either one breaks parity with the Worker and the goal of this step.
- **Em dash in a moved line:** the line `text += fragment // buffered server-side — single-shot ...` had to be re-indented inside the new `try`. That makes it an added line, so the em-dash guard would trip. I replaced its em dash with a comma. All other em dashes in the file are unchanged.
- **Test file not written:** `dev-proxy-abort.test.ts` was not created, because the plan has to change first.
- **Follow-up for the conductor:** the JSDoc at `tool-dispatch.ts:44-45` (`packages/agent-ui/a2ui/tools/agent/integrations/tool-dispatch.ts`) still says the dev proxy's Node route has no signal. That is now stale, and this step was not allowed to touch that file.
- **Throwaway worktree:** created and removed. None is left under `$SDLC_TMP_WORKTREES`.
