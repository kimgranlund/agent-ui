# SPEC · agent-model: the locked contract for agent-admin's agent architecture (GH #1725)

> Status: proposed · v0.1 · 2026-09-04 · Layer: SPEC (execution contract)
> Refines: [`prd/agent-admin-app.prd.md`](../prd/agent-admin-app.prd.md) (PRD-G1, G3, G4, G5; the why and what)
> under the owning ADRs [ADR-0132](../adr/0132-agent-admin-instructions-capabilities-architecture.md) (entries),
> [ADR-0135](../adr/0135-agent-harness-config-schema-and-prompt-files.md) (agent config),
> [ADR-0136](../adr/0136-agent-admin-dev-only-live-model-overlay.md) (the injected turn seam) as reversed for
> production by [ADR-0152](../adr/0152-live-agent-production-worker-proxy.md),
> [ADR-0193](../adr/0193-shared-storage-adapter-seam.md) (persistence tiers),
> [ADR-0200](../adr/0200-agent-ui-devtools-package.md) (devtools capture),
> [ADR-0203](../adr/0203-agentteam-declaration-first-record.md) / [ADR-0204](../adr/0204-team-meta-line-arm.md) (teams),
> [ADR-0208](../adr/0208-external-skill-repo-import-pack-library.md) (skill packs),
> [ADR-0227](../adr/0227-context-shared-state-grammar-and-data-adoption.md) (the roster, shelf, and teams as `DataSource`s).
> Map and vocabulary: [`references/agent-model.md`](../references/agent-model.md) (derived, never ruling; this SPEC
> is the ruling contract the reference now points at). Sibling contracts cited by reference, never restated:
> [`mcp-agent-config.spec.md`](./mcp-agent-config.spec.md) (per-agent MCP services),
> [`capability-availability-tagging.spec.md`](./capability-availability-tagging.spec.md) (availability modes, the
> `@`/`/` reach path), [`a2ui-live-agent.spec.md`](./a2ui-live-agent.spec.md) (the wire and meta-line arms),
> [`devtools-harness.spec.md`](./devtools-harness.spec.md) (the capture format),
> [`../lld/agent-authoring-flow.lld.md`](../lld/agent-authoring-flow.lld.md) (the Builder interview's apply gate),
> [`../lld/admin-three-pane-ia.lld.md`](../lld/admin-three-pane-ia.lld.md) (shell IA).
> Altitude: owns **what an agent IS and how its six layers bind**: the record shapes, the lifecycles, the
> persistence tier each fact lives in, the composition laws, the turn seam, the team wrapper, and the seams
> between layers. File layout and per-module design stay with the source modules and their LLDs.
> Every requirement names its owner (an ADR clause or `file:symbol`); where the two disagree the source wins and
> the drift is reported, never papered over (§8).
> Requirement IDs file-scoped (`SPEC-R1…`, `SPEC-N1…`). Paths under `packages/agent-ui/app/src/` unless stated.

---

## 1 · Purpose

Lock the six-layer agent contract the reference describes (Identity, Configuration, Capabilities, Composition,
Turn, Wrappers) into one testable document, so the reviewer seat grades against a spec instead of against source
plus a derived map. Everything below is already shipped; this record adds no build authorization. It states the
contract the shipped tree honors, cites the test that pins each clause, and fences what is deliberately absent.

## 2 · Definitions

- **agent** (persona, preset, import): one `AgentRecord` at three moments. A **preset** is a shipped record; an
  **import** is a user-minted one. Glossary: reference §3.
- **store**: one `SettingsStore` per agent, seeded from the record's `seed` (`controls/settings/store.ts`).
- **entry**: one capability row of any kind (`controls/entry-list/entry-data.ts:Entry`).
- **ambient**: enabled and `context`-available; **invocable**: enabled but inert until invoked (`isAmbient`).
- **library pack**: an `EntryLibraryPack` the entry list offers; **skill pack**: an imported repo snapshot
  (`SkillPackSnapshot`) that projects into a library pack.
- **Knowledge**: the `resource` entry kind as the user sees it (PRD-G5).
- **GM**: the agent an `AgentTeam` names in `gmAgentId`; an ordinary agent, marked by nothing else.
- **tier**: one of the ADR-0193 persistence tiers: the sync `SettingsStore` (localStorage-backed via
  `memory-store.ts`), the localStorage `StorageAdapter` tier, the IndexedDB `StorageAdapter` tier.

## 3 · Requirements

### 3.1 Identity

**SPEC-R1 (the roster record).** `AgentRecord` (`controls/agent-admin/agent-roster-source.ts`) is exactly
`{ id, label, tagline, category?, seed, seedVersion?, imported?, createdAt? }`. `category` is a bare string in the
package; the site narrows it (`site/pages/agent-admin-presets.ts:Persona`, §3.9). The record's discriminator is
`imported`: `imported === true` is an import, anything else is a preset. `seedVersion` is a preset-only
migration marker but is optional on a preset (`personaFromPreset` copies it only when the preset declares one),
so `seedVersion` presence never decides deletability or kind. Owner: ADR-0227 cl.4; `agent-roster-source.ts:AgentRecord`;
`site/pages/agent-admin-presets.ts:personaFromPreset`.

**SPEC-R2 (the roster as a `DataSource`).** `createAgentRosterSource({ shipped, adapter?, onRemove? })` returns an
`AgentRosterSource<P>` that IS a `DataSource<P>` with all six verbs present (`read · list · create · update · remove
· subscribe`), plus a `view` sub-source yielding `AgentRosterView = { personas, activeId }`, plus the sync twins the
same-tick boot path needs (`listSync`, `activeIdSync`, `readViewSync`, and the marker verbs). Rules:
1. `listSync()` is shipped first, imports in import order, then `applyRosterOrder(natural, order)`: ids named by the
   persisted order come first in stored order (an id no longer on the roster is skipped), everything unlisted follows
   in natural order; an empty order reproduces the natural order byte for byte.
2. Reads are fail-closed: a corrupt or foreign `importedPersonas`/`rosterOrder` record reads as empty, never a throw.
3. `create` is an upsert stamping `imported: true`, last-write-wins on a same id. `update` with a `label` runs the
   rename law (import only, non-blank, in place so the picker never reorders); any other patch on a preset throws.
   `remove` refuses a preset (throws `notFound`).
4. The active id is one owner: `activeIdSync`/`writeActiveIdSync` ride the adapter key `activePreset`; the fallback
   to the first roster entry is the consumer's rule, never the source's. The one raw `localStorage` read is the
   documented legacy migration of a pre-wave raw id, taken only under the production namespace.
5. `subscribe` and `view.subscribe` yield once per roster-record change from another tab (the adapter's `storage`
   seam); per-agent state keys never wake the roster view.
Owner: ADR-0227 cl.4 and Amendment; `agent-roster-source.ts:createAgentRosterSource`, `applyRosterOrder`.

**SPEC-R3 (the component-side projection).** `ui-agent-admin` renders the roster as `AgentRosterEntry = { id,
label, deletable? }` (`controls/agent-admin/agent-admin.ts`); `deletable` absent reads protected. The component
reaches every roster mutation through registered callbacks (`onDeleteAgentRequest`, `onGenerateRequest`,
`onTeamDeclared`) and never imports site code. Owner: LLD admin-three-pane-ia §16.3; `agent-admin.ts:AgentRosterEntry`.

### 3.2 Record lifecycle

**SPEC-R4 (persist, seed, and edit).** Each agent's store is `createMemoryStore({ initial: seed, persistKey:
'agent-admin-app.<id>' })`, cached per id (`site/pages/agent-admin-presets.ts:personaStore`). A persisted value wins
over the seed. Every real write bumps the `<id>.modifiedAt` marker through the roster source; construction alone
never does. The persisted flavour rides the localStorage `StorageAdapter` tier end to end (`memory-store.ts`,
ADR-0193 Amendment A1): no module touches `localStorage` directly. Owner: ADR-0132 cl.5, ADR-0193 cl.2 and Amendment;
`controls/settings/memory-store.ts`; `agent-admin-presets.ts:personaStore`.

**SPEC-R5 (preset seed migration).** On first construction of a preset's store in a session, if the persisted
`<id>.seedVersion` marker is lower than the preset's `seedVersion` (absent reads 1 on both sides), the persisted
state under `<id>.` is swept (`resetStateSync`) before the store hydrates, and the marker is rewritten to the
preset's value. A user's edits on an unchanged preset are never swept. The sweep-then-hydrate order relies on the
localStorage tier's same-tick writes (`agent-roster-source.ts` header). Owner: `agent-admin-presets.ts:personaStore`;
`agent-roster-source.ts:writeSeedVersionSync`, `resetStateSync`.

**SPEC-R6 (mint, duplicate, import, export).** An import mints a NEW record: `importedPersonaFrom(file, roster)` and
`duplicatePersonaFrom(source, store, taken)` uniquify only the roster identity (`id`, `label`) and carry the state
verbatim, including the `name` key; `mintBlankPersona(seed, roster, label)` seeds from the component's own shipped
default. A shipped preset is never overwritten in place. The persona file is `{ kind: 'agent-ui-persona', version: 1,
meta, state }`; `state` is filtered through the enumerated `PERSONA_STATE_KEYS` on the way out AND on the way in, so
a hand-edited file cannot smuggle an unknown key into a store. Conversation history, the Dialog Turns ring, and the
Effort dial are never persona state. On export every routed resource entry is materialized and its
`idbRef`/`contentLength` stripped (`resourceEntriesForExport`). Owner: `site/pages/agent-admin-persona-file.ts`;
`controls/agent-admin/persona-patch.ts:PERSONA_STATE_KEYS`, `readPersonaState`;
`controls/agent-admin/resource-idb-store.ts:resourceEntriesForExport`.

**SPEC-R7 (reset and delete).** Reset drops every persisted key under `<id>.` and the cached store, so the next
`personaStore` rebuilds from the pure seed; for an import the seed IS the imported state. The active-id record lives
outside every agent namespace and is never swept. Delete is import-only: it runs the reset sweep, removes the
library record, removes the id from the order record, and fires `onRemove(id)` so the composition root evicts its
store cache; the active-id fallback is the page's. A preset delete touches nothing and returns `false`. Owner:
`agent-roster-source.ts:removeImportedSync`, `resetStateSync`; `agent-admin-presets.ts:resetPersona`.

### 3.3 Configuration

**SPEC-R8 (the store seam).** `SettingsStore` is `get(key): unknown` and `set(key, value): void`, both synchronous,
with optional `subscribe(listener)` and optional `save(values)`. The component depends only on this interface.
Owner: app-surfaces-m4 LLD-C15 fork F7; `controls/settings/store.ts:SettingsStore`.

**SPEC-R9 (the turn-time snapshot).** `AgentConfigSnapshot = { name, model, temperature, toolsEnabled, systemPrompt,
skills, workflows, resources, tools }` is a fresh read of the store at turn time, never a cache: live-apply is "the
next turn reads the store again". `systemPrompt` is the composed prompt (§3.5); the four label lists carry each
kind's enabled entry labels. Owner: ADR-0132 cl.6, ADR-0136 cl.3; `controls/agent-admin/agent-admin-schema.ts:AgentConfigSnapshot`.

**SPEC-R10 (fail-closed reads).** Every stored value is read through a sanitizer with a stated default and no
migration write:
- `sanitizeModel` accepts an id on `SUPPORTED_MODELS`, else `DEFAULT_MODEL_ID` (Haiku 4.5);
  `sanitizeAuthoringModel` is the same clause with `AUTHORING_DEFAULT_MODEL_ID` (Sonnet 5) as the fallback.
- Master switches (`agentEnabled`, `kindEnabledKey(kind)` = `${kind}sEnabled`) read ON unless explicitly `false`
  (`isEnabledFlag`); the `tool` kind resolves to the pre-existing `toolsEnabled` key.
- Inverse-default keys read OFF unless explicitly `true`: `surfaceGenui`, `surfaceGenuiDogfood`, `surfacePlanner`,
  `surfaceAuthoring`, `surfaceBubbles`, `bankrollCapable`. `surfaceMarkdown` and `surfaceA2ui` follow `isEnabledFlag`.
- `sanitizeCatalog` accepts a registered base id or a registered derived id, else `agent-ui`;
  `sanitizeLocalPatterns` accepts a shipped persona-catalog id, else `undefined`; `sanitizeBankroll` accepts a
  finite non-negative number, else `undefined`.
The pure guards `initialValuesFor`, `sanitizeNumber`, `sanitizeSelect` are the single implementation hoisted to
`@agent-ui/shared` and re-exported here. Owner: ADR-0135 Piece A cl.3 and Fork 2; `agent-admin-schema.ts`.

**SPEC-R11 (the config schema).** `agentConfigSchema()` carries one section, `agent`, with fields `name` (text,
required, default `Untitled agent`) and `temperature` (slider 0..1 step 0.1, default 0.5). Model selection and the
per-model inclusion record live on the Model grid under `model` and `modelsIncluded`, not in the schema; the
`toolsEnabled` field left the schema when kind-level master switches arrived. The Agent help card's summary and facts
are projected from this schema, never restated. Owner: ADR-0131 cl.1 as amended by Kim's 2026-07-19 rev.2/rev.5
rulings; `agent-admin-schema.ts:agentConfigSchema`, `ADMIN_HELP.agent`.

### 3.4 Capabilities

**SPEC-R12 (the entry).** `Entry = { id, kind, label, description, content, order, enabled, builtin, availability?,
idbRef?, contentLength? }`. `kind` is a bare string; `ENTRY_KINDS` names the seven known constants
(`prompt-section · skill · workflow · resource · tool · pattern-source · catalog`), never a closed enum. One kind's
list lives under the store key `entries:<kind>` as one array; `readEntries` degrades a missing or corrupt value to
`[]`. A disabled entry is skipped by composition, never removed; a builtin entry can be toggled, never deleted
(enforced by the UI). Owner: ADR-0132 cl.1, Fork 2, Fork 4; ADR-0164 cl.2; `entry-data.ts:Entry`, `entriesStoreKey`,
`readEntries`; `controls/agent-admin/entries.ts:ENTRY_KINDS`.

**SPEC-R13 (admission).** `validateNewEntry(existing, kind, input, options?)`: a blank label refuses with
`A name is required.`; the id is `input.id` trimmed when supplied (never slugged), else `slugify(label)`; a colliding
id takes the `-2, -3, …` suffix unless `options.rejectOnCollision`, which refuses with `Already in the list.`; the
entry lands with `order = maxOrder + 1`, `enabled: true`, `builtin: false`, and NO `availability` member. `renameEntry`
writes `label` only and refuses a blank; `describeEntry` writes `description` only and accepts an empty value. Both
return a fresh array and never mutate their input. Owner: ADR-0132 cl.4; GH #564, #848, #917;
`entry-data.ts:validateNewEntry`, `renameEntry`, `describeEntry`.

**SPEC-R14 (availability, by reference).** `availability` is `context | invocable`; absent reads `context` at every
read site (`entryAvailability`). `isAmbient(entry)` is `enabled && context`. Semantics exist for the four
`AVAILABILITY_KINDS` (`skill · workflow · resource · tool`) only; the field is inert elsewhere. The reach path
(`@` for resources, `/` for skills, workflows, tools) and the menu projections are owned by
`capability-availability-tagging.spec.md` and are not restated here. Owner: that SPEC's R1/R3/R8;
`entry-data.ts:isAmbient`; `entries.ts:AVAILABILITY_KINDS`, `MENTIONABLE_KINDS`, `INVOCABLE_KINDS`.

**SPEC-R15 (the kinds with special selection).** `pattern-source` is a source-level pick: the first enabled entry by
`order` then `id` (`pickedPatternSource`), enabling more than one is a no-op past the first. `catalog` is derived
single-select: `readCatalogEntries(store)` always prepends the Default row (`builtin: true`, `order: -1`) when absent
and replaces every row's `enabled` with `id === sanitizeCatalog(store.get('a2uiCatalog'))`; the stored per-entry
flags are never the selection truth for this kind. The three prompt-section builtins (`foundation`, `personality`,
`critical-items`) seed every store; the six other kinds seed empty. Owner: genui-surface SPEC-R11 D3; ADR-0170 cl.1,
cl.2, cl.4; ADR-0132 cl.2; `entries.ts:pickedPatternSource`, `readCatalogEntries`, `DEFAULT_PROMPT_SECTIONS`,
`initialEntryValues`.

**SPEC-R16 (library packs).** `EntryLibraryPack = { id, label, description, entries: NewEntryInput[],
rejectOnCollision? }` is pure data for one kind. A library add commits through `validateNewEntry` into the active
agent's own `entries:<kind>` store: a library add IS a custom add with the typing done. Packs live with their
consumer (site-side); the component renders whatever it is handed through the reactive `libraries` prop. Owner:
ADR-0132 cl.1; GH #47/#48/#143; `entry-data.ts:EntryLibraryPack`.

**SPEC-R17 (skill packs).** `SkillPackSnapshot = { format: 'agent-ui-skillpack@1', pack, provenance, license }`.
`parseSkillPackSnapshot` accepts exactly the D1 shape and refuses with a named reason on: a non-object, a wrong or
absent `format`, a pack missing `id`/`label`/`description`, zero entries, a malformed entry (every entry needs a
non-empty `id` and `label`), a missing provenance, an empty `sourceUrl` or `commitSha`, or a malformed license.
`parseSkillPackText` refuses non-JSON first. An accepted snapshot persists WHOLE under `skill-packs:<packId>` in the
IndexedDB tier (database `agent-ui-skill-packs`); `saveSkillPack` on the same id overwrites the shelf record.
The shelf is app-level: `loadSkillPacks` returns every valid snapshot sorted by pack id and skips a corrupt record.
`removeSkillPack` deletes the shelf record only; entries an agent already opted into are copies and stay untouched.
`importedSkillPackLibrary` projects snapshots into skill-kind library packs with `rejectOnCollision` forced `true`.
`skillPackAttribution` renders `sourceUrl @ sha7 · imported YYYY-MM-DD · licenseFile` or `no license file found`.
The module performs no fetch and opens no socket. Owner: ADR-0208 D1, D3, D4, D7; ADR-0227 Amendment (wave 2);
`controls/agent-admin/skill-pack-store.ts`.

**SPEC-R18 (Knowledge routing).** `routeResourceContent(text)`: text at or under
`RESOURCE_IDB_TEXT_THRESHOLD_CHARS` (4,000) passes through as `{ content: text }` with no IndexedDB touch; longer text
is written under a fresh globally unique `idbRef` in the IndexedDB tier (database `agent-ui-resource-text`, object
store `kv`) and returns `{ content: RESOURCE_IDB_PLACEHOLDER, idbRef, contentLength }`. A failing IndexedDB write
fails OPEN: the real text stays inline. `entryTextLength` reports the true length with no round trip.
`materializeResourceEntry` is sync and cache-only (a not-yet-cached routed entry keeps its placeholder);
`materializeResourceEntriesAsync` awaits the tier and is the export path's function; `hydrateResourceEntries` warms
the cache fire-and-forget. Budgets are the three constants in `lib/document-budget.ts`: `MAX_RAW_FILE_BYTES`
(10 MiB), `MAX_DOCUMENT_CHARS` (50,000), `MAX_AGENT_KNOWLEDGE_CHARS` (200,000); truncation is always visible via the
`…[truncated: N of M chars]` marker, which itself counts against the budget. The threshold number is justified only
in the module header, not in an ADR (§8). Owner: ADR-0193 cl.3; ADR-0202 (the pdf extractor feeding it);
req-doc-ingestion R4/R6/R7; `resource-idb-store.ts`; `lib/document-budget.ts`.

**SPEC-R19 (MCP services, by reference).** Per-agent MCP configuration rides the `tool` kind and the
`integrations` wire per `mcp-agent-config.spec.md` (SPEC-R2 reference grammar, SPEC-R4 storage shape) and ADR-0185.
This SPEC adds nothing to that contract.

### 3.5 Composition

**SPEC-R20 (the base prompt).** `composeSystemPrompt(sections, team?)`: keep entries with `enabled` and non-blank
`content`; sort by `order` then `id`; render each as `## {label}` newline `{content.trim()}`; join with one blank
line; if nothing survives, the result is `DEFAULT_SYSTEM_PROMPT_FALLBACK` (`You are a helpful assistant.`), never an
empty instruction. When `team` is supplied and `isTeamGm(team)` holds, the team section (SPEC-R30) joins after one
blank line; an empty section joins nothing. Omitting `team` is byte-identical to the pre-team output. Owner:
ADR-0132 cl.2, cl.6; ADR-0203 cl.2; `entries.ts:composeSystemPrompt`.

