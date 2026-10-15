<!-- role=architect level=L1 model=fable effort=high -->
Verification done; writing the final design message now.

## Approach

The turn already builds its system prompt once (`produce.ts:967`) and assembles a `TurnTrace` from data flowing through the loop (`produce.ts:977`). The design adds two read-only observations to that same path and never touches the composed bytes. First, `buildSystemPrompt` becomes a thin join over a new `buildSystemPromptSections` that returns `{text, sections: PromptSection[]}`; each section's `chars` includes its own leading `\n\n## ...` separator so the sum equals `text.length`, and zero-length blocks (an absent persona, a mode with no mini-skills) are omitted rather than reported as empty. Byte identity of the refactor is already guarded by `prompt-equivalence.baseline.json` and `prompt-drift.test.ts`; nothing new is needed to prove it. A new pure module `src/agent/prompt-budget.ts` declares per-family character ceilings keyed by `catalog.catalogId` (base catalogs vs. derived `base--persona` ids, derived falling back to a wider ceiling so a new persona never reds the gate) and `assessPromptBudget(sections, limit)` returns `PromptBudgetReport {limit, total, sections, over}`. Characters are the unit; tokens come from the provider after the fact. The module stays zero-dep on purpose: `selection-guidance.ts` reads `node:fs` and sits in the `gates.test.ts` NODE_ALLOWED fence, so the budget does not live beside `SELECTION_GUIDANCE_CHAR_BUDGET`, and the Worker's `produce()` (`worker/index.ts:290`) needs no fs-shim entry. Ceiling values are measured at build time in the `selection-guidance.ts:237` MEASURED style: run the worst-case fixture matrix (blue-sky mode, k=3 largest judged exemplars, mini-skill cap, genui dogfood on, persona and authoring and mission on) and set ceiling = measured rounded up to the next 1,000 plus 10% headroom. `prompt-drift.test.ts` gains a static leg asserting that matrix stays under budget, with a negative control.

Over-budget behaviour is report-only by default: `produce()` assesses once per turn, attaches `trace.prompt`, and sets `over: true` when exceeded. Nothing is dropped, so no SPEC-N4 failure code is tallied. A `ProduceOptions.promptBudget?: {mode: 'report' | 'halt', limit?: number}` switch lets Kim flip to a hard stop: in `halt` mode an over-limit prompt throws `ProduceHalt([{code: 'PROMPT_OVER_BUDGET', path: ''}])` before the first provider call, so no tokens are spent, and both callers already route a thrown `ProduceHalt` to the GH #144 terminal error line (`dev-proxy-plugin.ts` inner try wraps the `for await`; `worker/index.ts:328`). The injectable `limit` is what makes the halt test buildable without inflating a real prompt past a measured ceiling.

Provider usage rides the ADR-0073 seam the way ADR-0146 already extended it: `ProviderEvent` gains `kind: 'usage'` with an optional `usage: TokenUsage` member. The Anthropic adapter gets a `UsageCollector` passed as a fourth optional parameter to `parseAnthropicSSE` (`ToolUseCollector` stays byte-quiet), seeded from `message_start.message.usage` and overridden latest-wins by `message_delta.usage`, which the docs state is cumulative and may itself carry input and cache fields; one `usage` event fires per upstream request at `message_stop`, so each tool-loop round reports once. `produce()` installs an always-present `onEvent` that only records usage (the progress channel is still only pushed when `emitProgress`; the `produce.ts:1020` comment is repaired), sums every usage event across self-correct rounds and tool rounds, and attaches `trace.usage` only when at least one event arrived. `TokenUsage`, `PromptSection`, `PromptBudgetReport` are defined in `meta-line.ts` because that file's law is "no imports" and the trace field types must live beside the trace; `agent-transport.ts` and `prompt-budget.ts` `import type` from it. `readMetaLine` never validates the trace's inner shape (`meta-line.ts:314, 452`), so old readers, the devtools `meta` event and existing captures are unaffected.

