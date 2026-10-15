<!-- role=planner level=L3 model=opus effort=xhigh -->
Writing the replanned step 1 now.

## Goal
When the browser disconnects mid-turn, the Node dev proxy aborts the turn in both the `/chat` and produce arms, so the provider stream and in-flight tool calls are cancelled the way the Worker cancels them with `request.signal`. This plan covers only gap (a) of GH #1797 and is a replan of step 1 after the `plan defect:` block.

## Step 1: Thread a per-request AbortController through both dev-proxy turn paths, with a red-then-green test
level: L3
guard timeout: 150
### Do
Depends on: none. This step is a replan. The superseded attempt blocked on `plan defect:` (`.sdlc/dev-proxy-abort/step-1.superseded-1/builder-L3.md`), so the level stays L3 with no bump.

Paths used below:
- P = `packages/agent-ui/a2ui/tools/agent/dev-proxy-plugin.ts`
- C = `packages/agent-ui/a2ui/src/live-agent/chat-route.test.ts`
- D = `packages/agent-ui/a2ui/tools/agent/integrations/tool-dispatch.ts`
- T = `packages/agent-ui/a2ui/src/live-agent/dev-proxy-abort.test.ts` (new)

1. **P: keep the in-tree edit as it is.** The scope amendment in `.sdlc/dev-proxy-abort/handoff.md` says not to redo it. The edit already contains:
   - in both arms, `const controller = new AbortController()` and a guarded `res.on('close', () => { if (!res.writableEnded) controller.abort() })`;
   - `buildToolDispatch(active, env, controller.signal)`, twice;
   - `signal: controller.signal, ...toolOpts` in the `/chat` `provider.stream` request;
   - `maxRounds: 3, signal: controller.signal,` in the `produce()` options;
   - in `/chat`, a try/catch that returns silently once the signal is aborted;
   - in produce, the inner catch guarded by `!res.destroyed && !controller.signal.aborted`;
   - both stale comments rewritten;
   - one em dash in a re-indented line replaced with a comma.

   Settled facts the edit relies on:
   - **Request types.** `AgentProvider.stream` takes `signal?: AbortSignal` (`src/agent/agent-transport.ts:162`). `produce()` forwards `opts.signal` (`produce.ts:101`, `:1059`).
   - **Worker parity.** The Worker passes `request.signal` in the same places (`tools/agent/worker/index.ts:194,204`).
   - **Why `typeof res.on === 'function'` stays.** Three live-agent files drive the POST arms with fake `res` objects that have no `on`:
     - C `postChat` (C:159-163);
     - `mcp-boot.test.ts` `postChat` (:121 on);
     - `mcp-enablement.test.ts` `post` (:116-128).

     A real `ServerResponse` always has `on`, so the guard costs nothing in production.
   - **Why only `res` `close`.** The arena precedent (`a2a/tools/arena/dev-proxy-plugin.ts:189-190`) also listens on `req` `close`. This route must not: on Node 16+ (host: v24.9.0), `IncomingMessage` emits `close` once its body is consumed, and `readBody` (P:117-127) consumes the body before the stream starts. Listening on `req` would abort every turn. `res` `close` together with the `writableEnded` check is the disconnect signal that can be told apart from a normal finish.

   Touch P only if a gate below goes red because of it.
2. **C: update the key pin (lines 204-205).** This is the only change to C. It is justified only by Worker parity: `handleChat` sends `signal` in the same request object (`worker/index.ts:194-205`).
   - Line 205 becomes exactly `    expect(Object.keys(request).sort()).toEqual(['effort', 'messages', 'model', 'signal', 'system'])`.
   - Line 204 holds an em dash, so it is rewritten as exactly ``    // The whole request the route composes: the pre-amendment shape plus the turn `signal` (GH #1797), the key the Worker's handleChat also sends.``
   - Keep everything else in C unchanged, including the test name and the `'tools' in request` and `'executeTool' in request` false assertions. The test's intent holds: with no integrations, the request has no `tools` key and no `executeTool` key.
