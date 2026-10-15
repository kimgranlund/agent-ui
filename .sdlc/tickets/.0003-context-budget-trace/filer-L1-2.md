<!-- role=filer level=L1 model=sonnet effort=medium -->
## Warnings
None

## PR title
T-0003: Per-turn context budget, assembled-prompt trace and provider usage (GH #1809, #1797)

## PR body
### Summary
Each live turn now reports what it assembled and what the provider billed. A whole-prompt character budget yields a structured `PromptBudgetReport` and never truncates. Prompt-section sizes and summed provider token usage land on `TurnTrace`, and devtools `turn-end` carries the usage. Composed prompt bytes are unchanged and `prompt-equivalence.baseline.json` is untouched. Tracks GH #1809 and the token accounting remainder of GH #1797.

Kim's decisions (2026-10-05):
- Over-budget is report-only by default. Halting is opt-in via `ProduceOptions.promptBudget.mode`.
- `ProviderEvent` gets an optional `usage` kind, one event per upstream request.
- The `TurnTrace` change gets a new ADR-0234, proposed and not self-ratified, rather than an amendment of ADR-0088.

### Changes
- `meta-line.ts` (still zero imports): adds `TokenUsage`, `PromptSectionId`, `PromptSection` and `PromptBudgetReport`. `TurnTrace` gains optional `prompt` and `usage`.
- `agent-transport.ts`: `ProviderEvent` gains a `usage` kind.
- `system-prompt.ts`: `buildSystemPrompt` now returns the text of the new `buildSystemPromptSections`.
- `prompt-budget.ts` (new, on the barrel): per-family ceilings of 140,000 chars. Measured worst cases are 126,563 (base) and 127,103 (derived). It also holds `assessPromptBudget`.
- `produce.ts`: attaches `trace.prompt` to every turn and sums usage across rounds. In `halt` mode an over-limit prompt throws `ProduceHalt` with `PROMPT_OVER_BUDGET` before the round loop's first provider call.
- `providers/anthropic.ts`: adds `newUsageCollector`. `message_start` usage seeds the counts and `message_delta` usage overrides them. One `usage` event is emitted per upstream request, just before `done`.
- Devtools: `turn-end` becomes `{status, lines, ms, usage?}`. A `usage` rule is added in `capture/format.ts`. The capture version stays 1 and `DEVTOOLS_EVENT_KINDS` is unchanged.
- Existing tests: three stream-equality pins (`a2ui-surface-toggle`, `genui-exclusive`, `produce-loop`) now compare runs with `trace.prompt` stripped.
- New tests: `prompt-budget.test.ts`, `produce-budget-usage.test.ts`, `anthropic-usage.test.ts`, `turn-usage.test.ts`.
- Docs:
  - ADR-0234 (proposed) and its `adr-index.json` entry.
  - `KNOWN_GAPS` in `docs-grammar.test.ts` lists 233 as reserved for the no-barrels lane.
  - `a2ui-live-agent` SPEC and LLD (LLD-C3, C4, C10 and the module tree). SPEC-R29 and R30 AC3 now read "apart from `trace.prompt` (ADR-0234)".
  - `devtools-harness.spec.md` (SPEC-R7), `record-and-replay.md`, the `a2ui-prompt-authoring` skill, `packages/agent-ui/a2ui/AGENTS.md`, an `agent-model.md` glossary entry, and a comment-only cross-reference in `selection-guidance.ts`.
  - Reviewed and left unchanged: `a2ui-chat` SPEC and LLD, `app-surfaces-m2.lld.md`, `genui-surface.spec.md`, `producer-order-and-yield.md`, `roadmap.md`, `plan.md`, root `AGENTS.md`, ADR-0232.
- Loose-ends pass: the ADR now cites `produce.ts:1025` for the halt. `prompt-budget.test.ts` asserts `buildSystemPromptSections(...).text` equals `buildSystemPrompt(...)`.

### How each step was verified
Every step got an independent verifier pass. Steps 1 and 3 were L2, steps 2, 4 and 5 were L1.
- Step 1 (a2ui sections, budget, usage sum):
  - `prompt-budget.test.ts` (39 tests) and `produce-budget-usage.test.ts` (8) pass, and both fail at base.
  - The `live-agent` and `agent` folders pass (807 tests). All of a2ui plus devtools passes (2811 tests).
  - `tsc`, the baseline-unchanged guard and the zero-import guard on `meta-line.ts` pass.
- Step 2 (devtools usage):
  - `turn-usage.test.ts` passes (5 tests), and cases (a) and (e) fail at base.
  - The devtools suite passes (82 tests), as do three site tests (22).
- Step 3 (Anthropic adapter):
  - `anthropic-usage.test.ts` passes (7 tests). Removing the `usage` argument or the `message_delta` merge makes it fail.
  - 13 adapter-dependent files pass (104 tests). `anthropic-sse.test.ts` is unchanged.
- Step 4 (ADR and docs scrub):
  - ADR-0234 is `proposed` and cites ADR-0073, 0088, 0146, 0200 and GH #1809, #1797.
  - Site docs-grammar, sitemap and adr tests pass (199 tests).
  - The baseline-unchanged and em-dash guards pass.
  - `npm run check` exits 0 and `npm test` exits 0 (631 files, 12737 tests).
- Step 5 (loose ends):
  - The `produce.ts:1025` citation was read against the code. The first provider call is at line 1080, so the "before the round loop" wording holds.
  - `buildSystemPrompt` returns `buildSystemPromptSections(...)` (`system-prompt.ts:411`).
  - Both touched test files pass (47 tests). `produce-budget-usage.test.ts` test (f) already pins that the provider is never called under halt.
  - The baseline guard and `npm run check` exit 0.

Not run in this change: `test:browser` and `doc_lint`. The step 4 builder's `doc_lint.py` run printed "not a functional document" for each doc, so it checked nothing.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Changelog entry
- Added: per-turn prompt budget report and prompt-section sizes on `TurnTrace.prompt` (report-only by default, opt-in halt via `ProduceOptions.promptBudget.mode`), and provider token usage on `TurnTrace.usage` and the devtools `turn-end` event. The Anthropic adapter emits one `usage` event per upstream request. ADR-0234 (proposed) records the `TurnTrace` and provider-seam change. Composed prompt bytes are unchanged.

## Follow-ups
- fix-now: Run `doc_lint` with a working copy on the five touched `.claude/docs` files; the only copy found printed "not a functional document" and checked nothing.
- note: ADR-0234 is `proposed` and needs Kim to ratify it; 233 is reserved in `KNOWN_GAPS` for the no-barrels lane.
- note: `anthropic.ts` emits zeros for `inputTokens` and `outputTokens` when upstream sends a `usage` object without them; real frames always carry `output_tokens`, so it was left as is.
- note: Steps 1 and 2 were committed as wip commit `dce7f6fe` and the lane was rebased onto origin/main (#1805, #1806, #1819 present); squash the wip commit when merging.
