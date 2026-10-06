# @agent-ui/a2ui

The A2UI protocol layer. Root `AGENTS.md` and `CLAUDE.md` hold the package DAG, gates and conventions; this file holds only what is local here.

## Byte-pinned prompt stack

- `src/agent/prompts/` (`src/agent/prompts/grammar.md`, the mode files, `src/agent/prompts/mini-skills/`, `src/agent/prompts/genui-packs/`) is byte-pinned by the golden baseline `src/live-agent/prompt-equivalence.baseline.json`, asserted by `src/live-agent/prompt-equivalence.test.ts`.
- The whole composed prompt has a declared character budget (`src/agent/prompt-budget.ts`, ADR-0234), gated by `src/live-agent/prompt-budget.test.ts`. Re-author tersely or re-measure deliberately; never raise the ceiling just to get green.
- After a deliberate prompt change, recapture from the repo root, then diff the baseline: `RECAPTURE_BASELINE=1 npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/recapture-baseline.test.ts`

## Catalogs

| Catalog | Path |
|---|---|
| default | `src/catalog/default/` |
| upstream interop (ADR-0169) | `src/catalog/a2ui-basic/` |
| personas | `src/catalog/personas/` |

- Factory modules never import controls (ADR-0233). The renderer registers the built-in catalogs with `builtinControls` (`src/catalog/controls.ts`), which defines the controls a surface needs on demand; persona entries inherit it through `composeControlLoaders`. A factory that mints another tag inside its control names it in `uses`, and a sub-element tag needs an alias in `controls.ts`; the gate is `src/renderer/builtin-controls.test.ts`.
- Catalog content is hand-curated, never generated (ADR-0173 cl.5). The agreement gate `src/catalog/default/descriptor-agreement.test.ts` checks each row against its component descriptor.
- Each catalog has a `selection.json` sidecar (per-type `intents` and `notFor`, ADR-0232) loaded by `src/agent/selection-guidance.ts` and rendered on the prompt inventory line. A new emittable type needs an entry or `src/catalog/selection-guidance.test.ts` fails; an edit moves the byte-pinned baseline, so recapture it deliberately. `npm run eval:agent-behavior` (`tools/agent-eval/`) derives one case per `notFor` edge from these sidecars through `selectionGuidanceFor`.
- Each fragment folder under `src/catalog/personas/` is pinned by its agent manifest in `site/lib/agent-manifest/` (ADR-0235). An edit to a fragment's `catalog.json` or `selection.json` reds `site/lib/agent-manifest/agent-manifest.test.ts` until the writer runs from the repo root: `AGENT_MANIFEST_WRITE=1 npx vitest run --project site site/lib/agent-manifest/agent-manifest.write.test.ts`. A new fragment folder needs a hand-written manifest first.
- The capability registry (ADR-0237) is a derived index over the catalogs, sidecars, personas, mini-skills, packs, corpus shards and the component descriptors, never a source. The pure model is `src/registry/` (`./registry` subpath, no `node:*`, no import from `src/agent/`); the Node loader and CLI are `tools/registry/`. `site/capability-registry.json` (and its `site/public/` twin) is generated: after a descriptor, catalog, sidecar, persona, mini-skill, pack or corpus edit run `npm run generate:registry`, or `tools/registry/generate.test.ts` fails and names it. The loader's persona list is hard-coded and held equal to `SHIPPED_PERSONA_CATALOG_MANIFESTS` by `src/registry/registry-wiring.test.ts`, so a new persona fragment updates both. The registry never moves a prompt byte, and a derived catalog still retrieves none of its base's mini-skills or exemplars (ADR-0172 SPEC-R6).

## Boundaries

- Trust boundary: provider keys stay server-side behind the dev-proxy mount `/__a2ui/agent` (`tools/agent/dev-proxy-plugin.ts`, ADR-0073 clause 5). No key, provider adapter or `produce()` import may enter `@agent-ui/devtools` (ADR-0200). `scripts/e2e-admin` answers `/__a2ui/agent` from fixtures through Playwright routes and adds no key path (local only, no CI job).
- Node-only fence: under `src/agent/`, only the modules in `NODE_ALLOWED` (`src/agent/gates.test.ts`) may import `node:*` (ADR-0137 clause 4).

## Wire and validator spine

- Wire types `src/protocol.ts`; validator `src/renderer/validate.ts`.
- SPEC `.claude/docs/spec/a2ui-runtime.spec.md`, `.claude/docs/spec/a2ui-message-lifecycle.spec.md`; LLD `.claude/docs/lld/a2ui-renderer.lld.md`, `.claude/docs/lld/a2ui-validator-finalize.lld.md`. The full set is `.claude/docs/spec/a2ui-*` and `.claude/docs/lld/a2ui-*`.

## Skills

| Task | Skill |
|---|---|
| Renderer, catalog, validator, protocol code | `a2ui-build` |
| Compose or debug a payload | `a2ui-payload-authoring` |
| Prompt stack and baseline recapture | `a2ui-prompt-authoring` |
| Add or compose a catalog | `a2ui-multi-catalog` |
| Corpus seeds and admission | `a2ui-corpus-curation` |
