## Task goal
When the browser disconnects from the Node dev proxy mid-turn, the turn is aborted: the upstream provider stream and in-flight tool calls are cancelled, as the production Worker already does with `request.signal`. Tracks GH #1797, gap (a) of (a) to (d); this task is only (a).

## Step 1: Thread a per-request AbortController through both dev-proxy turn paths, with a red-then-green test
level: L3
guard timeout: 150
### Do
Depends on: none.

Implementation target: `packages/agent-ui/a2ui/tools/agent/dev-proxy-plugin.ts`, inside the `server.middlewares.use(MOUNT, ...)` handler of `a2uiDevProxyPlugin`.

1. In the `/chat` arm (base lines 330-344), immediately before `const active = resolveIntegrations(chatIntegrations, env)`, add the abort wiring:
   - Add `const controller = new AbortController()`.
   - Register `res.on('close', () => { if (!res.writableEnded) controller.abort() })`. The `writableEnded` check stops a normal completion from aborting: `sendJson` calls `res.end`, so a later `close` leaves the signal unaborted.
   - Change the dispatch call to `const toolOpts = buildToolDispatch(active, env, controller.signal)`. The third parameter already exists as the optional turn-level fallback: `tool-dispatch.ts:53` and `:66` (`callSignal ?? signal`).
   - Pass `signal: controller.signal` in the `provider.stream({ ... })` request object. `AgentProvider.stream` accepts `signal?: AbortSignal` (`src/agent/agent-transport.ts:162`). The Worker does the same at `tools/agent/worker/index.ts:194,204`.
   - Wrap the `for await` stream loop and the `sendJson(res, 200, { text })` in `try { ... } catch (err) { if (controller.signal.aborted) return; throw err }`. An aborted turn then writes nothing to the closed response and never reaches the outer catch's `sendJson(res, 500, ...)`. Any other error still reaches the outer catch unchanged.
2. In the produce arm (base lines 399-469), add the same `const controller = new AbortController()` and the same `res.on('close', ...)` listener before `const active = resolveIntegrations(integrations, env)`. Then:
   - Change the dispatch call to `const toolOpts = buildToolDispatch(active, env, controller.signal)`.
   - Add `signal: controller.signal` to the `produce(input, deps, { maxRounds: 3, ... })` options object. `ProduceOpts.signal` exists at `produce.ts:101` and is forwarded to the provider at `produce.ts:1059`. The Worker passes it at `worker/index.ts:296`.
   - Change the inner catch's guard from `if (!res.destroyed)` to `if (!res.destroyed && !controller.signal.aborted)`. The trailing `res.end()` stays as it is.
3. Rewrite the two stale comments. In each, remove the text stating that no turn-level AbortSignal exists on this Node route (base lines 335-336 and 404-407). Replace it with a statement that a per-request `AbortController`, aborted on `res` `close` before `writableEnded`, is this route's turn-level signal: the twin of the Worker's `request.signal`, threaded into `buildToolDispatch` and the provider (or `produce`). Use no em dashes in any added line. Other em dashes already in the file stay as they are.
4. New test file: `packages/agent-ui/a2ui/src/live-agent/dev-proxy-abort.test.ts`. A new sibling file is used instead of extending `chat-route.test.ts` because that file's `vi.mock` stub yields at once and its fake `res` has no events. The test follows `chat-route.test.ts` lines 107-180 as precedent:
   - Mock `../../tools/agent/providers/index.ts` with `vi.mock` plus `vi.hoisted` state. `providerFor` returns `{ ok: true, provider: { stream } }`. `stream(req)` records `req` (and so `req.signal`) in the hoisted state.
   - The stub's mode `'hang'`: if `req.signal` is undefined, return at once. Otherwise await the signal's `abort` event and then throw a `DOMException('aborted', 'AbortError')`, the way a real adapter's `fetch` rejects.
   - The stub's mode `'complete'`: yield `'ok'`.
   - Set `process.env['ANTHROPIC_API_KEY'] = 'sk-test-value'` in `beforeAll` and restore it in `afterAll`. Build `a2uiDevProxyPlugin()` and capture the handler through a fake `server.middlewares.use`, as `chat-route.test.ts` does.
   - Fake `req`: the precedent's data/end emitter.
   - Fake `res`: a `node:events` `EventEmitter` with `statusCode`, `headersSent=false`, `writableEnded=false` and `destroyed=false`. It also has `setHeader`, a `write(chunk)` that records the chunk, and an `end(payload?)` that records the payload and sets `writableEnded=true`. A disconnect is simulated by setting `destroyed=true` and then emitting `'close'`.
   - Write exactly these three `it` names, which a criterion filters on with `-t`:
     - `/chat: a client disconnect mid-turn aborts the turn signal`. POST `/chat` with body `{ system: 'be helpful', model: 'claude-sonnet-5', messages: [] }`. Wait until the stub has recorded a request. Assert `req.signal` is an `AbortSignal` that is not aborted. Disconnect. Assert `signal.aborted === true`. Let the handler settle with `await new Promise(r => setTimeout(r, 0))`. Assert that nothing was written or ended with a payload after the disconnect.
     - `produce: a client disconnect mid-turn aborts the turn signal`. Same as the `/chat` test, but POST `/` with `{ input: { kind: 'intent', text: 'a submit button', session: { turns: [] } }, provider: 'anthropic', model: 'claude-sonnet-5' }`. The `TurnInput` fixture shape comes from `produce-loop.test.ts:56`. Assert no `error` line is written after the disconnect.
     - `/chat: a completed response never aborts the turn signal (negative control)`. Use mode `'complete'`, await the 200 `{ text: 'ok' }` response, then emit `'close'`. Assert the recorded `req.signal` is an `AbortSignal` whose `aborted` is `false`.
   - Wait for a recorded request by polling the hoisted array with short `setTimeout(0)` ticks (bounded, for example 50 tries), never with a fixed sleep. On the base commit `req.signal` is undefined, so the two disconnect tests fail on their first assertion instead of timing out. An unhandled rejection fails the vitest run, which covers "settles without throwing".
