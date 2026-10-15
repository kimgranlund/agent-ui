## Task goal
Make each turn report what it assembled and what the provider billed: a declared whole-prompt budget with a structured over-budget result (never silent truncation), prompt-section sizes on `TurnTrace`, and token usage from the provider on the trace and the devtools timeline. Tracks GH #1809 and the token accounting remainder of GH #1797.

## Step 3: Anthropic adapter reports one usage event per upstream request
level: L3
### Read first
- `packages/agent-ui/a2ui/AGENTS.md`
### Do
Depends on: step 1 (the `'usage'` kind), and on the lane holding PRs #1805 and #1806. Both merged on main on 2026-10-05 and their test files are on main; this lane gets them from its main resync.

1. **Precondition.** First confirm that `src/live-agent/anthropic-timeouts.test.ts` and `anthropic-retry.test.ts` exist on HEAD. If either is absent, stop with Status blocked: "depends on PRs #1805/#1806 synced into the lane".
2. **Read the merged adapter.** #1805 adds a first-byte deadline and `readOrStall` in `runRound`; #1806 adds `fetchWithRetry` before streaming. Neither changes `parseAnthropicSSE`'s signature.
3. **`packages/agent-ui/a2ui/src/agent/providers/anthropic.ts`.**
   - Export an `interface UsageCollector` and `newUsageCollector()`. The collector is separate from `ToolUseCollector`, which stays byte-quiet.
   - `parseAnthropicSSE(chunk, onEvent?, tools?, usage?: UsageCollector)`:
     - `message_start.message.usage` seeds every numeric field present;
     - each `message_delta.usage` overrides each numeric field present (cumulative, latest wins);
     - map snake_case to camelCase: `input_tokens` to `inputTokens`, `output_tokens` to `outputTokens`, `cache_read_input_tokens` to `cacheReadInputTokens`, `cache_creation_input_tokens` to `cacheCreationInputTokens`;
     - at `message_stop`, emit `{kind: 'usage', usage}` immediately before the existing `done` event, only when a collector was passed and a usage object was seen.
   - The Anthropic field shapes are cited in `.sdlc/context-budget-trace/architect-L1.md` (streaming doc fetched 2026-10-05).
   - `runRound` creates one collector per call, after the response is accepted (after retry resolution and the `res.ok` check), and passes it to both parse calls: the main loop and the trailing flush. The result is one event per upstream request, each tool-loop round reports once, and a retried request never double-reports.
   - Update the `parseAnthropicSSE` doc comment.
4. **Keep the existing tests untouched.** `anthropic-sse.test.ts` stays as it is: its :68 two-argument event sequence is unaffected because emission needs the fourth argument.
5. **New `src/live-agent/anthropic-usage.test.ts`.** Cases:
   - (a) a fixture with `message_start` usage (input, both cache fields, output 1) and `message_delta` usage `{output_tokens: 57}` yields exactly one usage event with the merged values;
   - (b) `message_delta` input or cache fields override the seed;
   - (c) a collector with no usage frames emits none;
   - (d) the two-argument call emits none and yields identical text;
   - (e) mocked-fetch tool loop (the `anthropic-tool-loop.test.ts` shape): two upstream requests give two usage events in order;
   - (f) the text-only path gives one event;
   - (g) `produce()` over `anthropicProvider` with mocked fetch (note line first) gives a `trace.usage` equal to the per-request sum.
6. **Regression guard scope.** The guard runs only the adapter's test dependents, not the whole producer dirs. They come from `git grep -ln` for `providers/anthropic` and `anthropicProvider` over `*.test.ts`: the `live-agent/anthropic*` files, `build-key-safety`, `provider-dispatch`, `chat-route`, `mcp-boot`, `mcp-enablement` and `agent/gates`. The whole suite runs in step 4 (rule 14). This set is green on the current tree, while the producer dirs stay red until step 1 lands.

Focused check: `npx tsc`.
### Acceptance criteria
- `for f in anthropic-timeouts anthropic-retry; do test -f "packages/agent-ui/a2ui/src/live-agent/$f.test.ts" || exit 1; done`
- `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/anthropic-usage.test.ts`
- `grep -qF "export function newUsageCollector(" packages/agent-ui/a2ui/src/agent/providers/anthropic.ts`
- (guard) `git diff --quiet "$SDLC_BASE_SHA" -- packages/agent-ui/a2ui/src/live-agent/anthropic-sse.test.ts`
- (guard) `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/anthropic packages/agent-ui/a2ui/src/live-agent/build-key-safety.test.ts packages/agent-ui/a2ui/src/live-agent/provider-dispatch.test.ts packages/agent-ui/a2ui/src/live-agent/chat-route.test.ts packages/agent-ui/a2ui/src/live-agent/mcp-boot.test.ts packages/agent-ui/a2ui/src/live-agent/mcp-enablement.test.ts packages/agent-ui/a2ui/src/agent/gates.test.ts`
- (guard) `{ git diff --name-only "$SDLC_BASE_SHA" -- . ":(exclude).sdlc"; git ls-files --others --exclude-standard -- . ":(exclude).sdlc"; } | grep -vxE "packages/agent-ui/a2ui/src/agent/(meta-line|agent-transport|system-prompt|prompt-budget|produce|index)\.ts|packages/agent-ui/a2ui/src/agent/providers/anthropic\.ts|packages/agent-ui/a2ui/src/live-agent/(meta-line|prompt-budget|produce-budget-usage|produce-loop|a2ui-surface-toggle|genui-exclusive|anthropic-usage)\.test\.ts|packages/agent-ui/devtools/src/timeline/(events\.ts|turn-usage\.test\.ts)|packages/agent-ui/devtools/src/capture/format\.ts" | { ! grep -q .; }`
