<!-- role=planner level=L3 model=opus effort=xhigh -->
I wrote the replan, and `steps.py lint` passes on its criteria. Only the criterion that `steps.py split` refused has changed; the code, the step design and the other ten criteria are the same as in `planner-L2.md`.

## Goal
Add a bounded, abortable transport retry around the single upstream `fetch` in the Anthropic provider's `runRound`. It retries on 429, 5xx, 529 and a network TypeError, and never after streaming starts. It goes through a new exported `fetchWithRetry` helper, and a new test file proves it (GH #1797 gap (d)).

guard timeout: 120

## Step 1: fetchWithRetry helper, one-line call site, retry tests, gates green
level: L3
### Do
Replan note: the only change from `planner-L2.md` is criterion 2. `steps.py split` refused the old test-count criterion. The new criterion runs the file with the verbose reporter and checks the eight test titles by name. Item 4 fixes those titles word for word. Every other criterion and Do item stays the same.

Implementation targets. Neither file has an AGENTS.md above it other than the root one: `find packages/agent-ui/a2ui -name AGENTS.md` returned nothing, and `packages/AGENTS.md` and `packages/agent-ui/AGENTS.md` do not exist.

1. In `packages/agent-ui/a2ui/src/agent/providers/anthropic.ts`, add a new block ABOVE `export function anthropicProvider`. Right after `validateAnthropicKey` is fine. Do not reformat or reorder any existing code, because branch `fix/anthropic-sse-deadline` edits the same function. Export exactly these names:
   - `export const ANTHROPIC_MAX_RETRIES = 2` (at most 3 attempts).
   - `export const ANTHROPIC_RETRY_BACKOFF_MS: readonly number[] = [500, 1500]` (base delay for each retry index).
   - `export const ANTHROPIC_RETRY_AFTER_CAP_MS = 10_000`.
   - `export async function fetchWithRetry(doFetch: () => Promise<Response>, opts: { signal?: AbortSignal; maxRetries?: number; backoffMs?: readonly number[]; sleep?: (ms: number, signal?: AbortSignal) => Promise<void>; random?: () => number } = {}): Promise<Response>`.

   These names become part of the public `@agent-ui/a2ui/agent` API through `export * from './providers/anthropic.ts'` (`packages/agent-ui/a2ui/src/agent/index.ts:28`). No test or snapshot pins that export list, so nothing else changes.
2. Settled behaviour of `fetchWithRetry`. The handoff requires this behaviour; this item fixes the details:
   - Statuses that retry: 429, 500, 502, 503, 504, 529. Any other non-ok status (400, 401, 403, any other 4xx) returns the Response at once, with its body untouched.
   - On exhaustion (a retryable status on the last attempt), return that last Response with its body unread. The existing `if (!res.ok)` block in `runRound` then reads the body and throws `anthropicProvider: upstream error <status>: <body>` unchanged. The exhaustion error stays byte-identical to today, and the message code is not duplicated.
   - Before waiting after a retryable Response that will be discarded (not the last attempt), call `await res.body?.cancel().catch(() => {})` so the connection is not leaked.
   - A thrown error from `doFetch` is retried only if it is NOT an abort. It counts as an abort when `opts.signal?.aborted` is true or `err.name === 'AbortError'`. An abort is rethrown at once, unwrapped, with no wait. Any other thrown error is retried (a network failure from fetch is a `TypeError`). On the last attempt, rethrow the original error object.
   - Delay before retry i (counting from 0):
     - If the discarded response has a `Retry-After` header, parse it as whole seconds (`* 1000`) or as an HTTP-date (`Date.parse(v) - Date.now()`, never below 0). Wait `Math.min(parsed, ANTHROPIC_RETRY_AFTER_CAP_MS)`, with no jitter.
     - Otherwise take `base = backoffMs[min(i, len-1)]` and wait `base + Math.floor(random() * base * 0.2)` (up to 20% jitter). `random` defaults to `Math.random`.
   - The default `sleep` can be aborted:
     - If `signal` is already aborted, it rejects with `signal.reason` at once.
     - Otherwise it sets one `setTimeout` and adds an `abort` listener (`{ once: true }`) that calls `clearTimeout` and rejects with `signal.reason`.
     - When the timer fires, it removes the listener. No timer may stay pending after an abort.
   - A healthy first attempt (ok, or a status that does not retry) calls `doFetch` exactly once and schedules no timer. Before each attempt after the first, if `signal?.aborted` is true, throw `signal.reason`.
