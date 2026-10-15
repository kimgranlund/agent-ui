<!-- role=filer level=L1 model=sonnet effort=medium -->
## Warnings
None

## PR title
T-0003: Per-turn context budget, assembled-prompt trace and provider usage (GH #1809, #1797)

## PR body
### Summary
Each live turn now reports what it assembled and what the provider billed. A whole-prompt character budget produces a structured report (`PromptBudgetReport`) and never truncates. Prompt-section sizes and summed provider token usage land on `TurnTrace`, and `turn-end` in devtools carries the usage. Composed prompt bytes are unchanged, and `prompt-equivalence.baseline.json` is untouched. Tracks GH #1809 and the token accounting remainder of GH #1797.

Kim's decisions (2026-10-05):
- Over-budget is report-only by default. Halting is opt-in via `ProduceOptions.promptBudget.mode`.
- `ProviderEvent` gets an optional `usage` kind, one event per upstream request.
- The `TurnTrace` change gets a new ADR-0234, proposed and not self-ratified, rather than an amendment of ADR-0088.

### Changes
- **`meta-line.ts` (still zero imports):** adds `TokenUsage`, `PromptSectionId`, `PromptSection` and `PromptBudgetReport`. `TurnTrace` gains optional `prompt` and `usage`.
- **`agent-transport.ts`:** `ProviderEvent` gains a `usage` kind.
- **`system-prompt.ts`:** `buildSystemPrompt` now joins the output of the new `buildSystemPromptSections`.
- **`prompt-budget.ts` (new, exported from the barrel):** per-family ceilings, with base and derived worst cases measured at 126,563 and 127,103 chars against a 140,000 limit. It also holds `assessPromptBudget`.
- **`produce.ts`:** attaches `trace.prompt` to every turn and sums usage across rounds. In `halt` mode an over-limit prompt throws `ProduceHalt` with `PROMPT_OVER_BUDGET` before the first provider call.
- **`providers/anthropic.ts`:** adds `newUsageCollector`. `message_start` usage seeds the counts and `message_delta` usage overrides them. One `usage` event is emitted per upstream request, just before `done`.
- **Devtools:** `turn-end` becomes `{status, lines, ms, usage?}`. A `usage` rule is added in `capture/format.ts`, and the capture version stays 1.
- **Existing tests:** three stream-equality pins now compare runs with `trace.prompt` stripped. They are `a2ui-surface-toggle`, `genui-exclusive` and `produce-loop`.
- **New tests:**
  - `prompt-budget.test.ts`
  - `produce-budget-usage.test.ts`
  - `anthropic-usage.test.ts`
  - `turn-usage.test.ts`
- **Docs:**
  - ADR-0234 (proposed) and its entry in `adr-index.json`.
  - `KNOWN_GAPS` in `docs-grammar.test.ts` now lists 233 as reserved for the no-barrels lane.
  - `a2ui-live-agent` SPEC and LLD (LLD-C3, C4 and C10, plus the module tree). SPEC-R29 and R30 AC3 now read "apart from `trace.prompt` (ADR-0234)".
  - `devtools-harness.spec.md` (SPEC-R7), `record-and-replay.md`, the `a2ui-prompt-authoring` skill, `packages/agent-ui/a2ui/AGENTS.md`, an `agent-model.md` glossary entry, and a comment-only cross-reference in `selection-guidance.ts`.
  - Left unchanged because they name only consumed fields or single fields: `a2ui-chat` SPEC and LLD, `app-surfaces-m2.lld.md`, `genui-surface.spec.md`, `producer-order-and-yield.md`, `roadmap.md`, `plan.md`, root `AGENTS.md`, and ADR-0232.

### How each step was verified
Each step passed an independent verifier. Steps 1 and 3 were L2, steps 2 and 4 were L1.
- **Step 1 (a2ui sections, budget, usage sum):**
  - 39 tests in `prompt-budget.test.ts` and 8 in `produce-budget-usage.test.ts` pass, and both fail at base, so they can go red.
  - The `live-agent` and `agent` folders pass (807 tests). All of a2ui plus devtools also passes (2811 tests).
  - `tsc`, the baseline-unchanged guard and the zero-import guard on `meta-line.ts` all pass.
- **Step 2 (devtools usage):**
  - 5 tests in `turn-usage.test.ts` pass, and the usage-bearing cases (a) and (e) fail at base.
  - The devtools suite passes (82 tests), as do three site tests (22).
  - The capture version is still 1, and `DEVTOOLS_EVENT_KINDS` is unchanged.
- **Step 3 (Anthropic adapter):**
  - 7 tests in `anthropic-usage.test.ts` pass. Mutating the parse call or the `message_delta` merge makes them fail.
  - 13 adapter-dependent files pass (104 tests), and `anthropic-sse.test.ts` is unchanged.
- **Step 4 (ADR and docs scrub):**
  - ADR-0234 exists with status `proposed` and cites ADR-0073, 0088, 0146 and 0200 and GH #1809 and #1797.
  - The site docs-grammar, sitemap and adr tests pass (199 tests).
  - The baseline-unchanged guard and the em-dash guard pass.
  - `npm run check` exits 0, and `npm test` exits 0 (631 files, 12737 tests).

Not run in this change: `test:browser` and `doc_lint`. The step 4 builder's `doc_lint.py` run only printed "not a functional document" for each touched doc, so it checked nothing.

## Changelog entry
- Added: per-turn prompt budget report and prompt-section sizes on `TurnTrace.prompt` (report-only by default, opt-in halt via `ProduceOptions.promptBudget.mode`), and provider token usage on `TurnTrace.usage` and the devtools `turn-end` event. The Anthropic adapter emits one `usage` event per request. ADR-0234 (proposed) records the `TurnTrace` and provider-seam change. Composed prompt bytes are unchanged.

## Follow-ups
- fix-now: Run `doc_lint` with a working copy on the five touched `.claude/docs` files. The only copy the builder found printed "not a functional document" and checked nothing.
- fix-now: Trace two ADR-0234 claims line by line. They are that an over-budget halt fires before any provider call (`produce.ts:1025`) and that `buildSystemPrompt` stays byte-identical to `buildSystemPromptSections`. The step 4 builder wrote both from the step 1-3 code without tracing them.
- note: ADR-0234 is `proposed` and needs Kim to ratify it. The number 233 is reserved in `KNOWN_GAPS` for the no-barrels lane.
- note: `anthropic.ts` emits zeros for `inputTokens` and `outputTokens` when upstream sends a `usage` object without them. Real frames always carry `output_tokens`, so this was left as is.
- note: Steps 1 and 2 were committed as wip commit `dce7f6fe`, and the lane was rebased onto origin/main so the #1805, #1806 and #1819 prerequisites were present. Squash the wip commit when merging.
