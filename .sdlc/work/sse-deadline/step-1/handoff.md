## Task goal
Bound the Anthropic provider's network wait: a stall guard on the response so a connection that goes silent mid-stream fails the turn visibly instead of hanging, plus a deadline for the first response. Tracks GH #1797, gap (c) of (a) to (d). Gaps (a) dev-proxy abort (PR #1804) and (b) tool-dispatch timeout are separate branches; do not depend on them and do not touch `dev-proxy-plugin.ts` or `tool-dispatch.ts`.

## Step 1: First-byte deadline and stall guard in anthropicProvider, with timeout tests, gates green
level: L3
guard timeout: 120
### Do
Targets: `packages/agent-ui/a2ui/src/agent/providers/anthropic.ts` (inside `anthropicProvider` → `runRound`, lines about 299-380) and a new test file `packages/agent-ui/a2ui/src/live-agent/anthropic-timeouts.test.ts`. No other file may change. If an existing test has to change, stop and report it as builder Status blocked with `unresolved:`. The conductor decides any scope widening.

Settled interface:
- Add two module-level exports near the other constants: `export const ANTHROPIC_FIRST_BYTE_TIMEOUT_MS = 60_000` and `export const ANTHROPIC_STALL_TIMEOUT_MS = 60_000`. Use exactly those names and values (handoff `## Context`).
- The `anthropicProvider(opts)` signature does not change. No new optional opts: the tests use `vi.useFakeTimers()` with the default constants, so the handoff's optional-parameter allowance is not needed.
- First-byte deadline. Do NOT pass `AbortSignal.timeout(...)` into `fetch`. The fetch signal also governs the response body stream, so a timeout signal that fires 60 s after the request starts would abort a healthy, still-streaming long turn. The handoff's own constraint "for the fetch only" rules that out. Under fake timers `AbortSignal.timeout` is also not reliably faked in jsdom. Instead:
  - Create a local `AbortController` (`deadline`) and a `setTimeout(() => deadline.abort(), ANTHROPIC_FIRST_BYTE_TIMEOUT_MS)`.
  - Pass `signal: signal ? AbortSignal.any([signal, deadline.signal]) : deadline.signal` to `fetch`. `AbortSignal.any` is typed in the repo's DOM lib (`node_modules/typescript/lib/lib.dom.d.ts:3422`; tsconfig `lib: ["ES2023","DOM",...]`).
  - Wrap the `await fetch(...)` in try/catch/finally and `clearTimeout` in the finally, so the timer is cleared as soon as headers arrive or fetch rejects.
  - In the catch: if `deadline.signal.aborted && !signal?.aborted`, throw `new Error(\`anthropicProvider: no response within ${ANTHROPIC_FIRST_BYTE_TIMEOUT_MS} ms\`)`. Otherwise rethrow the original error unchanged, so a caller abort keeps its AbortError and is not relabelled.
  - After headers, `deadline` never fires, and the caller `signal` still aborts the body read as before.
- Stall guard. Replace `await reader.read()` in the `for (;;)` loop with a local helper that races `reader.read()` against a fresh `setTimeout` that rejects with `new Error(\`anthropicProvider: stream stalled for ${ANTHROPIC_STALL_TIMEOUT_MS} ms\`)`. Clear the timer in a `finally` on every settle. The throw lands inside the existing `try`, so the existing `finally { await reader.cancel().catch(() => {}) }` cancels the reader. Do not add buffering: each read's frames are still parsed and yielded in the same iteration, which keeps ADR-0146 live progress.
- Unchanged: the request body, headers, `!res.ok` upstream-error path (TKT-0075), `res.body === null` path, SSE error-frame throws, the trailing-buffer flush, the GH #49 tool loop (`MAX_TOOL_ROUNDS`, `MAX_CALLS_PER_ROUND`), and `validateAnthropicKey`.
- Lines you add contain no em dashes. The file already has many; guard 9 checks only added lines.