3. Call site in `runRound` (`anthropic.ts:312`):
   - Change only the `fetch(endpoint, {` opening line and its closing `})` line. The code becomes `const res = await fetchWithRetry(() => fetch(endpoint, {`, then the same option lines, then `}), { signal })`.
   - The rest of `runRound` stays untouched: the `!res.ok` throw, the body reader, and `parseAnthropicSSE`.
   - The wrapper's job ends once it returns `res`, so a retry can never happen after the body read starts (test 8).
   - Leave `validateAnthropicKey` (the `/status` fetch at `anthropic.ts:292`) and the tool path alone.
4. New test file `packages/agent-ui/a2ui/src/live-agent/anthropic-retry.test.ts`.
   - Setup:
     - Stub `fetch` per test with `vi.stubGlobal`, with `afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })`.
     - Copy the `sseResponse` helper pattern from `anthropic-tool-loop.test.ts:14-25`.
     - Drive the provider through `anthropicProvider({ apiKey: 'test-key' }).stream(...)` with no tools.
     - Use `vi.useFakeTimers()` with `vi.advanceTimersByTimeAsync` and `vi.getTimerCount()`. Unit cases may call `fetchWithRetry` directly with an injected `sleep`/`random`.
   - Title rules:
     - Write exactly one `it('<title>', ...)` for each title below, with the title copied byte for byte. Use plain `it`; never `it.skip`, `it.only`, `it.todo` or `it.each`.
     - Criterion 2 runs the file with `--reporter=verbose` and requires a passing (`✓`) line for each title. A renamed, skipped, or `.only`-shadowed case therefore fails it.
     - Titles contain no single quote and no em dash, because the criterion wraps them in single quotes and criterion 6 scans the file for em dashes.
   - The titles and what each test asserts:
     - `retry 1: a 503 then a 200 succeeds on attempt 2 and yields the text`: the stream yields the text from the 200 after exactly 2 fetch calls.
     - `retry 2: a 429 with Retry-After 2 waits 2000 ms before attempt 2`: under fake timers, call 2 has not happened after advancing 1999 ms and has happened by 2000 ms.
     - `retry 3: three 503s throw upstream error 503 after exactly 3 calls`: the stream rejects with a message matching `upstream error 503`, and fetch was called exactly 3 times.
     - `retry 4: a 400 and a 401 are not retried`: one stream per status, and each rejects after exactly 1 fetch call.
     - `retry 5: a fetch TypeError then a 200 retries and succeeds`: the first stub throws `new TypeError('fetch failed')`, and the stream yields the text after 2 calls.
     - `retry 6: a caller abort during backoff rejects at once with no pending timer`: the test aborts the controller while the backoff sleep is pending. The stream rejects with the abort reason, the call count stays at the calls already made, and `vi.getTimerCount()` is 0.
     - `retry 7: a healthy first attempt makes one call and sets no timer`: a 200 gives exactly 1 call, and `vi.getTimerCount()` is 0 after the stream completes.
     - `retry 8: a 200 whose body errors mid-stream is surfaced and not retried`: a ReadableStream enqueues one frame, then calls `controller.error(...)`. The stream rejects with that error after exactly 1 call.
5. Red-then-green proof (record it in builder Notes). See skill `checks-that-bite`.
   1. Run `git worktree add --detach "$SDLC_TMP_WORKTREES/base" HEAD` with that literal path shape, which the stray-worktree hook requires.
   2. Copy the new test file into that worktree and run it there. It must fail, because the exports are missing and the retry cases are red.
   3. Apply one mutant locally (add 400 to the retryable set) and show that case `retry 4` fails.
   4. Revert the mutant and remove the throwaway worktree.
6. Contract dependents. Found with `git grep -ln "providers/anthropic" -- '*.test.ts'` and `git grep -ln "anthropicProvider" -- '*.test.ts'`:
   - `anthropic-tool-loop.test.ts`, `anthropic-sse.test.ts`, `anthropic-request-body.test.ts` and `build-key-safety.test.ts` either stub only 200 responses or never call `stream`. They stay unchanged, and the live-agent suite guard covers them.
   - `anthropic-key-validation.test.ts` stubs a 500, but it tests `validateAnthropicKey`, which this step does not touch.
   - `src/agent/gates.test.ts` checks only two things: `anthropicProvider` is absent from the root barrel, and `src/agent/` imports no third-party package. The new code adds no import, so it stays green.
   - `corpus-genui-data.test.ts` and `tools/corpus-genui/generate.test.ts` only grep for the constructor name.
   - No existing test may change. If one must, STOP and report `unresolved:`, because the conductor decides scope.