**SPEC-R21 (the live prompt).** `composeLiveSystemPrompt(sections, capabilities, bankroll?, team?)` is, in order:
the base prompt; the bankroll path line plus the resume sentence when `bankroll.stored` is present (only for a
capable, A2UI-on agent, or nothing); then, iff at least one group composes, `CAPABILITY_INDEX_TEACHING` followed by
one `## {heading}` block per group. A group composes iff its master switch is on and it has at least one ambient
entry (`isAmbient`), sorted by `order` then `id`. Each entry is ONE index line: `- {label}`, then a spaced em dash
(`U+2014`) and the whitespace-collapsed description when the description is non-empty. Entry `content` appears
nowhere in the ambient prompt. With no ambient entries and no bankroll, the output is byte-identical to
`composeSystemPrompt(sections, team)` (gated equivalence). Owner: ADR-0136 Fork 3; ADR-0190 rev.2; SPEC-R14/R15 of
capability-availability-tagging; GH #525; `entries.ts:composeLiveSystemPrompt`, `CAPABILITY_INDEX_TEACHING`.

**SPEC-R22 (invocation framing).** `resolveTurnReferences(text, references, groups)` resolves each reference by
`kind` and `id` against a fresh store read, fail-closed: a reference whose kind is unmapped, whose kind's master
switch is off, whose entry is missing, or whose entry is disabled contributes nothing; duplicates resolve once. A
resolved `tool` contributes its id to `toolIds` and no prose. A resolved skill, workflow, or resource contributes a
block `### {label} ({kind})`, the description when non-empty, a blank line and the content verbatim when non-empty.
Blocks sit under one `## Referenced for this message` heading, typed text last; zero blocks returns the typed text
byte-identically. The framed text is what both arms send and what history records. Owner:
capability-availability-tagging SPEC-R4; GH #402; `entries.ts:resolveTurnReferences`.

