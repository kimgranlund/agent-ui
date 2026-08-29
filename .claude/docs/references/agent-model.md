# Agent model: how agent-admin defines, structures, and abstracts an agent

> Conceptual reference for the agent-admin surface (`ui-agent-admin`, `@agent-ui/app`): the layers an
> agent is built from, the vocabulary the fleet uses for them, and the seams between layers with the
> reason each seam exists. **Derived**, never ruling: every fact here is owned by a source file or a
> decision record named beside it; on any conflict the source wins and this doc is repaired.
> Owning records: [ADR-0132](../adr/0132-agent-admin-instructions-capabilities-architecture.md) (entries),
> [ADR-0135](../adr/0135-agent-harness-config-schema-and-prompt-files.md) (agent config),
> [ADR-0136](../adr/0136-agent-admin-dev-only-live-model-overlay.md) (the live-turn seam),
> [ADR-0193](../adr/0193-shared-storage-adapter-seam.md) / [ADR-0202](../adr/0202-pdfjs-second-runtime-dependency-exception.md) (persistence tiers, ingestion),
> [ADR-0200](../adr/0200-agent-ui-devtools-package.md) (devtools capture),
> [ADR-0203](../adr/0203-agentteam-declaration-first-record.md) / [ADR-0204](../adr/0204-team-meta-line-arm.md) (teams),
> [ADR-0208](../adr/0208-external-skill-repo-import-pack-library.md) (skill packs),
> [ADR-0227](../adr/0227-context-shared-state-grammar-and-data-adoption.md) (the roster as a `DataSource`).
> Sibling how-to: [state-and-persistence.md](./state-and-persistence.md) (where state lives and how it persists).
> Written 2026-08-29 (Kim's ruling, planner seat) against main `9d2075df`; type names follow the
> GH [#1699](https://github.com/kimgranlund/agent-ui/issues/1699) rename (in flight at authoring time, see §1).

## 0 · Route by question

| "What is…" | Answer | Detail |
|---|---|---|
| an agent, a persona, a preset | one thing at three moments: the record is an **agent**; a shipped one is a **preset**, a user's is an **import** | §3 |
| the thing the model actually reads | the composed system prompt, visible as the `Context: System` segment | §1 Composition |
| the difference between a team and an agent | a team is a **wrapper record** (GM + members) over agents; it never runs | §1 Wrappers |
| "the harness" | four different things; use the qualified term | §2 |
| a roster | the ordered agent list, or a team's member list; never a capability list | §3 |
| a pack | a **skill pack** (imported snapshot) or a **library pack** (the entry list it becomes) | §3 |
| why `AdminTurn` is not a2ui's `Turn` | the package DAG runs `a2ui ← app`; the shape is duplicated on purpose | §4 |

## 1 · Layers

Six layers, bottom to top. Each is one type family in one file; the table names the source of truth.

```
Wrappers      AgentTeam (GM + members)          agent-team.ts
   ▲ names agents by id
Turn          AdminTurn / AdminTurnRequest       agent-admin-schema.ts
   ▲ carries the composed prompt
Composition   composeSystemPrompt → "Context: System"   entries.ts · agent-team-prompt.ts
   ▲ projects enabled entries
Capabilities  Entry lists per kind (entries:<kind>)      entry-data.ts · entries.ts
   ▲ live in the store
Configuration AgentConfigSnapshot over SettingsStore     agent-admin-schema.ts · settings/store.ts
   ▲ seeded from the record
Identity      AgentRecord (roster row)           agent-roster-source.ts
```

**Identity.** `AgentRecord` is the roster row: `id`, `label`, `tagline`, optional `category`,
a `seed` (the settings store's initial values), and the provenance markers `seedVersion`
(presets only), `imported`, `createdAt`. The roster is a `DataSource` (`AgentRosterSource`, ADR-0227
cl.4) whose one view is `AgentRosterView` = ordered agents + the active id. *Rename note:* until GH
#1699 lands these read `PersonaRecord` / `PersonaRosterSource` / `PersonaRosterView` in
`persona-roster-source.ts`; the new names are canonical from this doc onward. The header's
`AgentRosterEntry` (`agent-admin.ts`) is the component-side projection of the same row (`id`,
`label`, `deletable?`), kept separate because the component cannot import site code.

**Configuration.** One `SettingsStore` per agent (`settings/store.ts`: sync `get`/`set`, optional
`subscribe`/`save`), seeded from the record's `seed`. `AgentConfigSnapshot` is the turn-time read of
that store: `name`, `model`, `temperature`, `toolsEnabled`, the composed `systemPrompt`, and the
enabled labels per capability kind. It is a read, never a cache: live-apply is "the next turn reads
the store again" (ADR-0136).

**Capabilities.** Every capability is an `Entry` (`entry-data.ts`): `id`, `kind`, `label`,
`description`, `content`, `order`, `enabled`, `builtin`, optional `availability`
(`context` | `invocable`), optional `idbRef` + `contentLength` for IDB-routed text. Kinds are the
`ENTRY_KINDS` constants in `entries.ts`: `prompt-section`, `skill`, `workflow`, `resource`, `tool`,
`pattern-source`, `catalog` (ADR-0170). Each kind is one ordered array under the store key
`entries:<kind>`. A disabled entry is skipped, never removed (ADR-0132 Fork 4).

**Composition.** `composeSystemPrompt(sections, team?)` (`entries.ts`) projects the enabled,
in-context entries into one markdown prompt of `## {heading}` blocks; `composeLiveSystemPrompt`
adds the capability groups, bankroll, and the team block from `composeTeamPromptSection`
(`agent-team-prompt.ts`, heading `## Your team`). The result is what the settings surface shows
under **Context: System** (`data-segment="Context: System"`, `agent-admin.ts`) and what
`AdminTurnRequest.system` carries.

**Turn.** `AdminTurn` is one completed `{role, content}` exchange; `AdminTurnRequest` is one live
request (`text`, `system`, `model`, optional `effort`, `integrations`). Two runner arms exist:
`AdminAgentTurn` (prose reply) and `AdminAgentSurfaceTurn` (streamed A2UI lines); both are
injected, `undefined` by default, so the packaged component ships no fetch or key code (ADR-0136).

**Wrappers.** `AgentTeam` (`agent-team.ts`): `id`, `label`, `tagline?`, `gmAgentId`, `members[]`
of `{agentId, role, routingDescription, instructions?}`. A team names agents by id and composes into
the GM's prompt; it has no runtime, no dispatch, no group conversation (ADR-0203 cl.1, IDR-0001).
The builder's `TeamDeclaration` (`a2ui/src/agent/meta-line.ts`, ADR-0204) is the wire-side proposal
that `handleTeamDeclared` (`site/pages/agent-admin-app.ts`) mints into agents plus one `AgentTeam`.

### Type → source

| Type | Source (under `packages/agent-ui/app/src/` unless stated) | Owning record |
|---|---|---|
| `AgentRecord`, `AgentRosterView`, `AgentRosterSource` | `controls/agent-admin/agent-roster-source.ts` (pre-#1699: `persona-roster-source.ts`) | ADR-0227 cl.4 |
| `AgentRosterEntry`, `GenerateSeed` | `controls/agent-admin/agent-admin.ts` | LLD admin-three-pane-ia §16.3 |
| `SettingsStore` | `controls/settings/store.ts` | app-surfaces-m4 LLD-C15 |
| `AgentConfigSnapshot`, `AdminTurn`, `AdminTurnRequest`, `AdminAgentTurn`, `AdminAgentSurfaceTurn` | `controls/agent-admin/agent-admin-schema.ts` | ADR-0135, ADR-0136 |
| `Entry`, `EntryLibraryPack`, `NewEntryInput`, `entriesStoreKey` | `controls/entry-list/entry-data.ts` | ADR-0132, ADR-0164 cl.2 |
| `ENTRY_KINDS`, `composeSystemPrompt`, `composeLiveSystemPrompt`, `EntryRosters` (pre-#1699: `ComposerRosters`) | `controls/agent-admin/entries.ts` | ADR-0132 cl.6 |
| `AgentTeam`, `AgentTeamMember` | `controls/agent-admin/agent-team.ts` | ADR-0203 |
| `composeTeamPromptSection` | `controls/agent-admin/agent-team-prompt.ts` | ADR-0203 cl.2 |
| `TeamDeclaration` | `packages/agent-ui/a2ui/src/agent/meta-line.ts` | ADR-0204 |
| `RoutedContent`, `RESOURCE_IDB_TEXT_THRESHOLD_CHARS` | `controls/agent-admin/resource-idb-store.ts` | ADR-0193, ADR-0227 cl.5 exception |
| `SkillPackSnapshot`, `SkillPackShelfSource` | `controls/agent-admin/skill-pack-store.ts` | ADR-0208 |
| `Persona` (site literal) | `site/pages/agent-admin-presets.ts` | §4; folds into `AgentRecord` under #1699 |
| `AgentTransport`, `Turn` | `packages/agent-ui/a2ui/src/agent/agent-transport.ts` | ADR-0069, ADR-0073 |
| `DevtoolsEvent`, `DevtoolsCapture` | `packages/agent-ui/devtools/src/timeline/events.ts`, `capture/format.ts` | ADR-0200 |

## 2 · "Harness", disambiguated

The bare word names four different things in this repo. Use the qualified term; the bare word is
retired from new prose (a fifth sense, *test harness*, stays a plain English phrase and is always
written with its qualifier).

| Canonical term | What it is | Owning record |
|---|---|---|
| **agent config** | the hoisted `SettingsSchema` + prompt files an agent's store is seeded from (ADR-0135 calls this "the agent harness's config") | ADR-0135 |
| **a2ui producer** | the grammar/dialect owner behind `produce()`: agents, skills, rubrics, gates for authoring and judging A2UI | `spec/a2ui-expert-harness.spec.md` |
| **devtools capture** | `@agent-ui/devtools`: the three transports behind `AgentTransport`, `recordTurn`, the `DevtoolsEvent` timeline and `DevtoolsCapture` file | ADR-0200, `spec/devtools-harness.spec.md` |
| **skill vocabulary** | the skill-kind entries a persona can opt into, including those projected from imported skill packs | ADR-0208 |

The two spec filenames keep their historical names; each carries a one-line disambiguation in its
header pointing here.

## 3 · Glossary

- **agent** = **persona** = a preset or an import. One `AgentRecord`; "persona" survives only as a
  human-facing tagline word in the UI, "preset" means a shipped record (`seedVersion` set, not
  deletable), "import" means a user-minted one (`imported: true`, `createdAt` set).
- **GM** (general manager): the agent an `AgentTeam` names in `gmAgentId`; its prompt gains the
  `## Your team` block. The GM is an ordinary agent; nothing else marks it.
- **Context: System**: the settings segment showing the compiled agent-system JSON, including the
  composed prompt; the read-only truth of what the next turn will send. Its sibling **Context: Dialog**
  is the per-turn payload log.
- **roster**: two senses, both about agents. The **agent roster** is the ordered `AgentRecord` list
  (`AgentRosterView`); the **team roster** is an `AgentTeam`'s `members`. A capability list is
  never a roster: the composer's `@`/`/` option lists are `EntryRosters` (pre-#1699
  `ComposerRosters`), an entry-side name.
- **pack**: two senses. A **skill pack** is the imported repo snapshot (`*.skillpack.json`,
  persisted whole as `skill-packs:<packId>`, ADR-0208 D1/D3). A **library pack** is the
  `EntryLibraryPack` it projects into beside the first-party packs (ADR-0208 D4); a library pack is
  data the entry list offers, and adding from it is a custom add with the typing done. The **pack
  library** is the UI shelf that lists library packs.
- **entry**: one capability row of any kind (§1 Capabilities). **Ambient** = enabled and
  `context`-available; **invocable** = enabled but inert until invoked from the composer.
- **Co-pilot**: the builder-interview place (`[Chat | Settings | Co-pilot]`, ADR-0179 as amended by
  GH #686); "Author" is its retired name.

## 4 · Seams, and why each exists

**`AdminTurn` vs a2ui `Turn` / `AgentTransport`.** `agent-admin-schema.ts` declares its own
`AdminTurn`/`AdminTurnRequest` instead of importing `Turn`/`TurnInput` from
`@agent-ui/a2ui/agent`. Reason (the code comment at the "injectable turn-runner seam" block,
TKT-0052/ADR-0136): a2ui's `Turn` is tools-internal, not a package export (SPEC-N1), and the
package DAG runs `a2ui ← app`, so the site runner matches the shapes structurally and the packaged
component carries zero fetch/env/proxy code. `agent-transport.ts` cites the same precedent for its
own local `Effort` union. The reason lives in those two code comments and ADR-0136; no ADR states
the duplication rule on its own.

**Site-side `Persona` literal vs the package record.** `site/pages/agent-admin-presets.ts`
declares `Persona` with a literal `category: PresetCategory` union; the package's `AgentRecord`
keeps `category` a bare string so the package never imports site vocabulary (comment on the record
type). GH #1699 folds the site type into the package one (a direct import or a declared subset,
the builder's call); until then the two are structurally compatible by construction.

**`RoutedContent` and the IndexedDB thresholds.** A `resource` entry's text over
`RESOURCE_IDB_TEXT_THRESHOLD_CHARS` (4,000) routes to the IndexedDB tier (`agent-ui-resource-text`,
store `kv`) and the entry keeps a placeholder `content` plus `idbRef`/`contentLength`; text at or
under passes through. Reason (the module header): every `entries:<kind>` array lives in the
localStorage tier, which is shared per origin and small; a document can reach
`MAX_DOCUMENT_CHARS` (50,000, `lib/document-budget.ts`), so large text must leave the sync tier
while short notes stay on the no-round-trip path (ADR-0193 tiers; ADR-0202 for the pdf extractor
that feeds it). The routing fails open: an IDB write that throws keeps the real text inline. The
threshold number itself is justified only in the module header, not in an ADR.

**`AgentRosterEntry` vs `AgentRecord`.** The component renders a roster it cannot know the shape
of (the DAG forbids importing site code), so it takes a narrowed `{id, label, deletable?}` row and
reaches every mutation through registered callbacks (`onDeleteAgentRequest`, `onGenerateRequest`).
Reason: LLD admin-three-pane-ia §16.3's frozen seam shapes, restated in the type's comment.
