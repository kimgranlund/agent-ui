<!-- role=planner level=L2 model=opus effort=medium -->
## Goal
Add a bounded, abortable transport retry (429/5xx/529 and network TypeError, never after streaming starts) around the single upstream `fetch` in the Anthropic provider's `runRound`, through a new exported `fetchWithRetry` helper, with a new test file that proves it (GH #1797 gap (d)).

guard timeout: 120

## Step 1: fetchWithRetry helper, one-line call site, retry tests, gates green
level: L3
### Do
Implementation targets. There is no non-root AGENTS.md above either file: `find packages/agent-ui/a2ui -name AGENTS.md` returned nothing, and `packages/AGENTS.md` and `packages/agent-ui/AGENTS.md` do not exist.

1. In `packages/agent-ui/a2ui/src/agent/providers/anthropic.ts`, add a new block placed ABOVE `export function anthropicProvider` (after `validateAnthropicKey` is fine). Do not reformat or reorder any existing code; branch `fix/anthropic-sse-deadline` edits the same function. Export these names exactly:
   - `export const ANTHROPIC_MAX_RETRIES = 2` (at most 3 attempts).
   - `export const ANTHROPIC_RETRY_BACKOFF_MS: readonly number[] = [500, 1500]` (base delay per retry index).
   - `export const ANTHROPIC_RETRY_AFTER_CAP_MS = 10_000`.
   - `export async function fetchWithRetry(doFetch: () => Promise<Response>, opts: { signal?: AbortSignal; maxRetries?: number; backoffMs?: readonly number[]; sleep?: (ms: number, signal?: AbortSignal) => Promise<void>; random?: () => number } = {}): Promise<Response>`.