5. Contract dependents. `buildToolDispatch`'s signature is unchanged, because the optional third parameter already exists. No exported symbol, CLI flag or output format changes. `chat-route.test.ts`, `mcp-boot.test.ts`, `mcp-enablement.test.ts` and `mcp-services-get.test.ts` drive the same handler with fake `res` objects that have no `on` method. Calling `res.on` on them would throw inside the `/chat` and produce arms.
   - `chat-route.test.ts`'s `postChat` fake `res` (lines 159-163) has only `statusCode`, `setHeader` and `end`. To keep it working, guard the registration as `if (typeof res.on === 'function') res.on('close', ...)`; do not edit that test. A real Node `ServerResponse` always has `on`, so the guard costs nothing in production.
   - Check the fake `res` objects in the mcp-* tests the same way. They run in the live-agent gate below.
6. Left untouched on purpose:
   - The `tool-dispatch.ts:44-45` JSDoc still says the dev proxy's Node route has no signal, which becomes stale. The handoff constraint forbids touching `tool-dispatch.ts`, so the builder reports it in the builder result as a follow-up for the conductor.
   - The Worker, `produce.ts`, the providers, and the prompt and baseline files.
7. Focused checks: run the new test file, the live-agent folder, the tools project, and `npm run check`. All are listed below.

This step proves through a fake `res` `close` event that the signal reaches the provider and aborts. It does not prove the live Vite/Node socket close: that remains manual acceptance, the same `chat-route.test.ts` header precedent.

### Acceptance criteria
- `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/dev-proxy-abort.test.ts` exits 0.
- Red on base. This criterion runs the new test against the base plugin in a temp worktree and requires both disconnect tests to fail as assertions, not as a load error:
  `: "${SDLC_TMP_WORKTREES:?}"; w="$SDLC_TMP_WORKTREES/abort-base"; if [ ! -d "$w" ]; then git worktree add --detach "$w" "$SDLC_BASE_SHA" >/dev/null 2>&1; fi; ln -sfn "$PWD/node_modules" "$w/node_modules"; cp packages/agent-ui/a2ui/src/live-agent/dev-proxy-abort.test.ts "$w/packages/agent-ui/a2ui/src/live-agent/" && out=$(cd "$w" && npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/dev-proxy-abort.test.ts -t "disconnect mid-turn" 2>&1); test $? -ne 0 && printf "%s\n" "$out" | grep -qE "Tests +2 failed"`
- `test "$(grep -c 'new AbortController()' packages/agent-ui/a2ui/tools/agent/dev-proxy-plugin.ts)" -ge 2`
- `test "$(grep -cF 'buildToolDispatch(active, env, controller.signal)' packages/agent-ui/a2ui/tools/agent/dev-proxy-plugin.ts)" -eq 2`
- `! grep -qF 'AbortSignal exists on this Node route' packages/agent-ui/a2ui/tools/agent/dev-proxy-plugin.ts`
- `test -f packages/agent-ui/a2ui/src/live-agent/dev-proxy-abort.test.ts && ! grep -q '—' packages/agent-ui/a2ui/src/live-agent/dev-proxy-abort.test.ts`
- (guard) `! git diff "$SDLC_BASE_SHA" -- packages/agent-ui/a2ui/tools/agent/dev-proxy-plugin.ts | grep -q '^+.*—'`
- (guard) `test -z "$(git diff --name-only "$SDLC_BASE_SHA" -- . ':(exclude).sdlc' ':(exclude).worktrees' | grep -vxF packages/agent-ui/a2ui/tools/agent/dev-proxy-plugin.ts)"`
- (guard) `test -z "$(git ls-files --others --exclude-standard -- . ':(exclude).sdlc' ':(exclude).worktrees' | grep -vxF packages/agent-ui/a2ui/src/live-agent/dev-proxy-abort.test.ts)"`
- (guard) `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent`
- (guard) `npx vitest run --project tools`
- (guard) `npm run check`
