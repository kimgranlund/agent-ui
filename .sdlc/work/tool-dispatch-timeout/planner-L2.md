<!-- role=planner level=L2 model=opus effort=medium -->
## Goal
Give `buildToolDispatch`'s `executeTool` a 30 s per-call deadline (`TOOL_CALL_TIMEOUT_MS`) that cancels cooperative executors through `ctx.signal` and rejects non-cooperative ones with a named `Error`, so no tool call can hang a turn (GH #1797 gap b).

## Step 1: Per-call tool deadline in the shared dispatch, tests, gates green
level: L3
guard timeout: 120
### Do
Depends on: none.

**Implementation target.** `packages/agent-ui/a2ui/tools/agent/integrations/tool-dispatch.ts`, inside `buildToolDispatch`'s `executeTool` (lines 57-68 today). The `{}` return for zero manifests at line 55 stays exactly as it is.

**Constant.**
- Add `export const TOOL_CALL_TIMEOUT_MS = 30_000` at the top level.
- Write a doc comment saying it is a backstop above the inner 10 s bounds, not a replacement for them. The inner bounds are `FETCH_TIMEOUT_MS` in `integrations/fetch-json.ts` and `DEFAULT_TIMEOUT_MS` in `integrations/mcp/client.ts`.
- Do not touch those inner timeouts, and do not wrap them.
- Do not add `TOOL_CALL_TIMEOUT_MS` to `integrations/index.ts`. That file is outside the allowed scope, and tests import the constant from `tool-dispatch.ts` directly.

**Deadline mechanism.** Use one `AbortController` named `deadline` and a global `setTimeout(..., TOOL_CALL_TIMEOUT_MS)`. Do not use `AbortSignal.timeout`.
- Why: there is then a single timer to clear, `vi.useFakeTimers()` drives it, and the handoff explicitly allows the cleared-`setTimeout` form.
- Build the per-call `outer` signal as `callSignal ?? signal`, the existing precedence.
- Set `ctx.signal = outer ? AbortSignal.any([deadline.signal, outer]) : deadline.signal`. This covers the case where both signals are absent: the executor gets the deadline signal alone, never `undefined`.
- When the timer fires, build `err = new Error(`${name}: tool call timed out after ${TOOL_CALL_TIMEOUT_MS} ms`)`. Call `deadline.abort(err)` and reject the race with that same `err`, so the cooperative and non-cooperative paths carry the same message.
- Race `match.execute(input, ctx)` against the deadline promise.
- Clear the timer in a `finally` once the race settles, so no timer leaks.
- Attach a no-op `.catch(() => {})` to the executor promise. Otherwise an executor that rejects after the timeout raises an unhandled rejection, which fails the vitest run.

**Outer abort first.** Keep the current behaviour: the call rejects with the executor's own abort error. Never relabel it as a timeout. This holds because the executor's own rejection wins the race and the timer is then cleared.

**Order of checks.** The unknown-tool and invalid-input throws stay before the timer is armed, so they create no timer.

**Header comment.** Add a fourth bullet to the "Three behaviours" header and update the count. The bullet says the per-call deadline is a backstop and that its rejection travels the existing GH #49 `is_error` path. New lines must contain no em dashes.

**Contract dependent: `packages/agent-ui/a2ui/tools/agent/integrations/tool-dispatch.test.ts`.** The composed signal breaks five identity assertions in this file: lines 109 (`toBeUndefined()`), 154, 190, 193 and 201 (`toBe(turn.signal)` / `toBe(perCall.signal)`). Rewrite them from identity checks to behaviour checks:
- Line 109: `ctx.signal` is an `AbortSignal` and `.aborted === false`.
- Lines 154, 190, 193 and 201: aborting the expected source controller flips `ctx.signal.aborted` to `true`. Aborting the non-preferred controller does not flip it. This covers the priority test at lines 183-194: a per-call signal wins, and the turn signal is only the fallback.

Leave every other test in the file unchanged. This file is outside the handoff's file list; see `unresolved:` under Assumptions.

**Other dependents, intentionally left untouched.**
- `mcp/map-tool.test.ts:266-274` calls `manifest.execute` directly, not through the dispatch, so its `toEqual({signal, ...})` is unaffected.
- `mcp-enablement.test.ts:260` asserts `{}` for an empty set, and that contract is unchanged.
- `chat-route.test.ts:237` pins the call text `buildToolDispatch(active, hostEnv, request.signal)`, and the signature is unchanged.
- Do not touch `anthropic.ts`, `produce.ts`, `dev-proxy-plugin.ts`, the Worker, prompts, baselines, `index.ts` or docs.
- If SPEC-R17/R18 or LLD-C4 says the dispatch has no deadline, report that as a follow-up in builder Notes instead of editing it. A grep of `a2ui-live-agent.spec.md` for "deadline" found none.

**New test file: `packages/agent-ui/a2ui/src/live-agent/tool-dispatch-timeout.test.ts`.**
- First line: `// @vitest-environment node`. The code runs in Node and Worker hosts, and this keeps the test's controllers and the module's `AbortSignal.any` in one realm under fake timers.
- Import `buildToolDispatch` and `TOOL_CALL_TIMEOUT_MS` from `../../tools/agent/integrations/tool-dispatch.ts`. The precedent is `mcp-enablement.test.ts:31`, which imports from `../../tools/agent/...`.
- Use `vi.useFakeTimers()` with the real constant, and restore real timers in `afterEach`.
- Build the stub manifests the way `tool-dispatch.test.ts:19-46` does.

