# LLD — the MCP connector (allowlist roster · Streamable-HTTP wire client · three-fact mapping · fail-soft discovery · dev-proxy boot-await · admin GET)

> Refines: [`../spec/a2ui-live-agent.spec.md`](../spec/a2ui-live-agent.spec.md) v0.12 §3.7
> (SPEC-R23–R28 — the merged S-SPEC, PR #571, incl. the F2 freeze: Streamable HTTP only, pin
> `2025-06-18`, acceptance {`2025-06-18`, `2025-03-26`}, the `Mcp-Session-Id` echo law; and F3
> recorded: hand-rolled `fetch`, SDK = blocked handback) under
> [ADR-0177](../adr/0177-mcp-client-registry-source-http-transport-additive-manifest-mapping.md)
> (RATIFIED 2026-08-06). Build plan:
> [`../decompositions/mcp-manifest-registry.decomp.md`](../decompositions/mcp-manifest-registry.decomp.md)
> (GH [#567](https://github.com/kimgranlund/agent-ui/issues/567); this doc is its S-LLD slice).
> · proposed · 2026-08-07 · planner (design seat) · Layer: LLD (implementation plan)
>
> **Composes on:** the SHIPPED enablement seam — `IntegrationManifest`/`registerIntegration`'s
> four-check block (`tools/agent/integrations/registry.ts:65-81`), `assertSupportedSchema`
> (`validate-input.ts:97`), the ONE shared `buildToolDispatch` (`tool-dispatch.ts`), the
> `providers-config.ts` pure-helpers/no-I/O posture + `resolvePair` allowlist discipline, and
> `dev-proxy-plugin.ts`'s `configureServer` seam. The §0 frozen-file fence of the decomposition
> BINDS every slice here: `registry.ts` · `validate-input.ts` · `tool-dispatch.ts` ·
> `integrations/index.ts` · `src/agent/` · `worker/` — zero diffs, all six slices (SPEC-R23 AC1).
>
> **Freeze discipline.** §2 is the fan-out contract; one writer per file per slice
> (`dev-proxy-plugin.ts` is S5's then S6's, serialized by their dependency edge). A builder who
> finds a seam unworkable STOPS and escalates — a coordinated LLD/SPEC repair, never a local
> workaround. If hand-rolling any part of §4's wire client hits a real wall, that is the F3
> escape hatch: a blocked handback naming the wall, never a quiet `npm install` of
> `@modelcontextprotocol/sdk` (a repo-identity dependency change, the ADR-0139 class).

## 1 · Intent

Add a second manifest PRODUCER: a connector at
`packages/agent-ui/a2ui/tools/agent/integrations/mcp/` that turns each allowlisted MCP server's
`tools/list` into N ordinary `IntegrationManifest`s registered through the EXISTING
`registerIntegration()` — indistinguishable downstream from a hand-authored manifest (SPEC-R23).
Five build slices (S1–S5) land the roster, the wire client, the mapping, the discovery loop, and
the dev-proxy boot-await; S6 surfaces the registered trios to the admin UI over a host GET (the F1
ruling). No consumer-side mechanism changes anywhere; the `auth` vocabulary, the enablement wire,
and every frozen file stay byte-identical.

## 2 · Components (build slices)

| ID | Component | File(s) | Traces |
|---|---|---|---|
| LLD-C1 (S1) | The committed MCP-server roster + its pure fail-fast loader — `McpServersConfig` (§3.1), `validateMcpServersConfig` throwing on the first violation (`providers-config.ts` posture, no I/O — the Node reader does `readFileSync` + `JSON.parse`); roster ships EMPTY (`{ "servers": {} }` — valid; the example entry lives in the loader's header comment, never as a committed entry a boot would dial) | NEW `packages/agent-ui/a2ui/tools/agent/mcp-servers.json` (sibling to `providers.json`) · NEW `tools/agent/integrations/mcp/servers-config.ts` + `servers-config.test.ts` | SPEC-R27 AC1 |
| LLD-C2 (S2) | The hand-rolled Streamable-HTTP JSON-RPC wire client — `createMcpClient` (§3.2): `initialize` handshake (pin + acceptance set + `notifications/initialized` + `Mcp-Session-Id` capture), `listTools` (cursor pagination, bounded), `callTool`; per-call auth-header injection from a key passed IN; both sanctioned POST-response framings (single JSON body OR SSE-framed, §3.2); size cap + timeout/abort; injectable `fetchImpl` | NEW `tools/agent/integrations/mcp/client.ts` + `client.test.ts` | SPEC-R24 AC1/AC2 |
| LLD-C3 (S3) | The pure three-fact mapping + execute bridge — `mapMcpTool` (§3.3): `id` = `mcp:<server-id>:<tool-name>` · `tool.name` verbatim · `label` independently composed; `inputSchema` passed through UNTOUCHED (the `assertSupportedSchema` gate runs inside `registerIntegration`, no pre-check and no carve-out); `auth`/`envKey` inherited once per server; `execute` = `client.callTool` + TEXT-only result mapping, THROWS on `isError`/transport failure (the adapter's existing `is_error` path) | NEW `tools/agent/integrations/mcp/map-tool.ts` + `map-tool.test.ts` | SPEC-R25 AC1/AC2 |
| LLD-C4 (S4) | The discovery loop + fail-soft registration — `discoverMcpIntegrations` (§3.4): per server initialize→list→map→register through an INJECTABLE sink (default `registerIntegration`); per-tool try/catch covering BOTH throw paths (unsupported schema · duplicate wire `tool.name`, incl. the disclosed second-server-loses drop); server-scope skips (§3.4); structured `DiscoveryReport`; module `REGISTRY` untouched by any test | NEW `tools/agent/integrations/mcp/discover.ts` + `discover.test.ts` | SPEC-R26 AC1, SPEC-R23 AC2 |
| LLD-C5 (S5) | The dev-proxy boot-await — `configureServer` starts the discovery pass synchronously at boot and every request handler AWAITS its completion promise before routing (§5 ready-gate mechanics); roster read+validated once at boot (fail-fast); discovery keys from the existing `loadEnv`-merged `env`; the report logged at boot; the plugin factory gains an optional test-only `mcpDiscovery` injection (default = the real pass) so the race test never touches `REGISTRY` | `tools/agent/dev-proxy-plugin.ts` (S5's writer) · NEW ready-gate cases in `src/live-agent/chat-route.test.ts`'s harness (or a sibling `mcp-boot.test.ts` beside it) | SPEC-R27 AC2 |
| LLD-C6 (S6) | Admin surfacing — the `GET /integrations` trio route on the same mount (§3.5, trios ONLY, post-gate so `mcp:*` entries appear); the admin integrations pack reads it LIVE instead of hand-mirroring; the both-directions trio-parity test reshapes exactly ONCE to grade the pack-projection against the served trios | `tools/agent/dev-proxy-plugin.ts` (S6's writer, after S5) · `site/pages/agent-admin-libraries.ts` + consumers · `site/pages/agent-admin-app.test.ts` (`:435` reshape) | SPEC-R28 AC1/AC2 |

## 3 · Interfaces (exact shapes — trios only where served; no builder guesses)

### 3.1 Roster (`mcp-servers.json` · `servers-config.ts`)

```ts
export interface McpServerEntry {
  /** Human display text; composes SPEC-R25 labels ("<label>: <tool>"). */
  label: string
  /** Absolute http(s) URL — the ONLY MCP URL this system ever dials (the resolvePair fence). */
  endpoint: string
  auth: 'none' | 'serverKey'
  /** REQUIRED iff auth === 'serverKey' — an env-var NAME, never a value (SPEC-R18). */
  envKey?: string
}

export interface McpServersConfig {
  /** Key = the stable server-id — the `mcp:<server-id>:<tool>` namespace segment. */
  servers: Record<string, McpServerEntry>
}

export function validateMcpServersConfig(cfg: unknown): McpServersConfig
```

Fail-fast rules (first violation throws, `providers-config.ts` message style): non-object root or
`servers`; server-id not matching `/^[a-z0-9][a-z0-9_-]*$/` (NO `:` — it is a namespace segment of
the manifest `id`, so a colon would make `mcp:<server-id>:<tool>` unparseable); empty/missing
`label`; `endpoint` not an absolute `http(s)` URL; `auth` outside the two-member enum;
`serverKey` without a non-empty `envKey`. An EMPTY `servers` map is VALID (unlike
`validateProvidersConfig`'s no-providers throw — the empty roster is SPEC-R27's shipped state,
a zero-cost no-op, not a defect). Pure module, zero I/O, Worker-portable by construction.

### 3.2 Wire client (`client.ts`)

```ts
/** The F2 freeze as one-line constants — a future SPEC-R24 amendment (§7 F4) is a one-line edit. */
export const MCP_PROTOCOL_VERSION = '2025-06-18'
export const ACCEPTED_PROTOCOL_VERSIONS: readonly string[] = ['2025-06-18', '2025-03-26']

export interface McpClientOptions {
  endpoint: string
  /** Host-resolved key → `Authorization: Bearer <key>` on every request; never read from env here. */
  apiKey?: string
  /** Injectable transport (tests inject a scripted fake; default = global fetch). */
  fetchImpl?: typeof fetch
  /** Per-request timeout, default 10_000 ms (combined with a caller signal via AbortSignal.any). */
  timeoutMs?: number
  /** Per-response byte cap, default 1 MiB (dev-proxy MAX_BODY / registry TRUST-NOTE parity). */
  maxResponseBytes?: number
}

export type InitializeOutcome =
  | { ok: true; protocolVersion: string; sessionId?: string }
  | { ok: false; reason: 'unsupported-version'; negotiated: string }

export interface McpToolInfo {
  name: string
  title?: string
  description?: string
  inputSchema: Record<string, unknown>
}

export type McpContentPart =
  | { type: 'text'; text: string }
  | { type: string; [key: string]: unknown } // non-text — dropped with placeholder at mapping (§3.3)

export interface McpCallResult { content: McpContentPart[]; isError?: boolean }

export interface McpClient {
  initialize(): Promise<InitializeOutcome>
  listTools(): Promise<McpToolInfo[]>
  callTool(name: string, args: Record<string, unknown>, opts?: { signal?: AbortSignal; apiKey?: string }): Promise<McpCallResult>
}

export function createMcpClient(opts: McpClientOptions): McpClient

/** Every non-version failure THROWS this (discovery catches per server; execute lets it ride to
 *  the adapter's is_error conversion). `code` is closed; `message` carries no key value ever. */
export class McpClientError extends Error {
  code: 'http' | 'timeout' | 'too-large' | 'parse' | 'jsonrpc' | 'too-many-pages'
}
```

Wire mechanics (the pinned `2025-06-18` Streamable-HTTP shape — all POST, no GET stream):

- Every request: `POST <endpoint>` with `Content-Type: application/json`,
  `Accept: application/json, text/event-stream`, `Authorization: Bearer <key>` iff a key is
  present (per-call `opts.apiKey` overrides the instance key — the `ctx.apiKey` path, §3.3).
- **Handshake** (`initialize()`): send `initialize` with
  `params.protocolVersion = MCP_PROTOCOL_VERSION`, minimal `clientInfo`/`capabilities`. If the
  response's `protocolVersion ∉ ACCEPTED_PROTOCOL_VERSIONS` → return the `not-ok` outcome
  (server-scope skip, SPEC-R24; `tools/list` is never dialed). Otherwise capture the
  `Mcp-Session-Id` response header if assigned, POST the `notifications/initialized`
  notification (a 202/204, no body expected), and resolve `ok`.
- **Session + version headers**: every post-initialize request carries
  `MCP-Protocol-Version: <negotiated>` and — iff the server assigned one — `Mcp-Session-Id`
  echoed verbatim (a server assigning none ⇒ the header is simply never sent). Session state is
  per client instance; ONE instance per server per process lifetime (created at discovery,
  reused by every `execute` — §6 risk notes session expiry).
- **Response framing duality** (both sanctioned, part of the pinned transport): a
  `content-type: application/json` body parses as the single JSON-RPC response; a
  `content-type: text/event-stream` body is SSE-parsed — accumulate `data:` lines per event,
  JSON-parse each, take the response whose `id` matches the request's (monotonic numeric ids per
  instance), IGNORE interleaved notifications/other-id frames, stop at the match. Both paths feed
  one shared byte-capped body reader (over cap → `too-large`).
- **`listTools()`**: `tools/list`, following `nextCursor` pagination to completion, bounded at 16
  pages (beyond → `too-many-pages`, a server-scope skip — a hostile/looping cursor never hangs
  boot).
- **HTTP non-2xx** (and non-202-on-notification) → `http`; timeout/abort → `timeout`; malformed
  frame → `parse`; a JSON-RPC `error` member → `jsonrpc`. Raw frames never leave this module in
  either direction (SPEC-R24 AC2's fence: no JSON-RPC construction outside `mcp/` + the shell).

### 3.3 Mapping + execute bridge (`map-tool.ts`)

```ts
export interface MapToolInput {
  serverId: string
  server: McpServerEntry
  tool: McpToolInfo
  client: McpClient
}

export function mapMcpTool(input: MapToolInput): IntegrationManifest
```

The three facts, held independent (SPEC-R25): `id` = `` `mcp:${serverId}:${tool.name}` `` ·
`tool.name` = `tool.name` VERBATIM · `label` = `` `${server.label}: ${tool.title ?? tool.name}` ``.
`tool.input_schema` = `tool.inputSchema` by reference, untouched — `registerIntegration`'s own
`assertSupportedSchema` is the one gate (a pre-check here would be a second validator to drift).
`description` = `tool.description ?? label` (the manifest field is required; MCP's is optional).
`version` = `'1.0.0'` (admin-display only; MCP tools carry no semver — a constant, not derived).
`auth`/`envKey` copied once from the server entry. `execute(input, ctx)` =
`client.callTool(tool.name, input, { signal: ctx.signal, apiKey: ctx.apiKey })`, then TEXT-only
result mapping: join `type:'text'` parts with `\n\n`; each non-text part degrades to the literal
placeholder `[<type> content omitted]` (stated, never silent); `isError: true` → THROW with the
result's text (the adapter's existing rejection→`is_error` tool_result conversion applies —
degrade the answer, never the turn). A transport `McpClientError` propagates the same way.

### 3.4 Discovery (`discover.ts`)

```ts
export interface DiscoveryDeps {
  /** Discovery-time key resolution — the caller passes the loadEnv-merged env (SPEC-R27). */
  env: Record<string, string | undefined>
  /** INJECTABLE registration sink, default registerIntegration — no test touches REGISTRY. */
  register?: (m: IntegrationManifest) => void
  /** Injectable client factory for tests (scripted fake clients, zero transport). */
  createClient?: typeof createMcpClient
  /** Boot log line sink, default console.info/warn; lines carry ids/reasons, never a key value. */
  log?: (line: string) => void
}

export interface DiscoveryReport {
  /** Manifest ids, in registration order. */
  registered: string[]
  /** `tool` absent ⇒ a server-scope skip. `reason` is the thrown/derived message. */
  skipped: { server: string; tool?: string; reason: string }[]
}

export async function discoverMcpIntegrations(
  cfg: McpServersConfig,
  deps: DiscoveryDeps,
): Promise<DiscoveryReport>
```

Semantics: iterate `cfg.servers` in key order (committed-file order — deterministic, and the
tiebreak that makes "the FIRST server wins a cross-server `tool.name` collision" reproducible).
Per server — **server-scope skips** (no tool listed, one report row): `auth:'serverKey'` with an
unset/empty `env[envKey]` (reason `no-key` — the roster declares auth the host cannot provide, so
the server is never dialed; the discovery-time twin of `resolveIntegrations`' not-offered
degrade); `initialize` not-ok (reason `unsupported-version:<negotiated>`); any `McpClientError`
from handshake or `listTools`. Then per tool: `mapMcpTool` → `deps.register(manifest)` inside a
per-tool try/catch covering BOTH `registerIntegration` throw paths — unsupported schema, and
duplicate wire `tool.name` (incl. the disclosed second-server-loses drop) — one bad tool costs
exactly that one tool (SPEC-R26). Never throws outward: every failure is a report row, so S5's
boot gate can never wedge the proxy. Empty roster → `{registered: [], skipped: []}` with zero
client construction, zero I/O.

### 3.5 The S6 GET (dev-proxy route)

```
GET /__a2ui/agent/integrations  →  200 application/json
{ "integrations": [ { "id": string, "label": string, "description": string } ] }
```

A projection of `listIntegrations()` — the SPEC-R16 AC2 trio vocabulary, registration order,
served AFTER the ready gate so `mcp:*` entries appear. Trios ONLY: no `endpoint`, no `envKey`
name, no key value, no `version`, no `tool`, no raw MCP fact (SPEC-R28's cl.2 boundary). Sits
beside `/status` in the same handler (a `GET` + `url.startsWith('/integrations')` branch).

## 4 · Data & contracts (facts pinned)

- **Frozen-file fence, mechanical:** every S1–S6 PR shows an empty `git diff` over `registry.ts`,
  `validate-input.ts`, `tool-dispatch.ts`, `integrations/index.ts`, `src/agent/`, `worker/`
  (SPEC-R23 AC1). The connector is imported by `dev-proxy-plugin.ts` ONLY — never by
  `integrations/index.ts` (that import would resurrect the top-level-await hazard SPEC-R27 bans).
- **Key life:** discovery keys resolve from the proxy's `loadEnv`-merged env at boot (S5);
  dispatch keys ride the EXISTING `ExecuteContext.apiKey` path into `execute` → `callTool`'s
  auth header. No key is stored on a manifest, serialized, or logged (SPEC-N2 grep-gate class).
- **Roster read posture — deliberately NOT `providers.json`'s per-request reload:** the roster is
  read once at boot. Per-request reload exists for `providers.json` to stay in lockstep with the
  HMR'd switcher; the MCP roster has no browser twin and discovery is once-per-lifetime anyway
  (SPEC-R27's accepted staleness) — a roster edit takes a dev-server restart, same as today's
  `.env` edit.
- **The wire client never reads env, never touches the registry, never knows manifests exist**
  (S2 is file-disjoint from S1 and parallel-safe). Mapping (S3) never registers; discovery (S4)
  never decides WHEN it runs; the proxy (S5) decides when.

## 5 · Ready-gate mechanics (S5, inside `configureServer`)

1. `configureServer` reads + validates `mcp-servers.json` (fail-fast at boot on a malformed
   roster — the `loadConfig()` posture, same throw surface).
2. It starts the discovery pass SYNCHRONOUSLY at boot and keeps the promise:
   `const mcpReady: Promise<DiscoveryReport> = runDiscovery(env)` — where `runDiscovery` is the
   plugin factory's injectable `mcpDiscovery` option (default: the real
   `discoverMcpIntegrations` over the parsed roster). `mcpReady` then logs its report
   (`registered n / skipped m + reasons`). It NEVER rejects (§3.4), so the gate cannot wedge.
3. The registered middleware handler's async IIFE begins `await mcpReady` BEFORE any routing —
   every branch (`/status`, `/chat`, produce, S6's `/integrations`) is behind it. A request
   racing boot QUEUES on the promise (never a 503, never served early); after resolution the
   await is a settled-promise microtask — zero steady-state cost.
4. Empty roster ⇒ `discoverMcpIntegrations` resolves immediately with the empty report ⇒
   behavior byte-identical to today (SPEC-R27 AC2's no-op law). Discovery latency is bounded by
   construction: `timeoutMs × servers × (1 handshake + ≤16 pages)`.
5. Why await-in-handler rather than a Vite hook: Vite has no "hold requests until a promise
   settles" primitive; gating inside the one registered handler is race-free by construction,
   touches no other middleware, and is the smallest diff to the seam file. This satisfies cl.4's
   law — discovery STARTS as a distinct boot step, is never spliced as a top-level `await` into
   `integrations/index.ts`, and no request can observe a half-discovered registry.
6. Test seam: `a2uiDevProxyPlugin(opts?: { mcpDiscovery?: (env) => Promise<DiscoveryReport> })` —
   optional, test-only; `vite.config.ts`'s call stays `a2uiDevProxyPlugin()`. The race test
   injects a manually-resolved deferred (no sink, no `REGISTRY` mutation) and asserts a request
   posted before resolution answers only after; the empty-roster test uses the default path
   against the real (empty) committed roster — no network either way.

## 6 · Fake-server test strategy (deterministic, zero network — all slices)

- **S2 (`client.test.ts`): a scripted `fetchImpl` fake, not a listening server.** The fake is a
  function returning canned `Response` objects (Node ≥18's global `Response`) and RECORDING every
  `{url, headers, body}` for assertions. Two builders make the framing duality first-class:
  `jsonResponse(rpcResult)` (an `application/json` body) and `sseResponse(events)` (a
  `text/event-stream` body string with `data:` frames, incl. interleaved notification frames the
  parser must skip). Pinned cases: `initialize` carries `protocolVersion: "2025-06-18"`;
  post-initialize requests carry `MCP-Protocol-Version` + the echoed `Mcp-Session-Id` (and omit
  it when the fake assigned none); a fake negotiating `2024-11-05` → not-ok outcome and the
  request log proves `tools/list` was never dialed (SPEC-R24 AC1); the SAME `tools/list` result
  served once JSON-framed and once SSE-framed parses deep-equal; `Authorization` carries the
  per-call key (`ctx.apiKey` reaching the header, SPEC-R25 AC1); oversize body → `too-large`;
  looping cursor → `too-many-pages`; no real timer waits (fake timers or immediate aborts).
- **S3 (`map-tool.test.ts`): no transport at all** — a hand-built `McpClient` stub. Pinned:
  relabel changes neither `id` nor `tool.name`; `input_schema` deep-equal AND reference-equal to
  the discovered `inputSchema` (passthrough, byte-true); mixed text+non-text `callTool` result →
  TEXT + placeholder; `isError` → throw (ridden through the shipped `buildToolDispatch` in one
  integration-grain case to re-assert the `is_error` tool_result, the SPEC-R17 AC2 pattern).
- **S4 (`discover.test.ts`): injected sink + injected client factory** (scripted fake clients).
  Pinned: one bad tool of N ⇒ exactly N−1 registered + the report row; two fake servers exposing
  one shared name ⇒ the second dropped with reason, the first registered (roster key order = the
  documented tiebreak); `no-key` server-scope skip; empty roster ⇒ empty report; and
  `listIntegrations()` length unchanged across the whole suite (the `REGISTRY`-untouched proof —
  what keeps `agent-admin-app.test.ts:435`'s trio-parity green by construction until S6's ONE
  sanctioned reshape).
- **S5: the `chat-route.test.ts` harness precedent** (fake Vite server capturing the middleware,
  fake req/res driving it — `chat-route.test.ts:133-180`), extended per §5.6. `npm run
  test:browser` is untouched by construction (no browser-shipped file changes until S6's pack).

## 7 · Open forks

- **F4 — the SPEC-R24 protocol pin is STALE against the live spec (found by this slice's
  mandated sanity check; recorded, NOT silently re-pinned — SPEC-R24 is the owning doc).**
  Checked 2026-08-07 against modelcontextprotocol.io's revision history: the CURRENT revision is
  **`2026-07-28`**, with **`2025-11-25`** (Final) between it and the pinned `2025-06-18`.
  `2025-11-25` is handshake-based and wire-compatible with this LLD's client mechanics byte-for-
  byte (same `initialize` lifecycle, same `Mcp-Session-Id` echo, same `MCP-Protocol-Version`
  header, same Streamable HTTP POST shape). `2026-07-28` is a BREAKING redesign: the
  `initialize` handshake and `Mcp-Session-Id` are REMOVED (stateless per-request `_meta`
  versioning, mandatory `server/discover`, required `Mcp-Method`/`Mcp-Name` headers) — a
  different client design, not a widened acceptance set. Behavior under the freeze as merged:
  a server negotiating `2025-11-25` — or speaking only `2026-07-28` — is skipped-and-logged
  (fail-soft, never a crash), which excludes current-generation servers from an otherwise-empty
  roster. Options for the host: **(a)** widen the acceptance set to
  `{2025-06-18, 2025-03-26, 2025-11-25}` — a one-line SPEC-R24 amendment + the §3.2 constant,
  zero client-design change (the LLD's constants exist precisely so this is one line);
  **(b)** keep the freeze exactly as merged — safe, honest, revisit when a real server enters
  the roster (ADR-0177 Non-goals already parks that call with Kim); **(c)** re-target the
  `2026-07-28` stateless protocol — a materially different wire client, premature while the
  roster is empty and the ecosystem straddles revisions. Recommendation: (a) or (b); neither
  blocks S1–S6, and every slice below builds identically under both.
- **F3 status: NOT fired.** The pinned flavor hand-rolls cleanly — four POST verbs, one SSE line
  parser, no SDK wall found while sizing §3.2. The escape hatch stays what the SPEC says it is.

## 8 · Risks & non-decisions

- **Session expiry mid-lifetime** — one client instance per server per process; a server
  expiring its `Mcp-Session-Id` (e.g. HTTP 404 post-expiry) makes the next `execute` throw →
  an `is_error` tool_result, and recovery is a dev-server restart. Accepted v1 gap, same class
  as SPEC-R27's stale-list staleness; re-initialize-on-404 is a later, additive client feature.
- **Discovery latency at boot** — real and disclosed (ADR-0177 Consequences); bounded by §5.4's
  arithmetic; empty roster costs nothing.
- **Non-decision (recorded, no ADR):** `version: '1.0.0'` constant on every MCP-sourced manifest
  — MCP carries no per-tool semver; inventing one from server metadata would be a fourth derived
  fact with no consumer. Revisit only if the admin UI ever needs real MCP versioning.
- **Non-decision:** the roster filename `mcp-servers.json` and the `Record<serverId, entry>` map
  shape mirror `providers.json`'s grammar deliberately — nothing was at stake beyond consistency.
- **Log hygiene** — report/log lines carry server-ids, tool names, and closed reason strings;
  never a key value (SPEC-N2 class), and endpoints stay out of the S6 GET by shape (§3.5).

## 9 · Build sequence + slice→AC map (gates FOREGROUND, judged by exit codes)

| Order | Slice | LLD | Proves (SPEC ACs) |
|---|---|---|---|
| 1 (∥ with 2) | S1 | C1 | R27 AC1 (loader fail-fast; empty roster valid) |
| 2 (∥ with 1) | S2 | C2 | R24 AC1 (pin/headers/skip/framing-duality) · R24 AC2 (node-side fence) |
| 3 | S3 | C3 | R25 AC1 (three facts, passthrough, key path) · R25 AC2 (TEXT-only, is_error) |
| 4 | S4 | C4 | R26 AC1 (fail-soft, second-server-loses, empty report) · R23 AC2 (ordinary manifest) |
| 5 | S5 | C5 | R27 AC2 (ready-gate, empty-roster byte-identity) · R23 AC1 (fence holds at head) |
| 6 | S6 | C6 | R28 AC1 (trios-only GET) · R28 AC2 (the ONE parity reshape, both-directions honest) |

S1 ∥ S2 (disjoint files); S3 needs both; S4 needs S3; S5 needs S4; S6 needs S5 (same seam file,
serialized). Every slice: one writer per file, `npm run check && npm test` green by exit code;
`test:browser` where site files are touched (S6). Reviewer of this doc: the doc-checker seat;
any F4 ruling: Kim, landing in SPEC-R24 first, this doc's §3.2 constants second.
