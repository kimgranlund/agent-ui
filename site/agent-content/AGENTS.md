# Agent content

The seed content of the agent-admin app: every shipped persona (the roster presets and the Builder), every capability entry they seed, and every library pack the add-from-library menu offers. The contract is `.claude/docs/spec/agent-content.spec.md` (ACS-R1 to ACS-R5, ACS-R15).

This file is authoring context for a person or an agent editing the files here. The generator never indexes it and nothing loads it at runtime.

## Layout

| Path | Kind | Holds |
|---|---|---|
| `personas/<id>/agent.md` | persona | Frontmatter: the persona's settings and its capability refs. Body: the foundation prompt, then `## Surface style`, then an optional `## House facts`. |
| `personas/<id>/<kind dir>/<entry>/<FILE>` | skill, workflow, resource, tool | An entry only this persona seeds. |
| `skills/<id>/SKILL.md`, `workflows/<id>/WORKFLOW.md`, `resources/<id>/RESOURCE.md`, `tools/<id>/TOOL.md` | skill, workflow, resource, tool | A library entry: a pack offers it and any persona may reference it. |
| `packs/<id>/pack.json` | pack | Refs only, never copies. |
| `schema.ts` | | The types, the frontmatter parser and the validator. |
| `registry.gen.ts` | | Generated: the full records, for Node and tests. Never edit it by hand. |
| `registry.runtime.gen.ts` | | Generated: the browser projection (no path, digest, changelog or notes). Never edit it by hand. |
| `registry.ts` | | The typed lookups every runtime reader uses (over the projection). |
| `digest.ts` | | The one sha256 helper (Node-side). |

The a2ui mini-skills and GenUI packs are not content files here: the agent-admin library reads them where they live (`packages/agent-ui/a2ui/src/agent/prompts/mini-skills/*.md` and `genui-packs/*.md`) through a raw glob, so a prompt edit has one generated copy (a2ui's `assets.gen.ts`). Edit those through the `a2ui-prompt-authoring` skill; they are byte-pinned. The `a2ui-idioms` pack is `"derived": "mini-skill"`. Dotfiles here are ignored.

## Frontmatter

Frontmatter is one JSON object between `---` fences. JSON is valid YAML, so a `SKILL.md` stays an Agent Skills file, and it parses with no YAML library. The validator refuses an unknown key, a wrong type and a carriage return, each with a named reason.

A persona (`agent.md`):

- `id` (the folder name), `version` (the seed version; 1 seeds no `seedVersion`), `order` (roster position) or `"roster": false`, `label`, `tagline`, optional `category` (`hospitality` or `games`).
- `name`, `model`, `toolsEnabled`, and the optional model settings `effort`, `thinking`, `showReasoning`, `maxTokens`, `cacheTtl`.
- Optional `localPatterns` (the persona catalog fragment), `domains`, `bankroll` (true only), `disabledBuiltins`.
- `skills`, `workflows`, `resources`, `tools`: lists of refs, in seed order.
- Optional `changelog` (one line per version, newest first, `<version>: <reason>`) and `notes`. Both are authoring context and never reach a seed.

An entry: `name` and `id` (both the folder name), `description` (one line, at most 1024 characters), `version`, `kind`, `availability` (`context`, or `invocable` for a persona-local entry only), `label`. The body is the entry's content.

A pack: `id`, `version`, `kind`, `order` (position among packs of its kind), `label`, `description`, optional `category` (offered only to presets of that category), optional `rejectOnCollision`, and either `entries` (refs) or `"derived": "mini-skill"`.

## Refs

A ref is `<id>@<version>`. `./<id>@<version>` names an entry under the persona's own folder; a bare ref names a library entry. A ref that names no entry at that version fails the validator.

## Naming

- Folder names are lowercase and hyphenated, and equal the `id` (and the `name`) inside.
- An entry's `id` is the store entry id. A library entry whose `label` differs from its `id` (the Integrations trio) keeps that `id` as its external key.
- A library entry belongs to at least one pack. An entry only one persona uses lives under that persona.

## Add a persona

1. Create `personas/<id>/agent.md` with the frontmatter above, the foundation as the body, and a `## Surface style` section.
2. Reference library entries by ref, and put any entry of its own under `personas/<id>/`.
3. Give it the next `order`.
4. Run the generator, then add its `site/lib/agent-manifest/<id>.manifest.json` (the drift gate reds until it exists).

## Add a skill (or workflow, resource, tool)

1. For a library entry, create `skills/<id>/SKILL.md` and add `<id>@1` to a pack's `entries`. For one persona's entry, create it under `personas/<persona>/skills/<id>/` and add `./<id>@1` to that persona's `skills`.
2. Run the generator.

## Change seed text

Edit the file and run the generator. A user's edits are an overlay over the seed (T-0161), so a seed change never drops them: on the next load every field the user did not edit takes the new text, an edited field keeps the user's value, and a field both changed keeps the user's value flagged `seedChanged`. That merge runs on any seed change, bumped or not. Bump the persona's `version` when the change is a new seed release, and add a `changelog` line saying why. The generator copies `version` into the manifest's `seedVersion`. The manifest's `seedDigest` pins the assembled seed (so a change to the assembly code reds it too): refresh it with the armed writer, `AGENT_MANIFEST_WRITE=1 npx vitest run --project site site/lib/agent-manifest/agent-manifest.write.test.ts`. `site/pages/agent-admin-seed-digests.test.ts` pins every assembled seed and needs its row updated for a deliberate change.

## Validate and generate

```
node scripts/generate-agent-content.mjs           # validate, then write both registries and the manifests' seedVersion
node scripts/generate-agent-content.mjs --check   # validate and write nothing; exit 1 on a problem or stale output
```

`--check` rides `npm run check` (`check:scripts`), and `registry-freshness.test.ts` holds the same equality in the site tests.