Five tests:
1. A never-settling executor that ignores the signal rejects after `vi.advanceTimersByTimeAsync(TOOL_CALL_TIMEOUT_MS)`. The message contains the tool name and `tool call timed out after 30000 ms`. It has not rejected at `TOOL_CALL_TIMEOUT_MS - 1`.
2. A cooperative executor sees `ctx.signal.aborted === true` at the deadline, and `ctx.signal.reason` is the same named Error.
3. A fast executor resolves, and afterwards `vi.getTimerCount() === 0`. This is the negative control.
4. A cooperative executor rejects with its own error (for example `new Error('aborted by turn')`) when `ctx.signal` aborts. Aborting the outer turn signal before the deadline rejects the call with that error. Its message does not contain `timed out`, and `vi.getTimerCount() === 0` afterwards.
5. `buildToolDispatch([], {})` still returns `{}`.

**Proof the tests bite (builder Notes, not criteria).**
- Red on the base: copy the new test into a base worktree created with the literal `git worktree add --detach "$SDLC_TMP_WORKTREES/base" HEAD`, run it with `--project packages` from that worktree, and record the failure. Remove the worktree afterwards.
- One mutant: remove the race, keep only the signal, and show that test 1 fails. Restore the race.

**Gates.** Run `npm run check`, the `packages` live-agent suite and the `tools` suite, all by exit code.

### Acceptance criteria
- `grep -qE '^export const TOOL_CALL_TIMEOUT_MS = 30_000' packages/agent-ui/a2ui/tools/agent/integrations/tool-dispatch.ts`
- `grep -qF 'tool call timed out after' packages/agent-ui/a2ui/tools/agent/integrations/tool-dispatch.ts`
- `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/tool-dispatch-timeout.test.ts` exits 0 and reports 5 or more passing tests.
- `! grep -nE 'ctx\.signal\)\.toBe\((turn|perCall)\.signal\)' packages/agent-ui/a2ui/tools/agent/integrations/tool-dispatch.test.ts`
- `test -f packages/agent-ui/a2ui/src/live-agent/tool-dispatch-timeout.test.ts && ! grep -q '—' packages/agent-ui/a2ui/src/live-agent/tool-dispatch-timeout.test.ts`
- (guard) `! git diff "$SDLC_BASE_SHA" -- packages/agent-ui/a2ui/tools/agent/integrations/tool-dispatch.ts packages/agent-ui/a2ui/tools/agent/integrations/tool-dispatch.test.ts | grep '^+' | grep -q '—'`
- `test -z "$(git diff --name-only "$SDLC_BASE_SHA" -- . ':(exclude).sdlc' | grep -vxF -e packages/agent-ui/a2ui/tools/agent/integrations/tool-dispatch.ts -e packages/agent-ui/a2ui/tools/agent/integrations/tool-dispatch.test.ts)"`
- `test -z "$(git ls-files --others --exclude-standard -- . ':(exclude).sdlc' | grep -vxF packages/agent-ui/a2ui/src/live-agent/tool-dispatch-timeout.test.ts)"`
- (guard) `npx vitest run --project tools packages/agent-ui/a2ui/tools`
- (guard) `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent`
- (guard) `npm run check`

## Assumptions
- unresolved: scope widening to `tool-dispatch.test.ts`. The handoff demands three things at once:
  - `ctx.signal = AbortSignal.any([...])`.
  - Changes limited to `tool-dispatch.ts` plus the new test file.
  - A green `npx vitest run --project tools packages/agent-ui/a2ui/tools`.

  No implementation meets all three. `tool-dispatch.test.ts` lines 109, 154, 190, 193 and 201 assert `ctx.signal` by identity or as `undefined`, so any composed signal turns them red. The handoff says to report a real design question rather than guess. Two ways to settle it:
  - (recommended) The conductor widens the file list to include `tool-dispatch.test.ts`, and those five assertions are rewritten as abort-behaviour checks, as the step's Do describes.
  - Relax the composed-signal requirement: race only, `ctx.signal` keeps its identity, and test 2 is dropped. Cooperative executors would then not be cancelled at the deadline.
- The current dispatch has no deadline and passes `callSignal ?? signal` straight through: verified at `tool-dispatch.ts:66-67`.
- The adapter turns a thrown executor into an `is_error` result: verified at `anthropic.ts:409,427`.
- The `tools` project runs `integrations/*.test.ts`, and the `packages` project runs `src/**/*.test.ts`: verified at `vitest.config.ts:34-36,106-111`.
- `AbortSignal.any` is available: Node v24.9.0 (`node --version`), and jsdom 29.1.1 also has it (`AbortSignal-impl.js:44`).
- Gate timings: `npm run check` exits 0 in 30 s, the live-agent suite in 8 s, and the tools suite in 6 s, all measured at plan time. A 120 s guard timeout covers each.
- No non-root `AGENTS.md` governs the changed files: verified by `find packages site -name AGENTS.md` (no output).
- Red probes at HEAD:
  - The constant grep exits 1, so it is red because the behaviour is missing.
  - The new-test vitest run exits 1 with "No test files found".
  - The identity-assert grep currently matches, so its negation is red.
  - The scope checks are green.

## Risks
- Under `vi.useFakeTimers()`, promise interleaving can let the race settle in the wrong order unless the tests use `advanceTimersByTimeAsync`. The Do prescribes that.
- If the user picks the relax option, the Do's signal composition, test 2, and the dependent-test rewrite all have to change in a replan.
- If `AbortSignal.any` keeps its source listeners after the call ends, a long-lived turn signal could slowly accumulate them. This is not measured by this step.
