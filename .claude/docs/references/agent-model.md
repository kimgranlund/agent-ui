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
> Ruling contract (2026-09-04, GH #1725): [spec/agent-model.spec.md](../spec/agent-model.spec.md) locks the six layers,
> lifecycles, tiers, and seams this map describes; on any conflict that SPEC and the source it cites win over this page.
> Content model (2026-10-14, T-0182): [spec/agent-content.spec.md](../spec/agent-content.spec.md) owns content kinds,
> files and registry, overlays and merge, schema forms, and the one compiler (all planned, T-0160 to T-0163).
> Written 2026-08-29 (Kim's ruling, planner seat) against main `b371558a`, after the
> GH [#1699](https://github.com/kimgranlund/agent-ui/issues/1699) rename landed (PR #1708); type names are the shipped ones.

## 0 · Route by question

| "What is…" | Answer | Detail |
|---|---|---|
| an agent, a persona, a preset | one thing at three moments: the record is an **agent**; a shipped one is a **preset**, a user's is an **import** | §3 |
| the thing the model actually reads | the composed system prompt, visible as the `Context: System` segment | §1 Composition |
| the difference between a team and an agent | a team is a **wrapper record** (GM + members) over agents; it never runs | §1 Wrappers |
| "the harness" | four different things; use the qualified term | §2 |
| a roster | the ordered agent list, or a team's member list; never a capability list | §3 |
| Knowledge, Instructions | the `resource` kind and the composed system prompt, as the user sees them | §3 |
| a pack | a **skill pack** (imported snapshot) or a **library pack** (the entry list it becomes) | §3 |
| why `AdminTurn` is not a2ui's `Turn` | the component keeps its own minimal shapes so it binds to no transport type; the code comment's stated reason is stale | §4 |

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
cl.4) whose one view is `AgentRosterView` = ordered agents + the active id. The header's
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
The surface arm also carries the response type hint (ADR-0242): `AdminSurfaceTurnRequest.prefers`
(`text` | `surface` | `auto`, omitted on `auto`), read fresh each turn from the persona's `prefers` setting,
which the Surface Options tab edits through its **Response type** picker (`PREFERS_KEY`,
`agent-admin-schema.ts`; the picker in `agent-admin.ts`). The hint is advisory: it composes one preference
paragraph into the prompt and never changes the `render_surface` offer. The mechanical per-turn override is a
different field, the produce request's `responsePreference` (`text` withholds the tool, `surface` forces it;
`auto` or absent means none), and the user's own words win over both.

**Wrappers.** `AgentTeam` (`agent-team.ts`): `id`, `label`, `tagline?`, `gmAgentId`, `members[]`
of `{agentId, role, routingDescription, instructions?}`. A team names agents by id and composes into
the GM's prompt; it has no runtime, no dispatch, no group conversation (ADR-0203 cl.1, IDR-0001).
The builder's `TeamDeclaration` (`a2ui/src/agent/meta-line.ts`, ADR-0204) is the wire-side proposal
that `handleTeamDeclared` (`site/pages/agent-admin-app.ts`) mints into agents plus one `AgentTeam`.

The type → source-path table is Appendix A (kept out of this section for length).

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

- **agent** = **persona** = a preset or an import (the record contract: [spec/agent-model.spec.md](../spec/agent-model.spec.md) SPEC-R1). One `AgentRecord`; "persona" survives only as a
  human-facing tagline word in the UI, never as a type name or a doc noun (Kim's decision, 2026-08-29;
  the record type was renamed from `PersonaRecord` to `AgentRecord` by GH #1699, PR #1708, 2026-08-29), "preset" means a shipped record (`imported` absent or not `true`; not
  deletable; it may or may not declare a `seedVersion`, so `seedVersion` never decides the kind), "import" means a
  user-minted one (`imported: true`, `createdAt` set). The discriminator is `imported` (SPEC-R1).
- **GM** (general manager): the team's leading agent, the one an `AgentTeam` names in `gmAgentId`;
  its prompt gains the `## Your team` block. The GM is an ordinary agent; nothing else marks it.
- **`render_surface`**: the terminal tool `produce()` offers on an a2ui-enabled turn (ADR-0242, accepted;
  [spec/response-type-selection.spec.md](../spec/response-type-selection.spec.md) RTS-R1). The model calls it
  with the A2UI JSONL to show UI; its input is validated like any payload and never executed as a tool.
  Text is the default response type: a turn with no call is a text answer.
- **`textDelta`**: the additive meta arm `{"a2uiMeta":{"textDelta":"..."}}` carrying one fragment of the
  reply text as it streams, ahead of the leading meta-line and any content (RTS-R5). A meta arm, not a
  progress stage; the leading meta-line's `note` still carries the whole reply.
- **whole-turn deadline**: the one absolute time limit `produce()` puts on an entire turn, every provider
  round, repair round and tool call together (`TURN_DEADLINE_MS`, 300000 by default, `withTurnDeadline` in
  `src/agent/deadlines.ts`; server-owned, never read from a request body). It is the bound the per-wait
  timers (first byte, stream stall) cannot give, because a stream that keeps emitting never stalls. Expiry
  throws `TurnDeadlineError`, an `AgentTimeoutError` (T-0023).
- **plain-words error**: the user-facing text a host writes when a turn fails: `failureMessageFor(err)`
  (`tools/agent/chat-validation.ts`) returns a `ProduceHalt`'s own message, an `AgentTimeoutError`'s
  `userMessage`, or one generic line, so no upstream body, key or id reaches the wire. The raw error stays in
  the server log (T-0024). Not the terminal `error` meta arm itself, which carries this text.
- **Context: System**: the settings segment showing the compiled agent-system JSON, including the
  composed prompt; the read-only truth of what the next turn will send. Its sibling **Context: Dialog**
  is the per-turn payload log. Their tabs in the settings strip read `System` and `Dialog`; the full
  names are the segment names, the tabs' accessible names and their tooltips.
- **admin flow**: one scripted, keyless agent-admin scenario run by `npm run e2e:admin`
  (`scripts/e2e-admin`) in headless Chromium. Always qualified: bare "flow" already names ask-flows and
  the guided-authoring flow.
- **scenario fixture**: the recorded raw wire lines an admin flow replays through Playwright routes in
  place of the live model; captured by `npm run e2e:admin:record`.
- **A2UI test kit**: the keyless kit under `packages/agent-ui/a2ui/tools/testkit/` (T-0011) that tests the
  A2UI layer itself, not an agent-admin flow. Its unit is the **kit scenario** (`*.scenario.json`, format
  `agent-ui-a2ui-scenario`), always qualified so it never reads as an admin flow's scenario fixture. A
  **seeded fixture** is a known defect pinned to the **layer** that must catch it (validator, heal,
  renderer, catalog, producer, integration, interop) and its code. Its doubles are *scripted*
  (scripted transport, scripted provider, scripted MCP server), never "fake" or "harness".
- **probe fixture**: the `agent-ui-chat-probe` v1 file `npm run chat:probe` replays: the preset, the user
  steps and, per produce request, the wire lines plus the model rounds behind them (`ProbeFixture` in
  `scripts/e2e-admin/probe/model.ts`, T-0174). A live probe writes one; `--from-trace` builds one from
  `.agent-traces/`. Not an admin flow's scenario fixture (scripted lines per endpoint, no rounds) and not
  a kit scenario. Contract: [spec/agent-closed-loop.spec.md](../spec/agent-closed-loop.spec.md) CL-R3.
- **eval scenario**: one agent use case as data (`agent-ui-eval-scenario`, persona, models, efforts,
  tags, steps, per-turn checks, optional `expectedFail: T-NNNN`), played live or replayed by the eval
  runner (T-0176, planned; CL-R1). It tests an agent; a kit scenario tests the A2UI layer and an admin
  flow tests the agent-admin app. Both eval and kit files end `*.scenario.json`; the `kind` tells them
  apart.
- **check**: one named verdict over one probe or eval turn (`model-pick`, `no-halt`, `no-json-as-prose`,
  `no-surface-loss`, `expect-component`, `render-lint`, `reasoning`; `CHECK_NAMES` in
  `probe/model.ts`), status `pass`, `fail`, `warn` or `skip` (CL-R2). Not a **semantic check** (a
  persona's in-loop domain check that feeds a self-correct round), not the A2UI protocol's `checks`, and
  not a kit finding code.
- **signal row**: one line of `.agent-evals/runs.jsonl` per eval scenario run per sample: the checks,
  verdict, retries, tokens, cost, latency, digest and links (T-0176, planned; CL-R4). A trace line is per
  live turn (`.agent-traces/`, T-0151); a signal row is per scenario run and links its trace lines by id.
- **roster**: two senses, both about agents. The **agent roster** is the ordered `AgentRecord` list
  (`AgentRosterView`); the **team roster** is an `AgentTeam`'s `members`. A capability list is
  never a roster: the composer's `@`/`/` option lists are `EntryRosters`, an entry-side name.
- **pack**: two senses. A **skill pack** is the imported repo snapshot (`*.skillpack.json`,
  persisted whole as `skill-packs:<packId>`, ADR-0208 D1/D3). A **library pack** is the
  `EntryLibraryPack` it projects into beside the first-party packs (ADR-0208 D4); a library pack is
  data the entry list offers, and adding from it is a custom add with the typing done. The **pack
  library** is the UI shelf that lists library packs.
- **entry**: one capability row of any kind (§1 Capabilities). **Ambient** = enabled and
  `context`-available; **invocable** = enabled but inert until invoked from the composer.
- **Knowledge**: the `resource` entry kind as the user sees it (attached documents, PRD §3.5).
  User-facing copy says Knowledge; the `resource` kind, `RoutedContent`, and the budget constants keep
  their names. Vendor convergence (vendor docs fetched 2026-08-29: Claude Projects "project knowledge",
  ChatGPT GPTs "Knowledge", Gemini Gems "Knowledge"; §5).
- **Instructions**: the composed system prompt as the user sees it, i.e. what the `Context: System`
  segment shows (§1 Composition). User-facing copy may say Instructions; the segment id
  `context-system` and `#renderContextSystem` keep their names.
- **team member**: one `AgentTeamMember` of an `AgentTeam`; the GM consults it by prose only. Across
  vendors the same role is a *subagent* (Claude Code, Google ADK) or a *handoff target* (OpenAI
  Agents SDK); this repo's word is member (vendor docs fetched 2026-08-29, §5).
- **selection guidance**: per-type "which one when" data for the model: `intents` (the job, in the
  user's words) and `notFor` (a confusable sibling and the axis that separates them). Its machine home
  is each catalog's `selection.json` sidecar beside `catalog.json`, read by
  `selectionGuidanceFor` on `@agent-ui/a2ui/agent` and rendered as a clause on the composed prompt's
  inventory line (ADR-0232, accepted); in-page tooling reads the derived browser-safe copy,
  `selectionProjectionFor` on `@agent-ui/a2ui/registry`. The human twins are the catalog SPEC §5.2 Notes and the site's
  choosing guide; neither is generated from it.
- **agent manifest**: the `<id>.manifest.json` file in `site/lib/agent-manifest/`, one per agent
  preset plus one for `fixture-demo`. It pins the preset's effective `seedVersion` and canonical
  sha256 digests of its seed, its persona catalog fragment's `catalog.json` and that fragment's
  `selection.json`; an agent with no fragment records why in `noFragment.why` (the ruling is ADR-0235
  cl.5, under the bar restated in
  `.claude/docs/decompositions/md-content-concierge-croupier-promotion.decomp.md:21-25`, proposed).
  Its gate is `site/lib/agent-manifest/agent-manifest.test.ts`; its writer is
  `AGENT_MANIFEST_WRITE=1 npx vitest run --project site site/lib/agent-manifest/agent-manifest.write.test.ts`
  (ADR-0235, accepted). Not the fragment manifest `PersonaCatalogManifest`
  (`catalog/personas/<id>/manifest.ts`), the Node-safe `personaId`/`fragment`/`targetCatalogs`
  triple of GH #516 (plus any `semanticChecks`), which stays inside the a2ui package.
- **semantic check**: a pure, deterministic domain check a persona declares on its fragment manifest
  (`PersonaCatalogManifest.semanticChecks`, contract in `packages/agent-ui/a2ui/src/catalog/semantic-check.ts`).
  `produce()` runs it on a round that already passed the shared validator, over each touched surface merged
  with the session; a finding (`{code, path, message}`) is fed back as a self-correct round, and at the round
  bound the valid payload ships tallied `SEMANTIC_UNCORRECTED` (ADR-0238). The first one is the
  Croupier's hand check (a stated total must match the cards shown, and a natural blackjack leaves no Hit, Stand or Double). Not the A2UI protocol's `checks`
  (input validation on a component) and not a model-graded round.
- **prompt budget**: the declared character ceiling on the whole composed system prompt, per catalog
  family (`PROMPT_CHAR_BUDGET_BASE`, `PROMPT_CHAR_BUDGET_DERIVED` in `src/agent/prompt-budget.ts`). Each
  turn reports its section sizes against it as `trace.prompt`, and the provider-billed token counts as
  `trace.usage`. Over budget is reported, never truncated; halting is opt-in (`PROMPT_OVER_BUDGET`,
  ADR-0234, accepted).
- **capability registry**: the derived index that joins what an agent can emit: each catalog type with the
  control it renders (one pure tag rule), its selection guidance, the controls no catalog renders and the
  exclusion that excuses them, the mini-skills, genui packs and corpus shards scoped to a catalog id, and per
  persona the fragment types a `<base>--<persona>` id adds. It indexes and never generates catalog content
  (ADR-0173 cl.5). The pure model is `@agent-ui/a2ui/registry` (`composeRegistry`, `registryViewFor`); the one
  committed projection is `site/capability-registry.json`, regenerated by `npm run generate:registry`. It is
  not the **roster** (an `AgentRecord` list) and not the components registry `CONTROLS` it joins (ADR-0237,
  accepted).
- **activity step**: one row of a turn's activity strip in `ui-conversation`'s step mode: the neutral
  `ActivityStep` (`id`, `kind`, `label`, `status` of running/ok/repaired/failed, optional `startedAt`,
  `durationMs`, `summary`, `retries`, `raw`, `reasoning`, `details`) a host pushes through `AgentTurnHandle.step()`, plus the turn's
  `ActivityFooter` facts (rounds, tokens, model). It names no catalog, type or protocol: an adapter
  builds it (`site/lib/a2ui-activity.ts` for A2UI turns). Not a **plan step** (`PlanStep`, the model's
  own declared step list on the meta-line) and not a `TurnProgress` stage (the producer's wire signal
  an adapter reads). ADR-0159 amendment (T-0016, ratified). `reasoning` is the model's thinking text, a collapsed
  panel on the Reasoned row (ADR-0240).
- **Co-pilot**: the builder-interview place (`[Chat | Settings | Co-pilot]`, ADR-0179 as amended by
  GH #686); "Author" is its retired name.
- **content kind**: one of `persona · skill · workflow · resource · tool · pack · team`, the seven kinds of seed
  content ([spec/agent-content.spec.md](../spec/agent-content.spec.md) ACS-R1, planned T-0160). Not an entry kind:
  `prompt-section`, `pattern-source` and `catalog` stay `ENTRY_KINDS` values that a persona file carries as body
  sections and fields.
- **seed home**: where a preset's seed lives. Today it is the TypeScript constants in
  `site/pages/agent-admin-presets.ts` and `agent-admin-libraries.ts`, with the `seedVersion` rationale in code
  comments; planned (T-0160), it moves to content files whose frontmatter carries `version` and a `changelog:`
  list, indexed by the generated content **registry** (`registry.gen.ts`, one row per item with its digest).
- **overlay**: a user's edits to one seed, stored as field-level ops keyed by `id@baseVersion`; every reader sees
  the **resolved view** `resolve(seed, overlay)`, and a seed update merges into it instead of wiping it
  (ACS-R6, ACS-R7, planned T-0161). Imports and duplicates are full records and carry no overlay.
- **bundle digest**: the sha256 of everything one turn sends about an agent, as built by the one compiler
  `compile(agentManifest, overlay)`; each turn trace records it with a **resolution** (every item's id, kind,
  version, digest and source) (ACS-R11 to R13, planned T-0163). Not the agent manifest's seed digest, which pins
  one preset's seed, nor a registry item digest, which pins one file.

## 4 · Seams, and why each exists

**`AdminTurn` vs a2ui `Turn` / `AgentTransport`.** `agent-admin-schema.ts` declares its own
`AdminTurn`/`AdminTurnRequest` instead of importing `Turn`/`TurnInput` from
`@agent-ui/a2ui/agent`, and `agent-transport.ts` declares a local `Effort` union instead of importing
`@agent-ui/app`'s `EffortLevel`. The two halves have different reasons. The a2ui side is the package
DAG: `app` may import `a2ui`, never the reverse, so a2ui duplicates the four-value union (comment on
`Effort`, citing "the `AdminTurn`/a2ui `Turn` precedent, TKT-0052"). The app side is ADR-0136's
posture: the packaged component ships zero fetch/env/proxy code and binds to no transport type; the
site runner (`site/lib/admin-live-runner.ts`) matches `AdminTurn` structurally and owns everything
transport-shaped. *Stale-comment note (2026-08-29):* the seam comment at the "injectable turn-runner
seam" block in `agent-admin-schema.ts` states a2ui's `Turn` is "deliberately NOT a package export
(SPEC-N1)"; that predates SPEC-N1 v0.5 (ADR-0137/TKT-0072), which exports `Turn` at
`@agent-ui/a2ui/agent`. The duplication stands on ADR-0136's posture, not on export reachability;
the comment is filed for repair (GH #1702) and this doc does not repeat its claim.

**Site-side `Persona` literal vs the package record.** `site/pages/agent-admin-presets.ts`
declares `Persona` as `Omit<AgentRecord, 'category'> & { category?: PresetCategory }`, a declared
subset of the package record with the page's literal category union; the package's `AgentRecord`
keeps `category` a bare string so the package never imports site vocabulary (comments on both
types, GH #1699). One shape, one name; the site alias exists only for the narrowed category.

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

## 5 · Vendor vocabulary sources

The Knowledge and team-member mappings in §3 rest on vendor docs fetched 2026-08-29 (the marshal's
fetch, cited by URL; re-check on any vendor rename):
docs.claude.com/en/docs/claude-code/sub-agents (Claude Code subagents) ·
support.claude.com/en/articles/9517075-what-are-projects (Claude Projects "project knowledge") ·
openai.github.io/openai-agents-python/agents/ (OpenAI Agents SDK handoffs) · adk.dev/get-started/about/ (Google ADK) ·
help.openai.com/en/articles/8554397 (ChatGPT GPTs "Knowledge") ·
support.google.com/gemini/answer/15236321 (Gemini Gems "Knowledge").

## A · Type → source

| Type | Source (under `packages/agent-ui/app/src/` unless stated) | Owning record |
|---|---|---|
| `AgentRecord`, `AgentRosterView`, `AgentRosterSource` | `controls/agent-admin/agent-roster-source.ts` | ADR-0227 cl.4 |
| `AgentRosterEntry`, `GenerateSeed` | `controls/agent-admin/agent-admin.ts` | LLD admin-three-pane-ia §16.3 |
| `SettingsStore` | `controls/settings/store.ts` | app-surfaces-m4 LLD-C15 |
| `AgentConfigSnapshot`, `AdminTurn`, `AdminTurnRequest`, `AdminAgentTurn`, `AdminAgentSurfaceTurn` | `controls/agent-admin/agent-admin-schema.ts` | ADR-0135, ADR-0136 |
| `Entry`, `EntryLibraryPack`, `NewEntryInput`, `entriesStoreKey` | `controls/entry-list/entry-data.ts` | ADR-0132, ADR-0164 cl.2 |
| `ENTRY_KINDS`, `composeSystemPrompt`, `composeLiveSystemPrompt`, `EntryRosters` | `controls/agent-admin/entries.ts` | ADR-0132 cl.6 |
| `AgentTeam`, `AgentTeamMember` | `controls/agent-admin/agent-team.ts` | ADR-0203 |
| `composeTeamPromptSection` | `controls/agent-admin/agent-team-prompt.ts` | ADR-0203 cl.2 |
| `TeamDeclaration` | `packages/agent-ui/a2ui/src/agent/meta-line.ts` | ADR-0204 |
| `RoutedContent`, `RESOURCE_IDB_TEXT_THRESHOLD_CHARS` | `controls/agent-admin/resource-idb-store.ts` | ADR-0193, ADR-0227 cl.5 exception |
| `SkillPackSnapshot`, `SkillPackShelfSource` | `controls/agent-admin/skill-pack-store.ts` | ADR-0208 |
| `Persona` (site alias, a declared subset of `AgentRecord`) | `site/pages/agent-admin-presets.ts` | §4 |
| `AgentManifest` | `site/lib/agent-manifest/agent-manifest.ts` | ADR-0235 |
| `AgentTransport`, `Turn` | `packages/agent-ui/a2ui/src/agent/agent-transport.ts` | ADR-0069, ADR-0073 |
| `ActivityStep`, `ActivityStatus`, `ActivityFooter` | `controls/conversation/activity-step.ts` (re-exported from `@agent-ui/app/conversation`) | ADR-0159 amendment (T-0016), ADR-0240 (`reasoning`, accepted) |
| `SemanticCheck`, `SemanticFinding`, `SurfaceView` | `packages/agent-ui/a2ui/src/catalog/semantic-check.ts` | ADR-0238 |
| `DevtoolsEvent`, `DevtoolsCapture` | `packages/agent-ui/devtools/src/timeline/events.ts`, `capture/format.ts` | ADR-0200 |
