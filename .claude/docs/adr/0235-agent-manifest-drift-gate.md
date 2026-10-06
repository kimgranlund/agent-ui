# ADR-0235 — Each agent preset has one agent manifest that pins its seed, seedVersion, catalog fragment and selection sidecar, held by a drift gate

> Source: agent-ui ADR log (this directory, the numbered files ARE the index; status lives in each ADR's own header). · 2026-10-06
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-10-06 |
> | **Proposed by** | the sdlc-lite run `persona-manifest` (GH [#1812](https://github.com/kimgranlund/agent-ui/issues/1812), epic GH [#1817](https://github.com/kimgranlund/agent-ui/issues/1817)); the digest pins were ruled by Kim on 2026-10-05 per the run handoff, which approves building the design, not this record |
> | **Ratified by** | kimgranlund (repo owner), 2026-10-06, ratified by Kim in the sdlc-lite session (run `persona-manifest`) |
> | **Repairs** | [`../spec/persona-catalog-composition.spec.md`](../spec/persona-catalog-composition.spec.md) SPEC-R7 (new, v0.4) · `packages/agent-ui/a2ui/AGENTS.md` (`## Catalogs`, one bullet) · rubric [`../rubrics/a2ui-catalog.md`](../rubrics/a2ui-catalog.md) D7 (v0.5) · [`../references/agent-model.md`](../references/agent-model.md) §3 (the `agent manifest` glossary entry) and §A (the `AgentManifest` row) · skills: `.claude/skills/a2ui-catalog-rendering-review/references/catalog-pipeline.md` (§2 and §3 rows), `.claude/skills/a2ui-multi-catalog/SKILL.md` (pattern 5), `.claude/skills/a2ui-prompt-authoring/SKILL.md` (the sidecar bullet) · code: `site/lib/agent-manifest/agent-manifest.ts` (new), `site/lib/agent-manifest/agent-manifest.test.ts` (new), `site/lib/agent-manifest/agent-manifest.write.test.ts` (new), the fifteen `site/lib/agent-manifest/<id>.manifest.json` files (new), `site/pages/agent-admin-presets.ts` (the `seedVersion` and `localPatterns` doc comments only) |
> | **Supersedes / Superseded by** | none · **Amends [ADR-0172](./0172-persona-catalog-composition-intake.md) cl.1** (a persona fragment folder gains a site-side pin; ADR-0172's body is untouched, accepted ADRs are append-only) · **Amends [ADR-0232](./0232-catalog-selection-guidance-sidecar.md) cl.4** (a persona fragment sidecar edit also moves an agent manifest digest; ADR-0232's body is untouched) · follows the "Amends ADR-0071" precedent ADR-0232 set |

## Context

An agent preset has four members that live in three places and share no pin: its config in
`AGENT_PRESETS` (`site/pages/agent-admin-presets.ts`), that preset's `seedVersion`, its persona catalog
fragment (`packages/agent-ui/a2ui/src/catalog/personas/<id>/catalog.json`, with its `manifest.ts`), and
the fragment's `selection.json` sidecar. A change to one never forced a look at the others.

GH #1812 cites the Croupier: its prompt changed (`seedVersion` 6, GH #1794) independently of its sidecar
and fragment. Reading `git log` shows that this was a missing pin, not a present mismatch. The GH #1794
commit touched only `agent-admin-presets.ts` and `agent-admin.ts`; the croupier catalog folder was last
touched by an earlier change, and today `localPatterns: 'croupier'`, the fragment's `personaId` and the
sidecar's `personaId` all agree. No existing gate moves on a persona fragment or sidecar edit: the
prompt-equivalence baseline has no persona key. The defect is structural, so the gate checks "was every
change acknowledged in one place", not only "do the members agree right now".

GH #1812 says "per-persona manifest". This record calls it an **agent manifest**, because
`agent-model.md` §3 retires "persona" as a type name or doc noun. It is a different thing from the
fragment manifest `PersonaCatalogManifest` (`catalog/personas/<id>/manifest.ts`, GH #516), which stays
untouched.

GH #1812 also asks whether the presets without a fragment need one. The promotion bar that question
turns on is GH #497's. It is restated only in the proposed note
`.claude/docs/decompositions/md-content-concierge-croupier-promotion.decomp.md:21-25` (proposed, v0.1):
a type earns catalog promotion when validation adds real value over prose teaching, and a
pure-arrangement idiom whose every part is already a validated catalog row stays prose. Neither
ADR-0172 nor the persona-catalog-composition SPEC states that bar.

## Decision

We will give every agent preset one hand-authored agent manifest that names and pins its four members,
and hold the manifests to the tree with a drift gate in the standing `npm test` run.

1. **Home and schema.** The manifests live in `site/lib/agent-manifest/`, one
   `<id>.manifest.json` per `AGENT_PRESETS` entry plus one for `fixture-demo`. The module
   `site/lib/agent-manifest/agent-manifest.ts` exports the `AgentManifest` schema:
   `id`, `preset`, `seedVersion`, `seedDigest`, `fragment` (`personaId`, `types`, `targetCatalogs`,
   `digest`, or `null`), `selection` (`digest`, or `null`), and the optional `noFragment` and `noPreset`
   declarations, each `{ why }`. The home is consumer-owned because two members live in `site/` and two
   in `@agent-ui/a2ui`, and a2ui may never import site.
2. **Pins.** Each manifest pins the preset's effective `seedVersion` (absent means 1, the value
   `presetStore` compares) and three canonical sha256 digests: `seedDigest` over
   `personaFromPreset(preset)`, `fragment.digest` over the parsed `catalog.json`, and
   `selection.digest` over the parsed `selection.json`. A digest is taken over sorted-key JSON, so a
   reformat moves nothing. Digests, not version-only pins (Kim, 2026-10-05): a version-only pin would
   let a sidecar or fragment edit red nothing, which is the gap this closes.
3. **The gate.** `site/lib/agent-manifest/agent-manifest.test.ts` runs in the `site` vitest project, so
   `npm test` carries it and no new gate command exists. It has twelve legs, each with a
   planted-defect negative control (`bites: <leg>`): `schema` (keys and value shapes), `declaration`
   (preset fields all set or all null; a non-empty `why` exactly when its member is null),
   `bijection` (each `AGENT_PRESETS` id is named by exactly one manifest), `identity` (manifest id,
   preset id, `localPatterns`, fragment `personaId`, folder name and sidecar `personaId` agree),
   `unknown-local-patterns` (a `localPatterns` that names no shipped fragment reds),
   `seed-version`, `seed-digest`, `fragment-digest`, `selection-digest`, `fragment-types` (the sorted
   `catalog.json` component keys), `target-catalogs` (the shipped manifest's resolved
   `targetCatalogs`), and `list-coherence` (`SHIPPED_PERSONA_CATALOGS`,
   `SHIPPED_PERSONA_CATALOG_MANIFESTS`, the persona folders and the manifests' fragments are one id
   set).
4. **The armed writer.** After a deliberate seed, fragment or sidecar change, run from the repo root:
   `AGENT_MANIFEST_WRITE=1 npx vitest run --project site site/lib/agent-manifest/agent-manifest.write.test.ts`.
   It rewrites digests and derived facts (`fragment.types`, `fragment.targetCatalogs`) only. It never
   creates a manifest and never touches an id, a nullness, a `why` or a `seedVersion`. A `seedVersion`
   bump stays a human decision, because the bump drops users' persisted stores for that preset. A
   plain `npm test` run skips the writer and writes nothing.
5. **No new fragment for the twelve fragmentless presets** (quant, restaurant, travel, curator,
   stylist, quizmaster, mentalist, negotiator, lexicographer, admiral, alchemist, dungeon-master).
   Every idiom type they teach is already a validated default-catalog row, so each idiom stays prose
   under the GH #497 bar as restated in
   `.claude/docs/decompositions/md-content-concierge-croupier-promotion.decomp.md:21-25`. That note is
   `proposed` (v0.1), so this clause is the ruling Kim ratifies with this ADR, not an application of
   ratified law. Each preset records the ruling in its `noFragment.why`. Any later candidate is its own
   ADR-0172 intake: ADR-0172 rules how a fragment composes, not which idiom earns one.
6. **`fixture-demo` has no preset.** It is the SPEC-N6 mechanism fragment, so its manifest sets
   `preset`, `seedVersion` and `seedDigest` to `null` and declares why through `noPreset.why`.

## Consequences

- A fragment `catalog.json` or `selection.json` edit, or any change to a preset's seed, reds
  `agent-manifest.test.ts` until the writer runs. The red forces a look at the manifest, which is
  where the `seedVersion` question gets asked.
- Library-pack coupling: some presets seed from shared library text (`resources: seedFrom(GAMES_RULES)`
  for the croupier, the pack-seeded hospitality skills), so one text edit in
  `site/pages/agent-admin-libraries.ts` moves several seed digests at once. That is correct but
  surprising. The fix is to run the writer, then decide per preset whether `seedVersion` bumps.
- A new fragment folder needs a hand-written manifest first; the writer refuses to invent one, and the
  `bijection` and `list-coherence` legs red until it exists.
- If `personaFromPreset` ever gains a nondeterministic field, the gate flaps. The seed determinism test
  in `agent-manifest.test.ts` is the tripwire.
- If the GH #1807 registry later wants the manifest inside the package, the site-side home moves. The
  schema is the stable part; the path is not.
- `PersonaCatalogManifest`, each fragment's `manifest.ts`, `selection-guidance.ts` `PERSONA_IDS` and the
  Worker fs-shim stay untouched.

## Alternatives considered

- **A manifest inside `packages/agent-ui/a2ui/src/catalog/personas/<id>/`**: rejected because the
  package would ship a consumer's `seedVersion`, and the name collides with `PersonaCatalogManifest`.
- **Extending `PersonaCatalogManifest` with `seedVersion` and `preset`**: rejected for the same
  ownership inversion; the Worker-safe fragment triple stays what it is.
- **Version-only pins, no digests**: rejected because a sidecar or fragment edit would red nothing,
  which is today's gap (Kim, 2026-10-05).
- **Forcing a `seedVersion` bump on any digest change**: rejected because a bump wipes user edits for a
  sidecar wording change; the bump stays a human decision.
- **Generating the manifest from its sources on every test run**: rejected because a generated file
  follows drift instead of catching it; only the armed writer writes.
- **Folding into the GH #1807 registry or GH #1808 asset discovery**: rejected because this is a
  hand-authored per-agent pin that a registry may later consume; it pins neither `factories.ts` nor
  controls.
- **Shipping fragments for Quant, Curator, Stylist, Maître d' and Travel Agent**: rejected because every
  idiom they teach already names default-catalog types, so the bar in
  `.claude/docs/decompositions/md-content-concierge-croupier-promotion.decomp.md:21-25` (proposed) is
  not met.
- **Byte digests of the JSON files**: rejected because a reformat would red the gate; the digest is
  taken over the parsed canonical document instead.