Devtools reads the trace it already receives: `recordTurn` latches `meta.a2uiMeta.trace?.usage` and copies it onto `turn-end` as an optional `usage`, beside `ms` where accounting belongs. `parseCapture`'s `EVENT_FIELD_RULES` checks only listed fields, so an optional-predicate rule keeps old captures parsing and `DEVTOOLS_CAPTURE_VERSION` stays 1. The harness page renders rows as `serializeDevtoolsEvent` text (`devtools-harness.ts:156`), so tokens appear with zero page change. Cost stays out: `TokenUsage` is the seam a later site-layer rate table consumes; no price enters any package. One proposed ADR (0234, never self-ratified) records the four decisions. Slicing follows one writer per file: S0 serial prep (meta-line types, ProviderEvent kind, ADR), then A (system-prompt sections, prompt-budget, produce wiring including the usage sum, drift gate, barrel export), B1 (anthropic adapter, the only slice blocked on PRs #1805/#1806), B2 (devtools events/format) in parallel, then D serial docs scrub.

## Interfaces

- `packages/agent-ui/a2ui/src/agent/meta-line.ts`: `TurnTrace` gains `prompt?: PromptBudgetReport` and `usage?: TokenUsage`; new exported types `TokenUsage {inputTokens: number; outputTokens: number; cacheReadInputTokens?: number; cacheCreationInputTokens?: number}`, `PromptSection {id: PromptSectionId; chars: number}` with the closed id union `grammar | components | functions | few-shot | mini-skills | genui | authoring | mission | persona`, `PromptBudgetReport {limit: number; total: number; sections: PromptSection[]; over: boolean}`. File keeps zero imports.
- `packages/agent-ui/a2ui/src/agent/agent-transport.ts`: `ProviderEvent.kind` adds `'usage'`; new optional member `usage?: TokenUsage` (`import type` from `./meta-line.ts`).
- `packages/agent-ui/a2ui/src/agent/prompt-budget.ts` (new, pure): `assessPromptBudget(sections: readonly PromptSection[], limit: number): PromptBudgetReport`; `promptBudgetFor(catalogId: string): number`; measured constants `PROMPT_CHAR_BUDGET_BASE`, `PROMPT_CHAR_BUDGET_DERIVED`. Exported from `src/agent/index.ts`.
- `packages/agent-ui/a2ui/src/agent/system-prompt.ts`: new `buildSystemPromptSections(...same 9 params): {text: string; sections: PromptSection[]}`; `buildSystemPrompt` returns `.text` (byte-identical).
- `packages/agent-ui/a2ui/src/agent/produce.ts`: `ProduceOptions.promptBudget?: {mode: 'report' | 'halt'; limit?: number}` (absent means report at `promptBudgetFor(catalogId)`); new failure code `PROMPT_OVER_BUDGET` on `ProduceHalt`; `traceFor` attaches `prompt` and `usage`.
- `packages/agent-ui/a2ui/src/agent/providers/anthropic.ts`: `parseAnthropicSSE(chunk, onEvent?, tools?, usage?: UsageCollector)`; exported `newUsageCollector()`; `runRound` emits one `{kind: 'usage', usage}` per upstream request.
- `packages/agent-ui/devtools/src/timeline/events.ts`: `turn-end` arm gains `usage?: TokenUsage`; `recordTurn` latches it from `meta.trace.usage`.
- `packages/agent-ui/devtools/src/capture/format.ts`: optional `usage` rule on `turn-end`; version stays 1.
- New `.claude/docs/adr/0234-*.md` (proposed). Docs touched per the manifest's D slice; scrub dispositions: `genui-surface.spec.md` (cites `failureCodes` only at :145/:429) no change, `producer-order-and-yield.md` no change, `line-framing-and-heal.md:87` (`healed` only) no change, `roadmap.md`/`plan.md` carry no #1797/#1809 entries so no change.
- Manifest: `.sdlc/0003-context-budget-trace/decompose/manifest-v1.json` (technical-architecture, plan + strict, coverage clean, quadrant load-bearing); report `.sdlc/0003-context-budget-trace/decompose/report.md`.

## Constraints and assumptions

