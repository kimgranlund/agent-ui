---
name: agent-ui-integration-standards
description: >-
  THIS repo's tool/integration enablement laws (ADR-0168 / SPEC-R16–R19): adding an integration,
  a new tool for the agent, integration keys/auth (serverKey/envKey, why a keyed tool isn't
  offered), tool input validation (input_schema, malformed model input, is_error tool_result),
  the id ≠ tool.name ≠ label split, the shared buildToolDispatch on both live arms, and where
  registry code lives (tools/agent/, never src/agent/). Use for "add an integration", "new tool
  for the agent", "how do integration keys work", "validate tool input", "why isn't my tool
  offered". NOT for catalog entries (agent-ui-catalog); NOT for A2UI payloads (a2ui-compose);
  NOT for MCP servers (deferred, ADR-0168 Non-goals).
disable-model-invocation: false
user-invocable: false
---

# agent-ui integration enablement laws (ADR-0168)

Five ratified laws governing every tool/integration the live agent can call. Sources of record:
ADR `.claude/docs/adr/0168-integration-manifest-registry-validated-dispatch-server-keys.md`
(accepted 2026-08-04) and SPEC `.claude/docs/spec/a2ui-live-agent.spec.md` v0.9 §3.6. This skill
states the laws; the cited lines are the authority — re-derive there, never from a peer's quote.
ADR/SPEC line numbers are frozen records; code cites (verified 2026-08-04) are symbol-first —
on drift, Grep the symbol name, then repair the line number here in the same change.

## 1 · The manifest law — one integration, one manifest, three separate facts

Every integration is an `IntegrationManifest` (`registry.ts:34`) registered via
`registerIntegration()` (`registry.ts:65`), never an entry in a hardcoded array. The registry
`id` (enablement wire vocabulary), the wire `tool.name` (what the model sees), and the admin
`label` (human display text) are THREE independent facts — no string does double duty.
Registration boot-fail-fasts on a duplicate `id` OR duplicate wire `tool.name`.
*(ADR-0168 cl.1 :52-58, cl.2 :60-65 · SPEC-R16 :692-699)*

**Bad (the retired pre-0168 failure):** one `Integration.id` string triples as registry key,
wire name, and admin label — a label change is a wire rename is a registry re-key, three blast
radii in one edit (ADR-0168 Context §1 :22-27).
**Good (illustrative, not the shipped manifest):**
`{id: 'flight-prices', tool: {name: 'search_flights', …}, label: 'Flight prices'}` — each fact
changes without touching the others. `tool.name` MAY equal `id` (the shipped v1 manifests do);
nothing requires it, and nothing else may assume it.

## 2 · Validate before execute — the schema is not advisory

The manifest's declared `input_schema` gates every dispatch: the ONE shared minimal-subset
checker `validateToolInput` (`validate-input.ts:61`; `type:'object'` + `required` + primitive
property types, hand-rolled, no dependency) runs BEFORE the executor. Malformed model input
never reaches the executor and never throws the turn — it surfaces as a structured `is_error`
tool_result naming the tool + failing fields (the GH #49 degrade-the-answer contract). A
manifest declaring schema constructs beyond the subset fail-fasts at registration
(`assertSupportedSchema`, `validate-input.ts:97`). Per-executor guards are defense-in-depth
only, never the first line. *(ADR-0168 cl.3 :67-75 · SPEC-R17 :708-716)*

## 3 · Server keys never cross to the browser

A manifest declares `auth: 'none' | 'serverKey'`; iff `'serverKey'` it carries `envKey` — an
env-var NAME, never a value (the `providers.json` discipline). The HOST resolves the value at
dispatch time in BOTH hosts — dev proxy via its `loadEnv`-merged env, production Worker via its
env binding — and hands it to `execute` through `ExecuteContext.apiKey` (`registry.ts:27`). An
unprovisioned keyed manifest is EXCLUDED by `resolveIntegrations` (`registry.ts:103`): the model
is never offered a tool that cannot run. No key value ever reaches the browser, a tool_result,
or a log line — ADR-0073 cl.5's trust boundary extended verbatim to integration keys, grep-gated
by SPEC-N2. *(ADR-0168 cl.4 :77-84 · SPEC-R18 :725-732)*

## 4 · ONE shared dispatch on both live arms

Both routes — prose `/chat` AND produce — in both hosts build tool wiring through the same
`buildToolDispatch` (`tool-dispatch.ts:50`; callers `dev-proxy-plugin.ts:191,260` and
`worker/index.ts:180,253`). Per-route or per-host dispatch forks are the GH #402 defect class
(a toggle silently inert on one arm) — new arms consume the shared builder, never re-implement
validate→key→execute. An absent `integrations` field keeps a request byte-identical to the
pre-0168 shape. *(ADR-0168 cl.5 :86-97 · SPEC-R19 :742-748)*

## 5 · Where things live — the ADR-0137 shell law

Registry, manifests, validator, and dispatch are site-internal in
`packages/agent-ui/a2ui/tools/agent/integrations/` (anchor: `registry.ts` there — the shipped
pattern to copy for a new manifest). The portable `src/agent/` core stays types-only/zero-dep:
it carries the `ToolDef`/`ExecuteTool` seam, never key handling, registry code, or executors.
*(ADR-0168 preamble :48-50 · SPEC-N1 :763 · ADR-0137)*

## Routing out

- New/changed catalog components the renderer paints → `agent-ui-catalog`.
- Authoring the A2UI message stream an agent emits → `a2ui-compose`.
- The session/turn model or validate-then-stream pipeline → `agent-protocols:a2ui-chat-agent-facts`.
- MCP client integration → DESIGNED, not built: ADR-0177 (which un-defers ADR-0168 Non-goals
  :109-110). An MCP server registers as a manifest-registry SOURCE (N discovered
  `IntegrationManifest`s, never one multi-tool entry), HTTP/SSE server-side only (stdio deferred),
  tool schemas map additively onto `ToolDef`/`validateToolInput` under the id≠tool.name≠label law,
  behind a config-registered server allowlist. Read the ADR before building — the connector module,
  the allowlist config, and this skill's own MCP-manifest pattern section are its named build-wave
  repairs, not yet landed.
