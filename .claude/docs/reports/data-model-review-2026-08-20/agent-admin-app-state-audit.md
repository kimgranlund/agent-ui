# agent-admin-app state audit — the symptomatic surface

> Slice 4 of the data-model review (2026-08-20). Read-only audit of
> `site/pages/agent-admin-app.ts` (1396 lines) + `agent-admin-presets.ts`,
> `agent-admin-persona-file.ts`, `agent-admin-debug-export.ts`, `agent-admin-libraries.ts`, and
> the composed `packages/agent-ui/app/src/controls/agent-admin/*` sources (`agent-admin.ts`
> 4877 lines, `agent-admin-schema.ts`, `entries.ts`, `agent-team.ts`, `agent-team-pane.ts`,
> `persona-patch.ts`, `resource-idb-store.ts`, `skill-pack-store.ts`,
> `settings/{store,schema,settings,memory-store}.ts`), by a dedicated reader session.

**Bottom line: the "New agent 48" vs "Wrench" bug is not a wiring slip — it's the visible
symptom of two entirely separate, never-synchronized "agent name" identities, plus further
display surfaces that read one and not the other. It is a systemic class: a second live
instance of the identical defect exists (the Team pane's GM/member line has the same
staleness). The app is at least FOUR stacked generations of state-management pattern, each
added for a feature without retrofitting the ones underneath.**

## Mechanism inventory

| Mechanism | Home | Holds | Propagation | Judgment |
|---|---|---|---|---|
| `SettingsStore` contract + `createMemoryStore` | `settings/store.ts:16-42`, `settings/memory-store.ts:38-56` | Generic key/value config (flat fields + entry-list JSON blobs) | `get`/`set` sync, `subscribe(key,value)` fired on every write; `ui-settings` and `agent-admin.ts` both wire real listeners | **signal-clean** — the one genuinely reactive core |
| `agent-admin.ts` `store`/`schema`/`libraries` props + `this.effect()` | `agent-admin.ts:938-977` (effect), `:910-917` | Which store/schema/libraries object is live | Signals `effect()`, re-wires on **reference-identity change** | **signal-clean**, but see sync-point 3 |
| Per-kind entry-list sections | `entries.ts`, `agent-admin.ts:3121` `#rewireAllSections`, `:2900` `#updateEntries` | The 5 `Entry[]` lists | `store.subscribe` per kind, real per-key reactivity (+ a no-subscribe degrade branch, `:1147,:2911,:3113`) | **signal-clean** |
| `AgentConfigSnapshot`/Context:System reads of `store.get('name')` | `agent-admin.ts:3354`, `:4141` | Live name/model/temperature snapshot | Fresh every turn / every subscribe-triggered rebuild (`:4041`) | **signal-clean** — always current |
| **`Persona.label`** (roster/catalog identity) | `agent-admin-presets.ts:715-732` (interface), `:853` `IMPORTED_PERSONAS_KEY`, `:901` `ROSTER_ORDER_KEY`, `:639` `ACTIVE_PRESET_KEY` | id/label/tagline/category/seed/createdAt per roster entry | Raw `localStorage` + JSON — **not** StorageAdapter; mutated only by `renameImportedPersona` (`:986-994`), `saveImportedPersona` (`:880-883`), `saveRosterOrder` (`:920-922`) | **manual-sync, no read-path back into the store** |
| Page-module `roster`/`active`/`importedSkillPacks`/`reorderMode` | `agent-admin-app.ts:132,171,139,719` | In-memory roster snapshot + active persona + skill-pack cache | Plain `let`/`const`, `.push`/`.splice`, re-derived on demand | **manual-sync** — internally disciplined (every page-owned mutation calls `pushRoster`/`refreshRoster` after) |
| `admin.setAgentRoster(entries, activeId)` / `#pendingRoster` | `agent-admin.ts:4313-4403`, `:661` | Snapshot `AgentRosterEntry[]` the header `<ui-select>` renders wholesale | Explicit "data-in" push — doc comment `:4302`: "data-in, not a callback... RE-CALLABLE" | **write-only-no-read-path**: nothing calls `#applyAgentRoster()` in response to `store.subscribe` on `'name'` |
| Team pane `getKnownAgents()`/`nameFor()` | `agent-admin.ts:1592`, `agent-team-pane.ts:369,391,417` | GM/member display names | Reads `#pendingRoster` "AT INVOKE TIME" (own comment `agent-team-pane.ts:59-61`) — the same stale label snapshot, never `store.get('name')` | **second live instance of the identical bug class** |
| `AgentTeam` records | `agent-team.ts:17` | GM id + member roster + role/routing | `loadAgentTeams()`/`saveAgentTeam()` via `createLocalStorageAdapter`, called from `handleTeamDeclared` (`agent-admin-app.ts:528-564`) | clean for its own record; a **third** persistence style |
| Resource large-text routing | `resource-idb-store.ts` (threshold `:39`) | Large resource `content` via `idbRef` | ADR-0193 IndexedDB tier; sync cache-read + async export variant | correctly isolated; **fourth** persistence style |
| Imported skill-pack shelf | `skill-pack-store.ts:169-181` | `.skillpack.json` snapshots | IndexedDB adapter; page caches in `importedSkillPacks`, pushes into `admin.libraries` on import/remove (`:1211`, `:1294`) | **manual-sync**, same reassignment law as below |
| `admin.libraries` prop | Reassigned at `agent-admin-app.ts:159,167,341,1211,1294,1390` | Library packs for the add-from-library menu | Effect re-renders **only on reference-identity change** (comment `:144`: "Fresh object every call...") | **manual-sync-by-convention** — nothing enforces the fresh-object law |
| Instance fields on `UIAgentAdminElement` (`#history`, `#turnLog`, `#testTranscript`, `#panesShown`, …) | `agent-admin.ts` ~554-896 | Conversation/turn-log/view state | Plain class fields, imperative | **manual-sync**, internal to one component — lower blast radius |
| Registration-seam callbacks (`onAgentSelect`, `onNewAgentRequest`, `onImportRequest`, `onGenerateRequest`, `onTeamDeclared`, …) | `agent-admin.ts:4466+`, registrations `agent-admin-app.ts:265-326` | One callback per seam, last-registration-wins | Deliberate anti-CustomEvent convention (SPEC-R5, `agent-admin.ts:4293-4299`) | clean, but a **fourth distinct communication style** |
| Direct `.textContent`/DOM rebuild | roster rows `agent-admin-app.ts:878-976`, `drawerStatus:671-704`, toasts `:357-361` | Rendered roster/drawer/toast text | Wholesale `replaceChildren` per mutation, no diffing | internally consistent imperative style; a different paradigm from the FACE control it wraps |

