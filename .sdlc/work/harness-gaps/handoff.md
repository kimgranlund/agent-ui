## Goal
Map what agent-ui's agent runtime and agent-admin app already do against what a well-rounded general agent harness does, and list the real gaps with file references.

## Context
agent-ui is a UI library; its agent runtime is `packages/agent-ui/a2ui/src/agent/produce.ts` (a bounded generate, heal, validate loop for A2UI), `providers/` (Anthropic only implemented), `packages/agent-ui/a2ui/tools/agent/` (dev proxy, `integrations/tool-dispatch.ts`, MCP allowlist), `packages/agent-ui/devtools/` (transports, recordTurn), `site/lib/agent-runtime.ts`, and the agent-admin app in `packages/agent-ui/app/src/controls/agent-admin/`. Vocabulary: `.claude/docs/references/agent-model.md` (do not use bare "the harness"). Read-only; do not edit anything.

## Question
For each of these eight areas, state what exists (with file:line), what is missing, and how confident you are: (1) a general tool-use agent loop with stop conditions and turn budget, (2) context management (compaction, summarizing, token budget), (3) durable cross-session memory, (4) the tool layer (permissions or approvals, timeouts, retries, sandboxing), (5) multi-provider support, (6) end-to-end evaluation of agent behavior, cost and latency metrics, (7) observability (structured traces, per-step cost and errors), (8) multi-agent orchestration (do AgentTeam records actually run, delegate, hand off). Cite code, not file names alone.

## Output rule
You cannot write files. Your final answer text IS the report: do not say it was saved anywhere. Give one section per area (1 to 8) with `what exists (file:line)`, `what is missing`, `confidence (high, medium, low)`. A stub that only says "done" is a failed run.
