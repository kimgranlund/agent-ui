# Build breakdown: T-0060 response type selection

Source: `.claude/docs/spec/response-type-selection.spec.md` (RTS-R*), `.claude/docs/lld/response-type-selection.lld.md`, ADR-0242 (proposed). Every step runs `npm run check` plus the named tests; gates judged by exit code. One writer per file: the file lists below are disjoint. Steps 1 and 7a may run in parallel with each other; everything else follows the merge order. Builder levels per `sdlc-lite:level-rubric`.

## Merge order

1 → 2 → 3 → 4 → 5 → 6 → 7 (7a may start after 1; 7b after 3) → 8

## Steps

### Step 1 (builder L2): the pure response-type module
Files: `packages/agent-ui/a2ui/src/agent/response-type.ts` (new), `packages/agent-ui/a2ui/src/agent/response-type.test.ts` (new).
Does: `RESPONSE_TYPES`, `ResponsePreference`, `RENDER_SURFACE_TOOL_NAME`, `renderSurfaceTool(openSurfaceIds)`, `detectUserOverride(input)`, `classifyResponse`, `isLegacyShape`. Zero imports beyond `import type` from `agent-transport.ts`.
Accept: `npx vitest run --project packages packages/agent-ui/a2ui/src/agent/response-type.test.ts` exits 0 with tests for: the tool schema requires `jsonl`; the description names each open surface id; `detectUserOverride` returns `text` for "just tell me", `surface` for "show me as a table", `undefined` for "book a table" and for every `kind:'client'` input; `isLegacyShape` is true for `{"version":"v1.0",...}` and false for prose. `JSON.stringify(renderSurfaceTool(['main'])).length < 1500`.

### Step 2 (builder L3): the seam and the Anthropic adapter
Files: `packages/agent-ui/a2ui/src/agent/agent-transport.ts`, `packages/agent-ui/a2ui/src/agent/providers/anthropic.ts`, `packages/agent-ui/a2ui/src/agent/providers/anthropic-terminal-tool.test.ts` (new).
Does: RTS-R2. `terminalTools?`, `toolChoice?` on the stream request; terminal-only rounds yield text live and end on a terminal call with one `executeTool` and no continuation; mixed rounds unchanged; `buildRequestBody` emits `tool_choice` only when no `thinking` is sent.
Accept: the new test exits 0 covering RTS-R2 AC1 to AC3 with scripted SSE fixtures (a `fetch` stub, no network); `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/anthropic-sse.test.ts` still exits 0; `npm run check` exits 0.

### Step 3 (builder L4): the produce loop
Files: `packages/agent-ui/a2ui/src/agent/produce.ts`, `packages/agent-ui/a2ui/src/agent/meta-line.ts`, `packages/agent-ui/a2ui/src/agent/session.ts`, `packages/agent-ui/a2ui/src/live-agent/produce-response-type.test.ts` (new).
Does: RTS-R1, R3, R4, R5, R6 (loop half), R8, R9. The tool offer and capture wrapper, the text channel as reply with the legacy fallback, `textDelta`, tool-aware repair feedback, `SURFACE_DEGRADED`, `SURFACE_REQUESTED`/`SURFACE_REQUESTED_UNMET`, `responsePreference` and `onRepairRound` options, `textDelta` on the envelope, `appendAssistantTurn(session, jsonl, note?)` (RTS-R12).
Accept: the new test exits 0 covering RTS-R1 AC1 and AC2, R3 AC1 to AC3, R5 AC1 and AC2, R6 AC1 and AC2, R8 AC1 and AC2, R9 AC1, R12 AC1 (a two-turn session) with stub providers (the `produce-loop.test.ts` shapes); `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/` exits 0 unedited (R4 AC1); `node --experimental-strip-types packages/agent-ui/a2ui/tools/agent-eval/eval-agent-behavior.ts selftest` and `.../testkit/kit.ts selftest` exit 0 unedited.

### Step 4 (builder L2): the prompt stack
Files: `packages/agent-ui/a2ui/src/agent/prompts/grammar.md`, `packages/agent-ui/a2ui/src/agent/prompts/response-preference-text.md` (new), `packages/agent-ui/a2ui/src/agent/prompts/response-preference-surface.md` (new), `packages/agent-ui/a2ui/src/agent/system-prompt.ts`, `packages/agent-ui/a2ui/src/agent/assets.gen.ts` (regenerated only), `packages/agent-ui/a2ui/src/live-agent/prompt-equivalence.baseline.json` (recaptured only), `packages/agent-ui/a2ui/src/live-agent/prompt-budget.test.ts` (only if a measured constant must move, with the measurement in the commit).
Does: RTS-R7 (prompt half) and R11. Grammar intro rewrite to the text-channel contract; the tenth `buildSystemPrompt` parameter and the `response-preference` section; `node scripts/generate-agent-assets.mjs`; the deliberate recapture per skill `a2ui-prompt-authoring`.
Accept: `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/prompt-equivalence.test.ts packages/agent-ui/a2ui/src/live-agent/prompt-drift.test.ts packages/agent-ui/a2ui/src/live-agent/prompt-budget.test.ts packages/agent-ui/a2ui/src/agent/agent-assets-freshness.test.ts` exits 0; the LLD §4 measurement prints a default composition at most 46,400 chars (42,209 plus the K6 room) with `'auto'` byte-identical to the nine-parameter call; `grep -c "do NOT reply in prose" grammar.md` prints 0.