3. **D: change the JSDoc comment only, lines 44-45.** Replace exactly those two lines with these two:
   - ``` * `signal` is the TURN-level abort signal (the Worker's `request.signal`; the dev proxy's disconnect-aborted```
   - ``` * per-request `AbortController`, GH #1797). It is the FALLBACK: the adapter passes its own per-call signal as```

   Leave line 46 and everything after it untouched: line 46 holds an em dash that the added-line guard would trip on. Change no code.
4. **T: a new sibling test file.** It is a new file, not an extension of C, because C's `vi.mock` stub yields at once and C's fake `res` has no events.

   **Imports and setup.** Follow the C precedent (C:107-150):
   - Import only from `vitest` and `../../tools/agent/dev-proxy-plugin.ts`, with no `node:*` import. tsconfig has `types: ["vite/client"]`, and C declares `process` itself.
   - Add `declare const process: { cwd(): string; env: Record<string, string | undefined> }`.
   - In `beforeAll`, set `process.env['ANTHROPIC_API_KEY'] = 'sk-test-value'`. In `afterAll`, restore it.
   - Mount `a2uiDevProxyPlugin()` and capture the handler through a fake `server.middlewares.use`.

   **Provider mock.** Mock `../../tools/agent/providers/index.ts` with `vi.mock` plus `vi.hoisted` state `{ requests, mode: 'hang' | 'complete', settled }`. Reset that state in `beforeEach`. `providerFor` returns `{ ok: true, provider: { stream } }`, where `stream` is:
   ```ts
   async *stream(req: Record<string, unknown>) {
     state.requests.push(req)
     try {
       if (state.mode === 'complete') { yield '{"a2uiMeta":{"note":"ok"}}'; return }
       const signal = req['signal'] as AbortSignal | undefined
       if (signal === undefined) return
       if (!signal.aborted) await new Promise<void>((r) => signal.addEventListener('abort', () => r(), { once: true }))
       throw new DOMException('The operation was aborted.', 'AbortError')
     } finally { state.settled += 1 }
   }
   ```
   The `complete` yield is the note-only meta-line from `mcp-enablement.test.ts:53`. The produce arm treats it as a clean one-round success, and `/chat` buffers it as text.

   **Fakes.**
   - Fake `req`: C's data/end emitter (C:127-141).
   - Fake `res`: hand-rolled, with no `EventEmitter` import:
     - `statusCode: 0`, `headersSent: false`, `writableEnded: false`, `destroyed: false`;
     - `setHeader()` does nothing;
     - `on(event, cb)` pushes `cb` into a listeners map;
     - `write(chunk)` records the chunk and returns true;
     - `end(payload?)` records the payload, sets `writableEnded = true`, and resolves a `done` promise;
     - a local `emitClose()` calls the `close` listeners.
   - A disconnect sets `res.destroyed = true` and then calls `emitClose()`.

   **Bodies and URLs.**
   - `/chat`: body `{ system: 'be helpful', model: 'claude-sonnet-5', messages: [] }`.
   - produce: URL `/produce` (the mcp-enablement.test.ts:144 precedent), body `{ input: { kind: 'intent', text: 'a submit button', session: { turns: [] } }, provider: 'anthropic', model: 'claude-sonnet-5' }`.

   **Names.**
   - The `describe` name is exactly `dev proxy turn abort on client disconnect (GH #1797)`. It must contain neither `disconnect mid-turn` nor `negative control`, because the criteria filter on those with `-t`.
   - The four `it` names are exact:
     - `/chat: a client disconnect mid-turn aborts the turn signal`
     - `produce: a client disconnect mid-turn aborts the turn signal`
     - `/chat: a completed response never aborts the turn signal (negative control)`
     - `produce: a completed response never aborts the turn signal (negative control)`

   **Disconnect tests**, in this order:
   1. Use mode `hang`.
   2. Call the handler, then `await vi.waitFor(() => expect(state.requests.length).toBeGreaterThan(0), { timeout: 2000, interval: 5 })`.
   3. Before any wait on abort, assert that the recorded `signal` is an instance of `AbortSignal` and is not aborted. On the base commit `signal` is undefined, so both tests fail fast here as assertions, not on a timeout.
   4. Record `res.writes.length`, then disconnect and assert `signal.aborted === true`.
   5. Wait for `state.settled >= 1` with `vi.waitFor`, then for one macrotask (`await new Promise((r) => setTimeout(r, 0))`).
   6. Assert that no write happened after the disconnect.
      - `/chat`: also assert `res.ended` is empty. Without the in-tree try/catch, the outer catch would `sendJson(res, 500, ...)`, so this assertion bites.
      - produce: every recorded `end` payload is `undefined`.

   **How settling is observed.** The middleware is `void (async () => {...})()` (P:252-253) and returns `undefined`, so the test cannot await it. "Settles without throwing" is observed as three things together: the stub's `finally` count, no write or payload after the disconnect, and vitest failing the run on any unhandled rejection.

   **Negative controls:**
   1. Use mode `complete`. Call the handler and await `done`.
   2. Assert `res.statusCode === 200`.
   3. Call `emitClose()` without setting `destroyed`.
   4. Assert the recorded `signal` is an `AbortSignal` whose `aborted` is `false`.

   These two tests are what make the `writableEnded` guard provable: the mutant criterion below removes the guard and requires both to go red.
