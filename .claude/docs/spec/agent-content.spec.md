# SPEC · agent-content: the agent content model (kinds, files and registry, overlays and merge, schema forms, one compiler with digests)

> Status: proposed · v0.1 · 2026-10-14 · Layer: SPEC (execution contract) · solo seat, T-0182
> Refines: [`prd/agent-admin-app.prd.md`](../prd/agent-admin-app.prd.md) PRD-G8 (editable content with provenance
> and reset) and PRD-G9 (trace and eval observability). Extends: [`agent-model.spec.md`](./agent-model.spec.md)
> (the six layers; its SPEC-R5, §3.5, SPEC-R34 and §8 point here). Builds: T-0160 (files and registry), T-0161
> (overlays and merge), T-0162 (schema forms), T-0163 (compiler). Kim approved the model 2026-10-14; decisions
> are recorded in those tickets, never as new ADR clauses (the ADR log is frozen, T-0164).
> Amends on landing: [`persona-catalog-composition.spec.md`](./persona-catalog-composition.spec.md) SPEC-R7
> (T-0160 generates or derives the agent manifests' digests from the registry; today they are hand-authored and
> refreshed by an armed writer). That SPEC is edited by the T-0160 build, not by this record.
> Holds unchanged: ADR-0073 (keys and `produce()` stay server-side, nothing enters devtools), ADR-0227 (one
> signal-backed owner, explicit injection, `StorageAdapter` persistence), the package DAG and its
> `layering.test.ts` trip-wires, and the prompt-equivalence baseline (changed only through the
> `a2ui-prompt-authoring` flow).
> Altitude: owns WHAT an agent's content is and the laws every reader and writer of it obeys. File names inside
> the content root, module names and per-step design stay with the four build tickets. Requirement IDs are
> file-scoped (`ACS-R1…`, `ACS-N1…`); every requirement below is planned and names its ticket.

---

## 1 · Purpose

Agent-admin seed content today is TypeScript constants (`site/pages/agent-admin-presets.ts`,
`site/pages/agent-admin-libraries.ts`), a user edit overwrites the seed in place, a `seedVersion` bump wipes every
user edit (agent-model SPEC-R5), the settings forms are hand-written beside the data they edit, and no turn records
which content it ran with. This SPEC fixes the contract the four tickets build against so that the Builder
(Co-pilot), a CLI, Test Chat and the settings pane read and write one source, a seed update merges instead of
wiping, and every turn names the exact content versions it used.

## 2 · Definitions

- **content kind**: one of the seven kinds in ACS-R1. A kind has one schema, one file shape, one write path.
- **content root**: the one directory holding every seed content file, chosen by T-0160 inside the package DAG.
- **seed**: a content item as committed in the content root and indexed by the registry. Read-only at runtime.
- **registry**: the generated index of every seed (`registry.gen.ts`, ACS-R4).
- **ref**: `id@version`, the only way one content item names another.
- **overlay**: one user's recorded changes to one seed, as field-level ops against that seed's schema (ACS-R6).
- **resolved view**: `resolve(seed, overlay)`, the only value any reader sees (ACS-R6).
- **provenance**: where a resolved value came from, one of `seed · pack · imported · duplicate · builder · user`
  (ACS-R8).
- **bundle**: everything one turn sends about the agent (system prompt, model, model settings, enabled capability
  labels, integrations), as built by the compiler (ACS-R11).
- **bundle digest**: the sha256 of the canonical bundle (ACS-R12).

## 3 · Requirements

### 3.1 Kinds and files (T-0160)

**ACS-R1 (seven kinds).** The content kinds are `persona · skill · workflow · resource · tool · pack · team`.
`skill`, `workflow`, `resource` and `tool` are the four capability kinds and map one to one onto the
`ENTRY_KINDS` constants of the same name (agent-model SPEC-R12). The other three `ENTRY_KINDS` are NOT content
kinds: `prompt-section` entries are the persona body's sections, and `pattern-source` and `catalog` are persona
fields (`fragments`, `catalog`). SPEC-R12's `Entry` shape and `entries:<kind>` store keys are unchanged by this
SPEC; content kinds describe seeds, entries remain the store's runtime rows. Planned: T-0160.

