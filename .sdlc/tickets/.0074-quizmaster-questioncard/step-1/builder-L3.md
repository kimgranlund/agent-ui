<!-- role=builder level=L3 model=opus effort=high -->
## Status
blocked

## Changes
- `packages/agent-ui/a2ui/src/catalog/personas/quizmaster/catalog.json` (new): the QuestionCard row. It has the 7 bindable props and the `value` mark `{prop:'value', event:'change', readProp:'a2uiQuestionValue'}`, with no children.
- `packages/agent-ui/a2ui/src/catalog/personas/quizmaster/selection.json` (new): intents `["one quiz question with its choices"]`, notFor `[RadioGroup]`.
- `packages/agent-ui/a2ui/src/catalog/personas/quizmaster/manifest.ts` (new): `QUIZMASTER_PERSONA_ID`, targetCatalogs `['agent-ui','a2ui-basic']`.
- `packages/agent-ui/a2ui/src/catalog/personas/quizmaster/index.ts` (new): `quizmasterPersona`.
- `packages/agent-ui/a2ui/src/catalog/personas/quizmaster/factories.ts` (new): `questionCardFactory` on `ui-card`, with the WeakMap parts progress, question, options and explanation, the `a2uiQuestionValue` getter, radios reused by index at 44px min block size, `revealed` driving disable and open, and unknown props as a no-op.
- `packages/agent-ui/a2ui/src/catalog/personas/quizmaster/factories.test.ts`, `index.test.ts`, `question-card.test.ts` (new): 20 tests, every title contains QuestionCard. `question-card.test.ts` goes through the real renderer with the jsdom ElementInternals stub, using the persona-exemplars.test.ts precedent.
- `packages/agent-ui/a2ui/src/catalog/personas/index.ts`, `manifests.ts`: quizmaster added to both lists and to the rewritten header comments.
- `packages/agent-ui/a2ui/src/catalog/records.ts`: added the PERSONAS row `['quizmaster', ['agent-ui','a2ui-basic'], []]`.
- `packages/agent-ui/a2ui/tools/registry/load.ts`: added the `PERSONA_FRAGMENTS` quizmaster entry (Do 4 does not name this file; see Notes).
- `packages/agent-ui/a2ui/src/registry/registry-wiring.test.ts`: quizmaster added to the `it.each` table and the unknownTags loop, plus a QuestionCard key test and a quizmaster view test.
- `packages/agent-ui/a2ui/src/agent/asset-source.test.ts`, `packages/agent-ui/a2ui/src/registry/selection.test.ts`: `quizmaster` added to the persona lists.
- `packages/agent-ui/a2ui/src/examples/persona-exemplars.ts`: added `personaQuizmasterQuestionSeed` and `personaBasicQuizmasterQuestionSeed` (value bound to `/answer`, a submit Button), appended to the shelf, and QuestionCard named in the header.
- `site/pages/agent-admin-presets.ts`: in the quizmaster entry, seedVersion goes from 2 to 3 with the T-0074 comment head, `localPatterns: 'quizmaster',` is added, quiz-round is rewritten around QuestionCard, and surfaceStyle names QuestionCard.
- `site/lib/agent-manifest/quizmaster.manifest.json`: seedVersion 3, `noFragment` dropped, fragment and selection added, digests filled by the writer.
- Generated: `packages/agent-ui/a2ui/src/agent/assets.gen.ts`, `packages/agent-ui/a2ui/src/registry/selection-projection.gen.ts`, `site/capability-registry.json`, `site/public/capability-registry.json`.

