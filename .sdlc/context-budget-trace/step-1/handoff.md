## Task goal
Make each turn report what it assembled and what the provider billed: a declared whole-prompt budget with a structured over-budget result (never silent truncation), prompt-section sizes on `TurnTrace`, and token usage from the provider on the trace and the devtools timeline. Tracks GH #1809 and the token accounting remainder of GH #1797.

## Step 1: Prompt sections, budget report, halt switch and usage sum in @agent-ui/a2ui
level: L3
### Read first
- `packages/agent-ui/a2ui/AGENTS.md`
### Do
Depends on: none. This step covers slices S0 (types and seam) and A from `.sdlc/context-budget-trace/architect-L1.md`. Read its Interfaces section and its Carry forward line refs; they are not repeated here.

**Replan state.** The blocked attempt's work for items 1 to 6, 8 and 9 is in the tree. Its `## Changes` in `.sdlc/context-budget-trace/step-1.superseded-1/builder-L3.md` lists it, and its Notes give the measured ceilings: base worst case 126,563 chars, derived worst case 127,103 chars, both 140,000. Keep that work and check it against the items below; do not rewrite it. The open work is item 7: three existing stream-equality pins compare two `produce()` runs that differ only in a prompt-composition gate, and those runs now differ in `trace.prompt`. `prompt` stays always attached (handoff `## Plan review`).

1. **`packages/agent-ui/a2ui/src/agent/meta-line.ts`.** Keep zero imports (SPEC-N5, the header at :75). Add these exported types:
   - `TokenUsage {inputTokens: number; outputTokens: number; cacheReadInputTokens?: number; cacheCreationInputTokens?: number}`.
   - `export type PromptSectionId = 'grammar' | 'components' | 'functions' | 'few-shot' | 'mini-skills' | 'genui' | 'authoring' | 'mission' | 'persona'`.
   - `PromptSection {id: PromptSectionId; chars: number}`.
   - `PromptBudgetReport {limit: number; total: number; sections: PromptSection[]; over: boolean}`.

   `TurnTrace` (:84) gains `prompt?: PromptBudgetReport` and `usage?: TokenUsage`. Add one header paragraph citing ADR-0234 (proposed). `readMetaLine` stays unchanged: it never validates the trace's inner shape (:314, :452). Add one case to `src/live-agent/meta-line.test.ts`: a trace carrying `prompt` and `usage` round-trips.
2. **`agent-transport.ts`.** `ProviderEvent.kind` (:101) adds `'usage'`. Add the member `usage?: TokenUsage` via `import type { TokenUsage } from './meta-line.ts'`. ADR-0146 is the additive precedent.
3. **`system-prompt.ts`.** Add the exported `buildSystemPromptSections(...the same 9 params as buildSystemPrompt): {text: string; sections: PromptSection[]}`. `buildSystemPrompt` (:399) returns its `.text`, byte-identical. Sections, in composition order (:411-426):
   - `grammar` = `grammarFor(mode)`.
   - `components` = the `\n\n## Available components (...)\n\n` header + `catalogIdTeaching` + `catalogInventory`.
   - `functions` = the `\n\n## Available functions\n\n` header + `functionsInventory`.
   - `few-shot` = `fewShot`.
   - `mini-skills` = `miniSkillsBlock(miniSkillsFor(...))`.
   - `genui` = `genuiBlock`.
   - `authoring` = `authoringBlock`.
   - `mission` = `missionBlock`.
   - `persona` = `personaBlock`.

   `chars` is the length of that substring. Zero-length sections are omitted. The sum equals `text.length`.
4. **New `src/agent/prompt-budget.ts`.** Pure, with only `import type` from `./meta-line.ts`, no `node:*`, and no `NODE_ALLOWED` entry (`gates.test.ts:113`).
   - Exports: `PROMPT_CHAR_BUDGET_BASE`, `PROMPT_CHAR_BUDGET_DERIVED`, `promptBudgetFor(catalogId)` and `assessPromptBudget(sections, limit)`.
   - `promptBudgetFor(catalogId)` returns DERIVED when `catalogId.includes('--')` (the `<base>--<persona>` convention, `src/catalog/compose.ts:89`), else BASE.
   - `assessPromptBudget(sections, limit)` returns `{limit, total: sum of chars, sections: fresh copies of the input entries, over: total > limit}` and never mutates its input.
   - Add `export * from './prompt-budget.ts'` to `src/agent/index.ts`.
