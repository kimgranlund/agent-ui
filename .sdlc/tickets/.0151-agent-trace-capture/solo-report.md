# T-0151 solo report

- `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/agent-trace.test.ts packages/agent-ui/a2ui/src/live-agent/dev-proxy-abort.test.ts` exit 0
- `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent packages/agent-ui/a2ui/src/layering.test.ts packages/agent-ui/a2ui/src/agent/gates.test.ts` exit 0
- `npm run check` exit 0
- `npm run traces` exit 0
- `git check-ignore -q .agent-traces/x.jsonl` exit 0
- `! git grep -q "from '@agent-ui/devtools" -- packages/agent-ui/a2ui` exit 0
- `! git grep -q "trace-log" -- packages/agent-ui/a2ui/tools/agent/worker packages/agent-ui/a2ui/tools/agent/chat-validation.ts` exit 0
- `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/agent-trace.test.ts -t "Croupier"` exit 0
- `npx vitest run --project site site/lib/a2ui-activity.test.ts` exit 0

Reasoning finding: the Anthropic adapter sends `thinking: {type: 'adaptive'}` with no `display`; on Sonnet 5 and Haiku 5.5 the API default is `display: "omitted"`, so thinking deltas arrive with empty text and the Reasoned step has no excerpt. Not a proxy capture bug; the fix is `display: "summarized"` in `buildRequestBody` (src/agent/providers/anthropic.ts), left as a follow-up. The trace records it per round as `thinking: {deltas, chars}`.

verify: needed