- `readMetaLine` does not validate the trace's inner shape, so additive trace fields are wire-compatible: verified by `meta-line.ts:314, 452`.
- `parseCapture` checks only the fields listed per kind, so an optional `usage` keeps old captures parsing: verified by `format.ts:67-85, 125-127`.
- The harness page renders timeline rows as serialized JSON, so no page edit is needed for `turn-end.usage`: verified by `devtools-harness.ts:150-158`.
- `message_delta.usage` is cumulative and may carry input and cache fields; `message_start.message.usage` carries `input_tokens`, `output_tokens` and optionally the two cache fields: verified by the Anthropic streaming doc (fetched 2026-10-05, lines 302, 536, 1404, 1478).
- The system prompt is built once per turn outside the round loop: verified by `produce.ts:967`.
- `selection-guidance.ts` is Node-fenced, so the budget cannot live beside `SELECTION_GUIDANCE_CHAR_BUDGET` without a fence and fs-shim entry: verified by `selection-guidance.ts:17` and `gates.test.ts:113`.
- Both `produce()` callers route a `ProduceHalt` thrown before the first yield to the GH #144 error line: verified by `dev-proxy-plugin.ts:441-470` (the try wraps the `for await`) and `worker/index.ts:289-333`.
- No existing test pins "no `onEvent` when progress is off": verified by `grep -n onEvent produce-loop.test.ts` (only stub drivers at :58-73, :181-196).
- devtools may import `@agent-ui/a2ui/agent/meta-line` types and must not import `/providers/`: verified by `events.ts:16-20` and `devtools/src/layering.test.ts:153`.
- ADR-0233 is claimed by no-barrels and 0234 is free: verified by `.sdlc/work/no-barrels/handoff.md:40` and `grep -rn 0234 .sdlc/*/handoff.md .claude/docs/adr/` (empty).
- PRs #1805 and #1806 are still open and both edit `providers/anthropic.ts`; B1 rebases after them: verified by `gh pr view 1805/1806` (OPEN) and their file lists.
- The measured ceilings cover every live prompt shape with the fixture matrix named above: unverified (measured at build).
- Kim accepts report-only as the default over-budget behaviour: unverified (fork 2).
- Kim accepts the additive `usage` kind on the ADR-0073 provider seam: unverified (fork 4).
- Kim accepts additive `TurnTrace` fields under a new ADR rather than an ADR-0088 amendment: unverified (fork 6).

## Rejected alternatives

- Token-based budget with a bundled tokenizer: zero-dep law and the Opus 4.7 tokenizer family make any local count a guess; characters are exact and tokens arrive from the provider.
- Runtime truncation of over-budget sections: the handoff's non-goal, and it would move the byte-pinned baseline and silently change what the model sees.
- Emitting a `usage` event on both `message_start` and `message_delta` and letting `produce()` reconcile: `produce()` cannot see upstream request boundaries inside the adapter's tool loop, so it would double count; one event per request at `message_stop` keeps the sum a plain addition.
- Folding usage into `ToolUseCollector`: the collector exists only when tools are active and its diff is deliberately byte-quiet; a separate collector keeps the text-only path and existing fixtures untouched.
- Devtools reading usage only from `meta.trace` with no `turn-end` change: leaves the accounting row (`ms`) without tokens and forces every consumer (debug bundle, future cost view) to walk meta events; the latch is three lines and the vocabulary stays one.
- A new `budget` devtools event kind: `DEVTOOLS_EVENT_KINDS` is closed and SPEC-R7 forbids a second vocabulary; an optional field on an existing arm is additive and capture-compatible.
- Defining `TokenUsage` in `agent-transport.ts` and importing it into `meta-line.ts`: breaks the "no imports" law the LLD and file header pin for `meta-line.ts`.
- Budget constant beside `SELECTION_GUIDANCE_CHAR_BUDGET`: that file is Node-only; the budget must run in the Worker and in jsdom tests.
- Two slices (A, B) as the handoff sketched: `produce.ts`, `meta-line.ts` and the SPEC/LLD would have two writers; the S0/A/B1/B2/D cut removes every shared file from the parallel phase.

## Risks