2. Settled semantics of `fetchWithRetry`. These are the handoff's required behaviour, and the details are fixed here:
   - Retryable status set: 429, 500, 502, 503, 504, 529. Every other non-ok status (400, 401, 403, any other 4xx) returns the Response at once, with its body untouched.
   - A retryable status on the last attempt (exhaustion) RETURNS that last Response with its body unread. The existing `if (!res.ok)` block in `runRound` then reads the body and throws `anthropicProvider: upstream error <status>: <body>` unchanged. That keeps the exhaustion error byte-identical to today with no duplicated message code.
   - When a retryable Response is discarded (not the last attempt), call `await res.body?.cancel().catch(() => {})` before waiting, so the connection is not leaked.
   - A thrown error from `doFetch` is retryable only if it is NOT an abort. It is an abort when `opts.signal?.aborted` is true or `err.name === 'AbortError'`, and an abort is rethrown at once, unwrapped and with no wait. Any other thrown error is retryable (fetch's network failure is a `TypeError`). On the last attempt it is rethrown as the original error object.
   - Delay before retry i (0-based): if the discarded response has a `Retry-After` header, parse it as integer seconds (`* 1000`) or as an HTTP-date (`Date.parse(v) - Date.now()`, floored at 0). Use `Math.min(parsed, ANTHROPIC_RETRY_AFTER_CAP_MS)` with no jitter. Otherwise use `base = backoffMs[min(i, len-1)]`, so the delay is `base + Math.floor(random() * base * 0.2)` (up to 20% jitter). `random` defaults to `Math.random`.
   - The default `sleep` is abortable. If `signal` is already aborted, it rejects with `signal.reason` at once. Otherwise it sets one `setTimeout`, adds an `abort` listener (`{ once: true }`) that calls `clearTimeout` and rejects with `signal.reason`, and removes the listener when the timer fires. No timer may be left pending after an abort.
   - A healthy first attempt (ok, or a non-retryable status) calls `doFetch` exactly once and schedules no timer. Before each attempt after the first, check `signal?.aborted` and throw `signal.reason` if it is.
3. Call site in `runRound`. Change only the `fetch(endpoint, {` opening line and its closing `})` line. The code becomes `const res = await fetchWithRetry(() => fetch(endpoint, {`, with the same option lines, then `}), { signal })`. The rest of `runRound` stays untouched: the `!res.ok` throw, the body reader, and `parseAnthropicSSE`. Because the wrap ends when `res` is returned, no retry can happen after the body read starts (test 8). Leave `validateAnthropicKey` (the `/status` fetch) and the tool path alone.
4. New test file `packages/agent-ui/a2ui/src/live-agent/anthropic-retry.test.ts`. Stub `fetch` per test with `vi.stubGlobal` and `afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })`, copying the `sseResponse` helper pattern from `anthropic-tool-loop.test.ts:14-25`. Drive the provider through `anthropicProvider({ apiKey: 'test-key' }).stream(...)` with no tools, and use `vi.useFakeTimers()` with `vi.advanceTimersByTimeAsync` plus `vi.getTimerCount()`. Unit cases may call `fetchWithRetry` directly with an injected `sleep`/`random`. Write at least these 8 `it(...)` cases, matching handoff items 1 to 8:
   - (1) 503 then 200 yields the text after 2 calls;
   - (2) 429 with `Retry-After: 2` does not issue call 2 before 1999 ms and does issue it by 2000 ms;
   - (3) three 503s reject with a message matching `upstream error 503` after exactly 3 calls;
   - (4) 400 and 401 each make exactly 1 call;
   - (5) a `TypeError` then 200 succeeds after 2 calls;
   - (6) an abort during backoff rejects with the abort reason, the call count stays at the calls made so far, and `vi.getTimerCount()` is 0;
   - (7) a healthy 200 makes exactly 1 call and `vi.getTimerCount()` is 0 after the stream completes;
   - (8) a 200 whose stream body errors mid-read (a ReadableStream that enqueues one frame then `controller.error(...)`) rejects with that error after exactly 1 call.
5. Red-then-green proof (record it in builder Notes). Run `git worktree add --detach "$SDLC_TMP_WORKTREES/base" HEAD` with that literal path shape, which the stray-worktree hook requires. Copy the new test file into it and run it there: it must fail, because the exports are missing and the retry cases are red. Then apply one mutant locally (add 400 to the retryable set), show that case (4) fails, revert the mutant, and remove the throwaway worktree. See skill `checks-that-bite`.
6. Contract dependents. These were checked by `git grep -ln "providers/anthropic" -- '*.test.ts'`:
   - `anthropic-tool-loop.test.ts`, `anthropic-sse.test.ts`, `anthropic-request-body.test.ts` and `build-key-safety.test.ts` stub only 200 responses or do not call `stream`, so they stay unchanged and are covered by the live-agent suite criterion.
   - `anthropic-key-validation.test.ts` stubs a 500, but it targets `validateAnthropicKey`, which this step does not touch.
   - No existing test may change. If one must, STOP and report `unresolved:`, because the conductor decides scope.
7. Builder Notes must include the line `Needs Kim: confirm retries=2, backoff 500/1500 ms, Retry-After cap 10000 ms`. Do not add em dashes on any line you write.
8. Gates. This is the only step, so it is the gates green step. Run `npm run check` (about 30 s), the live-agent suite and the tools suite, and fix any red this step introduced.

Depends on: none.
### Acceptance criteria
- `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/anthropic-retry.test.ts`
- `test $(grep -cE '^[[:space:]]*(it|test)\(' packages/agent-ui/a2ui/src/live-agent/anthropic-retry.test.ts) -ge 8`
- `grep -qE '^export const ANTHROPIC_MAX_RETRIES = 2$' packages/agent-ui/a2ui/src/agent/providers/anthropic.ts && grep -qE '^export const ANTHROPIC_RETRY_BACKOFF_MS' packages/agent-ui/a2ui/src/agent/providers/anthropic.ts && grep -qE '^export const ANTHROPIC_RETRY_AFTER_CAP_MS = 10_000$' packages/agent-ui/a2ui/src/agent/providers/anthropic.ts && grep -qE '^export async function fetchWithRetry\(' packages/agent-ui/a2ui/src/agent/providers/anthropic.ts`
- `grep -qF 'await fetchWithRetry(' packages/agent-ui/a2ui/src/agent/providers/anthropic.ts && test $(git diff "$SDLC_BASE_SHA" -- packages/agent-ui/a2ui/src/agent/providers/anthropic.ts | grep -cE '^-[^-]') -le 2`
- `test -f packages/agent-ui/a2ui/src/live-agent/anthropic-retry.test.ts && test -z "$( { git diff --name-only "$SDLC_BASE_SHA" -- . ':(exclude).sdlc'; git ls-files --others --exclude-standard -- . ':(exclude).sdlc'; } | grep -vxF -e packages/agent-ui/a2ui/src/agent/providers/anthropic.ts -e packages/agent-ui/a2ui/src/live-agent/anthropic-retry.test.ts)"`
- `test -f packages/agent-ui/a2ui/src/live-agent/anthropic-retry.test.ts && ! grep -q '—' packages/agent-ui/a2ui/src/live-agent/anthropic-retry.test.ts && test $(grep -c '—' packages/agent-ui/a2ui/src/agent/providers/anthropic.ts) -le $(git show "$SDLC_BASE_SHA":packages/agent-ui/a2ui/src/agent/providers/anthropic.ts | grep -c '—')`
- The builder Notes record three things: the new test file failing in a `$SDLC_TMP_WORKTREES/base` detached worktree of the base, a 400-retry mutant failing case (4), and the line `Needs Kim: confirm retries=2, backoff 500/1500 ms, Retry-After cap 10000 ms`.
- Reading `fetchWithRetry` shows four things: a discarded retryable response's body is cancelled; an abort (`signal.aborted` or `AbortError`) is rethrown without wait or relabel; the default sleep clears its timer and removes its listener on abort; and on exhaustion it returns the last Response, so `runRound`'s existing `upstream error` throw fires.
- (guard) `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent`
- (guard) `npx vitest run --project tools packages/agent-ui/a2ui/tools`
- (guard) `npm run check`

## Assumptions
- `runRound`'s single upstream `fetch` and the `!res.ok` throw are at `anthropic.ts:304-326`, and `validateAnthropicKey` is a separate fetch at `anthropic.ts:288-296`: verified by reading the file (459 lines at HEAD 38ed6721).
- Returning the last retryable Response on exhaustion keeps today's error message byte-identical: verified by reading `anthropic.ts:316-326`, where the message is built from `res.status` and `res.text()`.
- No existing test stubs a 429 or 5xx through `anthropicProvider().stream`, so none needs to change: verified by `git grep -nE "status: (429|5[0-9][0-9])" -- '*.test.ts'`. The only a2ui hit is `anthropic-key-validation.test.ts:29`, which targets `validateAnthropicKey`.
- No existing symbol is named `fetchWithRetry` or `ANTHROPIC_MAX_RETRIES`: verified by `git grep`, which returned no hits.
- Every gate is green at HEAD: verified by running each one. The live-agent suite exits 0 in 9 s (700 tests), the tools suite exits 0 in 5 s, and `npm run check` exits 0 in 30 s. That timing gives `guard timeout: 120`.
- `anthropic.ts` already contains em dashes, so the em-dash criterion compares the count against `$SDLC_BASE_SHA`: verified by `grep -q '—'` on the file at HEAD (exit 0).
- No SPEC or ADR text claims that the Anthropic provider never retries: verified by `git grep -n "never retr\|no retry\|not retry" -- '.claude/docs/**'` with an anthrop filter, which found no hit.

## Risks
- When `fix/anthropic-sse-deadline` merges, it wraps the same `fetch` with a first-byte timeout. The two-line call-site change keeps the conflict small, but whoever merges second must place the timeout inside the `doFetch` closure, so each attempt gets its own deadline and a timeout abort is not mistaken for a caller abort.
- With fake timers, the `fetch` stub and the provider's async generator can interleave in ways that make case (2) or (6) flaky if the builder advances timers before the first call settles. The builder should use `advanceTimersByTimeAsync`, and should assert call counts only after awaiting microtasks.
