---
name: agent-ui-integration-standards
description: >-
  THIS repo's tool/integration enablement laws (ADR-0168 / SPEC-R16–R19): adding an integration,
  a new tool for the agent, integration keys/auth (serverKey/envKey, why a keyed tool isn't
  offered), tool input validation (input_schema, malformed model input, is_error tool_result),
  the id ≠ tool.name ≠ label split, the shared buildToolDispatch on both live arms, and where
  registry code lives (tools/agent/, never src/agent/). Use for "add an integration", "new tool
  for the agent", "how do integration keys work", "validate tool input", "why isn't my tool
  offered". NOT for catalog entries (agent-ui-catalog); NOT for A2UI payloads (a2ui-compose).
  MCP servers ARE in scope (ADR-0177): adding one, its allowlist roster, serverKey/envKey, the
  namespaced mcp:server-id:tool id law; NOT Claude Code's own MCP config (update-config).
disable-model-invocation: false
user-invocable: false
---

# agent-ui integration enablement laws (ADR-0168 / ADR-0177)

Six ratified laws governing every tool/integration the live agent can call. Sources of record:
ADR `.claude/docs/adr/0168-integration-manifest-registry-validated-dispatch-server-keys.md`
(accepted 2026-08-04, laws 1–5) + ADR
`.claude/docs/adr/0177-mcp-client-registry-source-http-transport-additive-manifest-mapping.md`
(ratified 2026-08-06, law 6) and SPEC `.claude/docs/spec/a2ui-live-agent.spec.md` v0.13 §3.6
(laws 1–5, SPEC-R16–R19) / §3.7 (law 6, SPEC-R23–R28). This skill states the laws; the cited
lines are the authority — re-derive there, never from a peer's quote. ADR line numbers are frozen
records (ratified, unrevised); SPEC line numbers drift as the spec grows across versions and need
the SAME symbol-first discipline as code cites (laws 1–6 verified 2026-08-08 against v0.13) — on
drift, Grep the requirement id or symbol name, then repair the line number here in the same
change.

## 1 · The manifest law — one integration, one manifest, three separate facts

Every integration is an `IntegrationManifest` (`registry.ts:34`) registered via
`registerIntegration()` (`registry.ts:65`), never an entry in a hardcoded array. The registry
`id` (enablement wire vocabulary), the wire `tool.name` (what the model sees), and the admin
`label` (human display text) are THREE independent facts — no string does double duty.
Registration boot-fail-fasts on a duplicate `id` OR duplicate wire `tool.name`.
*(ADR-0168 cl.1 :52-58, cl.2 :60-65 · SPEC-R16 §3.6 :1024-1038)*

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
only, never the first line. *(ADR-0168 cl.3 :67-75 · SPEC-R17 §3.6 :1040-1055)*

## 3 · Server keys never cross to the browser

A manifest declares `auth: 'none' | 'serverKey'`; iff `'serverKey'` it carries `envKey` — an
env-var NAME, never a value (the `providers.json` discipline). The HOST resolves the value at
dispatch time in BOTH hosts — dev proxy via its `loadEnv`-merged env, production Worker via its
env binding — and hands it to `execute` through `ExecuteContext.apiKey` (`registry.ts:27`). An
unprovisioned keyed manifest is EXCLUDED by `resolveIntegrations` (`registry.ts:103`): the model
is never offered a tool that cannot run. No key value ever reaches the browser, a tool_result,
or a log line — ADR-0073 cl.5's trust boundary extended verbatim to integration keys, grep-gated
by SPEC-N2. *(ADR-0168 cl.4 :77-84 · SPEC-R18 §3.6 :1057-1072)*

## 4 · ONE shared dispatch on both live arms

Both routes — prose `/chat` AND produce — in both hosts build tool wiring through the same
`buildToolDispatch` (`tool-dispatch.ts:50`; callers `dev-proxy-plugin.ts:262,331` and
`worker/index.ts:182,255`). Per-route or per-host dispatch forks are the GH #402 defect class
(a toggle silently inert on one arm) — new arms consume the shared builder, never re-implement
validate→key→execute. An absent `integrations` field keeps a request byte-identical to the
pre-0168 shape. *(ADR-0168 cl.5 :86-97 · SPEC-R19 §3.6 :1074-1087)*

## 5 · Where things live — the ADR-0137 shell law

Registry, manifests, validator, and dispatch are site-internal in
`packages/agent-ui/a2ui/tools/agent/integrations/` (anchor: `registry.ts` there — the shipped
pattern to copy for a new manifest). The portable `src/agent/` core stays types-only/zero-dep:
it carries the `ToolDef`/`ExecuteTool` seam, never key handling, registry code, or executors.
*(ADR-0168 preamble :48-50 · SPEC-N1 §4 :1256 · ADR-0137)*

## 6 · MCP servers are a manifest PRODUCER, not a new mechanism

