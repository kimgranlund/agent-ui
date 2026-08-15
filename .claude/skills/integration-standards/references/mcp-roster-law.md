# MCP roster law (law 6)

Source of record: ADR
`.claude/docs/adr/0177-mcp-client-registry-source-http-transport-additive-manifest-mapping.md`
(ratified 2026-08-06) and SPEC `.claude/docs/spec/a2ui-live-agent.spec.md` v0.13 §3.7
(SPEC-R23–R28). This file states the law; the cited lines are the authority — re-derive there,
never from a peer's quote. ADR line numbers are frozen records (ratified, unrevised); SPEC line
numbers drift as the spec grows across versions and need the SAME symbol-first discipline as code
cites (verified 2026-08-08 against v0.13) — on drift, Grep the requirement id or symbol name, then
repair the line number here in the same change.

## 6 · MCP servers are a manifest PRODUCER, not a new mechanism

Adding an MCP server is adding a SOURCE for laws 1–5, never a sixth mechanism: an MCP-sourced
manifest is indistinguishable from a hand-authored one to every consumer named above.

**Add a server** by naming it in the committed allowlist roster (`mcp-servers.json`, sibling to
`providers.json`), validated by `validateMcpServersConfig` (`mcp/servers-config.ts:59`; throws on
the first malformed entry, a `serverKey` entry missing `envKey`, or a server-id containing `:` —
the reserved `mcp:server-id:tool` namespace separator). No browser- or model-supplied endpoint is
EVER dialed (`McpServerEntry`, `mcp/servers-config.ts:26`); `envKey` is a NAME, resolved host-side
exactly like law 3's `serverKey` (SPEC-R18, unchanged) — never a value, never in the roster.

**The description standard is MCP's own `tools/list` schema + the `IntegrationManifest` triple —
OpenAPI/Swagger is REJECTED, not merely unadopted** (ADR
`.claude/docs/adr/0189-tool-description-standard-and-tools-panel-visibility.md` cl.1/cl.2, ratified
2026-08-14). What documents an MCP tool is MCP's own `{name, description?,
inputSchema}` at `tools/list` — already fully captured (law 1's three-fact split, above); what
documents a non-MCP HTTP endpoint wrapped as an integration is the existing `IntegrationManifest`
triple (`description`, `tool.description`, `tool.input_schema`) — the two paths already converge on
ONE wire format (`mapMcpTool` maps INTO an `IntegrationManifest`, never a parallel type). OpenAPI is
rejected as an ingest format or an internal standard for a stated reason: every integration this
repo authors today is small and first-party (one endpoint, a handful of params), so hand-authoring
the shipped triple is strictly cheaper than authoring/hosting/syncing a full OpenAPI document and
then lossy-converting it down to `assertSupportedSchema`'s deliberately narrow subset — a second
schema dialect with a drift-prone conversion step, for a capability nothing currently needs. Not a
permanent rejection: an OpenAPI-to-`IntegrationManifest` **converter** (emitting ordinary manifests
through the existing `registerIntegration`/`assertSupportedSchema` gate, the way `mapMcpTool` does
for MCP) is the natural follow-up if the integration surface later grows to bulk-importing large,
externally-authored, multi-endpoint APIs — a new *ingest path* onto the same standard, never a
replacement of it.

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
wire itself stays `integrations: string[]` of ids — widened by ADR
`.claude/docs/adr/0185-enablement-wire-service-reference-grammar.md` to also honor a service
reference `mcp:<server-id>:*`, expanded server-side inside `resolveIntegrations`; that
grammar/expansion contract is `mcp-agent-config.spec.md` SPEC-R2/R3, a separate law from this
one. *(SPEC-R28 :1229-1248)*

**The `services` array's rows widen once more with real per-tool trios.** The SAME `GET
/integrations` body ALSO carries an additive `services` array (`projectServiceRows`,
`dev-proxy-plugin.ts`, beside `projectIntegrationTrios` above) — one row per allowlisted server
with ≥1 registered manifest, `{id, label, description}` at the SERVER grain (`description` a
boot-count aggregate, e.g. "2 tools discovered at boot") PLUS — ADR
`.claude/docs/adr/0189-tool-description-standard-and-tools-panel-visibility.md` cl.3, ratified
2026-08-14 — a `tools: Array<{id, label, description}>` member: one real per-tool trio per
member manifest, sourced from the SAME registered `IntegrationManifest.description` `mapMcpTool`
already computes (zero new capture, a wire change only). Same cl.2 leak boundary as `integrations`
at BOTH grains — no endpoint, `envKey`, key value, or JSON-RPC fact in the row or any `tools`
entry. That widened trio shape is `mcp-agent-config.spec.md` SPEC-R4, this skill's own pointer.

*(ADR-0177 cl.1 :101-132, cl.2 :133-161, cl.3 :162-211, cl.4 :212-256)*
