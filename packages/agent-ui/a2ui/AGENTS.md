# @agent-ui/a2ui

The A2UI protocol layer. Root `AGENTS.md` and `CLAUDE.md` hold the package DAG, gates and conventions; this file holds only what is local here.

## Byte-pinned prompt stack

- `src/agent/prompts/` (`src/agent/prompts/grammar.md`, the mode files, `src/agent/prompts/mini-skills/`, `src/agent/prompts/genui-packs/`) is byte-pinned by the golden baseline `src/live-agent/prompt-equivalence.baseline.json`, asserted by `src/live-agent/prompt-equivalence.test.ts`.
- After a deliberate prompt change, recapture from the repo root, then diff the baseline: `RECAPTURE_BASELINE=1 npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/recapture-baseline.test.ts`

## Catalogs

| Catalog | Path |
|---|---|
| default | `src/catalog/default/` |
| upstream interop (ADR-0169) | `src/catalog/a2ui-basic/` |
| personas | `src/catalog/personas/` |

- Catalog content is hand-curated, never generated (ADR-0173 cl.5). The agreement gate `src/catalog/default/descriptor-agreement.test.ts` checks each row against its component descriptor.
- Each catalog has a `selection.json` sidecar (per-type `intents` and `notFor`, ADR-0232) loaded by `src/agent/selection-guidance.ts` and rendered on the prompt inventory line. A new emittable type needs an entry or `src/catalog/selection-guidance.test.ts` fails; an edit moves the byte-pinned baseline, so recapture it deliberately.

## Boundaries

- Trust boundary: provider keys stay server-side behind the dev-proxy mount `/__a2ui/agent` (`tools/agent/dev-proxy-plugin.ts`, ADR-0073 clause 5). No key, provider adapter or `produce()` import may enter `@agent-ui/devtools` (ADR-0200).
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