## Checks
- `redck.py record` before the first edit: 6 controls recorded red, exit 0.
- `node scripts/generate-agent-assets.mjs`, `npm run generate:registry`, and `AGENT_MANIFEST_WRITE=1 npx vitest run --project site .../agent-manifest.write.test.ts`: all exit 0.
- Criterion 1 (catalog props, all bindable): pass.
- Criterion 2 (sidecar intent and RadioGroup notFor): pass.
- Criterion 3 (quizmaster tests `-t QuestionCard`): pass, 20 passed.
- Criterion 4 (manifest, projection, registry json): pass.
- Criterion 5 (seedVersion +1, localPatterns): pass.
- Criterion 6 (quiz-round names QuestionCard): pass.
- No-em-dash criterion: pass.
- Guard: packages vitest suite list (handoff line 26). Exit 1, 1094 passed and 6 failed:
  - `selection-guidance.test.ts`: "quizmaster: its sidecar is a bijection with the fragment and reciprocal inside it" fails with `QuestionCard -> RadioGroup has no RadioGroup -> QuestionCard edge`.
  - `selection-guidance.test.ts`: "quizmaster on a2ui-basic: the derived guidance covers every fragment type and renders" fails with `SELECTION_GUIDANCE_UNRESOLVED: notFor target "RadioGroup" is not a component of catalog "a2ui-basic--quizmaster"`.
  - `prompt-budget.test.ts`: the a2ui-basic--quizmaster default, specific and blue-sky section-sum legs and the PROMPT_CHAR_BUDGET_DERIVED leg fail with the same UNRESOLVED error.
  - `prompt-equivalence.test.ts` passed, so no baseline recapture was done.
- Guard: site vitest suite list (handoff line 27). Exit 1, 47 passed and 1 failed: `agent-admin-presets.test.ts` "the Quizmaster seedVersion bump (T-0036) > a current store keeps its edits" fails with `expected 3 to be 2`.
- Guard: `npx vitest run --project tools .../tools/registry/generate.test.ts && node scripts/generate-agent-assets.mjs --check`: pass (10 passed, --check exit 0).
- `npm run check` and `npm test`: not run, because the step is already blocked on the defects below and both are long.

## Notes
plan defect: criterion 2 (selection.json notFor must contain RadioGroup) contradicts the (guard) at handoff line 26 under Do 1 and Do 7's targetCatalogs ['agent-ui','a2ui-basic']. RadioGroup is a default-only component (a2ui-basic has ChoicePicker instead), so `renderSelectionClause` (`packages/agent-ui/a2ui/src/agent/selection-guidance.ts:237-243`) throws SELECTION_GUIDANCE_UNRESOLVED for a2ui-basic--quizmaster. That reds `selection-guidance.test.ts` and 4 legs of `prompt-budget.test.ts`. `reciprocityDefects` also flags the edge, because the persona reciprocity exemption covers only `SHARED_BASE_TYPES` = default ∩ a2ui-basic (`packages/agent-ui/a2ui/src/catalog/selection-guidance.test.ts:39-41,99`).

Facts for the replan (no choice made here):
- notFor may be empty (the cap allows 0 to 4 edges).
- A shared-base target such as Card or TextField resolves on both bases and is exempt from reciprocity.
- Adding ChoicePicker beside RadioGroup still fails on both bases.
- Targeting agent-ui alone drops the basic seed and the a2ui-basic--quizmaster id that Do 1, 5 and 7 require.
- A per-base tolerance in the resolver is a code change outside this step.

Second plan defect: criterion 5 (seedVersion 2 to 3) contradicts the (guard) at handoff line 27. `site/pages/agent-admin-presets.test.ts:270` pins `expect(persona.seedVersion).toBe(2)`. The fix is one line in a file the handoff does not name (`toBe(3)`, or reading the preset's value). I did not edit it.

Neither red is inherited: every failing title names quizmaster, a2ui-basic--quizmaster, or the quizmaster seedVersion this step changed, and none of those exist at base 3f5aebd6. So no base run was needed.

`packages/agent-ui/a2ui/tools/registry/load.ts` `PERSONA_FRAGMENTS` was touched although Do 4 does not name it. The read-first `packages/agent-ui/a2ui/AGENTS.md` requires it ("a new persona fragment updates both"), `registry-wiring.test.ts` holds it equal to `SHIPPED_PERSONA_CATALOG_MANIFESTS`, and criterion 4's projection grep cannot pass without it.

All work is left uncommitted in the tree. Criteria 1 to 6 and the no-em-dash check pass, the generated files and manifest digests are written, and the tools guard is green. HEAD equals the base sha (P1/T-0073 is not merged here), so no rebase was done. `SDLC_BASE_SHA` was unset in the shell; I exported it from `step-1/base-sha` for the criteria.