**SPEC-R23 (Context: System).** The settings surface's `Context: System` segment (`data-segment="Context: System"`,
`agent-admin.ts`) shows the compiled agent record including the composed prompt, read-only, rebuilt on every store
change; it is the truth of what the next turn sends. `Context: Dialog` is the session-local turn log, capped at
`TURN_LOG_CAP` (20) and never persisted with the agent. Owner: GH #866; `agent-admin-schema.ts:TURN_LOG_CAP`,
`ADMIN_HELP['context-agent']`, `ADMIN_HELP['context-turn']`.

### 3.6 Turn

**SPEC-R24 (the request shapes).** `AdminTurn = { role: 'user' | 'assistant', content }`. `AdminTurnRequest =
{ text, system, model, effort?, integrations?, history }` where `system` is `composeLiveSystemPrompt`'s output,
`model` is the driving context's sanitized read (SPEC-R10), `integrations` is the enabled tool-entry labels gated
on the tool master switch, and `history` is prior completed turns only. `AdminSurfaceTurnRequest = { turn,
personaSystem, model, effort?, integrations?, catalogId?, genui?, a2uiEnabled?, authoring?, session? }` with
`session` defaulting to `'test'`; `'authoring'` selects the Builder interview's own producer session. Every
optional field absent is byte-compatible with a runner written before the field existed. Owner: ADR-0136 cl.3;
ADR-0138; ADR-0168 cl.5; ADR-0178 cl.5; `agent-admin-schema.ts:AdminTurn`, `AdminTurnRequest`, `AdminSurfaceTurnRequest`.

