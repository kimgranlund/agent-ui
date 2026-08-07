# Decomposition — the MCP manifest-registry BUILD arc (allowlist config · wire client · additive mapping · fail-soft discovery · boot-await)

> Status: proposed · v0.1 · 2026-08-07 · planner · Tracker: GH [#567](https://github.com/kimgranlund/agent-ui/issues/567) ·
> Contract: [ADR-0177](../adr/0177-mcp-client-registry-source-http-transport-additive-manifest-mapping.md)
> (RATIFIED 2026-08-06, incl. its 2026-08-07 amendment: the build tracker is #567, not a reopened #438) —
> this doc does not re-derive that decision; it slices ADR-0177's four clauses + Repairs-cell build
> bookings into independently-shippable, gate-green leaves. Conformance laws the build lands INTO,
> byte-unchanged: [ADR-0168](../adr/0168-integration-manifest-registry-validated-dispatch-server-keys.md)
> cl.1–5 / [`../spec/a2ui-live-agent.spec.md`](../spec/a2ui-live-agent.spec.md) §3.6 **SPEC-R16–R19**
> (note: R16–R19's home is `a2ui-live-agent.spec.md`, NOT `a2ui-ecosystem-alignment.spec.md` — that
> spec's SPEC-R8 is the separate, already-settled MCP-*Apps* non-goal ADR-0177 distinguishes) · the
> `agent-ui-integration-standards` skill's five laws · the ADR-0137 shell law (registry code in
> `tools/agent/`, NEVER `src/agent/`; the root `.` barrel carries zero producer bytes).
> `break-down-problem` is not installed in this repo's `.claude/`; its two-plane method is applied
> inline (§1/§2) with the coverage check in §2. One writer per file per slice; every build slice ends
> `npm run check && npm test` green — judged by EXIT CODES, never grep.

## 0 · What already exists (read, not rebuilt) — and what this arc never touches

The shipped enablement seam (`packages/agent-ui/a2ui/tools/agent/integrations/`) is the landing zone,
not the work: `IntegrationManifest` + `registerIntegration()`'s four boot-fail-fast checks
(`registry.ts:65-81`), `resolveIntegrations`' fail-closed intersection + unprovisioned-serverKey
exclusion (`registry.ts:103-110`), `validateToolInput`/`assertSupportedSchema` (SPEC-R17), the ONE
shared `buildToolDispatch` on both live arms (SPEC-R19), and `ExecuteContext.apiKey` server-side key
hand-off (SPEC-R18).

**Frozen for this whole arc (ADR-0177 preamble + Non-goals — any slice diffing these files is out of
contract):**

- `src/agent/` — the portable core stays types-only; keys NEVER enter it (SPEC-R18 / skill law 5).
- `registry.ts` (`registerIntegration`/`listIntegrations`/`resolveIntegrations`),
  `validate-input.ts`, `tool-dispatch.ts` — an MCP-sourced manifest is indistinguishable from a
  hand-authored one to every consumer; this arc adds a PRODUCER, never a consumer-side mechanism.
- The `auth` vocabulary — `'none' | 'serverKey'` unchanged, no `'mcp'` member, no new
  `ExecuteContext` field.
- `worker/` — production Worker rollout is a deferred, additive follow-up (ADR-0177 cl.4/Non-goals);
  v1 is dev-proxy-only, a stated temporary asymmetry, not a #402-class silent gap.
- The enablement wire — the browser still forwards `integrations: string[]` of registry `id`s; no
  server URL, MCP tool name, or credential ever crosses in either direction (cl.2).

## 1 · Plane 1 — outside-in (the whole, broken into parts)

The domain: a second manifest PRODUCER — an MCP connector at
`packages/agent-ui/a2ui/tools/agent/integrations/mcp/` — that turns each allowlisted MCP server's
`tools/list` into N ordinary `IntegrationManifest`s via the existing `registerIntegration()`
(ADR-0177 cl.1: a registry SOURCE, never a per-server entry).

1. **Allowlist config + loader** — a committed, admin-curated MCP-server roster (sibling to
   `providers.json`, the `resolvePair` discipline: no browser- or model-supplied URL is ever dialed,
   cl.4) + a fail-fast loader mirroring `providers-config.ts`'s posture. Per server:
   stable server-id, human label, endpoint, `auth: 'none' | 'serverKey'`, `envKey?` (a NAME, never a
   value — SPEC-R18). v1 roster ships EMPTY/example-only (which real server enters it is Kim's later
   call, ADR-0177 Non-goals).
2. **MCP wire client** — the minimal HTTP JSON-RPC surface the connector needs (handshake as the
   chosen flavor requires, `tools/list`, `tools/call`), hand-rolled over `fetch` (F3, §4 — the
   SPEC-N1 derivation), auth header injected from a host-resolved key passed IN, per-response size
   cap + abort/timeout (the registry TRUST-NOTE parity). Raw JSON-RPC frames never leave the host
   (cl.2).
3. **Tool→manifest mapping + execute bridge** — a pure mapping from one discovered MCP tool
   `{name, description, inputSchema}` + its server's config onto ONE `IntegrationManifest` under the
   three-fact law (cl.3): `id` = namespaced `mcp:<server-id>:<tool-name>` · `tool.name` = the MCP
   name VERBATIM (unnamespaced — the disclosed cross-server-collision trade) · `label` =
   independently composed (`"<server label>: <tool name/title>"`), never re-derived from the other
   two · `input_schema` passed through UNTOUCHED into the same `assertSupportedSchema` gate (no MCP
   carve-out) · `auth`/`envKey` inherited once per server. `execute` = client `tools/call` +
   TEXT-only result mapping (non-text parts dropped/placeholder-stringified, cl.3), throwing on
   upstream failure so the adapter's existing `is_error` conversion applies.
4. **Discovery loop + fail-soft registration** — per allowlisted server: `tools/list` → map each →
   register, with a PER-TOOL try/catch around each `registerIntegration()` call covering BOTH throw
   paths (unsupported schema · duplicate wire `tool.name`, incl. the disclosed
   second-server's-same-named-tool-loses behavior) — skip-and-log the one tool, keep the other N−1;
   `registerIntegration` itself untouched (cl.3). Returns a structured report
   (registered/skipped+why) for boot logging. Registration sink is INJECTABLE (defaulting to
   `registerIntegration`) so tests never pollute the module-level `REGISTRY` singleton — which is
   also what keeps the both-directions admin-pack trio-parity test (SPEC-R16 AC2,
   `agent-admin-app.test.ts:435`) green by construction: discovery runs only at dev-proxy boot,
   never at `integrations/index.ts` import, so test-time `listIntegrations()` stays hand-authored-only.
5. **Boot-sequencing seam (dev proxy)** — the dev proxy AWAITS the whole discovery pass, for every
   allowlisted server, as a distinct startup step BEFORE serving `/chat`/produce requests (cl.4's
   law): never a top-level `await` spliced into `integrations/index.ts` (would stall hand-authored
   registration), never fire-and-forget a request could race. Discovery-time key resolution from the
   same `loadEnv`-merged env the proxy already holds; once per process lifetime (stale list = the
   accepted `providers.json`-class v1 gap).
6. **Contract docs + skill repair** — the ADR-0177 Repairs-cell bookings that are documents:
   `a2ui-live-agent.spec.md` gains MCP-sourcing requirements beside SPEC-R16–R19; a connector LLD
   (the module/interface decomposition above earns one); the `agent-ui-integration-standards` skill
   gains its MCP-manifest pattern section beside the five laws + a repointed Routing-out line.

## 2 · Plane 2 — inside-out (the actions each part must support)

| # | Action | Part |
|---|---|---|
| a1 | Name an MCP server (endpoint + auth envKey) in committed config; malformed roster fails fast at load | 1 |
| a2 | Refuse by construction to dial any server the config doesn't list (allowlist fence, cl.4) | 1, 4 |
| a3 | Resolve a server's key host-side for DISCOVERY (`tools/list`) — never in the browser, a log line, or `src/agent/` | 1, 5 |
| a4 | Resolve the same key host-side for DISPATCH (`tools/call`) via the EXISTING `ExecuteContext.apiKey` path, zero dispatch change | 3 (+ shipped `tool-dispatch.ts`, unchanged) |
| a5 | Fetch a server's tool list over HTTP JSON-RPC (handshake + `tools/list`) | 2, 4 |
| a6 | Map one discovered tool onto one manifest with `id` ≠ `tool.name` ≠ `label` held as three independent facts | 3 |
| a7 | Gate every discovered `input_schema` through `assertSupportedSchema` — no MCP carve-out of the validator | 3, 4 (the shipped gate inside `registerIntegration`) |
| a8 | Skip-and-log ONE unsupported/colliding tool; register the server's other N−1 (fail-soft, both throw paths) | 4 |
| a9 | Drop-and-log the SECOND same-named tool across two servers — disclosed, never a crash, never silent | 4 |
| a10 | Execute an enabled MCP tool: `tools/call` → compact TEXT for the model; upstream failure throws → the adapter's `is_error` tool_result | 2, 3 |
| a11 | Await discovery at dev-proxy boot before the first served request — never per-request, never racy | 5 |
| a12 | Keep hand-authored registration + both routes byte-identical when the roster is empty (zero-cost no-op) | 4, 5 |
| a13 | Report each boot's discovery outcome (registered/skipped + why) in the proxy log | 4, 5 |
| a14 | Teach the next author the pattern (SPEC requirements + skill section + LLD of record) | 6 |

**Coverage check (both directions):** every action a1–a14 names ≥1 part; every part 1–6 hosts ≥1
action (1: a1/a2/a3 · 2: a5/a10 · 3: a4/a6/a7/a10 · 4: a2/a5/a7/a8/a9/a12/a13 · 5: a3/a11/a12/a13 ·
6: a14). No orphan part, no unhomed action. Deliberately ABSENT actions are ADR-0177's recorded
Non-goals, not gaps: Worker-side discovery/dispatch of MCP tools, periodic/admin-triggered
re-discovery, multi-modal result content, stdio transport, wiring any real MCP server, agent-ui AS an
MCP server (SPEC-R6), MCP Apps delivery (ecosystem SPEC-R8). One further absent action is a genuinely
unruled fork, not a non-goal: how the BROWSER learns `mcp:*` ids so the enablement wire can carry
them (F1, §4) — no slice below builds it, and no slice pretends it isn't owed.

## 3 · Slices (independently shippable; each executable from its enumerated inputs alone)

Every build slice's standing DoD, in addition to its own: `npm run check && npm test` green by exit
code · new code under `tools/agent/integrations/mcp/` only (plus the one named seam file per slice) ·
no diff to the §0 frozen list · no key value or server URL reaches browser-shipped code (SPEC-N2's
grep-gate class).

- **S-SPEC — the SPEC amendment (doc, serial-first).**
  *Does:* an amendment sheet (the `tool-enablement.spec-amendment.md` precedent) applied to
  `a2ui-live-agent.spec.md` v0.9 → v0.10: new SPEC-R2x requirements for MCP sourcing — the
  registry-SOURCE law, server-side-only HTTP transport + allowlist fence, the additive mapping under
  the three-fact law, per-tool fail-soft with the disclosed second-server-loses consequence,
  boot-await sequencing, TEXT-only v1 results — each with checkable ACs; freezes the design-owned
  forks F2/F3 (§4) with reasoning; records F1's chosen resolution once Kim rules it.
  *Does NOT:* touch SPEC-R16–R19's text (additive beside them, the ADR-0177 posture); build anything.
  *Inputs:* ADR-0177 · SPEC v0.9 §3.6 · this manifest. *DoD:* doc-checker pass; `npm run check`
  green (docs don't compile, the gate proves no collateral).
- **S-LLD — the connector LLD (doc).**
  *Does:* Components/Interfaces/Data/Risks for the `mcp/` module family (servers-config · client ·
  map-tool · discover · the dev-proxy await seam): exact file names, exported signatures (incl. the
  injectable register sink + injectable fetch/transport for tests), the fake-MCP-server test
  strategy (deterministic, no external network), the ready-gate mechanics inside
  `dev-proxy-plugin.ts` (`configureServer`), error/log shapes. Slice→AC map for S1–S5.
  *Does NOT:* re-litigate ADR-0177 or this manifest; design Worker rollout.
  *Inputs:* S-SPEC output · `registry.ts`/`providers-config.ts`/`dev-proxy-plugin.ts` as shipped.
  *DoD:* doc-checker pass; every S1–S5 interface named well enough that no builder guesses.
- **S1 — allowlist config + loader.**
  *Does:* the committed roster file (sibling to `providers.json`; exact name/schema per S-LLD) + its
  fail-fast loader (`mcp/servers-config.ts`): malformed entry / `serverKey`-without-`envKey` throw at
  load (the `providers-config.ts` posture); ships an EMPTY/example-only roster.
  *Does NOT:* dial anything (zero I/O); register anything; name any real server.
  *Inputs:* S-LLD schema. *DoD:* unit tests for valid/malformed/empty rosters; gates green.
- **S2 — MCP wire client.**
  *Does:* `mcp/client.ts` — hand-rolled fetch JSON-RPC per S-SPEC's F2/F3 freeze: the required
  handshake, `tools/list`, `tools/call`; bearer/auth header from a key passed IN by the caller;
  response size cap + abort/timeout (TRUST-NOTE parity); typed result/error surfaces.
  *Does NOT:* read env or resolve keys itself; touch the registry; know about manifests.
  *Inputs:* S-LLD interfaces. *DoD:* deterministic tests via the LLD's fake-server/injected-transport
  strategy — no external network; gates green. Parallel-safe with S1 (disjoint files).
- **S3 — tool→manifest mapping + execute bridge.**
  *Does:* `mcp/map-tool.ts` — the pure cl.3 mapping (a6's three-fact split; `inputSchema` passed
  through untouched; `auth`/`envKey` inherited per server) + the `execute` bridge closing over the
  S2 client: validated input in (the shipped dispatch already ran `validateToolInput`), `tools/call`
  out, TEXT-only `CallToolResult` mapping, throw on upstream failure.
  *Does NOT:* call `registerIntegration` (no registration policy here); loop over servers.
  *Inputs:* S1 config types · S2 client. *DoD:* unit tests pinning all three facts independent
  (relabel touches neither `id` nor `tool.name`), schema passthrough byte-equal, non-text
  parts degraded as specified, `ctx.apiKey` reaching the auth header; gates green.
- **S4 — discovery loop + fail-soft registration.**
  *Does:* `mcp/discover.ts` — per allowlisted server: list → map → register through an INJECTABLE
  sink (default `registerIntegration`), per-tool try/catch covering both throw paths (a8/a9),
  structured `{registered, skipped: [{server, tool, reason}]}` report.
  *Does NOT:* wire into the dev proxy; decide when it runs; mutate the module `REGISTRY` in any test
  (injected sink only — the trio-parity invariant, §1 part 4).
  *Inputs:* S1+S2+S3. *DoD:* tests proving one bad tool costs exactly one tool (N−1 registered);
  cross-server duplicate `tool.name` drops the SECOND, logged with its reason; empty roster → empty
  report; the shipped `agent-admin-app.test.ts` trio-parity test still green untouched; gates green.
- **S5 — dev-proxy boot integration (the ONE seam-file slice).**
  *Does:* `dev-proxy-plugin.ts` gains the awaited discovery pass per cl.4's law — a ready-gate
  before `/chat`/produce handling (mechanics per S-LLD), discovery-time key resolution from the
  existing `loadEnv`-merged env, the S4 report logged at boot.
  *Does NOT:* touch `worker/index.ts` (frozen, §0); add refresh/re-discovery; splice any await into
  `integrations/index.ts`; change either route's request/response contract (empty roster ⇒
  byte-identical behavior to today).
  *Inputs:* S4 · shipped `dev-proxy-plugin.ts`. *DoD:* tests for the ready-gate (no request served
  ahead of completed discovery; empty roster = no-op cost) and for hand-authored manifests
  registering exactly as before; `npm run check && npm test` green; `npm run test:browser` unaffected.
- **S-SKILL — the skill + doc-state repair (doc, serial-last).**
  *Does:* `agent-ui-integration-standards` gains the MCP-manifest pattern section beside its five
  laws (symbol-first cites into the SHIPPED `mcp/` modules) and its Routing-out MCP line repoints
  from "not yet landed" to built; roadmap/plan rows touched iff they carry this arc.
  *Does NOT:* restate ADR-0177 (cites it); grade the build.
  *Inputs:* S1–S5 as merged. *DoD:* skill cites resolve against real symbols; gates green.

## 4 · Open forks — genuinely unruled by ADR-0177 (never pre-decided here)

- **F1 — browser-side surfacing of MCP-sourced manifests (KIM'S FORK — the one real scope hole).**
  ADR-0177 cl.4 asserts the enablement wire "can select AMONG config-registered MCP-sourced
  manifests" but never rules HOW the browser learns their `mcp:*` ids. Today that knowledge is
  hand-authored (`site/pages/agent-admin-libraries.ts` `INTEGRATION_TOOLS`) and pinned by the
  BOTH-directions trio-parity test (SPEC-R16 AC2, `agent-admin-app.test.ts:435` —
  `pack ≡ listIntegrations()` exactly). Discovered-at-boot manifests cannot appear in a static
  browser pack without either drift or a parity-test redesign. Options, none prejudged: **(a)** a
  new host GET endpoint serving registered `{id, label, description, auth}` trios, consumed
  dynamically by the admin pack (new wire surface; parity test reshaped to cover the projection);
  **(b)** hand-mirror expected MCP tools in the static pack (drift-prone AND reddens the
  both-directions parity test in the test env, where discovery never runs — likely a non-starter,
  stated for completeness); **(c)** v1 ships the connector proven at the route level (an
  `integrations: ['mcp:…']` body from a test/dev caller) with NO admin-UI exposure — smallest, but
  the toggle-affordance gap should be a stated scope cut, not a silent one (the #402 lesson).
  **Gates nothing in S1–S4; gates whether S5 is the arc's last build slice or an S6 follows.**
  Routed to Kim with this handback; S-SPEC records the ruling.
- **F2 — HTTP transport flavor + protocol-version pin (design-owned; S-SPEC freezes it).** ADR-0177
  cl.2 grants "HTTP-based MCP transport (Streamable HTTP / SSE)" without pinning: Streamable HTTP
  only (the current MCP revision) vs also the legacy HTTP+SSE flavor vs negotiate; and which MCP
  protocol-version string the handshake sends/accepts. A builder would have to guess → S-SPEC
  decides with reasoning inside the granted scope; listed here for visibility, not for Kim unless
  S-SPEC finds the choice widens scope beyond cl.2's grant.
- **F3 — client posture: hand-rolled fetch vs an MCP SDK dependency (constrained, near-closed).**
  ADR-0177 never says "hand-rolled," but SPEC-N1 pins `@agent-ui/a2ui/package.json` deps unchanged +
  "no LLM SDK anywhere (plain fetch)," and cl.4's production-rollout-is-additive posture requires
  Worker-fetchability — jointly these DERIVE the hand-rolled default S2 assumes. Named as a fork
  only because the escape hatch is owner territory: if S-LLD finds hand-rolling the chosen F2 flavor
  infeasible, adopting `@modelcontextprotocol/sdk` is a repo-identity dependency change (the
  CodeMirror/ADR-0139 class) needing its own Kim-ruled record — a blocked-handback at that point,
  never a builder's quiet `npm install`.
- **Carried open, already ruled open (not new):** which real MCP server first enters the allowlist —
  ADR-0177 Non-goals, Kim's later call; the roster ships empty either way (S1).

## 5 · Dependency order (dispatchable)

```
S-SPEC ──→ S-LLD ──→ S1 ─┐
                          ├─→ S3 ──→ S4 ──→ S5 ──→ S-SKILL
              └────→ S2 ─┘                   ▲
F1 (Kim) ────────────────────────────────────┘  (gates only whether an S6 admin-surfacing slice
                                                 exists after S5 — S1–S5 dispatch regardless)
F2/F3 resolve inside S-SPEC/S-LLD (no external wait unless F3's escape hatch fires → blocked handback)
```

Every edge is a real input dependency, not convention: S-LLD needs S-SPEC's frozen requirements
(F2 especially — S2's handshake shape depends on it); S1 and S2 are file-disjoint and parallel-safe;
S3 imports S1's config types + S2's client; S4 composes S3's mapping and S1's roster through S2's
list call; S5 is the only slice touching a shared seam file (`dev-proxy-plugin.ts`) and needs S4
whole; S-SKILL cites shipped symbols so it trails everything. One writer per file per slice holds
throughout — only S5 touches `dev-proxy-plugin.ts`, only S1 touches the roster/loader, only S-SPEC
touches the SPEC.

## 6 · Recommended first dispatch

**S-SPEC.** It is the ADR's own first booked repair, it freezes F2/F3 so S-LLD and every build slice
proceed guess-free, and it is where F1's ruling (routed to Kim now, in parallel) gets recorded when
it arrives — nothing in S-SPEC blocks on F1, since the amendment can state the surfacing requirement
in whichever shape Kim rules or mark it explicitly deferred under option (c).