7. Builder Notes must include the line `Needs Kim: confirm retries=2, backoff 500/1500 ms, Retry-After cap 10000 ms`. Do not add an em dash on any line you write.
8. Gates. This is the only step, so it is also the gates green step. Run `npm run check` (about 31 s), the live-agent suite and the tools suite, and fix any red this step introduced.

Depends on: none.
### Acceptance criteria
- `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/anthropic-retry.test.ts`
- `out=$(npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/anthropic-retry.test.ts --reporter=verbose 2>&1) && for t in 'retry 1: a 503 then a 200 succeeds on attempt 2 and yields the text' 'retry 2: a 429 with Retry-After 2 waits 2000 ms before attempt 2' 'retry 3: three 503s throw upstream error 503 after exactly 3 calls' 'retry 4: a 400 and a 401 are not retried' 'retry 5: a fetch TypeError then a 200 retries and succeeds' 'retry 6: a caller abort during backoff rejects at once with no pending timer' 'retry 7: a healthy first attempt makes one call and sets no timer' 'retry 8: a 200 whose body errors mid-stream is surfaced and not retried'; do printf '%s\n' "$out" | grep -F '✓' | grep -qF "$t" || exit 1; done`
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
- The replacement criterion 2 passes `steps.py` lint: verified by running `steps.py lint` on a copy of this step's criteria under `/tmp` (`steps lint: ok`, exit 0). It holds no count tool, glob, `ls` or `find`, and its only `||` ends in `exit 1`.
- The verbose reporter prints one line per passing test in the form `✓ |packages| <path> > <describe> > <title> <ms>`, also when not on a TTY: verified by running `npx vitest run --project packages .../anthropic-tool-loop.test.ts --reporter=verbose` (vitest 4.1.9).
- The title check catches a missing title: verified by running it under `bash -c` on `anthropic-tool-loop.test.ts`. Two real titles exit 0; with one fake title it exits 1.
- Criteria 1 and 2 are red at HEAD for the right reason: the test file does not exist, so vitest prints "No test files found" and exits 1 (checked under `bash -c`). Criteria 3, 4, 5 and 6 are red at HEAD only because the exports or the test file are missing. The scope part of criterion 5 and the em-dash count part of criterion 6 (48 em dashes at base) are green at HEAD.
- `runRound`'s single upstream `fetch` is at `anthropic.ts:312`, its `!res.ok` throw is at `anthropic.ts:323-333`, and `validateAnthropicKey` is a separate fetch at `anthropic.ts:292`: verified by `grep -n`.
- Returning the last retryable Response on exhaustion keeps today's error message byte-identical: verified by reading `anthropic.ts:323-333`, which builds the message from `res.status` and `res.text()`.
- No existing test sends a 429 or 5xx through `anthropicProvider().stream`: verified by `git grep -nE "status: (429|5[0-9][0-9])"` over a2ui tests. The hits are `anthropic-key-validation.test.ts:29` (tests `validateAnthropicKey`), `chat-route.test.ts` (the route's own 503) and `mcp/client.test.ts` (MCP client). None of them reaches `runRound`.
- No existing symbol is named `fetchWithRetry`, `ANTHROPIC_MAX_RETRIES` or `ANTHROPIC_RETRY_*`, and no test or snapshot pins the `./agent` export list: verified by `git grep` (no hits) and by searching for export-surface files (none).
- Every guard is green at HEAD, under `bash -c`: the live-agent suite exits 0 in 8 s (700 passed, 1 skipped), the tools suite exits 0 in 5 s (364 passed), and `npm run check` exits 0 in 31 s. The longest is about 31 s, so `guard timeout: 120` covers it.
- No SPEC or ADR says the Anthropic provider never retries: carried from `.sdlc/transport-retry/planner-L2.md` Assumptions (a `git grep` over `.claude/docs/**` found nothing).

## Risks
- When `fix/anthropic-sse-deadline` merges, it wraps the same `fetch` with a first-byte timeout. The two-line call-site change keeps the conflict small. Whoever merges second must put that timeout inside the `doFetch` closure, so each attempt gets its own deadline and a timeout abort is not mistaken for a caller abort.
- With fake timers, the `fetch` stub and the provider's async generator can interleave in ways that make `retry 2` or `retry 6` flaky if timers advance before the first call settles. The builder should use `advanceTimersByTimeAsync`, and should check call counts only after awaiting microtasks.
- Criterion 2 depends on the vitest 4 verbose line format (`✓` followed by the test path and title). A vitest upgrade that changes that format would turn criterion 2 red even though the tests pass. Criterion 1 still shows whether they pass.