5. **Tool-call leg.** It is covered by structure, not by behavior. Guard criterion 8 pins `buildToolDispatch(active, env, controller.signal)` twice. `tools/agent/integrations/tool-dispatch.test.ts` (tools gate) proves the `callSignal ?? signal` fallback at D:66. A behavioral proof here would mean registering a fake manifest and driving `executeTool` from the stub, which the shared pair already covers.

   This step proves the abort through a fake `res` `close`. It does not prove a live Vite/Node socket close, which stays manual acceptance, as C's header says (C:1-3).
6. **Contract dependents.**
   - The `/chat` stream-request key set gains `signal`. The only pin is C:205 (item 2). The live-agent folder run on the current tree shows that this pin is the one failure (699 passed, 1 failed).
   - The source-reading tests stay green on the current tree: `mcp-boot.test.ts:323`, `chat-validation.test.ts:97`, `validate-authoring-surface.test.ts:48`, `validate-builder-mission.test.ts:63`, and `build-key-safety.test.ts:35`.
   - `buildToolDispatch`'s signature is unchanged; the optional third parameter already exists (D:53).
   - No doc states the dev proxy lacks a signal: a `git grep` of `.claude/docs` finds none. So no ADR is needed.
   - Left untouched on purpose: the Worker, `produce.ts`, the providers, the prompt and baseline files, and D's code (handoff constraints).
7. **Focused checks.** Run T, the two worktree probes, the live-agent folder, the tools project, and `npm run check`, all listed below. Add no em dash to any line. Do not touch `.sdlc/`.