### Step 5 (builder L2): the hosts
Files: `packages/agent-ui/a2ui/tools/agent/chat-validation.ts`, `packages/agent-ui/a2ui/tools/agent/dev-proxy-plugin.ts`, `packages/agent-ui/a2ui/tools/agent/worker/index.ts`, `packages/agent-ui/a2ui/tools/agent/chat-validation.test.ts`.
Does: `validateResponsePreference` (only the three literals pass), threaded into `produce()` by both hosts (RTS-R6 AC3, R7).
Accept: `npx vitest run --project tools packages/agent-ui/a2ui/tools/agent/` exits 0 with a test that each non-literal value is dropped; `npm run check` exits 0.

### Step 6 (builder L3): the admin surface
Files: `packages/agent-ui/app/src/controls/agent-admin/agent-admin-schema.ts`, `packages/agent-ui/app/src/controls/agent-admin/agent-admin.ts`, `packages/agent-ui/app/src/controls/conversation/conversation.ts`, `site/lib/admin-live-runner.ts`, `site/lib/admin-live-runner.test.ts`, every `appendAssistantTurn` call site under `site/` (pass the note, RTS-R12), the app's agent-admin test that pins the settings schema.
Does: the `responsePreference` persona setting (default `auto`, omitted from the request when `auto`), the runner's `text-delta` event, the bubble painting deltas and replacing them with the final note (RTS-R5 AC3, R7 AC2). No strip redesign; `ActivityStep` untouched.
Accept: `npx vitest run --project packages packages/agent-ui/app/src/controls/agent-admin packages/agent-ui/app/src/controls/conversation` and `npx vitest run --project site site/lib/admin-live-runner.test.ts` exit 0; `npm run check` exits 0; `npm run e2e:admin` exits 0 locally.

### Step 7a (builder L2): the eval leg and the labelled set
Files: `packages/agent-ui/a2ui/tools/agent-eval/observe.ts`, `score.ts`, `legs.ts`, `cases.ts`, `scripted.ts`, `eval-agent-behavior.ts`, `cases.test.ts`, `legs.test.ts`, `eval-agent-behavior.test.ts`, `fixtures/response-type-cases.json` (new, at least 40 cases), `fixtures/scripted-turns.json`, `fixtures/pins.json`.
Does: RTS-R10. `hasText`, `hasSurface`, `toolCalled`, `eventual-text`; `scoreResponseType`; `runResponseTypeLeg` with the two rates and per-case first-line timing on live; the scripted turns (clean text, clean tool, degrade, text override, a two-turn continuation on a seeded session, one seeded wrong choice expected to fail); `observeTurn` accepts an optional `session`; the tool-round shape in `scripted.ts`.
Accept: `npm run eval:agent-behavior -- selftest` exits 0 and its summary line counts 12 or more turns; editing the seeded turn's `expect.exitCode` to 0 makes it exit 1 (then restore); `npx vitest run --project tools packages/agent-ui/a2ui/tools/agent-eval/` exits 0 including the count-and-literal assertions on the labelled set.

### Step 7b (builder L1): kit scenarios
Files: `packages/agent-ui/a2ui/tools/testkit/scenarios/response-type-text.scenario.json`, `response-type-surface.scenario.json`, `response-type-override.scenario.json` (all new), the scenarios' pin entry if the kit pins them.
Does: three scenarios on the existing `rounds` tool-round shape asserting `expect.produce` and `expect.tools`.
Accept: `node --experimental-strip-types packages/agent-ui/a2ui/tools/testkit/kit.ts run <each file>` exits 0; `kit.ts selftest` exits 0.

### Step 8 (builder L1): records
Files: `.claude/docs/spec/a2ui-live-agent.spec.md` (amendment pointers, a version bump), `.claude/docs/lld/a2ui-live-agent.lld.md` (fold), `.claude/docs/references/agent-model.md`, `.claude/skills/a2ui-jsonl-mcp/references/producer-order-and-yield.md`, `CHANGELOG.md`, the sitemap indexes (`node scripts/generate-sitemap.mjs`).
Does: the Repairs cell of ADR-0242; the ADR's ratification by Kim is reported, never performed by a builder.
Accept: `python3 <docs plugin>/scripts/doc_lint.py` on each touched document exits 0; `npx vitest run --project site site/lib/docs-grammar.test.ts site/lib/adr.test.ts site/lib/sitemap.test.ts` exits 0; a grep for the em dash character over the touched files prints only the ADR H1 line the adr gate requires.

## Live measurement (Kim, manual, not a gate)
Before step 3 merges: `npm run eval:agent-behavior -- live --leg response-type` on `main` with the step 7a fixtures cherry-picked, to record the K1 to K3 baselines in the PRD's table. After step 8: the same run on the built branch fills the Result column.
