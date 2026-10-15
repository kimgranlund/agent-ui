<!-- role=scout level=L1 model=claude-haiku-4-5 effort=low -->
Based on my exploration of the agent-ui runtime and agent-admin app, here is the mapping of the eight harness areas:

## Area 1: General tool-use agent loop with stop conditions and turn budget

**What exists (with file:line):**
- `produce.ts:962`: Bounded async generator loop with `maxRounds` parameter (ProduceOptions.maxRounds)
- `produce.ts:1000`: Loop bounded by `for (let round = 0; round < opts.maxRounds; round++)`
- `produce.ts:1079-1140`: Self-correct rounds retry on validation failure until maxRounds exhausted
- `produce.ts:294-299`: ProduceHalt thrown when maxRounds exhausted (carries failure codes)
- `produce.ts:1048-1060`: Tool integration via `opts.tools` and `executeTool` passed to provider.stream()
- `anthropic.ts:386-427`: Tool execution loop with model tool_use/tool_result round-trips (GH #49)

**What is missing:**
- Per-turn token budget (only maxRounds, no token accounting)
- Explicit stop conditions beyond maxRounds and validation success (no early exit criteria)
- Token counting or cost accounting for individual turns
- Latency metrics at the turn/round level (only DevtoolsEvent.turn-end.ms for full turn)

**Confidence:** High — loop structure is clear and documented via ADRs; missing pieces are token/cost tracking

---

## Area 2: Context management (compaction, summarizing, token budget)

**What exists (with file:line):**
- `session.ts:76-78`: Pure reducer nextTurn() that frames client messages for agent consumption
- `produce.ts:964-967`: Exemplar retrieval (top-k via `retrieve()`) and mini-skill selection 
- `mini-skills.ts:41,68`: Mini-skills prose (~3857 chars ≈ ~964 tokens per module), stored as committed module constant
- `produce.ts:1051`: messagesFor() passes exemplars/failures to buildSystemPrompt for turn-time composition
- Agent model reference shows no context summarization or compaction mentioned

**What is missing:**
- No context window compaction or message summarization
- No rolling window or sliding buffer on turn history
- No token counting for context budget
- No pruning/archival of old turns
- No conversation summarization mechanism

**Confidence:** High — only exemplar retrieval and mini-skill selection exist; no higher-level context management

---

## Area 3: Durable cross-session memory

**What exists (with file:line):**
- `agent-team.ts:17`: StorageAdapter seam via ADR-0193 (localStorage tier for config, IndexedDB for large text)
- `agent-model.md:165-172`: RESOURCE_IDB_TEXT_THRESHOLD_CHARS (4,000) routes large text to IndexedDB
- `agent-admin-schema.ts`: AgentConfigSnapshot seeded from SettingsStore at turn time
- Session turns persist in browser via `Session` type but are in-memory only
- DevtoolsCapture.ts:31-42 exports session for capture/replay but does not persist it

**What is missing:**
- No cross-session turn history persistence
- No durable memory store for agent state between sessions
- No recall/retrieval of prior conversation segments
- Session turns live only in browser memory; lost on page reload

**Confidence:** High — only config/settings persist; turn history is session-only

---

## Area 4: Tool layer (permissions, approvals, timeouts, retries, sandboxing)

**What exists (with file:line):**
- `tool-dispatch.ts:50-71`: Tool validation and execution with ExecuteContext (signal, apiKey)
- `tool-dispatch.ts:57-68`: Input validation against manifest's input_schema before executor runs
- `tool-dispatch.ts:34-37`: API key read from env at dispatch time (SPEC-R18, never stored)
- `anthropic.ts:307-309`: Abort signal passed through to tool executor and provider stream
- `dev-proxy-plugin.ts`: MCP integration with tool allowlist (ADR-0168 cl.3-4)
- `providers/index.ts:41-53`: Defensive dispatch with graceful degradation for unimplemented providers

**What is missing:**
- No explicit timeout mechanism for individual tool calls (only abort signal)
- No retry logic at tool-execution layer (retries only on A2UI validation failures)
- No sandboxing isolation for tool execution (runs in same process)
- No permission approval workflow (only allowlist filtering server-side)
- No rate limiting or call counting per tool

**Confidence:** High — tool layer has validation and signal cancellation but lacks timeout/retry/sandbox

---

## Area 5: Multi-provider support

**What exists (with file:line):**
- `providers/index.ts:28-30`: IMPLEMENTED dispatch table (only anthropic wired)
- `openai.ts:14-20`: OpenAI stub with "not implemented" error (ADR-0073)
- `gemini.ts` (inferred): Gemini stub (registry marks implemented: false)
- `providers-config.ts`: providers.json registry with multiple provider rows (Anthropic only implemented)
- `anthropic.ts:1-19`: Anthropic provider fully implemented with SSE parsing and tool support

**What is missing:**
- OpenAI adapter not implemented (stub only)
- Gemini adapter not implemented (stub only)
- No multi-provider fallback or load balancing
- No provider-agnostic token counting (provider-specific)

**Confidence:** High — only Anthropic is live; OpenAI/Gemini stubs confirm unimplemented state

---

## Area 6: End-to-end evaluation of agent behavior, cost and latency metrics

**What exists (with file:line):**
- `eval-genui-corpus.ts:1-50`: Five-leg evaluation CLI (collect, generate, judge, apply, report) for GenUI
- `eval-genui-corpus.ts:90-112`: Judge leg runs rubric-based scoring on generated payloads
- `devtools/capture/format.ts:31-42`: DevtoolsCapture format with session and timeline events
- `devtools/timeline/events.ts:34,70`: turn-end event tracks millisecond duration (ms field)
- `devtools/timeline/events.ts:80-81`: "turn-end" records status, lines count, and latency

**What is missing:**
- No token count tracking (input/output tokens per turn or provider)
- No cost accounting (no per-token or per-call costs tracked)
- No latency breakdown (only total turn-end.ms, no per-stage latencies)
- No agent behavior evaluation framework (only GenUI corpus eval exists, not general agent behavior)
- No A/B testing or comparative evaluation infrastructure

**Confidence:** High — latency tracked at turn level; no token/cost tracking visible anywhere

---

## Area 7: Observability (structured traces, per-step cost and errors)

**What exists (with file:line):**
- `meta-line.ts:84-96`: TurnTrace captures turnIndex, query, exemplarIds, rounds, healed, failureCodes, model
- `produce.ts:977-985`: traceFor() composes TurnTrace from loop state
- `produce.ts:1140-1165`: TurnTrace attached to outgoing meta-line after round success
- `devtools/capture/format.ts`: DevtoolsCapture format records timeline of turn-start, line, meta, render, turn-end, error events
- `recorded-transport.ts:89-105`: RecordedTransport replays turns with progress stages

**What is missing:**
- No structured error codes or error taxonomy beyond validator ErrorCode union
- No per-step cost (no input/output token counts in TurnTrace)
- No per-stage latency breakdown (no send/reasoning/validating/retry latency tracking)
- No distributed tracing (no trace IDs or request correlation)
- No metrics emission (no StatsD, OpenTelemetry, or similar integration)

**Confidence:** High — TurnTrace and DevtoolsEvent provide basic observability; missing cost/detailed latency

---

## Area 8: Multi-agent orchestration (do AgentTeam records actually run, delegate, hand off)

**What exists (with file:line):**
- `agent-team.ts:36-42`: AgentTeam record with gmAgentId and members[] array
- `agent-team.ts:69-106`: validateAgentTeam() validates team against known agent roster (closed validation)
- `agent-team-prompt.ts`: composeTeamPromptSection() composes "## Your team" block into GM's prompt (agent-model.md:73-75)
- `meta-line.ts:172-176`: TeamDeclaration wire shape for model-authored team proposals (ADR-0203 cl.4)
- `handleTeamDeclared`: Mints team record from declaration (site/pages/agent-admin-app.ts, per agent-model.md:88)

**What is missing:**
- No actual team delegation or hand-off at runtime (ADR-0203 cl.1: "never runs"; IDR-0001 fence)
- No team execution orchestration (GM reads team as prose only, routing is manual)
- No multi-agent conversation or turn-passing mechanism
- No protocol for agents to invoke each other or escalate to team members
- TeamDeclaration is proposal-only; no runtime execution of team workflows

**Confidence:** High — AgentTeam records persist and compose into prompts; no runtime orchestration exists

---
