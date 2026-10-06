# @agent-ui/a2ui

The A2UI protocol layer. Root `AGENTS.md` and `CLAUDE.md` hold the package DAG, gates and conventions; this file holds only what is local here.

## Byte-pinned prompt stack

- `src/agent/prompts/` (`src/agent/prompts/grammar.md`, the mode files, `src/agent/prompts/mini-skills/`, `src/agent/prompts/genui-packs/`) is byte-pinned by the golden baseline `src/live-agent/prompt-equivalence.baseline.json`, asserted by `src/live-agent/prompt-equivalence.test.ts`.
- The whole composed prompt has a declared character budget (`src/agent/prompt-budget.ts`, ADR-0234), gated by `src/live-agent/prompt-budget.test.ts`. Re-author tersely or re-measure deliberately; never raise the ceiling just to get green.
- After a deliberate prompt change, recapture from the repo root, then diff the baseline: `RECAPTURE_BASELINE=1 npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/recapture-baseline.test.ts`
- `src/agent/assets.gen.ts` embeds every prompt and `selection.json` sidecar; `src/agent/dogfood-fleet.gen.ts` holds the dogfood rows derived from the components descriptors. After editing a prompt, a sidecar or a components descriptor, run `node scripts/generate-agent-assets.mjs` from the repo root. `src/agent/agent-assets-freshness.test.ts` and `npm run check` stay red until you do.

## Catalogs

| Catalog | Path |
|---|---|
| default | `src/catalog/default/` |
| upstream interop (ADR-0169) | `src/catalog/a2ui-basic/` |
| personas | `src/catalog/personas/` |

- Factory modules never import controls (ADR-0233). The renderer registers the built-in catalogs with `builtinControls` (`src/catalog/controls.ts`), which defines the controls a surface needs on demand; persona entries inherit it through `composeControlLoaders`. A factory that mints another tag inside its control names it in `uses`, and a sub-element tag needs its family's descriptor to list it in `defines:` (generated into `registry.gen.ts`, which `controls.ts` folds into alias records; never hand-listed here); the gate is `src/renderer/builtin-controls.test.ts`.
- Catalog content is hand-curated, never generated (ADR-0173 cl.5). The agreement gate `src/catalog/default/descriptor-agreement.test.ts` checks each row against its component descriptor.
- Each catalog has a `selection.json` sidecar (per-type `intents` and `notFor`, ADR-0232) loaded by `src/agent/selection-guidance.ts` and rendered on the prompt inventory line. A new emittable type needs an entry or `src/catalog/selection-guidance.test.ts` fails; an edit moves the byte-pinned baseline, so recapture it deliberately. `npm run eval:agent-behavior` (`tools/agent-eval/`) derives one case per `notFor` edge from these sidecars through `selectionGuidanceFor`.
- Each fragment folder under `src/catalog/personas/` is pinned by its agent manifest in `site/lib/agent-manifest/` (ADR-0235). An edit to a fragment's `catalog.json` or `selection.json` reds `site/lib/agent-manifest/agent-manifest.test.ts` until the writer runs from the repo root: `AGENT_MANIFEST_WRITE=1 npx vitest run --project site site/lib/agent-manifest/agent-manifest.write.test.ts`. A new fragment folder needs a hand-written manifest first.
- The capability registry (ADR-0237) is a derived index over the catalogs, sidecars, personas, mini-skills, packs, corpus shards and the component descriptors, never a source. The pure model is `src/registry/` (`./registry` subpath, no `node:*`, no import from `src/agent/`); the Node loader and CLI are `tools/registry/`. `site/capability-registry.json` (and its `site/public/` twin) is generated: after a descriptor, catalog, sidecar, persona, mini-skill, pack or corpus edit run `npm run generate:registry`, or `tools/registry/generate.test.ts` fails and names it. The loader's persona list is hard-coded and held equal to `SHIPPED_PERSONA_CATALOG_MANIFESTS` by `src/registry/registry-wiring.test.ts`, so a new persona fragment updates both. The registry never moves a prompt byte, and a derived catalog still retrieves none of its base's mini-skills or exemplars (ADR-0172 SPEC-R6).

## Boundaries

- Trust boundary: provider keys stay server-side behind the dev-proxy mount `/__a2ui/agent` (`tools/agent/dev-proxy-plugin.ts`, ADR-0073 clause 5). No key, provider adapter or `produce()` import may enter `@agent-ui/devtools` (ADR-0200). `scripts/e2e-admin` answers `/__a2ui/agent` from fixtures through Playwright routes and adds no key path (local only, no CI job).
- Node-only fence: no module under `src/agent/` imports `node:*`; its prompt, sidecar and dogfood assets come from the build-time embed (ADR-0236), gated by the NODE-FENCE leg of `src/agent/gates.test.ts`.

## Wire and validator spine

- Wire types `src/protocol.ts`; validator `src/renderer/validate.ts`.
- The validator judges structure only. A persona may declare `semanticChecks` on its `PersonaCatalogManifest` (contract `src/catalog/semantic-check.ts`, ADR-0238); `produce()` runs them after the validator and feeds a finding into the repair round, shipping tallied at the round bound. Both hosts resolve them for the selected catalog through `semanticChecksDeps` (`tools/agent/chat-validation.ts`). The Croupier's hand check is `src/catalog/personas/croupier/checks.ts`.
- SPEC `.claude/docs/spec/a2ui-runtime.spec.md`, `.claude/docs/spec/a2ui-message-lifecycle.spec.md`; LLD `.claude/docs/lld/a2ui-renderer.lld.md`, `.claude/docs/lld/a2ui-validator-finalize.lld.md`. The full set is `.claude/docs/spec/a2ui-*` and `.claude/docs/lld/a2ui-*`.

## Test kit

- `tools/testkit/` holds the keyless A2UI test kit (T-0011): the scenario format, scripted transport, provider, MCP server and tools, the mount and interaction loop, the catalog-generated matrix, seeded defects under `tools/testkit/__seeded__/<layer>/` (pinned) and fuzz. Its vitest legs live in `src/testkit/`, because the browser shard only globs `src/**`.
- Commands: `npm run test:a2ui-kit`, `npm run test:a2ui-kit:browser`, and `node --experimental-strip-types packages/agent-ui/a2ui/tools/testkit/kit.ts selftest|run <file>|list`. The format, every finding code and the pin procedure: `tools/testkit/README.md`.
- A new catalog type gets a generated matrix cell with no hand file; it reds `src/testkit/matrix.test.ts` until it can be derived, validated and mounted.

## Skills

| Task | Skill |
|---|---|
| Renderer, catalog, validator, protocol code | `a2ui-build` |
| Compose or debug a payload | `a2ui-payload-authoring` |
| Prompt stack and baseline recapture | `a2ui-prompt-authoring` |
| Add or compose a catalog | `a2ui-multi-catalog` |
| Corpus seeds and admission | `a2ui-corpus-curation` |
