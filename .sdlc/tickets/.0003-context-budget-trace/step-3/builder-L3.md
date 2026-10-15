<!-- role=builder level=L3 model=opus effort=high -->
## Status
done

## Changes
- `packages/agent-ui/a2ui/src/agent/providers/anthropic.ts`: adds the exported `UsageCollector` interface and `newUsageCollector()`. `parseAnthropicSSE` takes an optional fourth `usage` argument: `message_start.message.usage` seeds the counts, each `message_delta.usage` overrides the fields it carries (snake_case mapped to camelCase), and `message_stop` emits `{kind:'usage'}` just before `done`. `runRound` creates one collector per accepted request and passes it to the main parse loop and the trailing flush. The doc comment is updated.
- `packages/agent-ui/a2ui/src/live-agent/anthropic-usage.test.ts` (new): cases (a) to (g) as listed in the handoff.

## Checks
- Precondition loop `for f in anthropic-timeouts anthropic-retry; do test -f ...; done`: exit 0. Both files are present on HEAD.
- `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/anthropic-usage.test.ts`: exit 0, 7/7 passed.
- `grep -qF "export function newUsageCollector(" packages/agent-ui/a2ui/src/agent/providers/anthropic.ts`: exit 0.
- (guard) `git diff --quiet "$SDLC_BASE_SHA" -- packages/agent-ui/a2ui/src/live-agent/anthropic-sse.test.ts`: exit 0.
- (guard) `npx vitest run --project packages` over the anthropic* files plus build-key-safety, provider-dispatch, chat-route, mcp-boot, mcp-enablement and agent/gates: exit 0, 13 files and 104 tests passed.
- (guard) scope pipeline (`git diff --name-only` plus untracked files, filtered against the allowlist): exit 0.
- `npx tsc` (focused check): exit 0.

## Notes
- `SDLC_BASE_SHA` is `dce7f6fe`, the WIP commit holding steps 1 and 2. This step's diff against it is only the two files above.
- The collector is created after the `res.ok` check and also after the `res.body === null` check. That is equivalent to the handoff's "after retry resolution and the `res.ok` check", because no parse can run before the reader exists.
- `anthropic.ts` now does a type-only import of `TokenUsage` from `../meta-line.ts`, which is a new direct edge. It stays inside the package, `meta-line.ts` has no imports, and `agent-transport.ts` already uses the same edge. The gates tests pass.
- When upstream never sends `inputTokens` or `outputTokens`, the emitted usage reports them as 0. The cache fields appear only when upstream sends them. An empty `usage: {}` object still counts as seen and emits zeros. Real Anthropic frames always carry `output_tokens`, so I left this as is.
