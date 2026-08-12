# LLD — per-agent MCP services (service-ref grammar · server-side expansion · services GET · the MCP-services pack · the one generic app widening)

> Refines: [`../spec/mcp-agent-config.spec.md`](../spec/mcp-agent-config.spec.md) v0.2
> (SPEC-R1–R7 / SPEC-N1–N3 — the merged contract, PR #786) under
> [ADR-0185](../adr/0185-enablement-wire-service-reference-grammar.md) (**ACCEPTED** 2026-08-12 —
> the wire-grammar widening is RATIFIED; no fork in this doc waits on Kim). Build plan:
> [`../decompositions/mcp-agent-config.decomp.md`](../decompositions/mcp-agent-config.decomp.md)
> (GH [#783](https://github.com/kimgranlund/agent-ui/issues/783); repairs tracker GH
> [#787](https://github.com/kimgranlund/agent-ui/issues/787)).
> · proposed · 2026-08-12 · planner (design seat) · Layer: LLD (implementation plan)
>
> **Composes on** (read, not rebuilt): `resolveIntegrations`/`MAX_ENABLED`/`isProvisioned`
> (`tools/agent/integrations/registry.ts` — THE expansion seam, deliberately absent from this
> arc's frozen list) · the shipped `mcp/` connector (`servers-config.ts`'s `SERVER_ID_PATTERN`,
> `discover.ts`'s per-tool skip taxonomy) · the dev proxy's ready-gated `GET /integrations` +
> `projectIntegrationTrios` (`dev-proxy-plugin.ts`) · the entry layer (`entry-data.ts`'s
> `validateNewEntry`/`ValidateNewEntryOptions`/`EntryLibraryPack`, `entry-list.ts`'s
> picker-disable, `agent-admin.ts`'s `#enabledToolIds` + `#makeSection`) · the site glue
> (`site/lib/admin-live-runner.ts`'s `fetchLiveIntegrations`,
> `site/pages/agent-admin-libraries.ts`'s `setLiveIntegrations` + `librariesForCategory`).
>
> **Frozen for this whole arc** (SPEC-R3 AC3 + SPEC-R6 AC1 — any slice diffing these is out of
> contract): `mcp/client.ts` · `mcp/servers-config.ts` · `mcp/map-tool.ts` · the ready-gate
> wiring inside `dev-proxy-plugin.ts` (`mcpReady` + the `await mcpReady` handler head — the file
> itself takes S2's GET widening, the GATE lines stay byte-identical) · `src/agent/` · `worker/`
> · `agentConfigSchema()`'s returned shape + `ENTRY_KINDS` (SPEC-R1 AC1) · every `app/` line not
> implementing the ONE `rejectOnCollision` widening. `mcp/discover.ts` takes exactly ONE change
> (the `*`-name skip, LLD-C3); `mcp-boot.test.ts` stays byte-untouched — new proxy-level tests
> land in NEW sibling files (§5.4).

## 1 · Intent

Land GH #783's per-agent MCP services on the seams the repo already ships: one new grammar
member on the enablement wire (`mcp:<server-id>:*`, ADR-0185), expanded server-side inside
`resolveIntegrations`; one additive `services` array on the admin GET; one live-derived
"MCP services" pack under the existing `tool` kind; one generic per-pack collision option in
`@agent-ui/app`. No new store key, no new schema field, no new entry kind (SPEC-R1); the
browser and the `app` package learn nothing about MCP (SPEC-R6/N1). The ADR-0185 Repairs wave
(GH #787) rides the same slices that falsify each record, never a follow-up (SPEC-N2).

## 2 · Components (build slices)

| ID | Component | File(s) | Traces |
|---|---|---|---|
| LLD-C1 (S1) | The service-reference grammar module — `SERVICE_REF_PATTERN` (anchored whole-string), `parseServiceRef` (member → server-id or `null`), `serviceRef(serverId)` (the composer S2's rows reuse), `serviceRefPrefix(serverId)` (`mcp:<sid>:` — the expansion key). Charset kept in lockstep with the frozen `servers-config.ts` by a BEHAVIORAL parity test (§5.1), never an export from the frozen file | NEW `packages/agent-ui/a2ui/tools/agent/integrations/service-ref.ts` + `service-ref.test.ts` | SPEC-R2 AC1 |
| LLD-C2 (S1) | Server-side expansion — `resolveAgainst(registry, ids, env)` (the pure, injectable-registry core, NEW export) with `resolveIntegrations(ids, env)` delegating to it over the module `REGISTRY`, SIGNATURE UNCHANGED: pre-expansion `MAX_ENABLED` cap as shipped → split wanted list into exact ids + ref prefixes → ONE pass over the registry in registration order (dedup inherent) → `isProvisioned` unchanged → the NEW post-expansion `MAX_RESOLVED` ceiling (§4.2), truncation logged | `tools/agent/integrations/registry.ts` + `registry.test.ts` | SPEC-R3 AC1/AC2 |
| LLD-C3 (S1) | The `*`-name discovery skip — one new per-tool guard in `discover.ts`'s existing loop (beside `hasUsableName`): a discovered tool whose `name === '*'` is skipped with reason `` `reserved tool name "*"` `` (the SPEC-R26 row shape); the ONLY discovery-side change this arc makes | `tools/agent/integrations/mcp/discover.ts` + `discover.test.ts` | SPEC-R2 AC2 |
| LLD-C4 (S2) | The `services` array on the host GET — `projectServiceRows(cfg, manifests)` (NEW export beside `projectIntegrationTrios`, fabricated-array-testable): one row per roster server with ≥1 registered `mcp:<sid>:`-prefixed manifest, `{ id: serviceRef(sid), label: roster label, description: §3.2's copy }`, roster key order; the GET body widens to `{ integrations, services }` with `integrations` byte-identical; the plugin factory's test-only opts gain `mcpRoster?: McpServersConfig` (the `mcpDiscovery` precedent) so a route test can stage a two-server roster | `tools/agent/dev-proxy-plugin.ts` · NEW `src/live-agent/mcp-services-get.test.ts` | SPEC-R4 AC1/AC2 |
| LLD-C5 (S3) | The ONE generic `app/` widening — `EntryLibraryPack` gains `rejectOnCollision?: boolean` (`entry-data.ts`); `entry-list.ts`'s picker-disable honors kind-level OR pack-level flag, and its select handler forwards the pack's flag as `onAdd`'s NEW optional second argument (§3.3); `agent-admin.ts`'s `#makeSection` `onAdd` merges it into the existing `validateNewEntry` options (`isCatalog || ctx?.rejectOnCollision === true`) — the collision LAW stays in the one validator, never a second enforcement site | `packages/agent-ui/app/src/controls/entry-list/entry-data.ts` · `entry-list.ts` (+ tests) · `controls/agent-admin/agent-admin.ts` (+ test) | SPEC-R6 AC1/AC2 (SPEC-R5's vehicle) |
| LLD-C6 (S4) | The MCP-services pack + live plumbing — `fetchLiveServices()` (sibling of `fetchLiveIntegrations`, same degrade-to-`undefined` law, `admin-live-runner.ts`); `setLiveServices(rows \| undefined)` + a module-level `MCP_SERVICES_PACK` (`rejectOnCollision: true`, entries getter over the live rows, ref as explicit `NewEntryInput.id`, empty `content`); `ADMIN_LIBRARIES[ENTRY_KINDS.tool]` becomes a GETTER returning `[integrations]` or `[integrations, mcpServices]` (§3.4 — pack ABSENT on degrade, both `librariesForCategory` and direct readers honest); `agent-admin-app.ts` wires the fetch beside the existing `fetchLiveIntegrations` block | `site/lib/admin-live-runner.ts` (+ test) · `site/pages/agent-admin-libraries.ts` · `site/pages/agent-admin-app.ts` (+ `agent-admin-app.test.ts`) | SPEC-R5 AC1/AC2, SPEC-R1 |
| LLD-C7 (S5) | Turn-time proofs + the arc fences — a NEW proxy-level suite (own module graph, §5.4) driving both POST arms through fake-discovered manifests: expansion/churn/degrade-ladder per SPEC-R7; the MCP-id master-switch case at the SITE layer (§5.3's placement trap); the arc-level fence assertions (diff read + the `grep -ri mcp packages/agent-ui/app/src` exit-code check + the shipped suites unmodified) | NEW `src/live-agent/mcp-enablement.test.ts` · `site/pages/agent-admin-app.test.ts` | SPEC-R7 AC1/AC2 · SPEC-R1 AC1/AC2 · SPEC-R3 AC3 · SPEC-R6 AC1 |

The ADR-0185 **Repairs** (GH #787) are not components; they are edits folded into the slice
whose code falsifies each record (SPEC-N2): S1 carries the [`a2ui-live-agent.spec.md`](../spec/a2ui-live-agent.spec.md)
v0.15 amendment (SPEC-R23's and SPEC-R28's wire sentences gain the ADR-0185 delta, append-only
changelog discipline) + the `agent-ui-integration-standards` SKILL
Admin-surfacing repoint; S4 carries `site/pages/agent-schema.ts`'s MCP-services pointer and the
`agent-admin-library-kinds` skill's pack row. Closing #787 = S1 and S4 merged.

## 3 · Interfaces (exact shapes — no builder guesses)

### 3.1 `service-ref.ts` (LLD-C1)

```ts
/** The ADR-0185 grammar, anchored whole-string. The capture charset RESTATES servers-config.ts's
 *  SERVER_ID_PATTERN (frozen file, not exported) — service-ref.test.ts's behavioral parity case
 *  (§5.1) is the drift trip-wire, cited here so the copy is a PINNED restatement, not rot. */
export const SERVICE_REF_PATTERN = /^mcp:([a-z0-9][a-z0-9_-]*):\*$/

/** `mcp:<server-id>:*` → the server-id; ANY other string (incl. `mcp:calc:add:*`, `mcp:*`,
 *  `mcp::*`, `*`) → null — the caller treats null as "an exact id" (SPEC-R2's parse law). */
export function parseServiceRef(member: string): string | null

/** The composer — one home for the string shape (S2's services rows + tests reuse it). */
export function serviceRef(serverId: string): string // `mcp:${serverId}:*`

/** The expansion key: `mcp:${serverId}:` — what a registered manifest id must START with. */
export function serviceRefPrefix(serverId: string): string
```

Pure module, zero I/O, zero imports beyond types — sits in `integrations/` (not `mcp/`) because
its consumers are the resolution seam and the proxy, not the connector; the frozen `mcp/` files
never import it.

### 3.2 `registry.ts` + the GET (LLD-C2/C4)

```ts
/** NEW export — the pure core resolveIntegrations delegates to; tests feed FABRICATED manifest
 *  arrays (the projectIntegrationTrios precedent), so no test touches the module REGISTRY. */
export function resolveAgainst(
  registry: readonly IntegrationManifest[],
  ids: unknown,
  env: Record<string, string | undefined>,
): IntegrationManifest[]

// resolveIntegrations(ids, env) — SIGNATURE UNCHANGED; body becomes resolveAgainst(REGISTRY, ids, env).

/** The post-expansion ceiling (SPEC-R3): registration order, first MAX_RESOLVED survive,
 *  truncation logged via console.warn (`integration registry: resolved set truncated to 64`).
 *  64 = 4× MAX_ENABLED — comfortably above any real kit (a 30-tool server + pins), low enough
 *  to bound a hostile list × registry product (the TRUST-NOTE posture). */
const MAX_RESOLVED = 64
```

`resolveAgainst` mechanics, in order: non-array ⇒ `[]` (unchanged) · string-filter + `slice(0,
MAX_ENABLED)` (the PRE-expansion cap, unchanged) · partition members via `parseServiceRef` into
`exact: Set<string>` + `prefixes: string[]` (`serviceRefPrefix` per parsed ref) · ONE
`registry.filter(m => (exact.has(m.id) || prefixes.some(p => m.id.startsWith(p))) &&
isProvisioned(m, env))` — registration order and dedup by construction (each manifest tested
once) · `slice(0, MAX_RESOLVED)` + the truncation warn. Unknown ids AND unknown refs drop
silently; a registry with no MCP manifests (the Worker) resolves every ref to nothing —
fail-closed, zero Worker edit.

`projectServiceRows` (dev-proxy-plugin.ts, beside `projectIntegrationTrios`):

```ts
export function projectServiceRows(
  cfg: McpServersConfig,
  manifests: readonly IntegrationManifest[],
): Array<{ id: string; label: string; description: string }>
// Per roster key (committed order): count = manifests whose id starts with serviceRefPrefix(sid);
// count === 0 ⇒ no row. Row = { id: serviceRef(sid), label: cfg.servers[sid].label,
//   description: `${count} ${count === 1 ? 'tool' : 'tools'} discovered at boot` }.
// The SPEC-R4 boundary by shape: no endpoint, envKey, key value, or JSON-RPC fact CAN appear.
```

The GET branch becomes
`sendJson(res, 200, { integrations: projectIntegrationTrios(listIntegrations()), services:
projectServiceRows(mcpConfig, listIntegrations()) })` — `mcpConfig` is already in
`configureServer` scope; `integrations` stays byte-identical (SPEC-R28's parity untouched).
Factory opts widen test-only: `{ mcpDiscovery?, mcpRoster?: McpServersConfig }` — `mcpRoster`
replaces the `readFileSync` roster the same way `mcpDiscovery` replaces the pass;
`vite.config.ts` passes neither.

### 3.3 The `app/` widening (LLD-C5) — every default byte-identical

```ts
// entry-data.ts
export interface EntryLibraryPack {
  // …shipped fields unchanged…
  /** GH #564's foreign-key law at PACK grain: this pack's entries key an external registry, so a
   *  colliding id is a duplicate to REJECT, never a name clash to suffix. Absent ⇒ the shipped
   *  suffix behavior for every existing pack. Generic vocabulary — no MCP semantics. */
  rejectOnCollision?: boolean
}

// entry-list.ts — EntryListHandlers.onAdd gains an OPTIONAL second argument; the return stays the
// bare boolean ADR-0164 cl.3 pins (nothing in this arc is async, and submitAdd branches on the raw
// return — a Promise would be always-truthy, the form-reset-on-rejection defect the boolean exists
// to prevent):
onAdd(input: NewEntryInput, context?: { rejectOnCollision?: boolean }): boolean
```

Threading: `buildLibraryMenu`'s row-disable check widens from the kind-level flag to
`rejectOnCollision || pack.rejectOnCollision === true`; the select handler calls
`handlers.onAdd(entry, pack.rejectOnCollision === true ? { rejectOnCollision: true } :
undefined)`. `agent-admin.ts`'s `#makeSection` `onAdd` merges:
`validateNewEntry(existing, kind, input, { rejectOnCollision: isCatalog ||
context?.rejectOnCollision === true })`. `validateNewEntry` itself is UNTOUCHED — the collision
law keeps its one home, and the rejection copy stays `Already in the list.` (SPEC-R5 AC2's
literal). Why an optional handler argument and not a second enforcement site inside
`entry-list.ts`: duplicating the reject-vs-suffix decision in the picker's commit path would be
a second collision-law home to drift (the GH #564 review-M1 class); an optional trailing
argument leaves every existing handler implementation valid by TS structural typing and every
existing call site byte-identical — the ADR-0164 options-bag SPIRIT (additive, defaulting,
byte-identical when absent) applied to the handlers bag. Recorded as a non-decision in §6.1.

### 3.4 The site glue (LLD-C6)

```ts
// site/lib/admin-live-runner.ts — sibling of fetchLiveIntegrations, same degrade law:
// not-ok / non-array / malformed row / thrown fetch ⇒ undefined, never a partial list.
export interface LiveServiceRow { id: string; label: string; description: string }
export async function fetchLiveServices(): Promise<LiveServiceRow[] | undefined>
// GET `${PRODUCE_ENDPOINT}/integrations`, reads body.services; shape-validated the isTrio way.
// A pre-S2 proxy (body.services absent) degrades to undefined — old proxy + new page is safe.

// site/pages/agent-admin-libraries.ts
export function setLiveServices(rows: readonly LiveServiceRow[] | undefined): void
// module-level `let liveServiceEntries: NewEntryInput[] | undefined`; rows map to
// { id: row.id, label: row.label, description: row.description, content: '' } — the service
// ref rides NewEntryInput.id EXPLICIT (never slugged, the LLD-C7/GH #402 law); label is the
// roster's human text, freely editable after add; content empty (the external-registry posture).
```

The pack + its inclusion (both live-derived, both degrade to ABSENT — no static fallback
exists to fall back to, per SPEC-R5):

```ts
const MCP_SERVICES_PACK: EntryLibraryPack = {
  id: 'mcp-services',
  label: 'MCP services',
  description: 'Live-discovered MCP servers — one entry enables a whole server’s current tools.',
  rejectOnCollision: true, // LLD-C5's widening — the SPEC-R5 foreign-key law + picker-disable
  get entries(): readonly NewEntryInput[] { return liveServiceEntries ?? [] },
}

// ADMIN_LIBRARIES's tool key becomes a GETTER (computed-name getters are legal in the literal):
get [ENTRY_KINDS.tool]() {
  return liveServiceEntries === undefined ? [INTEGRATIONS_PACK] : [INTEGRATIONS_PACK, MCP_SERVICES_PACK]
}
// INTEGRATIONS_PACK = the shipped inline literal hoisted to a named const, byte-identical body.
// Getter ⇒ BOTH librariesForCategory (which iterates Object.entries) and any direct
// ADMIN_LIBRARIES reader see the pack appear/disappear; librariesForCategory itself is untouched.
// GENERIC by construction: 'mcp-services' stays absent from FLAVORED_PACK_CATEGORY.
```

`agent-admin-app.ts`: inside the existing live-overlay block (the `fetchLiveIntegrations` →
`setLiveIntegrations` → `admin.libraries = librariesForCategory(active.category)` sequence),
add the sibling calls — `const services = await overlay.fetchLiveServices();
setLiveServices(services)` — BEFORE the one `admin.libraries` reassignment, so one
identity-change re-render carries both (the reassignment law that block's comment already
cites). `undefined` passes through: production/degrade keeps the pack absent.

## 4 · Data & contracts (facts pinned)

1. **Storage: nothing new** (SPEC-R1). Per-agent MCP state = ordinary `Entry` rows under
   `entriesStoreKey(ENTRY_KINDS.tool)` (`entries:tool`), master `kindEnabledKey` →
   `toolsEnabled`. An entry's `id` is the wire key (a `ServiceRef` or an exact manifest id,
   pack-supplied, never slugged); `label` display-only, never on the wire; `tool.name` never
   reaches the browser (the three-fact law at the store layer, SPEC-R2). Stored refs on a
   degraded host resolve to `[]` — visible rows, inert wire, never an error.
2. **Caps, both ends** (SPEC-R3): `MAX_ENABLED = 16` pre-expansion (shipped, unchanged);
   `MAX_RESOLVED = 64` post-expansion (NEW, §3.2 — registration order, warn-on-truncate,
   deterministic).
3. **The boundary map** (SPEC-N1): may know the service vocabulary — `tools/agent/`
   (grammar/expansion/GET) and the site glue (`site/lib/admin-live-runner.ts`,
   `site/pages/agent-admin-*.ts`, `site/pages/agent-schema.ts`). May NOT —
   `packages/agent-ui/app/src` (opaque strings + the generic pack flag only; the grep fence,
   SPEC-R6 AC1) and `src/agent/` (zero diff). No endpoint/`envKey`/key value/JSON-RPC fact in
   the GET body or any browser-bound byte.
4. **The wire**: still `integrations: string[]`, browser→host, forwarded raw by
   `#enabledToolIds` (zero diff to that method); vocabulary per ADR-0185. Both POST arms and
   the Worker inherit expansion through the one shared `resolveIntegrations` — zero route
   edits, Worker refs inert by construction.
5. **The GET degrades to absence, never staleness**: `fetchLiveServices` → `undefined` on any
   fault ⇒ pack absent (§3.4); the GET reflects the boot-time registry (SPEC-R27's accepted
   staleness, no refresh mechanism); route dev-only, `worker/` frozen.

## 5 · Test strategy (deterministic, injected fakes, zero network — SPEC-N3)

1. **S1 grammar** (`service-ref.test.ts`): the SPEC-R2 AC1 vector set verbatim — `mcp:calc:*`
   (ref) · `mcp:calc:add` / `weather` / `mcp:calc:add:*` (exact ids, the third the
   discriminator) · `mcp:*` / `mcp::*` / `*` (exact ids resolving to nothing). PLUS the
   charset-parity trip-wire: for each probe id in a boundary set (`a`, `a-b`, `a_b`, `9x`,
   `A`, `-a`, `a:b`, `a b`, ``), `validateMcpServersConfig({servers: {[id]: validEntry}})`
   accepts IFF `parseServiceRef(serviceRef(id)) === id` — behavioral lockstep with the frozen
   `SERVER_ID_PATTERN`, no export needed; a charset edit on either side reds this test.
2. **S1 expansion** (`registry.test.ts`, via `resolveAgainst` + fabricated manifests): the
   SPEC-R3 AC1 five-member case (expansion + union + dedup + two fail-closed drops) · AC2
   (unprovisioned `serverKey` filtered THROUGH expansion, rest unaffected) · both caps + the
   truncation warn (spy) · non-array ⇒ `[]`. S1 discovery (`discover.test.ts` extension): a
   fake server exposing `*` among real tools ⇒ one skip row `reserved tool name "*"`, siblings
   registered (SPEC-R2 AC2).
3. **The placement trap — pinned here so no builder walks into it**: SPEC-R1 AC2's
   master-switch-with-an-MCP-id case CANNOT live in `packages/agent-ui/app/src` — the literal
   `mcp:calc:*` would red SPEC-R6 AC1's `grep -ri mcp packages/agent-ui/app/src` fence. It
   lives in `site/pages/agent-admin-app.test.ts` (drive `ui-agent-admin` with a store holding
   one enabled `mcp:calc:*` row + `toolsEnabled: false`, assert the posted `integrations` is
   `[]`; flip the master, assert the ref rides the wire opaquely). The app package's own tests
   keep exercising the flag with NON-mcp foreign-key ids.
4. **Proxy-level suites get NEW files, never `mcp-boot.test.ts`**: that file's own discipline is
   REGISTRY-untouched, and vitest's per-file module isolation is exactly the fence that lets a
   SIBLING file register fakes safely — `mcp-services-get.test.ts` (S2) and
   `mcp-enablement.test.ts` (S5) mount the plugin via the same fake-server harness
   (`chat-route.test.ts` precedent), inject `mcpRoster` + an `mcpDiscovery` that registers
   fabricated `mcp:*` manifests through the REAL `registerIntegration` inside their own module
   graph. The trio-parity test (`agent-admin-app.test.ts`) runs in a different file/graph —
   unaffected by construction. Churn (SPEC-R7 AC1's re-seed): registration is append-only, so
   "the server gained a tool" = register one more manifest between turns and assert the next
   turn's tool defs widen with the store byte-identical.
5. **S5 degrade ladder** (SPEC-R7 AC2): each rung staged — master off · entry disabled ·
   unknown/roster-removed ref · unprovisioned key through a ref · empty registry (the Worker
   analogue) — every rung a COMPLETED turn with the predicted (possibly empty) tool set,
   asserted on the captured provider-request tool defs, judged by exit code.
6. **Arc fences at S5**: empty `git diff` over the §Frozen list · the SPEC-R6 grep (exit code,
   true at HEAD) · `agent-schema.test.ts` + the shipped SPEC-R16–R19/R23–R28 suites pass
   unmodified. `npm run test:browser` untouched until S3/S4 (app/site files) — those slices run
   it.

## 6 · Risks & non-decisions

1. **Non-decision — `onAdd`'s optional context argument** (§3.3): genuinely additive (every
   existing implementation and call site byte-identical), reversal trivial, and the alternative
   (a second collision check inside `entry-list.ts`) mints the drift class GH #564's review
   already caught once. Not an ADR: nothing contested, nothing hard to reverse. If the
   doc-checker or a builder reads ADR-0164 cl.3's frozen-interface law as covering the handlers
   bag's INTERNALS, that is a blocked-handback moment, not a quiet reinterpretation.
2. **Non-decision — `MAX_RESOLVED = 64`**: 4× `MAX_ENABLED`, above any plausible kit, bounded
   against hostile products. A real server family outgrowing it is a one-constant edit with a
   test.
3. **Non-decision — two GETs at admin boot** (`fetchLiveIntegrations` + `fetchLiveServices`
   fetch the same route twice): dev-only, one page-load, two ~1 KB requests — a shared-body
   refactor would couple the two functions' degrade paths for no observable gain (KISS).
4. **The services `description` copy** (`N tools discovered at boot`) is deliberately
   registry-derived-only (SPEC-R4's minimum) — roster prose would be a second authored fact
   with no owner.
5. **Carried open (SPEC §9.2, on the issue — not blocking)**: clause-2 provability is
   fakes-only until a first real server enters the roster (Kim's call, ADR-0177 Non-goals);
   whether a live-server demo is ALSO wanted stays an open scope note on GH #783.
6. **Not built here (SPEC §9.3)**: the shipped Integrations pack keeps suffix-dedup (its
   phantom-row defect predates this arc); S3's widening is the fix VEHICLE only — flipping that
   pack's flag is its own small filing.

## 7 · Build sequence + slice→AC map (gates FOREGROUND, judged by exit codes)

| Order | Slice | LLD | Proves (SPEC ACs) |
|---|---|---|---|
| 1 | S1 (+ repairs #787-1/2) | C1+C2+C3 | R2 AC1/AC2 · R3 AC1/AC2 |
| 2 (∥ with 1) | S3 | C5 | R6 AC1 (slice-grain)/AC2 |
| 3 (after 1) | S2 | C4 | R4 AC1/AC2 |
| 4 (after 2+3, + repairs #787-3) | S4 | C6 | R5 AC1/AC2 · R1 (no new keys, by construction) |
| 5 (last) | S5 | C7 | R7 AC1/AC2 · R1 AC1/AC2 · R3 AC3 · R6 AC1 (arc-grain) |

Dependency edges + one-writer-per-file discipline: the decomposition (§5 there) is the
dispatch record. Reviewer of this doc: the doc-checker seat.
