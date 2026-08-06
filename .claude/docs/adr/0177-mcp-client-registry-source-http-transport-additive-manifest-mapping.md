# ADR-0177 — MCP client integration for the tool-enablement layer: an MCP server registers as a manifest-registry SOURCE (N discovered `IntegrationManifest`s, not one multi-tool entry), server-side-only HTTP/SSE transport in scope now (stdio deferred — infeasible in the production Worker), MCP tool schemas map additively onto `ToolDef`/`validateToolInput` under the id≠tool.name≠label law, dev-proxy-first behind a config-registered server allowlist

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-08-06
>
> | Field | Value |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-08-06 |
> | **Proposed by** | planner (design seat — the MCP-client design intake; GH [#438](https://github.com/kimgranlund/agent-ui/issues/438) is the fork this record must decide, reopened by Kim's [2026-08-06 ruling](https://github.com/kimgranlund/agent-ui/issues/438#issuecomment-5206947252) quoted in Context) |
> | **Ratified by** | *(pending — proposed, not yet ratified; a repo-owner GitHub utterance flips this cell per `scripts/adr_ratify.py`, ADR-0149)* |
> | **Repairs** | **On ratification:** `.claude/skills/agent-ui-integration-standards/SKILL.md`'s Routing-out line (`SKILL.md:86`, *"MCP client integration → not built; deferred to its own future ADR (ADR-0168 Non-goals :109-110)"*) repoints to this record · GH #438 stays open, tracking the build this ADR unblocks (the ADR-0172 precedent: a design-intake ADR resolves the *intake*, not the *build*). **On ratification+build (a future SPEC/LLD, not authored here):** [`../spec/a2ui-live-agent.spec.md`](../spec/a2ui-live-agent.spec.md) v0.9 gains MCP-sourcing requirements alongside its existing SPEC-R16–R19 · a new `packages/agent-ui/a2ui/tools/agent/integrations/mcp/` connector module · a new MCP-server allowlist config (sibling to `providers.json`) · `.claude/skills/agent-ui-integration-standards/SKILL.md` gains an MCP-manifest pattern section beside its five existing laws. |
> | **Supersedes / Superseded by** | **Extends** [ADR-0168](./0168-integration-manifest-registry-validated-dispatch-server-keys.md) (the manifest-registry/validated-dispatch/server-key seam every clause below lands tools INTO, never replaces — cl.1's registry shape, cl.2's id≠tool.name≠label law, cl.3's `validateToolInput` gate, cl.4's server-side key resolution, cl.5's both-live-arms law all stand byte-unchanged) · un-defers ADR-0168's own **Non-goals** line (`0168:109-110`, *"MCP client integration — deferred to its own future ADR; it changes the shell's dependency posture and is not prejudged here"*) · [ADR-0137](./0137-a2ui-agent-producer-toolkit-export.md) (the shell law this record keeps: registry/connector code stays `tools/agent/`-side, the portable `src/agent/` core stays types-only) · [ADR-0073](./0073-a2ui-live-model-provider-seam.md) cl.5 (the trust boundary — extended verbatim, cl.2 below) · [ADR-0152](./0152-live-agent-production-worker-proxy.md) (the production Worker host cl.2/cl.4 reason against, for now) · **Relates** [`a2ui-ecosystem-alignment.spec.md`](../spec/a2ui-ecosystem-alignment.spec.md) SPEC-R8 (MCP Apps as a delivery vehicle — a different, already-settled non-goal, distinguished not touched) · [`a2ui-streaming-pipeline.spec.md`](../spec/a2ui-streaming-pipeline.spec.md) SPEC-R6 (agent-ui AS an MCP *server* — the opposite direction, unbuilt, distinguished not touched) · **Resolves** the design-intake half of GH #438 (build stays open, the ADR-0172 precedent). |

## Context

**The fork.** GH #438 tracks ADR-0168's own recorded Non-goal: *"MCP client integration — deferred to
its own future ADR; it changes the shell's dependency posture and is not prejudged here"* (`0168:109-110`).
The issue's own trigger condition (verbatim): *"Revisit when a real external-integration need lands — the
first candidate named by SPEC v0.9 / GH #49's direction is the hotel booking/PMS integration. Until then
the manifest registry (`registerIntegration()`, ADR-0168 cl.1) is the enablement path."* No evidence in
this repo shows the hotel/PMS integration itself has landed; Kim's reopen ruling below exercises the
deferral on its own authority as the ratifying owner, independent of that specific trigger — stated
honestly rather than backfilled.

**Triage confirmed the deferral was deliberate, not stale** (Kim, 2026-08-05 hygiene sweep, verbatim):
*"DELIBERATELY DEFERRED by ADR-0168's own Non-goals — the tool-enablement layer shipped without MCP by
ruled scope, and this issue is its named revisit hook. No action owed until an MCP consumer need arrives;
not stale, not unowned."*

**The reopen ruling that mints this intake** (Kim, 2026-08-06, verbatim): *"the ADR-0168 deferral is
knowingly reopened — MCP client integration proceeds via its own design intake (ADR-0177, campaign
dispatched). The intake freezes: the MCP client's home (tools/agent registry per ADR-0168's own layering
law), transport/auth model, the tool-manifest mapping onto the ADR-0168 dispatch seam, and the deferral's
original revisit conditions."* The four Decision clauses below answer those four items in order; the
fourth ("the deferral's original revisit conditions") is answered by naming what stays deferred even
after this ADR (Non-goals) rather than by re-litigating GH #438's own trigger text, which stands unchanged.

**The seam this ADR lands tools into, standing on the actual mechanisms (not the abstract shape).**

- **One manifest, one wire tool, three independent facts.** `IntegrationManifest`
  (`tools/agent/integrations/registry.ts:34-48`) is `{id, version, label, description, tool: ToolDef, auth,
  envKey?, execute}` — exactly ONE `tool: ToolDef` per manifest. `registerIntegration()` (`registry.ts:65`)
  boot-fail-fasts on a duplicate `id` OR a duplicate wire `tool.name` (`registry.ts:66-71`) and asserts the
  declared `input_schema` is within the validator's supported subset (`registry.ts:75-79`,
  `assertSupportedSchema`, `validate-input.ts:97`). `id` is the stable registry key AND the enablement wire
  vocabulary the browser forwards; `tool.name` is the wire name the model sees; `label` is human display
  text — three independent facts, no string doing double duty (ADR-0168 cl.1-2 `0168:52-65`; skill law 1,
  `agent-ui-integration-standards/SKILL.md:25-40`).
- **Validation runs before every dispatch, on a deliberately minimal schema subset.** `validateToolInput`
  (`validate-input.ts:61`) checks `type:'object'` + `required` + primitive property types — hand-rolled, no
  dependency — BEFORE `execute` runs, inside the ONE shared `buildToolDispatch`
  (`tool-dispatch.ts:50-71`, called from both hosts: `dev-proxy-plugin.ts:191,260` and
  `worker/index.ts:180,253`). A schema construct beyond that subset fails at REGISTRATION time
  (`assertSupportedSchema`), not at dispatch (ADR-0168 cl.3 `0168:67-75`; skill law 2, `SKILL.md:42-51`).
- **Server keys resolve host-side in both hosts, never cross to the browser.** `auth: 'none' | 'serverKey'`;
  `envKey` names an env var, never a value; the host resolves it per-dispatch and hands it to `execute` via
  `ExecuteContext.apiKey` (`registry.ts:23-30`, `tool-dispatch.ts:34-37`). An unprovisioned `serverKey`
  manifest is EXCLUDED by `resolveIntegrations` (`registry.ts:88-94,103-110`) — the model is never offered a
  tool that cannot run (ADR-0168 cl.4 `0168:77-84`; skill law 3, `SKILL.md:53-62`). This is ADR-0073 cl.5's
  trust boundary, extended verbatim: *"The proxy is the trust boundary… routes to `process.env[<config.env
  Key>]` for the matched provider… The key is passed INTO the adapter, never read at module scope"*
  (`0073:67-72`).
- **Registry/connector code lives in `tools/agent/`; the portable core stays types-only.** Registry,
  manifests, validator, and dispatch are site-internal (`registry.ts:1-4`'s own header: *"Node-side,
  site-internal (the ADR-0137 shell law: everything key/proxy/registry-shaped stays in `tools/agent/`, the
  portable core in `src/agent/` carries only the `ToolDef`/`ExecuteTool` seam)"*) — the RULING authority is
  `agent-ui-integration-standards` skill law 5 (`SKILL.md:73-79`): *"The portable `src/agent/` core stays
  types-only/zero-dep: it carries the `ToolDef`/`ExecuteTool` seam, never key handling, registry code, or
  executors."*
- **Both live arms share ONE dispatch builder.** `buildToolDispatch` is the single seam the dev proxy (Node
  process) and the production Cloudflare Worker (V8 isolate) both call — "per-route or per-host dispatch
  forks are the GH #402 defect class" (ADR-0168 cl.5 `0168:86-97`; skill law 4, `SKILL.md:64-71`). The
  Worker has no real OS-level substrate: its `node:fs` replacement (`worker/fs-shim.ts:1-9`) exists
  precisely because *"Workers has no real filesystem, so this is never a live read"* — the same platform
  constraint (a V8 isolate, not a Node process) means it cannot spawn a child process either, load-bearing
  for cl.2 below.
- **The config-allowlist precedent this ADR's cl.4 fence copies.** `providers.json`'s `ProviderEntry`
  (`providers-config.ts:22-29`: `{label, envKey, endpoint, defaultModel, models, implemented}`) is a
  committed, admin-curated registry; `resolvePair` (`providers-config.ts:96-108`) is *"the ONLY place a
  client-supplied `{provider, model}` pair is validated before a key is ever read"* — an unknown provider
  is rejected, never trusted. No browser-supplied URL is ever dialed.

**The two adjacent, differently-scoped MCP questions this record is NOT about — sharpened, not conflated
(Non-goals restates this precisely).** (1) **MCP Apps as a delivery/rendering vehicle** for A2UI —
`a2ui-ecosystem-alignment.spec.md` SPEC-R8 (`:199-213`) already rules this a non-goal: *"MCP Apps posture:
considered non-goal as a delivery vehicle… No MCP-Apps delivery code lands in any `@agent-ui/*` package
without a record superseding this ruling."* (2) **agent-ui itself AS an MCP server** — the opposite
direction from this ADR, `a2ui-streaming-pipeline.spec.md` SPEC-R6 (`:56-57`) names an unbuilt, separate
future surface: *"The system MUST provide an MCP server… exposing tools to: serve a catalog by id, validate
an A2UI payload… and retrieve top-k corpus exemplars."* This ADR is about neither — it is about the live
agent CONSUMING an external MCP server's tools as integrations, the GH #438 question.

## Decision

Four clauses, one per item the reopen ruling freezes. Everything lands `tools/agent/`-side (the ADR-0137
shell law, restated above); `src/agent/`'s `ToolDef`/`ExecuteTool` seam, `AgentProvider.stream`, and
`buildToolDispatch`/`validateToolInput`/`resolveIntegrations` are UNCHANGED by this ADR — an MCP-sourced
manifest is, to every downstream consumer, indistinguishable from a hand-authored one.

### 1 · Where the MCP client lives — a registry SOURCE, not a per-server entry

**Ruling: an MCP server registers as a manifest-registry SOURCE — a connector that queries the server's
tool list and calls the EXISTING `registerIntegration()` once per discovered MCP tool, producing N ordinary
`IntegrationManifest`s — never a single per-server ENTRY.**

**Why not a single per-server entry (rejected).** `IntegrationManifest` declares exactly ONE `tool: ToolDef`
(`registry.ts:34-48`); a per-server entry model would need either (a) a second, wider manifest shape
carrying N tools, forking the registry into two kinds the validator/dispatcher must both handle — directly
contradicting skill law 4's "ONE shared dispatch on both live arms," since a multi-tool entry's internal
tool-routing would be a second dispatcher living OUTSIDE `buildToolDispatch` — or (b) collapsing an MCP
server's N distinct tools into one coarse wire tool (e.g. `{name, args}` as free-form input), which fails
ADR-0168 cl.3's validated-dispatch law: the model would see one opaque tool instead of N schema-validated
ones, and `validateToolInput`'s per-tool `input_schema` check (`validate-input.ts:61`) would have nothing
real to validate against. Neither reading survives contact with the shipped registry shape.

**Why a SOURCE composes cleanly.** `registerIntegration`/`listIntegrations` (`registry.ts:65,84`) already
accept manifests from any origin — the registry has no notion of "hand-authored" vs "discovered," it only
ever sees the `IntegrationManifest` shape. A connector module (housed at
`tools/agent/integrations/mcp/`, per the ADR-0137 shell law) queries the configured MCP server's tool list
(cl.2's HTTP/SSE transport) and, for each discovered tool, constructs one `IntegrationManifest`
(cl.3's mapping) and calls `registerIntegration()` — mirroring the shipped pattern where each of
`weather.ts`/`currency.ts`/`wikipedia-search.ts`/`fetch-json.ts` is a self-registering module imported by
`integrations/index.ts` for its side effect, generalized from "one module registers exactly one manifest"
to "one module registers N manifests, one per tool the connector discovers." Both hosts' existing
`buildToolDispatch`/`resolveIntegrations` calls need zero changes — they already operate over
`listIntegrations()`'s full array regardless of how each entry got there.

### 2 · Transport/auth model — server-side only, HTTP/SSE in scope now, stdio deferred

**Ruling: the browser never talks to an MCP server directly and never holds an MCP credential — ADR-0073
cl.5 / ADR-0168 cl.4's trust boundary extends verbatim (`0073:67-72`, `0168:77-84`). In scope now:
HTTP-based MCP transport (Streamable HTTP / SSE), fetchable from both hosts. Out of scope: stdio MCP
transport, which requires spawning a child process — mechanically available in the dev proxy's Node
process, but not in the production Worker's V8 isolate, which has no real OS-level substrate (`worker/
fs-shim.ts:8-9`'s "Workers has no real filesystem" names the same platform constraint that rules out
`child_process.spawn`).**

**What never crosses to the browser:** the MCP server's URL/endpoint, any auth token or header the server
requires, and the raw MCP JSON-RPC protocol frames (`tools/list`/`tools/call` requests and responses) all
stay host-side, in the SAME class as a `serverKey` manifest's `envKey` value today — "no key value ever
reaches the browser, appears in a `tool_result`, or lands in a log line" (`registry.ts:23-26`'s
`ExecuteContext` comment). The browser's enablement wire is unchanged: `integrations: string[]` of registry
`id`s (ADR-0168 cl.5, `0168:86-97`) — it never carries an MCP server URL, discovered tool name, or MCP
credential in either direction.

**Auth reuses the existing vocabulary, no new enum member.** An MCP server's own auth requirement (a bearer
token, an API key) is a `serverKey`-shaped secret resolved the SAME way a keyed integration's is today:
`envKey` names the env var, the host reads its value at dispatch/discovery time via `loadEnv` (dev) or the
Worker's env binding (production, `worker/env-projection.ts`'s existing widening pattern), and hands it to
the connector for both the discovery call (`tools/list`) and every dispatch call (`tools/call`). Every
manifest an MCP server's connector produces inherits ONE `auth`/`envKey` pair from its parent server
config (cl.4's allowlist) — not a per-tool credential, since MCP tools on one server share one connection.
An MCP server with no auth requirement produces `auth:'none'` manifests.

### 3 · Tool-manifest mapping — additive onto `ToolDef`, the id≠tool.name≠label law holds

**Ruling: an MCP tool's `{name, description, inputSchema}` (its `tools/list` shape) maps additively onto
`ToolDef`/`IntegrationManifest` — `tool.name` keeps the MCP tool's own name verbatim, but `id` is a NEW
namespaced, connector-derived key, and `label` is independently composed — cl.2's three-fact law is never
collapsed to two.**

- **`tool.name`** = the MCP tool's own name, unchanged — model-facing continuity with what an MCP-native
  client would show; `input_schema` = the tool's `inputSchema`, unchanged, run through the SAME
  `assertSupportedSchema` gate every hand-authored manifest already passes (`registry.ts:75-79`,
  `validate-input.ts:97`) — **no MCP carve-out of the validator.**
- **`id`** = a connector-derived, server-namespaced key (e.g. `mcp:<server-id>:<mcp-tool-name>`), NEVER the
  bare MCP tool name. This is load-bearing, not cosmetic: `registerIntegration` boot-fail-fasts on a
  duplicate `id` OR a duplicate `tool.name` (`registry.ts:66-71`) — two different MCP servers may legally
  expose tools with the same bare name (nothing in MCP's spec prevents it), and an `id = tool.name` mapping
  would turn that ordinary occurrence into a crash. Namespacing by server keeps `id` collision-free by
  construction, exactly as cl.2's "three facts, three fields" already requires for hand-authored manifests.
- **`label`** = an independently composed human string (e.g. `"<server label>: <tool name/title>"`), never
  re-derived from `id` or `tool.name` at runtime — free to change (a relabel in the connector's mapping
  logic) without touching either of the other two facts, exactly cl.2's existing guarantee.
- **Per-tool, not per-server, fail-fast.** `registerIntegration`'s boot-fail-fast posture (`registry.ts:65`)
  is correct for a hand-authored module registering ONE manifest — a bad schema there IS a startup defect.
  It is WRONG applied naively to a discovery loop registering N tools from one server: one MCP tool
  declaring an `inputSchema` construct beyond the validator's supported subset (`oneOf`/`anyOf`/nested
  objects — real constructs in MCP tool schemas the minimal checker does not cover, ADR-0168 cl.3
  `0168:67-75`) must skip and log that ONE tool, not abort registration of the server's other N−1 tools.
  This is an additive discipline the connector owns (a per-tool try/catch around each
  `registerIntegration()` call in the discovery loop) — `registerIntegration` itself is untouched.
- **Dispatch: `execute` calls MCP `tools/call`, v1 result-mapping is TEXT-only.** Input arrives already
  validated (`tool-dispatch.ts:63`'s existing `validateToolInput` call, unchanged) before `execute` runs;
  `execute` issues the MCP `tools/call` request and maps the `CallToolResult` back onto the existing
  `execute(input, ctx): Promise<string>` contract (`registry.ts:47`). MCP tool results can carry multi-part
  content (text/image/resource); this ADR scopes v1 to TEXT content only, matching every shipped
  integration's "compact TEXT for the model" contract (`registry.ts:16-18`'s TRUST NOTE) — non-text parts
  are dropped or stringified as a placeholder. Full multi-modal MCP content mapping is named in Non-goals.

### 4 · Scope cut — dev-proxy first, boot/admin-time discovery, config-registered server allowlist

**Ruling: this ADR scopes the build to the dev proxy (Node process) only; production Worker rollout is a
later, additive follow-up, not designed here. Discovery is on-demand at connector registration time (dev
boot, or a future admin-triggered re-run) — never per-request. Every MCP server this system will ever query
is a CONFIG-REGISTERED allowlist entry; an arbitrary, user- or model-supplied MCP server URL is never
dialed.**

- **Dev-proxy-first, not "design for both from the start."** HTTP/SSE MCP is mechanically fetchable from
  the production Worker too (cl.2), so this is a sequencing call, not a technical wall: the connector +
  discovery-loop + per-tool-fail-fast mechanism (cl.1/cl.3) is genuinely NEW capability — nothing in the
  shipped registry dynamically registers N manifests from an external, queried-at-boot source today — and
  proving it in the dev proxy's lower-stakes Node process comes before landing it in the production Worker's
  fetch-count/CPU-time-billed, same-origin-gated, rate-limited surface (ADR-0152's mitigations, the same
  posture ADR-0168's own registry widening reasoned from). Production rollout is additive once the
  connector is proven — a later work item, named in Non-goals, not a redesign.
- **Discovery timing: on-demand at registration, never per-request.** The connector queries `tools/list`
  once per dev-proxy process lifetime (the same "boot, self-registering module" posture every hand-authored
  `integrations/*.ts` module already has) — not on every turn. Automatic periodic refresh or an
  admin-triggered manual re-discovery affordance are real, useful features but are NOT this ADR's build —
  named in Non-goals. A stale discovered-tool-list (the MCP server added a tool since the last discovery) is
  an acceptable v1 gap: the same class of gap `providers.json` already has for provider config changes
  (requires a redeploy/restart, not a live surface).
- **The allowlist fence, stated as its own clause, not an aside.** MCP servers are named in a committed,
  admin-curated config — the SAME discipline `providers.json`'s `ProviderEntry` roster already enforces
  (`providers-config.ts:22-29`, `resolvePair`'s "ONLY place a client-supplied pair is validated before a key
  is ever read," `providers-config.ts:90-95`) — never a runtime-addable, user-supplied, or model-supplied
  URL. The enablement wire the browser drives stays `integrations: string[]` of registry `id`s exactly as
  today (ADR-0168 cl.5); it can select AMONG config-registered MCP-sourced manifests, but it can never name
  a server the config doesn't already list. This is the same shape as a keyed integration's env var being
  config-named, never client-supplied — extended to the server identity itself, not just its credential.

## Non-goals (recorded, not silent)

- **MCP Apps as a delivery/rendering vehicle for A2UI** — a DIFFERENT, already-settled non-goal
  (`a2ui-ecosystem-alignment.spec.md` SPEC-R8, `:199-213`). This ADR's subject is MCP as a TOOL-SOURCE for
  the live agent's enablement layer; a reader must not conflate the two just because both start with "MCP."
- **agent-ui itself acting as an MCP server** — the opposite direction from this ADR, and a separate,
  already-scoped, unbuilt future surface (`a2ui-streaming-pipeline.spec.md` SPEC-R6, `:56-57`: serve-catalog
  / validate-payload / retrieve-corpus tools exposed TO a generating agent). Not touched, not prejudged,
  not built here.
- **stdio MCP transport** — deferred (cl.2): feasible in the dev proxy's Node process, not in the production
  Worker's V8 isolate; revisit only if a stdio-only MCP server becomes a real, named need and the production
  Worker constraint is separately resolved or accepted as a dev-only gap.
- **Production Worker rollout of the MCP connector** — deferred (cl.4): this ADR scopes the build to the dev
  proxy; landing the same connector in `worker/index.ts` is a later, additive work item once the dev-proxy
  build is proven, not designed here.
- **Automatic/periodic tool-list refresh, or an admin-triggered re-discovery UI** — deferred (cl.4): v1
  discovery is boot-time-only, once per dev-proxy process lifetime; a stale list is an accepted v1 gap.
- **Multi-modal MCP tool-result content (image/resource parts)** — deferred (cl.3): v1 result-mapping is
  TEXT-only, matching every shipped integration's existing contract; non-text content is dropped or
  stringified as a placeholder.
- **The real hotel/PMS integration, or any specific MCP server being wired up** — this ADR builds the
  connector MECHANISM (registry-source registration, transport, mapping, allowlist config shape); which
  real MCP server(s) get added to the allowlist, and whether the hotel/PMS integration GH #438's own trigger
  text names ever routes through MCP specifically (vs staying hand-authored), is unsettled and not this
  intake's call — the ADR-0168 Non-goals precedent for "the real hotel/PMS integration… its own later work
  item" (`0168:115-117`) applies here too.
- **Any change to `AgentProvider.stream`, `buildToolDispatch`, `validateToolInput`, or
  `resolveIntegrations`.** Every MCP-sourced manifest is an ordinary `IntegrationManifest` to every existing
  consumer; this ADR adds a new PRODUCER of manifests, never a new consumer-side mechanism.
- **An `mcp` member on the `auth` enum, or any new `ExecuteContext` field.** cl.2 reuses `'serverKey'` +
  `envKey` unchanged; no MCP-specific auth vocabulary is introduced.

## Consequences

- The enablement layer gains a second manifest PRODUCER (a discovery-driven connector) alongside the
  existing hand-authored modules, with zero change to the registry, validator, dispatcher, or either host's
  route wiring — every downstream law (id≠tool.name≠label, validated dispatch, server-side keys, both live
  arms share one dispatcher) applies to MCP-sourced tools for free, by construction.
- A genuinely new discipline enters the codebase: per-tool fail-soft registration inside a discovery loop
  (cl.3), distinct from every existing manifest module's per-module boot-fail-fast. This is additive to
  `registerIntegration`'s contract, not a change to it — the connector, not the registry, owns the
  try/catch.
- A new config surface is needed (the MCP-server allowlist, cl.4) — a committed file naming which servers
  exist, their endpoint, and their auth env-var name, mirroring `providers.json`'s shape and discipline. Its
  exact schema is future SPEC/LLD work, not designed here.
- Production parity is deliberately deferred: MCP-sourced tools exist ONLY in the dev proxy until a later,
  separately-scoped follow-up lands the same connector in the Worker — a real, named asymmetry between the
  two live arms that ADR-0168 cl.5 otherwise closed for hand-authored manifests. Worth flagging at
  ratification so it is not mistaken for a #402-class silent gap: it is a stated, temporary scope cut, not
  an oversight.
- `.claude/skills/agent-ui-integration-standards`'s Routing-out line (`SKILL.md:86`) becomes stale the
  moment this ADR is proposed and must repoint from "MCP client integration → not built; deferred" to this
  record, on ratification (Repairs cell).
- GH #438 stays open after this ADR ratifies, tracking the build wave it unblocks — the same
  design-intake/build split ADR-0172 established for GH #421/#472.

## Alternatives considered

- **A single per-server `IntegrationManifest` carrying all of a server's tools (cl.1's rejected reading
  (a))** — rejected: forks the registry into two manifest shapes, and pushes a second, out-of-band tool
  router outside `buildToolDispatch`, contradicting skill law 4's "ONE shared dispatch on both live arms."
- **Collapsing an MCP server's tools into one coarse `{name, args}` wire tool (cl.1's rejected reading
  (b))** — rejected: defeats ADR-0168 cl.3's per-tool schema-validated dispatch; the model would see one
  opaque tool instead of N validated ones.
- **`id = tool.name` (bare MCP tool name as the registry key)** — rejected (cl.3): two MCP servers may
  legally expose same-named tools; `registerIntegration`'s duplicate-`id`-OR-duplicate-`tool.name` boot-
  fail-fast (`registry.ts:66-71`) would turn that ordinary occurrence into a startup crash instead of two
  coexisting integrations.
- **A new `auth: 'mcp'` enum member / a bespoke MCP credential shape** — rejected (cl.2): the existing
  `'serverKey'` + `envKey` vocabulary already expresses "a named env var resolved host-side," and MCP
  servers' auth needs (bearer token / API key) are the same shape; a new enum member would widen a closed
  vocabulary for no new expressive power, the same reasoning ADR-0168 cl.6 used to reject a widened
  `SettingsFieldType`.
- **Design for the production Worker from the start, ship both hosts together** — rejected as THIS ADR's
  scope (cl.4): the connector/discovery mechanism is genuinely new; proving it in the dev proxy first is a
  sequencing call, not a technical wall (HTTP/SSE MCP is Worker-fetchable) — production rollout stays a
  named, additive follow-up rather than doubling this intake's build surface.
- **stdio MCP transport, in scope now** — rejected (cl.2): requires a spawned child process, unavailable in
  the production Worker's V8 isolate (the same platform constraint `worker/fs-shim.ts` already works around
  for `node:fs`); scoping stdio in now would mean either building a Worker-incompatible feature or a
  host-conditional transport fork this ADR does not want to carry.
- **Per-request (live) tool-list re-query instead of boot-time discovery** — rejected (cl.4): adds real
  per-turn latency to every enablement resolution and breaks the registry's existing "one-time
  registration, many dispatches" posture (`registry.ts`'s module-level `REGISTRY` array); boot-time
  discovery with a later opt-in refresh affordance (named in Non-goals) is the honest v1 cut.
- **An arbitrary, browser- or model-supplied MCP server URL (no allowlist)** — rejected outright (cl.4): no
  precedent anywhere in this codebase trusts a client-supplied endpoint before validating it against a
  server-held registry (`resolvePair`'s exact law, `providers-config.ts:90-95`); an unfenced MCP URL would
  let a compromised or malicious client instruct the server to dial an arbitrary host, a materially
  different and strictly worse trust posture than every existing integration.