Adding an MCP server is adding a SOURCE for laws 1–5, never a sixth mechanism: an MCP-sourced
manifest is indistinguishable from a hand-authored one to every consumer named above.

**Add a server** by naming it in the committed allowlist roster (`mcp-servers.json`, sibling to
`providers.json`), validated by `validateMcpServersConfig` (`mcp/servers-config.ts:59`; throws on
the first malformed entry, a `serverKey` entry missing `envKey`, or a server-id containing `:` —
the reserved `mcp:server-id:tool` namespace separator). No browser- or model-supplied endpoint is
EVER dialed (`McpServerEntry`, `mcp/servers-config.ts:26`); `envKey` is a NAME, resolved host-side
exactly like law 3's `serverKey` (SPEC-R18, unchanged) — never a value, never in the roster.

**Registry SOURCE, never a consumer mechanism — the frozen-file fence.** The connector calls the
SAME `registerIntegration()` law 1 names; it never adds a second registry, validator, or dispatch
path. `registry.ts`, `validate-input.ts`, `tool-dispatch.ts`, `integrations/index.ts`, and
`src/agent/` carry ZERO diffs across the whole MCP arc (SPEC-R23 AC1) — a builder touching any of
those five files for an MCP change is off the LLD.

**The three-fact id law, MCP's version of law 1.** `mapMcpTool` (`mcp/map-tool.ts:64`) holds `id`
(the namespaced `mcp:server-id:tool`, `map-tool.ts:68`), `tool.name` (the MCP name VERBATIM,
unnamespaced), and `label` (independently composed from the server's label + the tool's
title/name, `map-tool.ts:69`) as three facts — none derived from either other. `input_schema`
passes through UNTOUCHED (same object reference) into the SAME `assertSupportedSchema` gate law 2
names — no MCP carve-out of the validator. *(SPEC-R25 :1157-1183)*

**Discovery is fail-soft per tool; the second server LOSES a name collision.**
`discoverMcpIntegrations` (`mcp/discover.ts:101`) wraps each `registerIntegration()` call in a
per-tool try/catch covering BOTH boot-fail-fast throw paths — unsupported schema, duplicate wire
`tool.name` (`discover.ts:143-155`) — skipping-and-logging the ONE tool while the server's other
N−1 still register. Across two servers exposing the same tool name, the SECOND registration
loses: dropped, logged with its reason, never a crash, never silent. The sink is INJECTABLE
(`DiscoveryDeps.register`, `discover.ts:44`, default `registerIntegration`) so no test mutates the
module `REGISTRY`. *(SPEC-R26 :1185-1203)*

**The dev proxy AWAITS discovery before serving anything.** `configureServer` starts the whole
discovery pass synchronously at boot and keeps its promise (`dev-proxy-plugin.ts:186-187`); every
branch of the mount handler — `/status`, `/integrations`, `/chat`, produce — sits behind `await
mcpReady` (`dev-proxy-plugin.ts:198`) BEFORE any routing. Never a top-level `await` spliced into
`integrations/index.ts` (would stall hand-authored registration); never fire-and-forget. An empty
roster resolves immediately — byte-identical to pre-MCP behavior. *(SPEC-R27 :1205-1227)*

**Admin surfacing rides one host GET, trios only.** `GET /integrations`
(`dev-proxy-plugin.ts:213-214`) serves `projectIntegrationTrios(listIntegrations())`
(`dev-proxy-plugin.ts:119`) — `{id, label, description}` ONLY, post-ready-gate so `mcp:*` entries
appear. No endpoint, `envKey` name, key value, or raw MCP frame ever rides this route (SPEC-R28's
cl.2 boundary — trios are admin-display facts, not the enablement wire's secrets); the enablement
wire itself stays `integrations: string[]` of ids, unchanged. *(SPEC-R28 :1229-1248)*

*(ADR-0177 cl.1 :101-132, cl.2 :133-161, cl.3 :162-211, cl.4 :212-256)*

## Routing out

- New/changed catalog components the renderer paints → `agent-ui-catalog`.
- Authoring the A2UI message stream an agent emits → `a2ui-compose`.
- The session/turn model or validate-then-stream pipeline → `agent-protocols:a2ui-chat-agent-facts`.
- Adding an MCP server so the live agent gains its tools → BUILT: law 6, above (ADR-0177 /
  SPEC-R23–R28 §3.7 / `.claude/docs/lld/mcp-connector.lld.md`). Distinguished, still routed OUT:
  agent-ui AS an MCP *server* — the opposite direction, unbuilt
  (`a2ui-streaming-pipeline.spec.md` SPEC-R6); MCP *Apps* delivery, a separate settled non-goal
  (`a2ui-ecosystem-alignment.spec.md` SPEC-R8); stdio transport and production-Worker MCP
  discovery, both ADR-0177 Non-goals (dev-proxy-only v1); Claude Code's OWN MCP server
  configuration, a different product surface (update-config — settings.json edits with no plugin
  object are its literal charter).