- The measured ceilings are set from a fixture matrix; a live persona with a very long `personaSystem` or a genui `sourceBody` could exceed the derived ceiling, producing `over: true` on every turn. Report-only makes that visible rather than harmful; the halt switch would make it a hard failure, which is why halt stays opt-in.
- The `buildSystemPrompt` refactor must reproduce every byte in every mode and gate combination; the equivalence baseline covers the pinned shapes, and `prompt-drift` the derived ones, but a composition path neither fixture exercises (for example `a2uiEnabled: false` with genui dogfood) could drift unnoticed. The section-sum leg should run over the same matrix as the budget leg.
- PRs #1805/#1806 restructure `runRound` (deadline, retry); if a retry re-issues a request, the usage emission point must sit after the final successful walk, or a retried request double-reports. B1 must read the merged adapter before placing the emission.
- Anthropic may omit `usage` on `message_delta` for some models or send only `output_tokens`; the latest-wins merge handles both, but a provider that reports nothing yields no `usage` on the trace, which the acceptance treats as correct and consumers must not read as zero spend.
- If Kim chooses halt by default, agent-admin and the chat page will see a `ProduceHalt` with a new code; their error copy keys off the message, not the code, so nothing breaks, but the user-facing wording will be the generic one until a later ticket maps it.

## Carry forward

- Manifest `.sdlc/0003-context-budget-trace/decompose/manifest-v1.json`: technical-architecture, plan + strict, coverage clean, quadrant load-bearing; slices S0 → {A, B1, B2} → D.
- `TurnTrace` lives at `packages/agent-ui/a2ui/src/agent/meta-line.ts:84`; inner shape unvalidated at `:314` and `:452`; file has zero imports.
- `traceFor` at `produce.ts:977`, called at `:1143` and `:1238`; system prompt built once at `:967`; progress-only `onEvent` at `:1026-1047` with the comment to repair at `:1020-1021`.
- `buildSystemPrompt` composes nine blocks at `system-prompt.ts:399-427`; block builders at `:169, :191, :209, :214, :220, :234, :286, :307, :327, :433`.
- `ProviderEvent` at `agent-transport.ts:100-105`; ADR-0146 is the precedent for extending it additively.
- `parseAnthropicSSE` at `providers/anthropic.ts:107`; `message_start` handled at `:115`, `message_delta` at `:137`, `message_stop` at `:145`; `runRound` at `:306`; tool loop at `:396-456`.
- Anthropic usage shapes: `message_start.message.usage` {input_tokens, output_tokens, cache_creation_input_tokens?, cache_read_input_tokens?}; `message_delta.usage` cumulative, may carry the same input/cache fields (streaming doc fetched 2026-10-05).
- devtools: `turn-end` at `timeline/events.ts:70`, `recordTurn` at `:114-146`; capture rules at `capture/format.ts:67-85`, version at `:23`; provider-import gate at `devtools/src/layering.test.ts:153`.
- `produce()` callers, complete list from `grep -rln "produce(" packages/agent-ui/a2ui/tools/agent/`: `dev-proxy-plugin.ts:442`, `worker/index.ts:290`; both catch `ProduceHalt` and write `formatErrorLine`.
- Trace consumers outside a2ui, complete list from `grep -rn "\.trace\b"` over `site/pages site/lib packages/agent-ui/app/src packages/agent-ui/devtools/src` excluding tests: `site/pages/a2ui-live.ts:682, 922`.
- TurnTrace restatements, from `grep -rn TurnTrace` over `.claude/docs/spec .claude/docs/lld .claude/skills .claude/docs/references`: `a2ui-live-agent.spec.md:374, 1655`; `a2ui-live-agent.lld.md:84, 124, 326`; `a2ui-chat.spec.md:46, 121`; `agent-model.md` glossary entry; `genui-surface.spec.md:145, 429` and `line-framing-and-heal.md:87` cite single fields only (no change).
- SPEC-R7 turn-end text at `.claude/docs/spec/devtools-harness.spec.md:115-125`; no devtools LLD exists.
- `SELECTION_GUIDANCE_CHAR_BUDGET` at `selection-guidance.ts:239` with the MEASURED-comment style at `:230-238`; budget leg at `prompt-drift.test.ts:153-158`; `selection-guidance.ts` is NODE_ALLOWED at `gates.test.ts:113`.
- ADR-0233 is claimed (`.sdlc/work/no-barrels/handoff.md:40`); this ticket's ADR is 0234, re-check at write time.
- `handoff.md` was not edited (its sha256 is pinned in `architect-L1.attempt.json`); the "Decomposition:" line is still owed by the conductor.