**ACS-R2 (file shapes).** One content item is one file (or one folder with one entry file) in the content root:
1. persona: a markdown file whose frontmatter carries `id`, `version`, `label`, `category`, `model`,
   the model settings (`effort`, `thinking`, `showReasoning`, `maxTokens`, `cacheTtl`, T-0185), `surfaces`, `catalog`, `fragments`, and the capability lists as refs (`skills`, `workflows`,
   `resources`, `tools`); the body is the foundation prompt, with `surfaceStyle` and any other prompt section as
   named sections. A persona is a manifest of refs: it never copies a capability's text.
2. skill, workflow, resource, tool: the Agent Skills format (`SKILL.md` with `name` and `description`) plus `id`,
   `version`, `kind`, `availability` (`context | invocable`, agent-model SPEC-R14).
3. pack: refs only (a JSON file listing `id@version` refs of one capability kind), never copies.
4. team: an `AgentTeam` record (agent-model SPEC-R28) whose `gmAgentId` and member `agentId`s name personas. The
   kind exists so a shipped team can be a seed; user teams keep their ACS-R9 write path.
5. The `seedVersion` rationale that lives in trailing code comments today moves into the persona frontmatter as a
   `changelog:` list, one line per version. `version` carries the value `seedVersion` carries today, so no stored
   marker changes meaning at extraction.
Planned: T-0160.

**ACS-R3 (frontmatter is zero-dependency).** Frontmatter is parsed by a repo-owned parser with no runtime or
build dependency (no YAML library). T-0160 picks either a small declared subset (flat keys, scalars, inline lists)
or JSON frontmatter; whichever it picks, the validator refuses any file outside the chosen grammar with a named
reason, never a best-effort parse. Planned: T-0160.

**ACS-R4 (registry, digests, drift gate).** `scripts/generate-agent-content.mjs` reads the content root and emits
`registry.gen.ts`: one row per item with `id`, `kind`, `version`, `digest`, `path`, the parsed frontmatter and the
body. The item digest is a sha256 over the item's canonical form (LF line endings, frontmatter as canonical JSON
with sorted keys, then the body), the same canonicalization family `site/lib/agent-manifest/agent-manifest.ts`
uses today. The generator has a `--check` mode that rides `check:scripts` and a freshness test, like every other
`*.gen.ts` (AGENTS.md "Never hand-edit"); a hand-edited registry reds the check. The existing mini-skill and GenUI
pack `.md` reads (`import.meta.glob` in `site/pages/agent-admin-libraries.ts`) fold into the same registry. The
agent manifests (`site/lib/agent-manifest/*.manifest.json`) read their seed digests from the registry or are
generated by the same script (the persona-catalog-composition SPEC-R7 amendment above). Planned: T-0160.

**ACS-R5 (extraction is byte-neutral).** Moving the presets, the Builder preset and the library packs into files
changes no assembled prompt: for every preset, the composed system prompt (agent-model SPEC-R20, SPEC-R21) built
from the registry is byte-identical to the one built from today's constants. Because nothing a store reads
changes, extraction carries no `version` bump. `site/pages/agent-admin-presets.ts` and
`agent-admin-libraries.ts` become thin readers of the registry. Planned: T-0160.

### 3.2 Seed, overlay, resolved (T-0161)

**ACS-R6 (three views, one resolver).** Every item has three views: the seed (registry, read-only), the overlay
(the user's ops, persisted), and the resolved view. One function, `resolve(seed, overlay)`, produces the resolved
view, and every reader (the admin panes, Test Chat, the Builder, the compiler) reads only the resolved view. An
overlay record is keyed by the seed ref it was made against (`id@baseVersion`) and carries the base digest, the
ordered ops, and per-op provenance (ACS-R8). An op is field-level against the kind's schema (set a field; add,
remove, or patch one entry of a list by entry id; reorder a list). Each op records the base value it replaced, so
a later merge never needs an old seed body. Overlays persist through `StorageAdapter` (the localStorage tier,
large text on the IndexedDB tier as agent-model SPEC-R18 routes it today). Planned: T-0161.