### Acceptance criteria
- `out=$(npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/dev-proxy-abort.test.ts 2>&1); test $? -eq 0 && printf "%s\n" "$out" | grep -qE "Tests +4 passed"`
- The new test is red on the base plugin: both disconnect tests must fail as assertions, not as a load error: `: "${SDLC_TMP_WORKTREES:?}"; w="$SDLC_TMP_WORKTREES/abort-base"; if [ ! -d "$w" ]; then git worktree add --detach "$w" "$SDLC_BASE_SHA" >/dev/null 2>&1; fi; ln -sfn "$PWD/node_modules" "$w/node_modules"; cp packages/agent-ui/a2ui/src/live-agent/dev-proxy-abort.test.ts "$w/packages/agent-ui/a2ui/src/live-agent/" && out=$(cd "$w" && npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/dev-proxy-abort.test.ts -t "disconnect mid-turn" 2>&1); test $? -ne 0 && printf "%s\n" "$out" | grep -qE "Tests +2 failed"`
- The negative controls bite: with the `writableEnded` guard removed from a copy of the current plugin, both go red: `: "${SDLC_TMP_WORKTREES:?}"; w="$SDLC_TMP_WORKTREES/abort-mutant"; if [ ! -d "$w" ]; then git worktree add --detach "$w" "$SDLC_BASE_SHA" >/dev/null 2>&1; fi; ln -sfn "$PWD/node_modules" "$w/node_modules"; cp packages/agent-ui/a2ui/tools/agent/dev-proxy-plugin.ts "$w/packages/agent-ui/a2ui/tools/agent/" && cp packages/agent-ui/a2ui/src/live-agent/dev-proxy-abort.test.ts "$w/packages/agent-ui/a2ui/src/live-agent/" && perl -pi -e 's/if \(!res\.writableEnded\) controller\.abort\(\)/controller.abort()/g' "$w/packages/agent-ui/a2ui/tools/agent/dev-proxy-plugin.ts" && ! grep -qF 'if (!res.writableEnded)' "$w/packages/agent-ui/a2ui/tools/agent/dev-proxy-plugin.ts" && out=$(cd "$w" && npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/dev-proxy-abort.test.ts -t "negative control" 2>&1); test $? -ne 0 && printf "%s\n" "$out" | grep -qE "Tests +2 failed"`
- `grep -qF "toEqual(['effort', 'messages', 'model', 'signal', 'system'])" packages/agent-ui/a2ui/src/live-agent/chat-route.test.ts && grep -qF "expect('executeTool' in request).toBe(false)" packages/agent-ui/a2ui/src/live-agent/chat-route.test.ts`
- `! grep -qF "proxy's Node route has none" packages/agent-ui/a2ui/tools/agent/integrations/tool-dispatch.ts && grep -qF 'GH #1797' packages/agent-ui/a2ui/tools/agent/integrations/tool-dispatch.ts`
- (guard) `test -z "$(git diff -U0 "$SDLC_BASE_SHA" -- packages/agent-ui/a2ui/tools/agent/integrations/tool-dispatch.ts | grep -E '^[-+]' | grep -vE '^(\+\+\+|---) ' | grep -vE '^[-+] \*')"`
- `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent`
- (guard) `test "$(grep -cF 'buildToolDispatch(active, env, controller.signal)' packages/agent-ui/a2ui/tools/agent/dev-proxy-plugin.ts)" -eq 2 && test "$(grep -cF 'if (!res.writableEnded) controller.abort()' packages/agent-ui/a2ui/tools/agent/dev-proxy-plugin.ts)" -eq 2 && grep -qF 'signal: controller.signal, ...toolOpts' packages/agent-ui/a2ui/tools/agent/dev-proxy-plugin.ts && grep -qF 'maxRounds: 3, signal: controller.signal,' packages/agent-ui/a2ui/tools/agent/dev-proxy-plugin.ts && ! grep -qF 'AbortSignal exists on this Node route' packages/agent-ui/a2ui/tools/agent/dev-proxy-plugin.ts`
- `test -f packages/agent-ui/a2ui/src/live-agent/dev-proxy-abort.test.ts && ! grep -q '—' packages/agent-ui/a2ui/src/live-agent/dev-proxy-abort.test.ts && ! git diff "$SDLC_BASE_SHA" -- packages/agent-ui/a2ui/tools/agent/dev-proxy-plugin.ts packages/agent-ui/a2ui/src/live-agent/chat-route.test.ts packages/agent-ui/a2ui/tools/agent/integrations/tool-dispatch.ts | grep -q '^+.*—'`
- (guard) `test -z "$(git diff --name-only "$SDLC_BASE_SHA" -- . ':(exclude).sdlc' ':(exclude).worktrees' | grep -vxF -e packages/agent-ui/a2ui/tools/agent/dev-proxy-plugin.ts -e packages/agent-ui/a2ui/src/live-agent/chat-route.test.ts -e packages/agent-ui/a2ui/tools/agent/integrations/tool-dispatch.ts)" && test -z "$(git ls-files --others --exclude-standard -- . ':(exclude).sdlc' ':(exclude).worktrees' | grep -vxF packages/agent-ui/a2ui/src/live-agent/dev-proxy-abort.test.ts)"`
- (guard) `npx vitest run --project tools`
- (guard) `npm run check`