**SPEC-R25 (the injected runners).** `AdminAgentTurn = (req) => Promise<string>` and `AdminAgentSurfaceTurn =
(req) => AsyncIterable<AdminSurfaceTurnEvent>` are injected props, `undefined` in every default and static path;
the packaged component ships no fetch, key, env, or proxy code and binds to no transport type. The default prose
path is `runStubAgentTurn`, a deterministic reply that cites the config it read. The surface event union is
`line · note · progress · genui · patch · flowEnd · plan · ask · team · target`; the runner peels meta-line arms
gate-blind, and consumption is the component's decision alone. Owner: ADR-0136 cl.1; ADR-0131; ADR-0204 cl.4;
`agent-admin-schema.ts:AdminAgentTurn`, `AdminAgentSurfaceTurn`, `AdminSurfaceTurnEvent`, `runStubAgentTurn`.

**SPEC-R26 (the site runner and production).** `site/lib/admin-live-runner.ts` implements both runners against the
mounted proxy (`dev-proxy-plugin.ts`'s `/chat` branch in dev, the Cloudflare Worker port in production), holds no
key, and matches `AdminTurn` structurally. The runner is probed at runtime in every environment (ADR-0152 reverses
ADR-0136 Fork 1's dev-only ruling for the deployed docs site). Owner: ADR-0152; ADR-0073 (the trust boundary);
`site/lib/admin-live-runner.ts`.

**SPEC-R27 (devtools capture).** The agent-admin debug bundle carries an additive optional `captures/<id>.json`
family written by `@agent-ui/devtools`'s `serializeCapture` and a `files.captures?: string[]` manifest field;
`DEBUG_BUNDLE_VERSION` stays 1. A capture exported from either surface replays through `replayTransport` to a
byte-identical `line` sequence. The bundle's `agent-settings` covers every roster agent as a persona file;
`test-chat` and `builder-interview` cover the active agent only. Owner: ADR-0200 cl.7; devtools-harness SPEC-R10;
`site/pages/agent-admin-debug-export.ts`; `packages/agent-ui/devtools/src/capture/format.ts`.

### 3.7 Wrappers

**SPEC-R28 (the team record).** `AgentTeam = { id, label, tagline?, gmAgentId, members: readonly AgentTeamMember[] }`
and `AgentTeamMember = { agentId, role, routingDescription, instructions? }`. A team names agents by id, composes
into the GM's prompt, and has no runtime, no dispatch, and no group conversation. Owner: ADR-0203 cl.1 and
Amendment; IDR-0001's fence; `controls/agent-admin/agent-team.ts:AgentTeam`.

**SPEC-R29 (validation and persistence).** `validateAgentTeam(team, knownAgentIds)` returns the FULL issue set,
each naming a field path: `id`, `label`, `gmAgentId`, `members[i].agentId`, `members[i].role`,
`members[i].routingDescription` must be non-empty; `gmAgentId` and every `members[i].agentId` must be in
`knownAgentIds`; `tagline` must be a string when present; `instructions` must be non-empty when present.
`saveAgentTeam` never persists an invalid team and returns the same issues. Teams persist keyed by `id` on the
localStorage `StorageAdapter` tier under the namespace `agent-ui-agent-teams` (a namespace of its own on the same
tier and seam, no new tier). `loadAgentTeams` applies a structural guard and skips a corrupt record; it does NOT
re-validate against a live roster, so a dangling member reference survives the read and is flagged by the Team pane
(`data-dangling="true"`), never silently dropped. `createAgentTeamSource()` exposes `read · list · create · remove`
plus a `view` sub-source; `create` throws `AgentTeamValidationError` carrying the issues, so nothing lands. Owner:
ADR-0203 cl.1, cl.5; ADR-0227 Amendment (wave 2); `agent-team.ts:validateAgentTeam`, `saveAgentTeam`,
`loadAgentTeams`, `createAgentTeamSource`; `controls/agent-admin/agent-team-pane.ts`.

**SPEC-R30 (the GM prompt section).** `composeTeamPromptSection(team, memberSnapshots)` is pure and byte-stable.
With zero members it returns `''`. Otherwise it renders the heading `## Your team`, the fixed intro sentence
(`TEAM_SECTION_INTRO`, the handoff-as-instruction framing), a blank line, then one row per member in declared
order: `- **{name}** ({role}): {routingDescription}`, with an indented `- Instructions: {instructions}` sub-line
when present. `name` is the member's snapshot name, or the bare `agentId` when no snapshot matches (never a thrown
error, never a dropped row). `TeamPromptContext = { team, activeAgentId, memberSnapshots }`; the section joins only
when `isTeamGm(context)`, i.e. `activeAgentId === team.gmAgentId`. Nothing reads `routingDescription` to pick a
member or dispatch a turn. Owner: ADR-0203 cl.2 and Amendment; `controls/agent-admin/agent-team-prompt.ts`.

**SPEC-R31 (the wire-side proposal).** `TeamDeclaration = { label, tagline?, members: TeamMemberSeed[] }` with
`TeamMemberSeed = { name, role, routingDescription }` rides the leading meta-line as a whole-arm-validated field: a
malformed arm drops the entire arm, never a partial roster. `produce()` passes it through gate-blind. The sole
consumer is `ui-agent-admin`'s `onTeamDeclared` callback; unregistered, a declared team is silently dropped. The
page's `handleTeamDeclared` pre-checks structure, mints one agent per seed, designates the currently active agent
as GM (the wire carries no GM field), validates the assembled `AgentTeam` through SPEC-R29, and persists through a
`mutation()`; a failure lands nothing and is notified. Owner: ADR-0204 cl.1 to cl.5;
`packages/agent-ui/a2ui/src/agent/meta-line.ts:TeamDeclaration`; `site/pages/agent-admin-app.ts:handleTeamDeclared`.

### 3.8 Workflows and persistence tiers

**SPEC-R32 (the page's state grammar).** The roster, the skill-pack shelf, and the team list are each ONE
`resource()` at the page over their `DataSource` face; every write is a `mutation()` with an atomic read-back
commit; every render surface derives from the one owner (the component's roster push is fed from a derivation, the
active id from one mutation). No page module touches `localStorage` for these facts. Owner: ADR-0227 cl.2, cl.4,
Amendment; `site/pages/agent-admin-app.ts`.

**SPEC-R33 (the authoring flow, by reference).** The Builder interview runs on the `surfaceAuthoring` gate
(SPEC-R10): a declared `personaPatch` is applied to the draft's store only through the three-filter gate
(enumerated key filter, per-key sanitizer, `validateNewEntry`), and only inside the `'authoring'` session. The
interview and the draft's test chat are two histories over one draft store; a real store reassignment resets the
conversation (GH #145). Contract owner: ADR-0178 cl.2, cl.3, cl.5; `agent-authoring-flow.lld.md`;
`controls/agent-admin/persona-patch.ts:applyPersonaPatch`. This SPEC adds nothing to it.

**SPEC-R34 (where each fact lives).** The tier per fact is fixed as follows; a new fact joins a row or records an
exception citing ADR-0227 cl.5.

| Fact | Tier | Key or namespace | Owner |
|---|---|---|---|
| Roster records: imports, order, active id, per-agent `seedVersion`/`modifiedAt` | localStorage adapter | namespace `agent-admin-app`; keys `importedPersonas`, `rosterOrder`, `activePreset`, `<id>.seedVersion`, `<id>.modifiedAt` | `agent-roster-source.ts` |
| Per-agent config and entry lists | `SettingsStore` over the localStorage adapter | namespace `agent-admin-app.<id>`; keys per `PERSONA_STATE_KEYS`, `entries:<kind>` | `memory-store.ts`, `persona-patch.ts` |
| Large resource text | IndexedDB adapter | database `agent-ui-resource-text`, store `kv`, key `idbRef` | `resource-idb-store.ts` |
| Skill-pack shelf | IndexedDB adapter | database `agent-ui-skill-packs`, keys `skill-packs:<packId>` | `skill-pack-store.ts` |
| Teams | localStorage adapter | namespace `agent-ui-agent-teams`, key `<teamId>` | `agent-team.ts` |
| Conversation history, Dialog Turns, Effort | element lifetime only | none | `agent-admin.ts` |

Owner: ADR-0193 cl.2, cl.3, Amendment A1; ADR-0208 D3; ADR-0227 cl.2.

### 3.9 Seams

**SPEC-R35 (why each duplicate shape exists).** Four seams are deliberate and stay:
1. `AdminTurn`/`AdminTurnRequest` are declared in `agent-admin-schema.ts` rather than importing a2ui's
   `Turn`/`TurnInput` because the packaged component binds to no transport type (ADR-0136's posture); a2ui's
   `Effort` union duplicates `EffortLevel` because `a2ui` may never import `app`. The remaining stale comment claiming
   a2ui's transport is not a package export is recorded in §8 item 5; this SPEC does not repeat that claim.
2. `AgentRosterEntry` (component) versus `AgentRecord` (package data) exists because the component cannot import site
   code (SPEC-R3).
3. The site's `Persona` is `Omit<AgentRecord, 'category'> & { category?: PresetCategory }`: one shape, one name, the
   alias exists only to narrow `category`.
4. `TeamDeclaration` (wire) versus `AgentTeam` (record): the wire never carries an id that does not exist yet.
Owner: reference §4; `agent-admin-schema.ts`; `site/pages/agent-admin-presets.ts:Persona`; ADR-0204 cl.1.

## 4 · Non-goals

**SPEC-N1.** Transport internals: the proxy body shape, the meta-line grammar, the `produce()` loop, and the
provider pairing belong to `a2ui-live-agent.spec.md` and ADR-0073/0137; this SPEC names the seam only.

**SPEC-N2.** Shell IA: pane set, place routing, drawers, and the entry list's rendering belong to
`admin-three-pane-ia.lld.md` and the entry-list module.

**SPEC-N3.** The A2UI catalog, persona catalogs, and derived catalog ids: owned by `a2ui-catalog.spec.md` and
`persona-catalog-composition.spec.md`; SPEC-R15 states only how the `catalog` kind reads them.

**SPEC-N4.** A runtime team orchestrator, group conversation, network A2A serving, or cross-team nesting: fenced by
ADR-0203's Non-goals and IDR-0001; a runtime is a new intent record, never a quiet build.

**SPEC-N5.** Kind-specific entry schemas (a tool's parameter list) and a model-side tool-execution loop that lets
the model load an entry itself: ADR-0132 Fork 3's deferral, unchanged.

**SPEC-N6.** Retrieval or embeddings over Knowledge: PRD-G5 rules context stuffing at v1; retrieval is an intent
escalation.

**SPEC-N7.** Any async `SettingsStore`, or an IndexedDB-backed per-agent config store: ADR-0193 cl.6 leaves the
sync seam untouched, and `memory-store.ts` is pinned to the localStorage tier.

## 5 · Examples

**E1, NORMATIVE (SPEC-R20).** Sections `[{ id: 'b', label: 'Personality', content: 'Be terse.', order: 1, enabled:
true }, { id: 'a', label: 'Foundation', content: 'You are a sommelier.', order: 0, enabled: true }, { id: 'c', label:
'Off', content: 'x', order: 2, enabled: false }]` compose to:

```
## Foundation
You are a sommelier.

## Personality
Be terse.
```

The same input with every entry disabled composes to `You are a helpful assistant.`

**E2, NORMATIVE (SPEC-R30, SPEC-R20).** Team `{ gmAgentId: 'host', members: [{ agentId: 'chef', role: 'Chef',
routingDescription: 'Menu and allergen questions.', instructions: 'Confirm the date first.' }, { agentId: 'ghost',
role: 'Valet', routingDescription: 'Parking.' }] }` with snapshots `[{ agentId: 'chef', name: 'Marco' }]` and
`activeAgentId: 'host'` appends after the base prompt:

```
## Your team
You lead the team below. When a request matches a teammate's routing rule, you may say you are consulting them, but nothing here dispatches automatically. Continue the conversation yourself, drawing on their role and routing rule as guidance for what to say and when.

- **Marco** (Chef): Menu and allergen questions.
  - Instructions: Confirm the date first.
- **ghost** (Valet): Parking.
```

The intro line above is paraphrased for this document; the byte-exact sentence is `TEAM_SECTION_INTRO` in
`agent-team-prompt.ts`, pinned by `agent-team-prompt.test.ts`. With `activeAgentId: 'chef'` the section is absent.

**E3, ILLUSTRATIVE (SPEC-R21).** A skill `{ label: 'House style', description: 'Warm,\n concise.' }` that is
enabled and in-context, under a master-on `skill` group headed `Skills available to you`, contributes exactly one
line reading `- House style`, a spaced em dash, then `Warm, concise.`. A second skill marked `invocable`
contributes no line; if it were the only enabled skill, the group heading would be absent too.

**E4, ILLUSTRATIVE (SPEC-R4 to R7).** A user opens the shipped `concierge` preset (seedVersion 7, persisted marker
6): the state under `concierge.` is swept, the marker becomes 7, the store hydrates from the seed. They edit the
temperature (a `concierge.temperature` write, `modifiedAt` bumps), export the persona file, import it (a new record
`concierge-imported` with `imported: true` and `createdAt`), then delete the import: its namespace, library record,
and order slot go; the preset is untouched.

**E5, ILLUSTRATIVE (SPEC-R17, SPEC-R13).** Importing `github-com-acme-skills.skillpack.json` twice leaves one shelf
record. Adding its `review` entry to agent A copies it into `entries:skill`; re-importing a newer snapshot leaves
A's copy byte-identical and shows the `review` row disabled in the picker because `rejectOnCollision` refuses the
duplicate id.

## 6 · Acceptance

Each criterion names the pinning test; a criterion with no existing test names the assert layer for the one to add.

- **AC-R1/R2:** `controls/agent-admin/agent-roster-source.test.ts` proves the order rule, the fail-closed reads, the
  import-only rename and remove, the legacy active-id read, and the cross-tab subscribe.
- **AC-R3:** `controls/agent-admin/agent-admin.test.ts` proves `deletable` absent hides the delete affordance.
- **AC-R4/R5/R7:** `site/pages/agent-admin-presets.test.ts` proves persisted-wins-over-seed, the seedVersion sweep,
  reset, and that the active id survives a reset.
- **AC-R6:** `site/pages/agent-admin-persona-file.test.ts` proves the round trip, the key filter both ways, and the
  stripped `idbRef` on export; `controls/agent-admin/persona-patch.test.ts` pins `PERSONA_STATE_KEYS`.
- **AC-R8:** `controls/settings/store.test.ts` grep-guards that `ui-settings` imports only the interface.
- **AC-R9/R10/R11:** `controls/agent-admin/agent-admin.test.ts` (live-apply through the stub reply) and the
  sanitizer cases in `agent-admin-schema-derived-catalog.test.ts` and `agent-admin.test.ts` prove each default.
- **AC-R12/R13:** `controls/entry-list/entry-data.test.ts` proves admission, suffix versus refuse, rename, describe.
- **AC-R14/R15:** `controls/agent-admin/entries.test.ts` proves `isAmbient`, the first-enabled pattern pick, and
  `readCatalogEntries`' derived single-select.
- **AC-R16:** `controls/agent-admin/genui-pack-library.test.ts` proves a library add commits through `validateNewEntry`.
- **AC-R17:** `controls/agent-admin/skill-pack-store.test.ts` proves every named refusal, whole-snapshot persistence,
  shelf-only removal, the forced `rejectOnCollision`, and the attribution line; `skill-pack-no-egress.test.ts` proves
  no fetch or socket.
- **AC-R18:** `controls/agent-admin/resource-idb-store.test.ts` proves the threshold, the placeholder, fail-open,
  `entryTextLength`, and the export strip; `lib/document-budget.test.ts` proves the marker counts against the budget.
- **AC-R19:** by reference, `mcp-agent-config.spec.md`'s own acceptance.
- **AC-R20/R21/R22:** `controls/agent-admin/entries.test.ts` proves E1, the fallback, gated equivalence, the index
  line grammar, content-never-ambient, and the framing block.
- **AC-R23:** `controls/agent-admin/agent-admin.test.ts` proves the `Context: System` segment rebuilds on a store
  write and the turn log caps at 20.
- **AC-R24/R25:** `controls/agent-admin/agent-admin.test.ts` proves the default path is the stub with `agentTurn`
  undefined; `packages/agent-ui/app/src/layering.test.ts` proves no transport import enters the package.
- **AC-R26:** `site/lib/admin-live-runner.test.ts` proves the request mapping and that no key string exists in the
  module.
- **AC-R27:** `site/pages/agent-admin-debug-export.test.ts` and `packages/agent-ui/devtools/src/capture/format.test.ts`
  prove the additive `captures/` family and the replay round trip.
- **AC-R28/R29:** `controls/agent-admin/agent-team.test.ts` proves the full issue set, the closed save, the corrupt
  skip, and the `AgentTeamValidationError` throw; `agent-team-pane.browser.test.ts` proves the dangling flag.
- **AC-R30:** `controls/agent-admin/agent-team-prompt.test.ts` proves E2, the empty-members `''`, the bare-id
  fallback, and `isTeamGm`.
- **AC-R31:** `packages/agent-ui/a2ui/src/live-agent/meta-line.test.ts` proves whole-arm drop; `site/pages/agent-admin-app.test.ts`
  proves the active agent becomes GM and an invalid assembly lands nothing.
- **AC-R32:** `site/pages/agent-admin-app.test.ts` proves one resource per fact and the derivation-fed push.
- **AC-R33:** by reference, `agent-authoring-flow.lld.md` §13.
- **AC-R34:** a grep gate over `site/pages/agent-admin-app.ts` and `agent-admin-presets.ts` for zero raw
  `localStorage` writes (the ADR-0227 acceptance predicate); the namespace and database names in the table are
  pinned by the owning module tests listed above.
- **AC-R35:** `packages/agent-ui/app/src/layering.test.ts` and the a2ui layering test prove the DAG edges the seams
  rest on.

## 7 · Agent verification

Every AC above asserts at the unit or jsdom layer through Vitest, run as `npm test`, judged by exit code. The two
browser-layer criteria (`agent-team-pane.browser.test.ts` for AC-R29, `agent-admin.browser.test.ts` for the
`Context: System` segment in AC-R23) run under `npm run test:browser`. No criterion needs a human. A reviewer
grading this SPEC re-runs the named suites and greps each cited `file:symbol`; a symbol that no longer resolves is a
red on this document, not on the tree.

## 8 · Drift and open items (2026-09-04, against main `8113b558`)

1. The reference's glossary says a preset is "seedVersion set, not deletable"; the source discriminator is
   `imported`, and a preset may declare no `seedVersion` (SPEC-R1). The reference is repaired by pointer only
   (its §3 cites this SPEC); the sentence itself is left for the reference's owner.
2. The reference cites ADR-0136 for the turn seam but not ADR-0152, which reversed the dev-only ruling for the
   deployed site (SPEC-R26).
3. ADR-0203 cl.1 says teams persist "on the SAME agent-admin store the persona records use"; the source uses its own
   namespace `agent-ui-agent-teams` on the same localStorage tier and seam (SPEC-R29). Same tier, different
   namespace; the ADR's "no new storage tier" holds.
4. The reference's Appendix A omits `SkillPackSource`, `AgentTeamSource`, and `AgentTeamValidationError`
   (ADR-0227 wave 2).
5. `agent-admin-schema.ts` carried two stale "deliberately NOT a package export" comments. The ALM-C2 instance was
   fixed by GH #1702 / PR #1707; this surface-turn instance (`agent-admin-schema.ts:811`) was missed by that repair
   and is resolved by GH #1727. Not repeated here.
6. `RESOURCE_IDB_TEXT_THRESHOLD_CHARS` (4,000) is justified in a module header only; an ADR clause would close it.