5. **Ceiling values.** Measure them with the worst-case matrix below.
   - Matrix inputs:
     - the max over modes `default`, `specific` and `blue-sky`;
     - k=3 exemplars: the three records of `packages/agent-ui/a2ui/corpus/exemplar/v1_0/agent-ui.jsonl` with the largest single-record `buildSystemPrompt(catalog, [record])` length;
     - mini-skills: the `DEFAULT_MINI_SKILL_CAP` (3) largest `MINI_SKILLS` bodies whose `catalogId` matches the base catalog id;
     - genui `{enabled: true, dogfood: true, sourceBody: a 16,384-char string}`, the cap at `tools/agent/chat-validation.ts:49`;
     - `personaSystem`: a 16,384-char string, the cap at `tools/agent/dev-proxy-plugin.ts:398`;
     - `authoringSurface`, `builderMission` and `a2uiEnabled` all true.
   - BASE covers `defaultCatalog` and `a2uiBasicCatalog`. DERIVED covers each `SHIPPED_PERSONA_CATALOGS` entry composed onto its target base catalog(s) with `composeCatalog` (the `prompt-drift.test.ts:166` call shape).
   - Each value = `Math.ceil(measured * 1.1 / 1000) * 1000`, recorded in a MEASURED doc comment in the style of `selection-guidance.ts:230-238`: the measured number, the date and the matrix. The attempt in the tree measured 140,000 for both; DERIVED equal to BASE is allowed.
6. **`produce.ts`.**
   - Replace the `buildSystemPrompt` call (:967) with `buildSystemPromptSections` (same args, same `system` text).
   - Before the round loop, compute the report: `assessPromptBudget(sections, opts.promptBudget?.limit ?? promptBudgetFor(deps.catalog.catalogId))`.
   - New `ProduceOptions.promptBudget?: {mode: 'report' | 'halt'; limit?: number}`. Absent means report. With `mode: 'halt'` and `over`, throw `new ProduceHalt([{code: 'PROMPT_OVER_BUDGET', path: ''}])` before the loop, so no provider call happens. Both callers already route a thrown `ProduceHalt` to the GH #144 error line (see the architect's file).
   - Install `onEvent` always. A `usage` event is summed into a turn-level `TokenUsage` across every round and every event. Cache fields appear on the sum only if some event carried them. All other kinds push progress only when `emitProgress`, so the stream stays byte-identical with progress off.
   - Repair the comment at :1016-1021, which says no callback is installed when progress is off.
   - `traceFor` (:977) attaches `prompt: report` always, and `usage` only when at least one usage event arrived.
7. **Contract dependents (the replan fix).** A full `npm test` on the current tree (exit 1, 121 s) fails exactly three tests, all outside the `:903` pin:
   - `src/live-agent/a2ui-surface-toggle.test.ts:199`;
   - `src/live-agent/genui-exclusive.test.ts:95`;
   - `src/live-agent/produce-loop.test.ts:1372-1373`.

   Each compares the full `produce()` line lists of two runs that differ only in `a2uiEnabled`, genui `exclusive` or `authoringSurface`. One approach for all three:
   - **The `:903` pin.** `produce-loop.test.ts:903` keeps its exact `toEqual`, which expects `prompt` (with `over: false`) and no `usage` key. The tree already has this.
   - **The helper.** Add the local, unexported helper below to each of the three files, with the same body in each. Evidence for a per-file local: each live-agent test file defines its own helpers (`stubProvider` at `a2ui-surface-toggle.test.ts:25`, `genui-exclusive.test.ts:46`, `produce-loop.test.ts:43`), and `src/live-agent/` holds no non-test module. Declare it with the `function` keyword and keep the error text exactly as written; criterion 8 greps both.

     ```ts
     // ADR-0234 (proposed): trace.prompt reports the composed prompt's section sizes, which this gate steers
     // by design. The comparison drops that one field and nothing else, and throws when no line carries it,
     // so it can never pass vacuously.
     function withoutTracePrompt(lines: readonly string[]): string[] {
       let stripped = 0
       const out = lines.map((line) => {
         const parsed = JSON.parse(line) as { a2uiMeta?: { trace?: { prompt?: unknown } } }
         const trace = parsed.a2uiMeta?.trace
         if (trace?.prompt === undefined) return line
         delete trace.prompt
         stripped++
         return JSON.stringify(parsed)
       })
       if (stripped === 0) throw new Error('withoutTracePrompt: no line carries a2uiMeta.trace.prompt')
       return out
     }
     ```
   - **Call sites.** Lines without `trace.prompt` come back byte-unchanged, so every A2UI line and every other meta field is still compared byte for byte.
     - `a2ui-surface-toggle.test.ts`: compare `withoutTracePrompt(await runWith(true))` to `withoutTracePrompt(await runWith(false))`.
     - `genui-exclusive.test.ts`: compare `withoutTracePrompt(await runWith(false))` to `withoutTracePrompt(await runWith(true))`.
     - `produce-loop.test.ts`: compare `withoutTracePrompt(off)` and `withoutTracePrompt(absent)` each to `withoutTracePrompt(on)`. The `personaPatch` assertion stays.
   - **Titles.** The `produce-loop.test.ts` test title changes "yields a byte-identical stream to the gate-ON run" to "yields a stream identical to the gate-ON run apart from trace.prompt". The other two titles claim mechanics identity, which still holds, so they stay.
   - **Em dashes.** All three files already contain em dashes, and step 4's guard counts them per file against base, so new comments and the renamed title add none.
   - **No other dependent.** `site/pages/a2ui-live.ts` reads named trace fields only (:817-829). No browser test compares two `produce()` streams: `git grep "produce("` over `*.browser.test.ts` finds comments only.