## Assumptions
- **The in-tree P edit holds every pinned string.** Verified by the guard 8 probe on the current tree (exit 0). At HEAD the counts are 0, 0 and 2 (`git show HEAD:<P> | grep -cF ...`), so the guard goes red when the edit is absent.
- **The only live-agent red on the current tree is the C:205 key pin.** Verified: `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent` printed 1 failed and 699 passed, with the failure at C:205 (`+ "signal"`).
- **`tools` and `check` are green on the current tree.**
  - `npx vitest run --project tools`: exit 0, 366 passed, 7 s.
  - `npm run check`: exit 0, 31 s.
  - The guard timeout of 150 is about three times the slowest observed run, with margin for load.
- **New-behavior criteria are red now for the right reason.**
  - Criterion 1: the T file is missing (exit 1).
  - Criterion 4: the key line is not updated (exit 1; the `executeTool` half alone is exit 0).
  - Criterion 5: the D text is still present (exit 1).
  - Criterion 7: the C:205 pin (exit 1).
  - Criterion 9: T is missing (exit 1); its diff part alone is exit 0.
- **Criteria 2 and 3 were not run at plan time.** They create worktrees, which rule 1 forbids for planner probes. They are red now because T is missing: `cp` fails, `$out` stays empty, and the grep fails.
  - The base-worktree mechanism with `ln -sfn node_modules` works on this host: the superseded builder ran C 18/18 in `$SDLC_TMP_WORKTREES/base` (`step-1.superseded-1/builder-L3.md`).
  - The mutation regex leaves 0 `if (!res.writableEnded)` matches and 2 `controller.abort()` matches (read-only `perl -pe` probe on P).
- **Guards were seen red.**
  - Guard 6: on a fixture diff containing a code line (exit 1); green on a comment-only fixture.
  - Guard 10: with P dropped from the allowlist (exit 1), and with `.sdlc` not excluded (exit 1).
  - Criterion 9's em-dash grep: matches a fixture `+` line that contains an em dash.
- **`SDLC_TMP_WORKTREES` reaches every role.** run.sh:486 exports it, and it was set in this planner's environment.
- **`.worktrees` is not git-ignored.** `git check-ignore .worktrees` printed nothing, so the scope guard excludes it, along with `.sdlc`.
- **A stream rejection propagates cleanly through produce with progress on.** Verified by reading `interleaveProgress` (produce.ts:258-279): `Promise.race` rejects, `finally` awaits `iter.return?.()`, and no try/catch wraps the stream loop (produce.ts:960-1110). The pending `waitForPush` promise never rejects.
- **`vi.waitFor` exists.** vitest is 4.1.9, and `node_modules/vitest/dist/index.d.ts:208` declares `waitFor`.
- **The produce stub success line completes in one round.** The note-only meta-line is a clean success per `mcp-enablement.test.ts:42-44`.
- **No documented contract changes.** A `git grep` of `.claude/docs` for dev-proxy signal or abort statements finds only the a2a arena (ADR-0116, LLD-C4), which is unrelated.

## Risks
- **Fake `close` versus a live socket.** The fake `res` `close` models Node's behavior: a real `ServerResponse` emits `close` after `end()` with `writableEnded` true, and emits it before `end()` on a socket drop. A live Vite socket close stays manual acceptance.
- **Leftover worktrees.** Criteria 2 and 3 leave worktrees under the verifier's `$SDLC_TMP_WORKTREES`. The scope guard excludes `.worktrees`, but if run.sh does not reap that prefix, they persist until `npm run ops:reap-worktrees`.