Tests in the new file. Stub `fetch` with `vi.stubGlobal('fetch', ...)` the way `anthropic-tool-loop.test.ts:16-20,68` does: build the body with `new ReadableStream<Uint8Array>` directly, because jsdom's Blob has no `.stream()`. Use `vi.useFakeTimers()` and `vi.advanceTimersByTimeAsync`. Attach the `expect(...).rejects` handler BEFORE advancing timers, so there is no unhandled rejection. Restore timers and globals in `afterEach`. Cases:
1. A fetch stub that never resolves but rejects with an AbortError when `init.signal` aborts. The turn rejects at 60_000 ms with `/anthropicProvider: no response within 60000 ms/`, and is still pending at 59_999.
2. The body enqueues one `content_block_delta` text frame and then never enqueues again. The first fragment is yielded, then the turn rejects with `/stream stalled for 60000 ms/`, and the stream's `cancel` callback (a `vi.fn`) was called.
3. Negative control: the body enqueues frames with 30_000 ms gaps driven by fake timers. Every fragment is yielded in order and the turn completes.
4. The caller's `AbortController.abort()` fires at 1_000 ms while fetch is pending. The rejection does NOT match `/no response within/`.
5. After a healthy completion, `vi.getTimerCount()` is `0`.

Red-then-green proof, reported in builder Notes and not a criterion:
- Criteria 1 to 4 below are red at base.
- Optionally, run the new test file against the base `anthropic.ts` in a throwaway worktree with `git worktree add --detach "$SDLC_TMP_WORKTREES/base" HEAD`, as the handoff instructs (it needs node_modules symlinked per `seat-map`). Then remove it with `git worktree remove`.
- Prove one mutant: temporarily replace the stall race with a bare `reader.read()`, show that test 2 fails, then restore the code.

Write `Needs Kim: confirm 60000 / 60000` in builder Notes. Do not touch `.sdlc/`, `dev-proxy-plugin.ts`, `tool-dispatch.ts`, `produce.ts`, prompts, or baselines.

Contract dependents: the factory signature does not change. Callers `packages/agent-ui/a2a/tools/arena/run-flagship.ts:55`, `a2ui/tools/agent-consumer-example/produce-to-conversation.ts:41`, `a2ui/tools/corpus-genui/eval-genui-corpus.ts:129` and the 4 calls in `anthropic-tool-loop.test.ts` stay untouched on purpose. No existing test pins the fetch `signal` option (`git grep signal` over the anthropic tests found none). The live-agent and tools gates below run every one of these dependents.

Depends on: none. Focused check while iterating: `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/anthropic-timeouts.test.ts`. Then run every gate below and fix any red this step introduced.
### Acceptance criteria
- `grep -qE '^export const ANTHROPIC_FIRST_BYTE_TIMEOUT_MS = 60_?000' packages/agent-ui/a2ui/src/agent/providers/anthropic.ts`
- `grep -qE '^export const ANTHROPIC_STALL_TIMEOUT_MS = 60_?000' packages/agent-ui/a2ui/src/agent/providers/anthropic.ts`
- `grep -q 'no response within' packages/agent-ui/a2ui/src/agent/providers/anthropic.ts && grep -q 'stream stalled for' packages/agent-ui/a2ui/src/agent/providers/anthropic.ts`
- `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/anthropic-timeouts.test.ts` exits 0, and its output lists at least 5 passing tests covering cases 1 to 5 of the Do.
- (guard) `npm run check`
- (guard) `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent`
- (guard) `npx vitest run --project tools packages/agent-ui/a2ui/tools`
- (guard) `git diff --quiet "$SDLC_BASE_SHA" -- packages/agent-ui/a2ui/src/live-agent/anthropic-sse.test.ts packages/agent-ui/a2ui/src/live-agent/anthropic-tool-loop.test.ts packages/agent-ui/a2ui/src/live-agent/anthropic-request-body.test.ts packages/agent-ui/a2ui/src/live-agent/provider-dispatch.test.ts`
- (guard) `! git diff "$SDLC_BASE_SHA" -- packages/agent-ui/a2ui/src/agent/providers/anthropic.ts | grep '^+' | grep -q '—'`
- (guard) `! { git diff --name-only "$SDLC_BASE_SHA" -- . ':(exclude).sdlc'; git ls-files --others --exclude-standard -- . ':(exclude).sdlc'; } | grep -vxF -e packages/agent-ui/a2ui/src/agent/providers/anthropic.ts -e packages/agent-ui/a2ui/src/live-agent/anthropic-timeouts.test.ts | grep -q .`
