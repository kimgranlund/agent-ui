# SPEC — Per-agent MCP services in the Agent Schema system

> Status: proposed · v0.3 · 2026-08-14 (v0.2 2026-08-12, v0.1 2026-08-12) · Layer: SPEC (execution contract)
> v0.3 changelog (GH #877, ADR-0189 ratified/built 2026-08-14): SPEC-R4 widens — the `services` row
> gains the ADR-0189 cl.3 `tools: Array<{id, label, description}>` member (real per-tool
> descriptions, sourced from the SAME registered `IntegrationManifest.description` `mapMcpTool`
> already computes — zero new capture, a wire change only); the row's own `description` (the
> boot-count aggregate) is UNCHANGED, kept as a compact summary fact. SPEC-R5's original "empty
> `content`" ruling is RETIRED (ADR-0189 cl.5) now that a real per-tool description exists on the
> wire — REV-annotated in place below, per doc-standards, rather than silently rewritten.
> v0.2 changelog (the doc-checker fix-then-ship pass, same day): SPEC-R2's ref grammar anchored to
> `SERVER_ID_PATTERN` + the `mcp:calc:add:*` discriminating vector · SPEC-R5's collision citation
> repaired (GH #564 / `ValidateNewEntryOptions` own the law, not ADR-0170 cl.8) + the cl.8
> `customAdd` question answered in §8 · SPEC-R6 re-fenced from "empty diff" to "no MCP-aware code"
> with ONE permitted generic widening (per-pack `rejectOnCollision`) · SPEC-N2 books two more
> stale-context records · the §9 grammar fork recorded in ADR-0185 instead of left open.
> Refines: GH #783 (the intake record — its Summary/Acceptance own the why/what) onto the shipped
> MCP manifest-registry infrastructure (ADR-0177 / [mcp-connector.lld.md](../lld/mcp-connector.lld.md) /
> GH #567) and the agent-admin Agent Schema surface (ADR-0131/ADR-0132, GH #781's shipped scope page).
> **No owning PRD — a deliberate, acknowledged deviation** (the `form-popover.spec.md` precedent):
> GH #783's issue body already carries the problem statement, user, and done-when; a PRD would restate
> it under different frontmatter.
> Refined by: [`mcp-agent-config.lld.md`](../lld/mcp-agent-config.lld.md) +
> [`mcp-agent-config.decomp.md`](../decompositions/mcp-agent-config.decomp.md) (both authored at build
> dispatch, 2026-08-12 — this line's earlier "does not exist yet" note repaired in that same change).
> The one genuine fork this SPEC opens — the enablement wire's grammar widening (SPEC-R2/R3),
> amending a fence four accepted records pin — is recorded, not self-ratified, in
> [`../adr/0185-enablement-wire-service-reference-grammar.md`](../adr/0185-enablement-wire-service-reference-grammar.md)
> (proposed): this SPEC states the recommended requirement pending Kim's ruling, per that ADR
> (the `app-surfaces-m2.spec.md`/ADR-0129 precedent — the fork authored ALONGSIDE the SPEC, never
> after the fact).
> Altitude: owns **how per-agent MCP configuration maps onto the ADR-0177 registry** — the reference
> grammar, the storage shape, the resolution semantics, and every boundary's degrade — GH #783's
> Acceptance clause 1. File layout, exact constants, and pack presentation are the LLD's.
> Requirement IDs file-scoped (`SPEC-R1…`, `SPEC-N1…`).

---

## 1 · Purpose

Let one agent (a persona in `ui-agent-admin`) declare which MCP **services** — allowlisted servers
from the committed roster, discovered into the global `IntegrationManifest` registry at boot
(ADR-0177) — its turns may use, with that selection persisting in the agent's own store and reaching
the live tool-enablement path (`resolveIntegrations` → `buildToolDispatch`) on every turn.

The design is deliberately small because the repo already carries almost the whole path. What exists
today, verified at HEAD:

1. `mcp-servers.json` → boot discovery → registry rows `mcp:<server-id>:<tool>` (ADR-0177,
   [a2ui-live-agent.spec.md](./a2ui-live-agent.spec.md) SPEC-R23–R27).
2. The dev proxy's `GET /integrations` serves the registered `{id, label, description}` trios,
   `mcp:*` entries included (SPEC-R28).
3. The admin app's Integrations pack reads that GET live (`fetchLiveIntegrations` →
   `setLiveIntegrations`, `site/pages/agent-admin-libraries.ts`), so a discovered MCP **tool** is
   already addable per agent as an ordinary `tool`-kind entry.
4. `ui-agent-admin`'s `#enabledToolIds` forwards each enabled entry's `id` (never its label,
   GH #402) on both live arms; `resolveIntegrations` intersects that list with the registry by
   manifest `id`, drops unknowns, and excludes unprovisioned `serverKey` manifests (ADR-0168
   cl.2/cl.4/cl.5).

So per-**tool** MCP enablement is shipped in all but roster content. What this SPEC adds is the
missing **service** grain GH #783 actually asks for, and the reasons it must be a first-class
reference rather than a UI convenience over per-tool rows:

- **Tool-set churn.** The registry is rebuilt from `tools/list` every proxy boot (SPEC-R27's
  accepted staleness has a boot-time horizon). Per-tool ids pinned in an agent's localStorage rot
  silently when a server renames or adds tools; a service reference resolves against the *current*
  registry at turn time, so a server's new tool joins the agent's kit with zero store edits.
- **The wire cap.** The browser-supplied enablement list is defensively capped (`MAX_ENABLED`,
  `integrations/registry.ts`). A 30-tool server cannot even be *expressed* per-tool; one service
  reference is one wire item.
- **The ask's own grain.** GH #783 says "declare/enable MCP **services** per agent" — the server is
  the unit an admin reasons about; individual tools are the exception (pinning one tool of many
  stays legal, see SPEC-R2).

## 2 · Definitions

- **Service** — one allowlisted MCP server: one `McpServersConfig.servers` key (`server-id`,
  charset `SERVER_ID_PATTERN`, colon-free by grammar) plus its roster entry.
- **Manifest id** — `mcp:<server-id>:<tool-name>`, the registry key and enablement wire vocabulary
  (SPEC-R25's three-fact law: id ≠ `tool.name` ≠ `label`).
- **Service reference** — `mcp:<server-id>:*` (new, this SPEC): "every tool this service currently
  has registered." Never itself a registry key; it exists only on the enablement wire and in agent
  stores.
- **Per-agent store** — the persona's own `SettingsStore` instance (`site/pages/agent-admin-app.ts`
  swaps stores on persona switch); "per-agent" throughout means "in that store," nothing global.
- **Entry layer** — the ADR-0132 ordered-entry-list system (`entries:${kind}` store keys,
  `entry-data.ts`), one of the two layers GH #781's shipped Agent Schema page
  (`site/pages/agent-schema.ts`) documents as "what `ui-agent-admin` reads and writes."

## 3 · The design in one paragraph (and the rejected shapes)

Per-agent MCP configuration is **rows of the existing `tool` kind** in the agent's own store — a
service reference (`mcp:<server-id>:*`) or an exact manifest id per row — added from a new
live-derived "MCP services" library pack, master-gated by the existing `toolsEnabled` switch,
forwarded by the existing `#enabledToolIds` projection, and **expanded server-side** inside
`resolveIntegrations` against the registry the boot pass already built. Discovery, boot, transport,
and key handling do not change; the browser and the `@agent-ui/app` package learn nothing about MCP.

Rejected shapes, and why:

| Shape | Why not |
|---|---|
| New `agentConfigSchema()` field (a flat `SettingsSchema` section) | The selection is an open-ended, per-item-toggleable *list keyed to an external registry* — exactly what the entry layer exists for (ADR-0132 cl.1) and what a flat field shape cannot carry; vision rev.5 already moved even the tools *master* out of the flat schema. |
| New `ENTRY_KINDS` member (`mcp-service`) | A new kind mints a new master key (`kindEnabledKey`), a new section, and — decisively — a second enablement wire: `#enabledToolIds` reads only the `tool` kind, so a parallel kind needs a parallel projection that can drift from it (the two-answers defect the shared projection was built to prevent). MCP tools *are* tools; the kind taxonomy gains nothing by forking them. |
| Per-tool entries only (service = "add all its tools") | Fails tool-churn stability and the wire cap (§1); "enable a service" decays into N rows the admin must hand-maintain against a registry that changes under them. |
| Client-side expansion (the site runner expands service refs using fetched trios) | Two sources of truth — the trio snapshot can be stale against the proxy's registry; the registry-side intersection point (`resolveIntegrations`) already exists and is fail-closed. |

## 4 · Requirements

**SPEC-R1 — Home ruling: the entry layer, no new schema surface, no new store keys.** Per-agent MCP
configuration MUST live as ordinary `tool`-kind entries in the agent's own store — under the
existing `entriesStoreKey(ENTRY_KINDS.tool)` (`entries:tool`) key, master-gated by the existing
`kindEnabledKey(ENTRY_KINDS.tool)` → `toolsEnabled` flag (`isEnabledFlag` semantics unchanged).
`agentConfigSchema()` MUST gain no field; `ENTRY_KINDS` MUST gain no member; no new per-agent store
key of any kind. This is the GH #781 scope answer applied: "Agent Schema system" covers both the
flat config surface AND the entry layer, and this feature belongs to the second.
*(→ GH #783, GH #781; ADR-0131, ADR-0132 cl.1)*
- **AC1** *Given* the built feature's diffs, *when* reviewed, *then* `agentConfigSchema()`'s
  returned shape and the `ENTRY_KINDS` object are byte-identical to HEAD, and no store key beyond
  the shipped `entries:tool`/`toolsEnabled` pair carries MCP state — checkable as a diff read plus
  the shipped `agent-schema.test.ts` structural claims staying green (`npm run check && npm test`,
  exit codes).
- **AC2** *Given* an agent whose store holds MCP rows, *when* `toolsEnabled` is stored `false`,
  *then* `#enabledToolIds` returns `[]` and no MCP item rides either live arm's wire — the existing
  master-switch test pattern extended with one MCP-id case.

**SPEC-R2 — The service reference joins the enablement wire vocabulary (ADR-0185, proposed).** The
wire stays `integrations: string[]`, browser→host, but its vocabulary widens: alongside exact
registry ids, a member MUST be honored as a service reference **iff** it is `mcp:` + one
`SERVER_ID_PATTERN`-conforming segment (`servers-config.ts` — colon-free by that charset) + `:*`,
anchored whole-string. ANY other member is an exact id — including `mcp:calc:add:*`, whose middle
segment fails the server-id charset: a real tool literally named `add:*` on server `calc` mints
exactly that manifest id and stays individually enablable, never mis-parsed as a ref for a server
(`calc:add`) the grammar cannot even name. The three-fact law extends to the store layer unchanged:
an entry's `id` is the wire key
(an exact manifest id or a service ref, supplied as the pack's explicit `NewEntryInput.id`, never
slugged); its `label` is display text, freely editable, never on the wire; `tool.name` never
reaches the browser or the store at all (the trios/services GET carries none). Both grains are
legal simultaneously and MAY coexist in one list (dedup is SPEC-R3's job). To keep the grammar
unambiguous, discovery MUST skip a discovered tool literally named `*` as one more per-tool
skip-with-reason row (the SPEC-R26 taxonomy) — the ONE discovery-side change this SPEC makes, and
under the anchored parse also the SUFFICIENT one: the only manifest id that can match the ref
grammar is one a tool named exactly `*` would mint, so the anchor and the skip are jointly complete.
*(→ ADR-0185; ADR-0168 cl.2, SPEC-R25 §3 of [a2ui-live-agent.spec.md](./a2ui-live-agent.spec.md);
GH #402)*
- **AC1** *Given* the reference-grammar unit tests, *when* fed `mcp:calc:*`, `mcp:calc:add`,
  `weather`, `mcp:calc:add:*`, `mcp:*`, `mcp::*`, and `*`, *then* exactly the first parses as a
  service ref, the next THREE as plain ids (`mcp:calc:add:*` the discriminating case — an exact
  id, never a ref), and the rest as plain ids that resolve to nothing (fail-closed) —
  deterministic, no network.
- **AC2** *Given* a fake discovery pass whose server exposes a tool named `*`, *then* that one tool
  is skipped with a stated reason and the server's other tools register — the SPEC-R26 report
  shape, unchanged.

**SPEC-R3 — Server-side expansion inside `resolveIntegrations`, everything else frozen.** The
resolution seam MUST expand each service reference to every registered manifest whose `id` starts
with `mcp:<server-id>:`, union that with exact-id matches, and dedup to a set — then apply the
existing pipeline unchanged: `isProvisioned` still excludes unprovisioned `serverKey` manifests
(ADR-0168 cl.4), unknown ids/refs still drop silently, a malformed list still resolves to `[]`
(tools off, never a throw). The pre-expansion wanted-list cap (`MAX_ENABLED`) stays; the
POST-expansion manifest set MUST also be bounded by a stated, deterministic ceiling (registration
order, truncation logged — exact constant is the LLD's; the posture is the registry TRUST-NOTE's).
Because `resolveIntegrations` is shared, both dev-proxy POST routes (produce + `/chat`, ADR-0168
cl.5) and the production Worker inherit expansion with zero further edits — and the Worker, which
registers no MCP manifests (ADR-0177's deferred rollout), resolves every service ref to nothing,
fail-closed by construction. Discovery/boot stay byte-untouched: `mcp-boot`'s ready gate,
once-per-lifetime discovery, the allowlist fence, `client.ts`, `servers-config.ts`, and
`map-tool.ts` carry zero changes (SPEC-R2's `*`-name skip lands in `discover.ts`'s existing
per-tool guard, the one exception). This feature is purely consumption-side — GH #783's own
additive expectation, confirmed.
*(→ ADR-0177 cl.4; ADR-0168 cl.2/cl.4/cl.5; SPEC-R22/R26/R27 of [a2ui-live-agent.spec.md](./a2ui-live-agent.spec.md))*
- **AC1** *Given* a registry holding `mcp:calc:add`, `mcp:calc:multiply`, `mcp:notes:search`
  (fakes, injected-sink registration), *when* resolving `['mcp:calc:*', 'mcp:notes:search',
  'mcp:calc:add', 'mcp:ghost:*', 'nonsense']`, *then* exactly the three real manifests return,
  each once — expansion, union, dedup, and fail-closed drops in one case.
- **AC2** *Given* a `serverKey` server whose env var is unset, *when* its service ref resolves,
  *then* its manifests are excluded and the rest of the list is unaffected — the ADR-0168 cl.4
  filter proven THROUGH expansion.
- **AC3** *Given* the arc's diffs, *then* `client.ts`, `servers-config.ts`, `map-tool.ts`,
  `mcp-boot`'s ready-gate wiring, and `src/agent/` show empty diffs — the FENCE is stated here and
  self-contained: this arc is consumption-side only, so those five modules are named as untouched and
  the proof is their diffs being EMPTY, not a suite that merely stays green (a transcribed
  "SPEC-R22 AC1 fence pattern" citation stood here through v0.2; the referent — SPEC-R22 of
  [a2ui-live-agent.spec.md](./a2ui-live-agent.spec.md) — is plan-failure/abandon semantics and carries no
  such fence, GH #850's own doc-check caught it) — and the shipped SPEC-R16–R19/R23–R28 suites pass
  unmodified — `npm test` green by exit code.

**SPEC-R4 — Admin surfacing: an additive `services` array on the host GET.** *(Widened by
[ADR-0189](../adr/0189-tool-description-standard-and-tools-panel-visibility.md) cl.3, ratified
2026-08-14, GH #877 — the `tools` member below; the row's `description` field predates this
widening and is UNCHANGED.)* The dev proxy's `GET /integrations` body MUST gain a second, additive
array — `services` — carrying one row per allowlisted server with ≥1 registered manifest:
`{ id: 'mcp:<server-id>:*', label: <roster label>, description: <derived from the registry — at
minimum the tool count; exact copy is the LLD's>, tools: Array<{ id: string; label: string;
description: string }> }`. `tools` carries one REAL per-tool trio per registered
`mcp:<server-id>:`-prefixed manifest, in that manifest set's own filter order — the SAME
`{id, label, description}` shape `projectIntegrationTrios` already computes for `integrations`,
sourced from the SAME registered `IntegrationManifest.description` `mapMcpTool` already computes
(zero new capture, a wire change only), so an MCP service's Tools-panel entry can show its member
tools' real text instead of the aggregate `description` count alone. The existing `integrations`
trios array stays byte-identical (SPEC-R28's parity test untouched), so every reader written before
this SPEC parses the body unchanged. The cl.2 boundary is inherited verbatim, extended to `tools`:
no endpoint URL, no `envKey` name, no key value, no JSON-RPC fact in the body, at either grain. The
GET reflects the boot-time registry (SPEC-R27's accepted staleness — no refresh mechanism); the
route remains dev-only with `worker/` frozen (the same stated temporary asymmetry ADR-0177 already
accepts — verified at the ADR-0189 build: `worker/index.ts` carries zero MCP bytes, DEV wire only).
*(→ SPEC-R28 of [a2ui-live-agent.spec.md](./a2ui-live-agent.spec.md); ADR-0177 cl.2/cl.4; ADR-0189 cl.3)*
- **AC1** *Given* the GET route test with fake-discovered manifests across two servers, *then*
  `services` carries exactly two rows with the grammar above (each row's `tools` array holding that
  server's real per-tool trios, in manifest-filter order), `integrations` is byte-identical to
  its pre-SPEC projection, and the whole body contains no URL, `envKey`, key value, or JSON-RPC
  fact at either grain — deterministic route test, no external network.
- **AC2** *Given* an empty roster, *then* `services` is `[]` and the body is otherwise identical to
  today's — the SPEC-R27 zero-cost-no-op law extended to this array.

**SPEC-R5 — The page pack: "MCP services", live-derived, `tool` kind, collision-rejecting.**
`site/pages/agent-admin-libraries.ts` MUST offer a second pack under `ENTRY_KINDS.tool`, populated
exclusively from the GET's `services` rows via the `setLiveIntegrations` seam's pattern (a sibling
setter or a widened one — LLD's choice): each pack entry carries the service ref as its explicit
`NewEntryInput.id`, the server label as `label`, ~~empty `content` (the external-registry posture
the catalog and live-integration packs already take)~~.
**RETIRED by [ADR-0189](../adr/0189-tool-description-standard-and-tools-panel-visibility.md) cl.5
(ratified + built 2026-08-14, GH #877):** `content` MUST instead be the joined REAL per-tool
descriptions from SPEC-R4's widened `tools` array, rendered as prose (the box is
`<ui-code-editor language="markdown">`, markdown-only — ADR-0139 — never a JSON dump of `tools`).
The original "empty content" ruling held only while the wire carried no real per-tool description
for a service row (only the synthetic boot-count aggregate) — a stated, bounded gap ADR-0189 names
and closes, not a reversal of this clause's collision/genericness/absence rules below, which stand
unchanged. A service row is guaranteed ≥1 member tool by construction (SPEC-R4's own "a server with
zero discovered tools contributes no row"), so `content` is non-empty for every entry this pack
ever offers.
The pack is GENERIC (absent from
`FLAVORED_PACK_CATEGORY` — services have no persona affinity), and ABSENT entirely when the GET
degrades (`fetchLiveIntegrations`-style `undefined`: production, network fault, malformed body) —
never a stale or hand-authored fallback, because unlike `INTEGRATION_TOOLS` no static service
roster exists to fall back to; stored service entries in an agent's store stay visible and simply
resolve to nothing downstream. Adding a service entry MUST reject on id collision via
`validateNewEntry`'s GH #564 option (`ValidateNewEntryOptions.rejectOnCollision`,
`entry-data.ts` — the foreign-key law: a service ref keys the registry's namespace, so a collision
is a duplicate, never a name clash to suffix around) — a dedup-suffixed `mcp:calc:*-2` row would
be a phantom that looks enabled and is wire-inert. Today that flag rides a kind-level `isCatalog`
split inside `agent-admin.ts` which a `tool`-kind pack cannot reach; the vehicle is SPEC-R6's one
permitted widening — the pack itself carries the flag, and the picker-disable affordance rides the
same signal (the GH #564 pairing: never clickable-but-silently-rejected). Custom authoring is NOT
suppressed for this pack (see §8 — the ADR-0170 cl.8 question, answered).
*(→ GH #47/#48/#143/#564; ADR-0170 cl.7 — the live-derived-pack precedent; ADR-0132 cl.1 —
capability surfaces grow by data; ADR-0189 cl.3/cl.5)*
- **AC1** *Given* the page tests with a fake `services` payload set, *then* the pack lists one
  addable entry per service whose committed store row carries the service ref as `id` and whose
  `content` is the joined real per-tool description prose (ADR-0189 cl.5); *given* the
  payload reset to `undefined`, *then* the pack is absent from `librariesForCategory`'s output for
  every category — both directions, deterministic.
- **AC2** *Given* an agent that already holds a service entry, *when* the same service is added
  again from the pack, *then* the add is rejected visibly (`Already in the list.`) and the store
  is unchanged — no suffixed phantom row.

**SPEC-R6 — The component fence: `@agent-ui/app` learns nothing about MCP.** The feature MUST
require zero MCP-aware code in `packages/agent-ui/app`: `#enabledToolIds` forwards enabled entry
ids raw exactly as shipped (service refs ride it as opaque strings), and no `mcp`-named
identifier, id-grammar parse, or registry knowledge enters the package. ONE generic widening is
permitted, and is the ONLY app-package diff this feature may carry: `EntryLibraryPack` gains an
optional per-pack `rejectOnCollision?: boolean` (default absent ⇒ today's suffix behavior,
byte-identical for every existing pack), honored by the pack-add path and the picker-disable
affordance — ordinary GH #564 foreign-key vocabulary with zero MCP semantics, needed because the
shipped flag rides `agent-admin.ts`'s kind-level `isCatalog` split, unreachable for a `tool`-kind
pack (SPEC-R5's collision requirement is unsatisfiable without it). The same widening is,
incidentally, the fix vehicle for the pre-existing Integrations-pack phantom-dedup defect (§9.3 —
not built here). Anything beyond that one option — any genuine need for MCP awareness in `app/` —
is a blocked-handback moment for the LLD, not a quiet widening (the ADR-0137 layering rationale:
the component knows entry ids, never the registry).
*(→ ADR-0137; ADR-0168 cl.2; GH #49's "the component knows entry labels, never the registry" law,
as amended by GH #402 to ids; GH #564)*
- **AC1** *Given* the arc's diffs over `packages/agent-ui/app/src`, *then* the only changed lines
  implement the per-pack `rejectOnCollision` option, and no `mcp`-named identifier or id-grammar
  parse appears anywhere in the package — checkable per PR as a diff read plus
  `grep -ri mcp packages/agent-ui/app/src` returning no matches (true at HEAD; judged by exit
  code, the standing law).
- **AC2** *Given* the widened `EntryLibraryPack` type, *when* every pre-existing pack (no flag
  set) exercises its add path, *then* behavior is byte-identical to HEAD — the GH #564
  additive-options law re-proven at the pack layer.

**SPEC-R7 — Turn-time semantics and the degrade ladder.** Enablement MUST keep the live-apply law:
a FRESH store read per turn through the one shared projection (`#enabledToolIds`), both arms. A
service reference resolves against the registry **as it stands that turn**, which fixes the churn
semantics precisely: a tool the server adds (visible after the next proxy boot) joins the agent's
kit with zero store edits; a removed/renamed tool leaves it the same way; an exact pinned id tracks
only itself. The full degrade ladder, every rung silent-but-visible-in-its-own-record and never a
thrown turn: master off or entry disabled ⇒ no wire item (SPEC-R1 AC2) · unknown/roster-removed
service ⇒ ref resolves to `[]`, turn proceeds without those tools · unprovisioned key ⇒ manifests
excluded, never offered (ADR-0168 cl.4) · production Worker ⇒ every MCP item inert (SPEC-R3) · a
tool call that fails upstream ⇒ the existing `is_error` tool_result path (SPEC-R25's
degrade-the-answer-never-the-turn contract, unchanged).
*(→ ADR-0168 cl.4/cl.5; SPEC-R25/R27 of [a2ui-live-agent.spec.md](./a2ui-live-agent.spec.md))*
- **AC1** *Given* an integration test over the dev proxy with fake-discovered manifests, *when* an
  agent's store enables one service ref and one exact id, *then* the tool defs offered to the
  provider adapter are exactly the expanded set's `tool.name`s; *when* the fake registry is
  re-seeded with one more tool under the referenced service, *then* the next turn offers it with
  the store byte-identical — the churn claim proven, not narrated.
- **AC2** *Given* each ladder rung above staged in tests, *then* every rung yields a completed turn
  with the predicted tool set (possibly empty) and no thrown error — `npm test` green by exit code.

## 5 · Non-functional requirements

| ID | Requirement | Target |
|---|---|---|
| **SPEC-N1** | Shell law preserved (ADR-0137/ADR-0177 cl.2) | Every key, endpoint, transport, and JSON-RPC byte stays inside `tools/agent/` (dev proxy + Worker shell); `src/agent/` and `packages/agent-ui/app` carry zero MCP bytes; the GET body carries admin-display facts only (SPEC-R4). The per-agent SCHEMA side lives entirely in the browser store + site-page glue — the boundary for this feature falls between `site/pages/agent-admin-libraries.ts` (glue, may know the trio/service vocabulary) and `packages/agent-ui/app` (generic, may not). |
| **SPEC-N2** | Stale-context repair rides the build | The change that lands this feature repairs its records in the same change — never a follow-up ticket: the Agent Schema page (`site/pages/agent-schema.ts`) gains its pointer to the MCP-services grain of the tool kind · `admin-library-kinds` (the skill) gains the pack row · [a2ui-live-agent.spec.md](./a2ui-live-agent.spec.md) takes a version-bump amendment in its own append-only discipline (SPEC-R23 and SPEC-R28's *"the enablement wire stays `integrations: string[]` of registry `id`s"* sentences are falsified by this build; each gains its ADR-0185 delta) · `integration-standards/SKILL.md`'s Admin-surfacing law (*"the enablement wire itself stays `integrations: string[]` of ids, unchanged"*, `SKILL.md:132-133`) repoints to the widened grammar. |
| **SPEC-N3** | Determinism of every gate | All ACs above run on injected fakes (the SPEC-R24 AC1 posture) — no real MCP server, no network, no key value in any fixture; `npm run check && npm test` judged by exit codes. |

## 6 · Typed contracts

```ts
// The service reference grammar (SPEC-R2, ADR-0185) — wire + store vocabulary, never a registry key.
// NORMATIVE parse: `mcp:` + one SERVER_ID_PATTERN-conforming segment (servers-config.ts, colon-free)
// + `:*`, anchored whole-string. The TS template type below is WIDER than the grammar (types cannot
// carry the charset); the anchored parse, not the type, decides ref-vs-exact-id — `mcp:calc:add:*`
// satisfies the type yet parses as an exact id.
type ServiceRef = `mcp:${string}:*`

// The enablement wire, browser→host — SHAPE UNCHANGED (still string[]); vocabulary widened.
// Members: exact IntegrationManifest ids (hand-authored or mcp:<sid>:<tool>) and/or ServiceRefs.
type EnablementWire = string[]

// resolveIntegrations — SIGNATURE UNCHANGED (SPEC-R3). New behavior: service-ref expansion by
// registry-id prefix, union with exact matches, dedup, then the shipped provisioned-filter + caps.
// function resolveIntegrations(ids: unknown, env: Record<string, string | undefined>): IntegrationManifest[]

// GET /integrations — the body, additively widened (SPEC-R4). `integrations` byte-identical.
interface IntegrationsGetBody {
  integrations: Array<{ id: string; label: string; description: string }> // SPEC-R28, untouched
  services: Array<{
    id: ServiceRef
    label: string
    description: string // the boot-count aggregate — unchanged by the ADR-0189 widening below
    tools: Array<{ id: string; label: string; description: string }> // ADR-0189 cl.3 — real per-tool descriptions, zero new capture
  }>
}

// The stored per-agent fact (SPEC-R1) — an ORDINARY Entry row; shown for shape, nothing new minted.
// store key: entriesStoreKey('tool') === 'entries:tool'; master: 'toolsEnabled' (kindEnabledKey('tool')).
// { id: 'mcp:calc:*',            // ServiceRef — or an exact manifest id for a pinned single tool
//   kind: 'tool', label: 'Calc server', description: '…', content: '',
//   order: n, enabled: true, builtin: false }
```

## 7 · Worked example (normative illustration for SPEC-R7)

Roster (`mcp-servers.json` — illustrative; the committed file still ships empty, see §9):

```json
{ "servers": {
    "calc":  { "label": "Calc server",  "endpoint": "https://calc.example/mcp",  "auth": "none" },
    "notes": { "label": "Notes server", "endpoint": "https://notes.example/mcp", "auth": "serverKey", "envKey": "NOTES_MCP_API_KEY" }
} }
```

1. **Boot.** Discovery registers `mcp:calc:add`, `mcp:calc:multiply`, `mcp:notes:search_notes`,
   `mcp:notes:create_note` — four ordinary manifests (SPEC-R25's three facts each). Nothing
   per-agent exists at this layer; the registry is global and boot-scoped, unchanged.
2. **The GET.** `integrations` lists all four trios (as today); `services` (new) lists
   `{ id: 'mcp:calc:*', label: 'Calc server', … }` and `{ id: 'mcp:notes:*', label: 'Notes server', … }`
   (ADR-0189 cl.3 — each row's `…` also carries `tools: [{id:'mcp:calc:add', …}, {id:'mcp:calc:multiply', …}]`
   / `tools: [{id:'mcp:notes:search_notes', …}]` respectively — the real per-tool trios).
3. **The admin.** Agent "Research Aide" adds the **Calc server** service from the MCP-services pack,
   and pins exactly one Notes tool (`mcp:notes:search_notes`) from the existing Integrations pack.
   Its store now holds, under `entries:tool`, two rows whose `id`s are `mcp:calc:*` and
   `mcp:notes:search_notes`, both enabled; `toolsEnabled` is on. No other key changed.
4. **A turn.** `#enabledToolIds` → `integrations: ['mcp:calc:*', 'mcp:notes:search_notes']` → the
   POST body → `resolveIntegrations` expands the ref (`add`, `multiply`), unions the exact id,
   passes the provisioned-filter (`NOTES_MCP_API_KEY` is set) → three manifests → the adapter
   offers wire tools `add`, `multiply`, `search_notes`. The key is resolved host-side per dispatch
   (`ExecuteContext.apiKey`), exactly as shipped.
5. **Churn.** The calc server adds a `divide` tool; after the next proxy boot the same turn offers
   four tools — the agent's store is byte-identical. The pinned notes row, by contrast, would never
   widen: pinning is the admin's explicit choice of the narrow grain.
6. **Degrades.** Unset `NOTES_MCP_API_KEY` ⇒ `search_notes` silently not offered, turn completes.
   Remove `calc` from the roster ⇒ `mcp:calc:*` resolves to `[]`, turn completes. Production
   Worker ⇒ both rows inert, turn completes.

## 8 · Non-goals

- **No transport/client change** — `client.ts` and the pinned Streamable-HTTP contract (SPEC-R24)
  untouched.
- **No discovery/boot redesign** — once-per-lifetime, allowlist-fenced, ready-gated, exactly as
  SPEC-R27 ships it; no refresh endpoint (the accepted staleness inherited, per-turn resolution in
  SPEC-R7 notwithstanding — resolution reads the boot-built registry, it never re-dials).
- **No roster-editing UI** — `mcp-servers.json` stays hand-committed; which real server first
  enters it stays Kim's call (ADR-0177 Non-goals, unchanged).
- **No per-tool parameter authoring** — ADR-0132 Fork 3's generic-entry deferral stands; MCP
  entries carry empty `content` like every external-registry pack row.
- **No Worker/production rollout** — `worker/` stays frozen; service refs are inert there by
  construction (SPEC-R3).
- **No subtraction grammar** (`mcp:<sid>:*` minus named tools) — v1 covers narrowing via exact-id
  pinning; a real exclude need re-opens this SPEC.
- **No authoring suppression for the tool kind** — ADR-0170 cl.8's `customAdd`/`contentField`
  suppression (the clause's ACTUAL content — it carries no collision law) does not extend here:
  that suppression was possible because the catalog KIND is exclusively external-registry-keyed,
  whereas the tool kind legitimately carries hand-authored entries (an exact manifest id typed by
  hand stays legal, SPEC-R2), and the MCP-services pack is one library among the kind's several —
  it owns no kind-level affordance. A per-pack authoring knob, if ever genuinely needed, re-opens
  SPEC-R6's widening; it is not smuggled in here.
- **No new ENTRY kind, no new store key, no `agentConfigSchema()` field** (SPEC-R1 — stated here
  too because it is the likeliest accidental widening).

## 9 · Recorded fork + open questions

1. **The wire-vocabulary widening earns an ADR — recorded, not left open** (v0.2; v0.1 under-called
   this). The "wire stays registry `id`s" fence is pinned in FOUR accepted places beyond SPEC-R28:
   ADR-0168 cl.2 (`0168:60-62`), ADR-0177 cl.2 (`0177:149-151`), ADR-0177 cl.4 (`0177:251-253`),
   and a2ui-live-agent.spec.md SPEC-R23 (`:1267`) — with SPEC-R28 (`:1401`) the fifth statement of
   the same sentence. A grammar member that then persists in agent stores is a real fork with
   moderate reversal cost; GH #783's ADR-default-no yields to its own exception. The fork is
   recorded in
   [ADR-0185](../adr/0185-enablement-wire-service-reference-grammar.md) (proposed — authored
   alongside this SPEC, never after the fact; the `app-surfaces-m2.spec.md`/ADR-0129 precedent),
   pending Kim's ratification; SPEC-R2/R3 state the recommended requirement per that ADR.
2. **Provability without a real server.** The committed roster is still empty, so GH #783's
   Acceptance clause 2 ("selection reaching the live path — gates green") is provable only through
   injected fakes (SPEC-N3) until a first real server lands — a Kim ruling this SPEC cannot make
   (ADR-0177 Non-goals). The clause is satisfiable as written via the SPEC-R7 integration tests;
   whether a live-server demonstration is ALSO wanted is an open scope question on the issue.
3. **The per-tool Integrations pack's collision behavior** predates this SPEC (suffix-dedup mints
   wire-inert `weather-2` rows — the same phantom class SPEC-R5 closes for services). Out of scope
   here — but SPEC-R6's per-pack `rejectOnCollision` widening is exactly the fix vehicle (one flag
   on the shipped Integrations pack); worth its own small filing if judged worth fixing.
