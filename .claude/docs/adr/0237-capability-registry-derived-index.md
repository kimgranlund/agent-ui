# ADR-0237 — The capability registry is a derived index in @agent-ui/a2ui, composed from objects hosts already hold and projected to one committed file

> Source: agent-ui ADR log (this directory, the numbered files ARE the index; status lives in each ADR's own header). · 2026-10-06
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-10-06 |
> | **Proposed by** | the sdlc-lite run `persona-registry` (T-0013, tracking issue GH [#1807](https://github.com/kimgranlund/agent-ui/issues/1807), epic GH [#1817](https://github.com/kimgranlund/agent-ui/issues/1817)); Kim ruled the two forks on 2026-10-05, the build is the proposal |
> | **Ratified by** | kimgranlund (repo owner), 2026-10-06, ratified by Kim in the sdlc-lite session (AskUserQuestion) |
> | **Repairs** | [`../references/agent-model.md`](../references/agent-model.md) §3 glossary ("capability registry") · `packages/agent-ui/a2ui/AGENTS.md` (the Catalogs section) · skills `a2ui-multi-catalog` (pattern 5) and `a2ui-prompt-authoring` (the sidecar and exemplar scope note) · code: `packages/agent-ui/a2ui/src/registry/` (new), `src/catalog/default/exclusions.ts` (new), `tools/registry/` (new), `site/capability-registry.json` and its `site/public/` twin (generated), `site/pages/capability-registry.*`, `site/lib/capability-registry.*`, `vitest.config.ts` |
> | **Supersedes / Superseded by** | none · relates [ADR-0071](./0071-a2ui-derived-drift-gated-system-prompt.md) (the derived inventory this registry indexes but does not change) · relates [ADR-0087](./0087-a2ui-whole-fleet-catalog-scope-policy.md) (the include-or-exclude partition the registry reports) · relates [ADR-0172](./0172-persona-catalog-composition-intake.md) (`SPEC-R6`'s exact `catalogId` filter stands, no amendment) · relates [ADR-0173](./0173-descriptor-inversion-generation-intake.md) cl.5 (catalog content stays hand-curated) · relates [ADR-0232](./0232-catalog-selection-guidance-sidecar.md) (the sidecars the registry reads) · relates [ADR-0233](./0233-per-control-entries-and-generated-control-registry.md) (the components registry the registry joins) · relates [ADR-0234](./0234-turn-trace-prompt-budget-and-token-usage.md) (the prompt budget, unchanged) |

## Context

Inventory is scattered across five places that each derive from one owning source and each gate in place:
descriptors drive the site and llms-full, `catalog.json` drives the prompt inventory and the renderer,
`selection.json` drives the selection clause, mini-skills and genui packs glob their own directories, and the
persona fragments compose into derived `<base>--<persona>` catalogs at registration time. What nothing held was
the join. No artifact related a catalog type to the control it renders, a preset to the fragment it selects, a
mini-skill or corpus record to a catalog that exists, or a persona to what its turn can actually use. Those
joins failed silently: `resolveEffectiveCatalogId` falls back to the base id when a preset's `localPatterns`
names no registered fragment, and catalog exclusion had two truths (a test-local `EXCLUSION_ALLOWLIST` and a
`catalog: excluded` descriptor line). GH #1807 asks for one queryable index per persona.

Components may never import a2ui (`layering.test.ts`), so the join cannot live in the framework package.

## Decision

We will add a capability registry as a derived index inside `@agent-ui/a2ui`.

1. **A derived index, never a source.** The registry indexes. It never generates a catalog row, a sidecar
   entry or a descriptor field (ADR-0173 cl.5 stands). Every row records where its fact lives (`source`), the one
   decided `status` with the recorded reason where a source recorded one, and which surfaces read it
   (`consumers`).
2. **A pure, opt-in `./registry` subpath.** `src/registry/` holds the row model, `composeRegistry`,
   `registryViewFor`, `selectCapabilities` and the one tag rule. It imports no `node:*` and nothing from
   `src/agent/` (`gates.test.ts` leg 5 scans type imports too, so the selection-guidance shape is declared
   structurally). The root barrel re-exports nothing from it, so a renderer-only consumer carries zero registry bytes.
3. **Two source tiers.** The runtime tier composes from objects every host already holds (the registered
   catalogs, the persona fragments with their targets, the selection guidance, the mini-skill registry), so the
   Worker needs no new asset. The build tier adds what only disk knows (descriptors, the components registry,
   genui packs, corpus shards, the exclusion allowlist) and is optional.
4. **One tag rule.** A default-catalog type renders `ui-` plus its kebab-case, with three named exceptions
   (`AudioPlayer` is `ui-audio`; `Option` and `MenuItem` have no `ui-*` tag). A new exception edits the rule,
   never a per-type alias. A persona type often composes existing controls (`BookingForm` renders
   `ui-form-provider`), and `a2ui-basic` types are upstream vocabulary, so the rule does not govern them: a
   persona type carries a tag only when the rule's tag is a fleet control in the sources (`PlayingCard`), and an
   `a2ui-basic` type carries none. A parity gate holds the rule equal to every default `WidgetFactory.tag` and
   every tagged persona type equal to its factory.
5. **Views resolve a catalog id.** `registryViewFor` splits the id on the first `--`. A base id is that
   catalog's rows. A derived id is the base's rows plus the persona fragment's when the persona is known and
   targets the base. An unknown persona half is the base view, and an unknown base half is empty. The view's
   `retrievable` rows are those scoped to exactly the id, so the ruled `SPEC-R6` exact filter shows through
   unchanged: a derived id retrieves none of its base's mini-skills or shards.
6. **One committed projection.** `npm run generate:registry` writes `site/capability-registry.json` and the
   `site/public/` twin (the sitemap two-copy vehicle, no timestamps, sorted rows). The browser site cannot read
   the Node-only sidecars and mini-skills, so the projection is the one queryable artifact. Its tax is a
   regeneration on every descriptor, catalog, sidecar, mini-skill, pack or corpus edit, the same tax the sitemap
   and llms-full carry. `tools/registry/generate.test.ts` regenerates in memory through the same loader and
   serializer and names the command when a copy is stale.
7. **Wiring gates over the joins.** Tag parity, the fleet join to the components registry, scope (every mini-skill
   and corpus shard names a registered catalog id), exclusion single-source, the shipped-persona list, and a
   preset `localPatterns` leg in `site/lib/capability-registry.test.ts`, each with a negative control.
8. **One exclusion allowlist.** `EXCLUSION_ALLOWLIST` moves verbatim from `default/index.test.ts` to
   `catalog/default/exclusions.ts`; the coverage gate and the loader import it.
9. **The site renders it.** `site/capability-registry.html` shows one catalog id's view, joining the site's own
   `TIER_OF` and `NESTED_ONLY` page-side, since a2ui cannot import them.

### Not decided here

- **Per-turn prompt-inventory pruning.** Deferred by Kim (2026-10-05) until T-0003's section trace and T-0005's
  selection evals exist. No prompt byte moves: `prompt-equivalence.baseline.json` is unchanged.
- **Widening base mini-skill and exemplar retrieval for derived catalogs.** Ruled NO by Kim (2026-10-05). The
  `SPEC-R6` exact `catalogId` filter stands, there is no amendment, and `retrievalScopeFor` is not shipped.
- **Persona and preset rows.** `agent-admin-presets.ts` imports `@agent-ui/app` and cannot load under plain Node,
  and a persona `manifest.ts` cannot either (`ERR_IMPORT_ATTRIBUTE_MISSING`). The loader hard-codes the persona
  list and targets (the `selection-guidance.ts` precedent), held equal to `SHIPPED_PERSONA_CATALOG_MANIFESTS` by a
  gate. A plain-Node-loadable persona manifest (T-0012, GH #1812) replaces that list and adds the `persona` kind.
- **Skills, agents and the ADR index as rows.** They are dev harness, not shipped, and nothing at runtime reads them.
- **A `prompt-asset` kind.** `fs-shim.test.ts` already holds the embedded asset set equal to disk; a registry row
  would add no gate. The asset-embed ticket (GH #1808) may add the kind if its discovery reads the registry.

## Consequences

- A preset naming a retired persona, a mini-skill or shard naming an unregistered catalog, a control no catalog
  renders and no allowlist excuses, and a tag the rule and a factory disagree on all red a gate instead of
  degrading silently.
- T-0005's per-persona eval leg can read `registryViewFor(derivedId)` (the `notFor` edges and the persona-only
  types) instead of re-reading the sidecars. T-0008's `catalogTypeForTag` should import `typeForTag` rather than
  keep a second copy of the rule; `default/index.test.ts` already does.
- The projection changes whenever a descriptor, catalog, sidecar, mini-skill, pack or corpus file changes. A
  contributor who forgets `npm run generate:registry` is told by name.
- ADR numbers 0235 and 0236 are reserved in flight by the T-0012 and T-0014 lanes; this ADR numbered past them and
  `docs-grammar.test.ts` S8 lists them as known gaps until they land.

## Alternatives considered

- **One registry inside `@agent-ui/components` spanning descriptors and catalogs**, rejected because layering
  forbids components knowing a2ui.
- **Generating catalog rows or sidecar entries from the registry**, rejected because ADR-0173 cl.5 rules catalog
  content hand-curated; the registry indexes only.
- **A Node loader under `src/agent/` with a Worker shim entry**, rejected because no runtime consumer needs
  descriptor-derived fields; the Worker composes the runtime tier from objects it already holds, so a sixth
  `NODE_ALLOWED` entry and a new shim `FILES` key buy nothing.
- **Reading `agent-admin-presets.ts` textually for persona rows**, rejected as a brittle pattern match over site
  TypeScript; the preset leg imports the presets module directly in the site test project.
- **A per-persona generated file beside each fragment**, rejected as a fifth persona file; runtime composition
  plus the committed projection replace it.
- **Pruning the prompt inventory per turn in this change**, rejected for now because it moves the byte-pinned
  baselines per query and cannot be judged before the section trace and selection evals exist.
- **A descriptor-side `intents` or `notFor` field**, rejected by ADR-0232; two sources that drift.
- **Keeping `EXCLUSION_ALLOWLIST` test-local and re-deriving exclusion in the loader**, rejected as a second
  derivation of the same truth (the GH #346 root cause).
- **Applying the pure tag rule to every catalog and persona factory**, rejected after measuring: three persona
  types are compositions and `a2ui-basic` is upstream vocabulary, so the rule over-claims there.