## Sync-point map — the bug factories

1. **THE root cause.** `Persona.label` (roster identity) vs `store.get('name')` (Settings Name
   field, schema `agent-admin-schema.ts:135-164`). **Zero code path writes both.** They don't
   even seed from the same source at mint: the store gets `name: 'Untitled agent'` (schema
   default via `initialValuesFor`), while `Persona.label` gets `mintIdentity`'s collision-safe
   slug ("New agent 48") — `agent-admin-app.ts:474-482` + `agent-admin-persona-file.ts:223-251,
   323-334`. They start divergent and never converge.
2. **Second live instance.** `agent-team-pane.ts` `nameFor(id)` resolves GM/member names from
   `#pendingRoster.entries[].label` (`agent-admin.ts:1592`) — renaming via the Settings Name
   field shows the OLD name in the Team pane's "GM: …" line too.
3. **`admin.libraries` reassignment law.** Five call sites must each independently build a
   fresh object and reassign; a mutate-in-place at any future call site silently no-ops with no
   type error. Same structural shape as the roster bug: identity-gated effect fed by
   manually-disciplined push instead of a derivation.
4. **Triplicated "active agent id".** `active` (page var, `agent-admin-app.ts:171`) /
   `#pendingRoster.activeId` (component field, `agent-admin.ts:661`) / raw
   `localStorage[ACTIVE_PRESET_KEY]` (`agent-admin-presets.ts:639`, written `agent-admin-app.ts:330`)
   — three copies of one fact, in sync only because `applyPersona()` (`:328-348`) touches all
   three. No structural guarantee.
5. **Persistence-style split, dated.** `settings/memory-store.ts:7-19` documents its migration
   onto StorageAdapter (GH #959/#1077, 2026-08-16/17). `agent-admin-presets.ts`'s roster
   bookkeeping (`IMPORTED_PERSONAS_KEY`, `ACTIVE_PRESET_KEY`, `ROSTER_ORDER_KEY`,
   `modifiedAtKey`, `seedVersionKey`) was NOT touched — the single most-central state in the app
   (the roster) is the one surface still on the pre-ADR-0193 pattern, beside `agent-team.ts` and
   the two IDB stores which use the unified seam.

## Verdict — four stacked generations

- **Gen 1 (oldest — TKT-0021/LLD-C15 era):** the generic `SettingsStore` contract + signals
  `effect()` inside `agent-admin.ts`. Genuinely reactive, well-documented, internally
  consistent.
- **Gen 2 (TKT-0074, GH #47/#48/#143):** the persona/preset roster — hand-rolled `Persona[]` +
  raw localStorage keys, predating any shared persistence seam. The reported bug lives here;
  never reconciled with Gen 1's store despite both holding "what is this agent called."
- **Gen 3 (GH #845/#905/#908 — roster redesign + Edit Agents drawer):** page-owned imperative
  DOM layered on Gen 2, plus the component-side `#pendingRoster`/`setAgentRoster` push seam — a
  third place "the roster" lives, synchronized with Gen 2 only by call-site discipline.
- **Gen 4 (ADR-0193 StorageAdapter — GH #1212/#1340/#1349, + the recent GH #959/#1077
  memory-store migration):** the proper async persistence tier. Most disciplined, but arrived
  after Gen 2 and was never extended to the roster bookkeeping — the app's newest and oldest
  persistence idioms sit side by side on the same page.

The Settings Name field belongs to Gen 1 (store key, reactively read); the select-menu label
and Team-pane GM line belong to Gen 2/3 (hand-pushed snapshot). Nothing ever treated these as
"the same fact" — there is no missing subscribe call to add; there are two genuinely separate
identity models that both happen to be called "the agent's name."