**ACS-R7 (3-way merge on seed update).** When the registry's version of a seed is higher than an overlay's
`baseVersion`, the overlay is merged per field, never swept:
1. the user did not change the field: the new seed value wins;
2. the seed did not change the field (new seed value equals the op's recorded base value): the user value wins;
3. both changed to the same value: the op is dropped as redundant;
4. both changed to different values: a conflict. The user value is kept, and the field is flagged `seedChanged`
   with the base, the new seed and the user values;
5. an entry the user edited was deleted upstream: the user's entry is kept as a user-added entry and flagged
   `seedChanged`; an entry the user did not touch is removed with the seed.
After the merge the overlay's `baseVersion` and base digest move to the new seed. The one-time migration from
today's stored shape diffs each stored value against the current seed: when the stored `<id>.seedVersion` equals
the seed's `version`, each differing field becomes a plain op; when it is lower (the base text is not kept), each
differing field becomes a conflict-flagged op that keeps the user value. The full stored copy is then dropped,
and the wipe in `personaStore`/`resetPersona` on a bump retires. Planned: T-0161.

**ACS-R8 (provenance and reset).** Provenance is one of `seed` (the registry value), `pack` (added from a library
or skill pack), `imported` and `duplicate` (a whole record minted by agent-model SPEC-R6), `builder` (applied by
a Builder `personaPatch`), `user` (a settings-pane edit). This list supersedes the differing wordings in T-0161,
T-0162 ("edited") and T-0163 ("seed/pack/user/builder"). Reset exists per field (drop that field's ops) and per
agent (drop the overlay); a field with any op reads "modified". Imports and duplicates stay full records with no
overlay: overlays apply to seeds only. Planned: T-0161.

**ACS-R9 (one write path per kind).** Each kind has exactly one write path, and every surface goes through it:
personas and capability entries on a seed through the overlay store (ACS-R6); imports and duplicates through the
roster source (agent-model SPEC-R2); the skill-pack shelf through `skill-pack-store.ts` (SPEC-R17); teams through
the page's `teamsResource` mutations, which the Teams pane (`agent-team-pane.ts`, a direct `saveAgentTeam` today)
and the Builder's `handleTeamDeclared` (`saveTeamMutation` today) both call. `teamsResource` gains a live leg so
both surfaces observe each other's writes. Planned: T-0161.

### 3.3 Schema forms (T-0162)

**ACS-R10 (one field definition).** Each kind's schema is the single definition of its fields. The settings
pane's `SettingsSchema` sections (today hand-written `agentConfigSchema` and friends, agent-model SPEC-R11) are
derived from it; layout hints live in the schema as optional members, never as a second field list. Every schema
field appears in the generated form and no form field lacks a schema field. Each row shows its provenance
(ACS-R8), a "modified" marker, the diff from the seed, and a reset. The Builder's `personaPatch` emits ops
validated by the same schema validator; the three-filter apply gate (agent-model SPEC-R33) stays and becomes
schema-backed. A CLI, `scripts/agent-content.mjs validate | new | add-skill | compile-check`, runs the same
validator over the content files with no new dependency, and a Builder export writes the same file format as a
seed, so a Builder-made agent can be committed as one. Planned: T-0162.

### 3.4 One compiler (T-0163)

**ACS-R11 (compile).** `compile(agentManifest, overlay)` returns `{ bundle, digest, resolution }`. It is the one
assembly path used by Test Chat, the dev proxy, the Cloudflare Worker and the CLI (`agent-content.mjs compile`);
any parallel assembly path retires. `bundle.system` is byte-identical to today's `composeLiveSystemPrompt` output
(agent-model SPEC-R21) for the same inputs; the compiler wraps the composition laws of agent-model §3.5, it does
not restate or change them. `resolution` lists every item that went in: `{ id, kind, version, digest, source }`,
where `source` is a provenance value (ACS-R8). The compiler is environment-neutral (browser, Node, Worker), holds
no key, and never calls `produce()`. Landed (T-0163): `@agent-ui/app/agent-admin-compile` (`compile`, and
`compileStore`, the synchronous projection Test Chat's live arms and Context view call); the dev proxy and the
Worker receive the composed prompt and recompute the digest from the request body, so no parallel assembly path
remains.

**ACS-R12 (the bundle digest).** The bundle digest is a sha256 over the canonical bundle, computed with Web Crypto
`SubtleCrypto.digest('SHA-256')`, which exists in all four environments with no dependency. Because that call is
async, `compile` either returns a promise or computes the digest in one async step over its pure output; T-0163
picks, and the result is identical either way. Test Chat, the proxy and the CLI produce the same digest for the
same agent and overlay. Landed (T-0163): the digest is the one async step over the synchronous `compileStore`
output (`@agent-ui/a2ui/agent/agent-bundle`); the bundle is the fields the request body carries (system, model,
model settings, integrations), so a host recomputes it from the body.

**ACS-R13 (every turn names its content).** Every turn trace line (`.agent-traces/`, T-0151,
`packages/agent-ui/a2ui/tools/agent/trace-log.ts`) and the admin debug bundle record the bundle digest and the
resolution; `npm run traces` prints them. The debug bundle also carries the devtools captures (agent-model
SPEC-R27's `captures/` family, a slot `buildDebugBundle` never fills today). Test Chat's context view shows the
resolution. e2e:admin fixtures and agent-behavior eval legs may pin `agent@digest` and report a mismatch instead of
drifting silently; the eval contract that consumes the digest (digest-affected selection) is T-0181's. Landed
(T-0163): the trace line's `bundle` (`digest` recomputed by the proxy, the client's `claimed` stamp, the
`resolution`), the debug bundle's `content/` and `captures/` families, the Context view's agent item, and the
e2e:admin `match.agent` pin. A resolution row an overlay op changed reads that op's source (T-0162's per-op
`user`, `builder`, `pack`). Open: the agent-behavior eval legs carry no pin yet.

### 3.5 Constraints

**ACS-R14 (zero dependencies).** No step of this model adds a runtime or build dependency: no YAML parser, no
diff or merge library, no hashing package. The two ruled exceptions (CodeMirror, pdfjs-dist) are untouched.
Planned: T-0160 to T-0163.

**ACS-R15 (authoring context is never runtime).** An `AGENTS.md` in the content root documents the schema, how to
add a persona or a skill, the validate command and the naming rules. It is authoring context for a person or an
agent editing files; the generator never indexes it and no runtime path imports it. Planned: T-0160.

## 4 · Non-goals

**ACS-N1.** Cloud sync, multi-user overlays, and publishing content outside the repo.

**ACS-N2.** New presets or rewrites of existing seed text: extraction is byte-neutral (ACS-R5).

**ACS-N3.** Memory, a redesign of the eval system, and the closed-loop testing contract (T-0181 owns it).

**ACS-N4.** Any change to the composition laws (agent-model SPEC-R20 to R22), the entry admission law (SPEC-R13),
or the meta-line arms.

## 5 · Examples

**E1, ILLUSTRATIVE (ACS-R7).** The `concierge` seed is at version 7. A user sets its effort from medium to low:
the overlay records `{ op: set, path: effort, base: medium, value: low, source: user }` against
`concierge@7`. Version 8 ships with a new `surfaceStyle` and effort still medium: the merge takes the new
`surfaceStyle` (case 1) and keeps low (case 2), with no conflict. Had version 8 set effort to high, the field
would keep low and show `seedChanged` with medium, high and low (case 4).

**E2, ILLUSTRATIVE (ACS-R11, ACS-R13).** A Test Chat turn on that agent records in its trace line the bundle
digest and a resolution naming `concierge@8` (source `seed`, with the user's effort op under source `user`)
and each skill ref with its version and digest. The same agent and overlay compiled by the CLI prints the same
digest.

## 6 · Acceptance

Each criterion is planned with its ticket and names the assert layer for the test to add.

- **AC-R1/R2/R3:** a validator unit test per kind refuses a file outside the grammar and a ref that names no
  registry item (T-0160).
- **AC-R4:** the generator's `--check` exits 0 on the tree and non-zero on a hand-edited `registry.gen.ts`
  (negative control); a freshness test rides `check:scripts` (T-0160).
- **AC-R5:** a before/after test over all 16 presets (15 plus the Builder) proves each assembled prompt's digest
  unchanged by extraction (T-0160).
- **AC-R6/R7:** unit tests for a merge with no conflict, with a conflict, and with a field deleted upstream; the
  one-time migration from today's stored shape; and a seed bump that keeps a user edit (T-0161).
- **AC-R8:** per-field and per-agent reset tests, and a test that an import carries no overlay (T-0161).
- **AC-R9:** a teams single-path test: a team saved from the Teams pane and one declared by the Builder both pass
  through the `teamsResource` mutation (T-0161).
- **AC-R10:** a form-coverage test (every schema field in the form, no orphan form field); provenance and reset
  browser tests in both engines; a Builder patch rejection test for an invalid op; CLI `validate` exits 0 on the
  repo and non-zero on a seeded bad file (T-0162).
- **AC-R11/R12:** a test that Test Chat, the proxy and the CLI produce the same digest for the same agent and
  overlay, and that `bundle.system` equals `composeLiveSystemPrompt` for the same inputs (T-0163).
- **AC-R13:** a unit test on the trace writer that the line carries the digest and resolution; a debug-bundle
  test that captures are present (T-0163).
- **AC-R14:** each package's dependency list is unchanged (`package.json` diff empty of new dependencies).
- **AC-R15:** a generator test that `AGENTS.md` in the content root produces no registry row (T-0160).

## 7 · Agent verification

Every AC above asserts through Vitest (jsdom or Node) or a script selftest, judged by exit code; the ACS-R10
provenance and reset criteria are browser-layer and run under `npm run test:browser`. A reviewer grading a build
ticket against this SPEC runs that ticket's named tests and checks each cited `file:symbol`.

## 8 · Open items

1. The content root's location, decided (T-0160): `site/agent-content/`. The presets and packs were page-local
   site data, so they stay site-internal and the package DAG is untouched. Its `AGENTS.md` is the authoring guide
   (ACS-R15). Two ACS-R4 points were narrowed in the T-0160 review: the a2ui mini-skills and GenUI packs stay where
   they are and the site keeps reading them through its live raw glob (one generated copy, a2ui's `assets.gen.ts`,
   per prompt edit), and the manifests take only `seedVersion` from the registry, since `seedDigest` must keep
   pinning the assembled seed (assembly code changes included), which a Node generator cannot build. The browser
   reads a runtime projection of the registry (`registry.runtime.gen.ts`) without paths, digests or changelogs.
2. The frontmatter grammar, decided (T-0160, ACS-R3): one JSON object between `---` fences (valid YAML, parsed by
   `JSON.parse`); the a2ui prompt files keep their single-line `key: value` frontmatter.
3. The digest step, decided (T-0163, ACS-R12): `compile` returns a promise, and its synchronous core
   `compileStore` digests in one separate async step (`bundleDigest`), so the live arms stay synchronous.
4. Context loading, decided (T-0231): skills, playbooks (workflows) and resources reach the prompt as index lines
   only (ADR-0190), so an index-only entry reaches the model as its label and one-line description, and its content
   loads only when the user names it. Live round 2 (T-0225) showed the cost: the Concierge said it lacked hours its
   `property-knowledge-base` holds. T-0231 took the prompt-section escape: a preset's own facts ride its always-loaded
   "House facts" section. The standing rule (T-0285): a rule the model must follow lives in the entry's description
   or in persona text, never only in its content (agent-model reference, Capabilities). Each trace line's
   `routing.references[]` lists every entry with `load: 'index-only'` or `'full'` (T-0239, agent-closed-loop CL-R12).
5. Hidden state, decided (T-0230): state the user must trust (a secret word, a fleet) lives in the game surface's own
   data model under the reserved key `/secret` (`/secret/word`; `/secret/fleet` and `/secret/playerFleet` as `{row,
   col}` lists), committed on the opening turn and bound to no component. It is client-visible, the T-0218
   face-down hole-card precedent, and the producer and the host's checks read it
   (`packages/agent-ui/a2ui/src/catalog/hidden-state-checks.ts`, every catalog). Host-held state was rejected. The
   authoring rule is in the `a2ui-payload-authoring` skill, Common traps.
6. Overlays, decided (T-0161, ACS-R6 to ACS-R9). The overlay module is `@agent-ui/app/agent-admin-overlay`
   (`agent-overlay.ts`: `resolveOverlay`, `setOverlayKey`, `rebaseOverlay`, `diffOverlay`, `modifiedPaths`,
   `resetPath`, `createOverlayStore`), persisted as one record per preset under `agent-admin-app.<id>.overlay`
   through the roster source. The base digest is a synchronous browser-side fingerprint of the assembled seed,
   not sha256 (the browser registry carries no digests), and a changed digest at an unchanged version also
   merges, a superset of ACS-R7's "higher version": an unbumped seed text edit reaches every user who did not
   edit that field. An entry patch keeps its whole base entry, which case 5 needs to keep the user's entry. At a
   lower stored version (ACS-R7's migration) a seed entry missing from the stored list is not read as a user
   removal (a later version may have added it), so that branch records no removals and no order. T-0355
   (Kim 2026-10-17, seed digests per version): a committed history table (`site/agent-content/seed-history.ts`)
   records the store values of past seed versions, and the generator emits their field digests as
   `SEED_DIGESTS` in the runtime registry. On that migration a stored value whose digest equals the stored
   version's seed digest is untouched and takes the new seed unflagged; any other differing value is kept and
   flagged `seedChanged`. Entry lists carry no digests yet, so they stay on the flagged path. ACS-R8's
   per-op `source` landed with T-0162 (item 7). The Teams pane takes its store through `ui-agent-admin`'s
   `setTeamStore`; the page's store writes through the `teamsResource` mutations.
7. Schema forms, decided (T-0162, ACS-R8 and ACS-R10). Each kind's fields are declared once in
   `@agent-ui/app/agent-admin-content-fields` (`content-fields.ts`: `PERSONA_FIELDS`, `ENTRY_FIELDS`,
   `PACK_FIELDS`, `checkFieldValue`), an import-free module because `app` cannot import the site and the
   content validator runs under Node. A persona row names its store key, its `agent.md` key, its value type and
   its home (the pane place that edits it, or `seed`, `state` or `file`). Readers: the content validator and the
   CLI (`checkFrontmatter`), the Agent and Model settings sections (`agentConfigSchema`, the `agent` and `model`
   rows plus their layout hints), `PERSONA_STATE_KEYS` (the `state` rows, so the persona file and the Builder's
   patch vocabulary are the schema's), and the patch gate's filter 2 (`checkFieldValue`, plus a fixpoint over
   the shipped reader for `model`, the catalog, the local patterns and the bankroll). The coverage law is
   pane-wide: every pane-homed row has a control carrying `data-field`, and every `data-field` names one
   (`provenance.browser.test.ts`). Each op records its `source` (`builder` from the patch gate, `pack` from the
   library menu, `user` stored as no member, so a user op keeps its T-0161 shape); a whole-record store (an
   import, a duplicate, a blank new agent) answers one provenance from the record's `origin`. A modified place
   shows a strip with its source (`mixed` when two surfaces wrote a control's places: ops carry no time), a
   Modified or Seed changed marker, the seed value and Reset; a runtime row (the bankroll a game writes) carries
   no provenance and no strip. A writer names its source through the store's declared `setFrom` (`writeFrom`),
   and a re-write of an unchanged value keeps the prior source. On a seed-changed
   place Reset reads "Take seed" and drops the op, whose base already moved to the new seed. A seed place shows
   no strip (its `data-provenance` says seed), so an unedited pane reads as it did. A seed entry the user removed
   and a reordered list show on the list's own strip. The CLI is `scripts/agent-content.mjs`; the Builder export
   is the persona file, and `new <id> --from <file>` writes it as a seed folder, listing every value the seed
   format cannot carry (switches, the model grid's record, builtin sections other than Foundation, an entry's
   display label) instead of adding frontmatter keys for them. `compile-check` is validate plus the generator's
   freshness check until the compiler's digest leg lands (T-0163).