8. **New `src/live-agent/prompt-budget.test.ts`.**
   - Unit cases for `assessPromptBudget`: over-limit gives `over: true`, the input is unchanged and not aliased, and total equal to the limit gives `over: false`.
   - Unit cases for `promptBudgetFor`: `agent-ui` and `a2ui-basic` map to BASE, `agent-ui--croupier` maps to DERIVED, and DERIVED >= BASE.
   - A section-sum leg: over the baseline shapes plus the worst-case matrix, `text === buildSystemPrompt(same args)`, the sum of chars equals `text.length`, ids are unique, in order, and every chars value is > 0.
   - The budget leg over the matrix.
   - A negative control: the same worst-case prompt at limit 1 reports `over: true`.
9. **New `src/live-agent/produce-budget-usage.test.ts`.** Stub providers whose output starts with a `{"a2uiMeta":{"note":"..."}}` line, because a trace ships only with a note or ask (`produce.ts:1230`, :1143). Cases:
   - (a) one usage event per stream call over three rounds (invalid, invalid, valid) sums into `trace.usage`;
   - (b) two usage events inside one stream call (an adapter tool loop) are both summed;
   - (c) no usage events gives no `usage` key;
   - (d) `trace.prompt.total === req.system.length`, the limit equals `promptBudgetFor(defaultCatalog.catalogId)`, and `over` is false;
   - (e) `promptBudget: {mode: 'report', limit: 1}` gives `over: true`, and `req.system` is byte-identical to a run without `promptBudget`;
   - (f) `{mode: 'halt', limit: 1}` throws `ProduceHalt` with code `PROMPT_OVER_BUDGET`, and the stub was never called;
   - (g) progress off with a usage-emitting stub yields no progress meta-lines.

Focused checks: the criteria below, plus `npx tsc --noEmit -p .` (about 10 s; vitest erases these types, and the whole `npm run check` gate runs in step 4).
### Acceptance criteria
- `for p in "export interface TokenUsage {" "export interface PromptSection {" "export interface PromptBudgetReport {" "export type PromptSectionId =" "prompt?: PromptBudgetReport" "usage?: TokenUsage"; do grep -qF "$p" packages/agent-ui/a2ui/src/agent/meta-line.ts || exit 1; done`
- (guard) `test "$(grep -c "^import" packages/agent-ui/a2ui/src/agent/meta-line.ts)" -eq 0`
- `grep -qF "usage?: TokenUsage" packages/agent-ui/a2ui/src/agent/agent-transport.ts && grep -qE "kind: .*'usage'" packages/agent-ui/a2ui/src/agent/agent-transport.ts`
- `grep -qxF "export * from './prompt-budget.ts'" packages/agent-ui/a2ui/src/agent/index.ts`
- `f=packages/agent-ui/a2ui/src/agent/prompt-budget.ts; test -f "$f" && test -z "$(grep -E "^import " "$f" | grep -v "^import type ")"`
- `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/prompt-budget.test.ts`
- `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/produce-budget-usage.test.ts`
- `for f in a2ui-surface-toggle genui-exclusive produce-loop; do p="packages/agent-ui/a2ui/src/live-agent/$f.test.ts"; grep -qF "function withoutTracePrompt(" "$p" && grep -qF "withoutTracePrompt: no line carries a2uiMeta.trace.prompt" "$p" || exit 1; done`
- `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent packages/agent-ui/a2ui/src/agent`
- (guard) `git diff --quiet "$SDLC_BASE_SHA" -- packages/agent-ui/a2ui/src/live-agent/prompt-equivalence.baseline.json`
- (guard) `! grep -qF "src/agent/prompt-budget.ts" packages/agent-ui/a2ui/src/agent/gates.test.ts`
- (guard) `{ git diff --name-only "$SDLC_BASE_SHA" -- . ":(exclude).sdlc"; git ls-files --others --exclude-standard -- . ":(exclude).sdlc"; } | grep -vxE "packages/agent-ui/a2ui/src/agent/(meta-line|agent-transport|system-prompt|prompt-budget|produce|index)\.ts|packages/agent-ui/a2ui/src/live-agent/(meta-line|prompt-budget|produce-budget-usage|produce-loop|a2ui-surface-toggle|genui-exclusive)\.test\.ts" | { ! grep -q .; }`
