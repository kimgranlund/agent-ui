<!-- role=planner level=L3 model=opus effort=xhigh -->
## Goal
Each live turn reports what it assembled and what the provider billed. It gets a per-family whole-prompt character budget with a structured report (never truncation, halt only by opt-in), prompt-section sizes and summed provider token usage on `TurnTrace`, and usage on the devtools `turn-end` row. ADR-0234 is written as proposed and every listed doc is updated, with prompt bytes left unchanged (GH #1809, #1797).

## Step 1: Prompt sections, budget report, halt switch and usage sum in @agent-ui/a2ui
level: L3
### Read first
- `packages/agent-ui/a2ui/AGENTS.md`
### Do
Depends on: none. This step covers slices S0 (types and seam) and A from `.sdlc/0003-context-budget-trace/architect-L1.md`. Read its Interfaces section and its Carry forward line refs; they are not repeated here.

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
   - Each value = `Math.ceil(measured * 1.1 / 1000) * 1000`, recorded in a MEASURED doc comment in the style of `selection-guidance.ts:230-238`: the measured number, the date and the matrix.
6. **`produce.ts`.**
   - Replace the `buildSystemPrompt` call (:967) with `buildSystemPromptSections` (same args, same `system` text).
   - Before the round loop, compute the report: `assessPromptBudget(sections, opts.promptBudget?.limit ?? promptBudgetFor(deps.catalog.catalogId))`.
   - New `ProduceOptions.promptBudget?: {mode: 'report' | 'halt'; limit?: number}`. Absent means report. With `mode: 'halt'` and `over`, throw `new ProduceHalt([{code: 'PROMPT_OVER_BUDGET', path: ''}])` before the loop, so no provider call happens. Both callers already route a thrown `ProduceHalt` to the GH #144 error line (see the architect's file).
   - Install `onEvent` always. A `usage` event is summed into a turn-level `TokenUsage` across every round and every event. Cache fields appear on the sum only if some event carried them. All other kinds push progress only when `emitProgress`, so the stream stays byte-identical with progress off.
   - Repair the comment at :1016-1021, which says no callback is installed when progress is off.
   - `traceFor` (:977) attaches `prompt: report` always, and `usage` only when at least one usage event arrived.
7. **Contract dependent.** `src/live-agent/produce-loop.test.ts:903` pins the trace with an exact `toEqual`. Extend that pin to expect `prompt` (with `over: false`) and no `usage` key. No other code consumer pins the trace shape: `site/pages/a2ui-live.ts` reads named fields only (:817-829).
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

Focused checks: the criteria below, plus `npx tsc` (about 10 s; vitest erases these types, and the whole `npm run check` gate runs in step 4). Write no em dash in new text; step 4 counts them per file.
### Acceptance criteria
- `for p in "export interface TokenUsage {" "export interface PromptSection {" "export interface PromptBudgetReport {" "export type PromptSectionId =" "prompt?: PromptBudgetReport" "usage?: TokenUsage"; do grep -qF "$p" packages/agent-ui/a2ui/src/agent/meta-line.ts || exit 1; done`
- (guard) `test "$(grep -c "^import" packages/agent-ui/a2ui/src/agent/meta-line.ts)" -eq 0`
- `grep -qF "usage?: TokenUsage" packages/agent-ui/a2ui/src/agent/agent-transport.ts && grep -qE "kind: .*'usage'" packages/agent-ui/a2ui/src/agent/agent-transport.ts`
- `grep -qxF "export * from './prompt-budget.ts'" packages/agent-ui/a2ui/src/agent/index.ts`
- `f=packages/agent-ui/a2ui/src/agent/prompt-budget.ts; test -f "$f" && test -z "$(grep -E "^import " "$f" | grep -v "^import type ")"`
- `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/prompt-budget.test.ts`
- `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/produce-budget-usage.test.ts`
- (guard) `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent packages/agent-ui/a2ui/src/agent`
- (guard) `git diff --quiet "$SDLC_BASE_SHA" -- packages/agent-ui/a2ui/src/live-agent/prompt-equivalence.baseline.json`
- (guard) `! grep -qF "src/agent/prompt-budget.ts" packages/agent-ui/a2ui/src/agent/gates.test.ts`
- (guard) `{ git diff --name-only "$SDLC_BASE_SHA" -- . ":(exclude).sdlc"; git ls-files --others --exclude-standard -- . ":(exclude).sdlc"; } | grep -vxE "packages/agent-ui/a2ui/src/agent/(meta-line|agent-transport|system-prompt|prompt-budget|produce|index)\.ts|packages/agent-ui/a2ui/src/live-agent/(meta-line|prompt-budget|produce-budget-usage|produce-loop)\.test\.ts" | { ! grep -q .; }`

## Step 2: Devtools turn-end carries the turn's token usage
level: L2
### Do
Depends on: step 1 (`TokenUsage` on `TurnTrace`).

1. **`packages/agent-ui/devtools/src/timeline/events.ts`.**
   - The `turn-end` arm (:70) gains `usage?: TokenUsage`, via `import type { TokenUsage } from '@agent-ui/a2ui/agent/meta-line'`, the subpath devtools already imports (:19-20). A provider import stays banned (`layering.test.ts:153`).
   - `recordTurn` latches `meta.a2uiMeta.trace?.usage` from each `meta` event; the last one seen wins. Both `turn-end` yields (:142 error path, :145) spread it only when defined, so a turn without it has no `usage` key at all.
   - `DEVTOOLS_EVENT_KINDS` (:34) stays closed: no new kind. SPEC-R7 forbids a second vocabulary.
2. **`packages/agent-ui/devtools/src/capture/format.ts`.**
   - Add to `EVENT_FIELD_RULES['turn-end']` (:79) the triple `['usage', (v) => v === undefined || isTokenUsage(v), 'absent or a TokenUsage object']`. The predicate is needed because the rules are required-field checks.
   - `isTokenUsage` is a local predicate: a record with numeric `inputTokens` and `outputTokens`, and each cache field either undefined or a number.
   - `DEVTOOLS_CAPTURE_VERSION` stays 1, so old captures still parse.
3. **New `packages/agent-ui/devtools/src/timeline/turn-usage.test.ts`**, built with `scriptTransport` and the `recordTurn` helper shape from `events.test.ts:21-25`. Cases:
   - (a) a meta-line whose trace carries usage gives `turn-end.usage` deep-equal to it;
   - (b) no trace usage gives `'usage' in turnEnd === false`;
   - (c) a capture whose `turn-end` carries usage round-trips equal through `serializeCapture` and `parseCapture`;
   - (d) a v1 capture whose `turn-end` lacks usage parses;
   - (e) a malformed usage throws `CaptureParseError` with field `timeline[2].usage`.
4. **Dependents left untouched on purpose.** The change is additive, and both are covered by the guards below and the step 4 gates:
   - `site/pages/devtools-harness*.test.ts` and `agent-admin-debug-export.test.ts` pin kind sequences only.
   - The harness page renders serialized rows (`devtools-harness.ts:150-158`), so there is no page change.

Focused check: `npx tsc`.
### Acceptance criteria
- `npx vitest run --project packages packages/agent-ui/devtools/src/timeline/turn-usage.test.ts`
- `grep -qF "usage?: TokenUsage" packages/agent-ui/devtools/src/timeline/events.ts && grep -qE "^\s*\[.usage., " packages/agent-ui/devtools/src/capture/format.ts`
- (guard) `grep -qF "export const DEVTOOLS_CAPTURE_VERSION = 1 as const" packages/agent-ui/devtools/src/capture/format.ts`
- (guard) `! grep -E "^export const DEVTOOLS_EVENT_KINDS" packages/agent-ui/devtools/src/timeline/events.ts | grep -qE "usage|budget"`
- (guard) `npx vitest run --project packages packages/agent-ui/devtools`
- (guard) `npx vitest run --project site site/pages/devtools-harness.test.ts site/pages/devtools-harness.helper.test.ts site/pages/agent-admin-debug-export.test.ts`
- (guard) `{ git diff --name-only "$SDLC_BASE_SHA" -- . ":(exclude).sdlc"; git ls-files --others --exclude-standard -- . ":(exclude).sdlc"; } | grep -vxE "packages/agent-ui/a2ui/src/agent/(meta-line|agent-transport|system-prompt|prompt-budget|produce|index)\.ts|packages/agent-ui/a2ui/src/live-agent/(meta-line|prompt-budget|produce-budget-usage|produce-loop)\.test\.ts|packages/agent-ui/devtools/src/timeline/(events\.ts|turn-usage\.test\.ts)|packages/agent-ui/devtools/src/capture/format\.ts" | { ! grep -q .; }`

## Step 3: Anthropic adapter reports one usage event per upstream request
level: L3
### Read first
- `packages/agent-ui/a2ui/AGENTS.md`
### Do
Depends on: step 1 (the `'usage'` kind), and on PRs #1805 and #1806 being merged to main and synced into this lane. This step is separate from step 1 only because of that external blocker.

1. **Precondition.** First confirm that `src/live-agent/anthropic-timeouts.test.ts` and `anthropic-retry.test.ts` exist on HEAD. If either is absent, stop with Status blocked: "depends on PRs #1805/#1806". #1806 was CONFLICTING at plan time.
2. **Read the merged adapter.** #1805 adds a first-byte deadline and `readOrStall` in `runRound`; #1806 adds `fetchWithRetry` before streaming. Neither changes `parseAnthropicSSE`'s signature.
3. **`packages/agent-ui/a2ui/src/agent/providers/anthropic.ts`.**
   - Export an `interface UsageCollector` and `newUsageCollector()`. The collector is separate from `ToolUseCollector`, which stays byte-quiet.
   - `parseAnthropicSSE(chunk, onEvent?, tools?, usage?: UsageCollector)`:
     - `message_start.message.usage` seeds every numeric field present;
     - each `message_delta.usage` overrides each numeric field present (cumulative, latest wins);
     - map snake_case to camelCase: `input_tokens` to `inputTokens`, `output_tokens` to `outputTokens`, `cache_read_input_tokens` to `cacheReadInputTokens`, `cache_creation_input_tokens` to `cacheCreationInputTokens`;
     - at `message_stop`, emit `{kind: 'usage', usage}` immediately before the existing `done` event, only when a collector was passed and a usage object was seen.
   - The Anthropic field shapes are cited in `.sdlc/0003-context-budget-trace/architect-L1.md` (streaming doc fetched 2026-10-05).
   - `runRound` creates one collector per call, after the response is accepted (after retry resolution and the `res.ok` check), and passes it to both parse calls: the main loop and the trailing flush. The result is one event per upstream request, each tool-loop round reports once, and a retried request never double-reports.
   - Update the `parseAnthropicSSE` doc comment.
4. **Keep the existing tests untouched.** `anthropic-sse.test.ts` stays as it is: its :68 two-argument event sequence is unaffected because emission needs the fourth argument.
5. **New `src/live-agent/anthropic-usage.test.ts`.** Cases:
   - (a) a fixture with `message_start` usage (input, both cache fields, output 1) and `message_delta` usage `{output_tokens: 57}` yields exactly one usage event with the merged values;
   - (b) `message_delta` input or cache fields override the seed;
   - (c) a collector with no usage frames emits none;
   - (d) the two-argument call emits none and yields identical text;
   - (e) mocked-fetch tool loop (the `anthropic-tool-loop.test.ts` shape): two upstream requests give two usage events in order;
   - (f) the text-only path gives one event;
   - (g) `produce()` over `anthropicProvider` with mocked fetch (note line first) gives a `trace.usage` equal to the per-request sum.

Focused check: `npx tsc`.
### Acceptance criteria
- `for f in anthropic-timeouts anthropic-retry; do test -f "packages/agent-ui/a2ui/src/live-agent/$f.test.ts" || exit 1; done`
- `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/anthropic-usage.test.ts`
- `grep -qF "export function newUsageCollector(" packages/agent-ui/a2ui/src/agent/providers/anthropic.ts`
- (guard) `git diff --quiet "$SDLC_BASE_SHA" -- packages/agent-ui/a2ui/src/live-agent/anthropic-sse.test.ts`
- (guard) `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent packages/agent-ui/a2ui/src/agent`
- (guard) `{ git diff --name-only "$SDLC_BASE_SHA" -- . ":(exclude).sdlc"; git ls-files --others --exclude-standard -- . ":(exclude).sdlc"; } | grep -vxE "packages/agent-ui/a2ui/src/agent/(meta-line|agent-transport|system-prompt|prompt-budget|produce|index)\.ts|packages/agent-ui/a2ui/src/agent/providers/anthropic\.ts|packages/agent-ui/a2ui/src/live-agent/(meta-line|prompt-budget|produce-budget-usage|produce-loop|anthropic-usage)\.test\.ts|packages/agent-ui/devtools/src/timeline/(events\.ts|turn-usage\.test\.ts)|packages/agent-ui/devtools/src/capture/format\.ts" | { ! grep -q .; }`

## Step 4: ADR-0234, docs scrub and gates green
level: L2
guard timeout: 420
### Read first
- `packages/agent-ui/a2ui/AGENTS.md`
### Do
Depends on: steps 1, 2 and 3.

1. **ADR.** Confirm that no `.claude/docs/adr/0234-*.md` exists; if one does, stop blocked. Write `.claude/docs/adr/0234-<kebab-title>.md` from `0000-template.md`, using ADR-0232's header as the dialect exemplar.
   - Status is the bare keyword `proposed`. `Ratified by` is left pending Kim. Never self-ratify.
   - It cites ADR-0073, ADR-0088, ADR-0146, ADR-0200 and ADR-0232, and GH #1809 and #1797.
   - Clauses:
     - additive optional `TurnTrace.prompt` and `usage` (not an ADR-0088 amendment);
     - the character budget per family: report-only by default, never truncation, halt opt-in through `promptBudget.mode` with `PROMPT_OVER_BUDGET`;
     - the `ProviderEvent` `usage` kind: one per upstream request, summed by `produce()`, absent when none is reported;
     - `turn-end.usage`, with capture version 1;
     - token counts only, no prices anywhere.
   - The H1 must use the `ADR_H1_RE` separator, the U+2014 dash (`scripts/generate-sitemap.mjs:260`). That H1 is the only place a U+2014 dash may appear in the ADR.
2. **ADR index.** Run `node scripts/generate-sitemap.mjs` to regenerate `site/public/adr-index.json`. Add `233` to `KNOWN_GAPS` in `site/lib/docs-grammar.test.ts:253`, with a reserved-in-flight note: ADR-0233 is claimed by the no-barrels lane. The entry is inert once that ADR lands, the 192/193 precedent.
3. **`.claude/docs/spec/a2ui-live-agent.spec.md`.**
   - The header version note (:5 convention).
   - The TurnTrace definition (:374).
   - A SPEC-R6 (:530) paragraph on the whole-prompt budget, plus an AC8 row in the traceability table (:1825-1836).
   - The typed contract `interface TurnTrace` (:1655): add `prompt?: PromptBudgetReport; usage?: TokenUsage;` and the three new types.
   - The SSE note (:1749): usage extraction and `PROMPT_OVER_BUDGET`.
4. **`.claude/docs/lld/a2ui-live-agent.lld.md`.**
   - The LLD-C3 row (:84) covers the report, halt and usage sum.
   - The LLD-C4 row (:85) covers `buildSystemPromptSections`.
   - The LLD-C10 row (:104) covers `newUsageCollector` and one event per request.
   - In the module tree, the `meta-line.ts` row (:124) gains the types and a new `prompt-budget.ts` row goes beside `selection-guidance.ts` (:130).
5. **Devtools docs.** In `.claude/docs/spec/devtools-harness.spec.md` SPEC-R7 (:115-125), write `turn-end` as `{status, lines, ms, usage?}`, latched from the meta trace, with capture version 1. In `.claude/skills/a2ui-jsonl-mcp/references/record-and-replay.md` (event list near :37), state that `turn-end` carries an optional `usage`.
6. **Skill, entry file, glossary and comment.**
   - `.claude/skills/a2ui-prompt-authoring/SKILL.md` (:56-60): a bullet beside the selection-guidance one naming `PROMPT_CHAR_BUDGET_BASE`/`PROMPT_CHAR_BUDGET_DERIVED` in `src/agent/prompt-budget.ts`, gated by `src/live-agent/prompt-budget.test.ts`. Re-author tersely or re-measure deliberately; never raise the ceiling just to get green.
   - `packages/agent-ui/a2ui/AGENTS.md`: one bullet under Byte-pinned prompt stack naming `prompt-budget.test.ts`.
   - `.claude/docs/references/agent-model.md` section 3: a `**prompt budget**` glossary entry after selection guidance.
   - `selection-guidance.ts` (:227-239): a comment-only cross-reference to `prompt-budget.ts`.
7. **No-change dispositions.** Report each with its line:
   - `a2ui-chat.spec.md` (:46, :121) and `a2ui-chat.lld.md` (:29, :128, :222): name consumed fields only;
   - `app-surfaces-m2.lld.md:139`: no field list;
   - `genui-surface.spec.md:145,429` and `line-framing-and-heal.md:87`: single fields only;
   - `producer-order-and-yield.md`;
   - `roadmap.md` and `plan.md`: no #1797 or #1809 entry;
   - root `AGENTS.md` Gates line: the budget leg runs inside `npm test`;
   - ADR-0232: untouched.
8. **Doc lint.** Run `doc_lint.py` on the touched docs per `process.md`. It is not a criterion; see Assumptions.
9. **Gates.** Run every gate below. Fix any red from steps 1 to 3, such as a `check:site` type error or a site test consuming the trace. A red already present at the build-start HEAD comes back as Status `inherited red`.
### Acceptance criteria
- `set -- .claude/docs/adr/0234-*.md; test -f "$1" && grep -qE "^> \| \*\*Status\*\* \| proposed \|$" "$1" && for c in ADR-0073 ADR-0088 ADR-0146 ADR-0200 "#1809" "#1797"; do grep -qF "$c" "$1" || exit 1; done`
- `grep -qF "#adr-0234" site/public/adr-index.json`
- (guard) `npx vitest run --project site site/lib/docs-grammar.test.ts site/lib/sitemap.test.ts site/lib/adr.test.ts`
- `for s in "prompt?: PromptBudgetReport" "usage?: TokenUsage" "PROMPT_OVER_BUDGET"; do grep -qF "$s" .claude/docs/spec/a2ui-live-agent.spec.md || exit 1; done && for s in "prompt-budget.ts" "newUsageCollector" "PROMPT_OVER_BUDGET"; do grep -qF "$s" .claude/docs/lld/a2ui-live-agent.lld.md || exit 1; done`
- `grep -qF "usage?}" .claude/docs/spec/devtools-harness.spec.md && grep -qE "turn-end.*usage" .claude/skills/a2ui-jsonl-mcp/references/record-and-replay.md`
- `grep -qF "PROMPT_CHAR_BUDGET_BASE" .claude/skills/a2ui-prompt-authoring/SKILL.md && grep -qF "prompt-budget.test.ts" packages/agent-ui/a2ui/AGENTS.md && grep -qF "**prompt budget**" .claude/docs/references/agent-model.md && grep -qF "prompt-budget.ts" packages/agent-ui/a2ui/src/agent/selection-guidance.ts`
- (guard) `git diff --quiet "$SDLC_BASE_SHA" -- packages/agent-ui/a2ui/src/live-agent/prompt-equivalence.baseline.json`
- (guard) `d=$(printf "\342\200\224"); for f in $(git diff --name-only "$SDLC_BASE_SHA" -- . ":(exclude).sdlc"); do if test -f "$f"; then a=$(git show "$SDLC_BASE_SHA:$f" 2>/dev/null | grep -o "$d" | wc -l); b=$(grep -o "$d" "$f" | wc -l); test "$b" -le "$a" || exit 1; fi; done; for f in $(git ls-files --others --exclude-standard -- . ":(exclude).sdlc"); do case "$f" in .claude/docs/adr/0234-*) m=1;; *) m=0;; esac; n=$(grep -o "$d" "$f" | wc -l); test "$n" -le "$m" || exit 1; done`
- (guard) `npm run check`
- (guard) `npm test`
- (guard) `{ git diff --name-only "$SDLC_BASE_SHA" -- . ":(exclude).sdlc"; git ls-files --others --exclude-standard -- . ":(exclude).sdlc"; } | grep -vxE "packages/agent-ui/a2ui/src/agent/(meta-line|agent-transport|system-prompt|prompt-budget|produce|index|selection-guidance)\.ts|packages/agent-ui/a2ui/src/agent/providers/anthropic\.ts|packages/agent-ui/a2ui/src/live-agent/(meta-line|prompt-budget|produce-budget-usage|produce-loop|anthropic-usage)\.test\.ts|packages/agent-ui/devtools/src/timeline/(events\.ts|turn-usage\.test\.ts)|packages/agent-ui/devtools/src/capture/format\.ts|packages/agent-ui/a2ui/AGENTS\.md|\.claude/docs/adr/0234-[a-z0-9-]+\.md|site/public/adr-index\.json|site/lib/docs-grammar\.test\.ts|\.claude/docs/spec/(a2ui-live-agent|devtools-harness)\.spec\.md|\.claude/docs/lld/a2ui-live-agent\.lld\.md|\.claude/skills/a2ui-prompt-authoring/SKILL\.md|\.claude/skills/a2ui-jsonl-mcp/references/record-and-replay\.md|\.claude/docs/references/agent-model\.md" | { ! grep -q .; }`

## Assumptions
- Kim settled forks 2, 4 and 6: report-only by default with halt opt-in through `ProduceOptions.promptBudget.mode`; an optional `usage` kind on `ProviderEvent`, one per upstream request at `message_stop`; a new proposed ADR-0234. Verified by the handoff's "Architecture and decisions" section.
- Additive trace fields are wire-compatible: `readMetaLine` shallow-checks `trace` only as an object (`meta-line.ts:314`) and passes it through (:452). Verified by reading the file.
- A plain /chain commits nothing, so `SDLC_BASE_SHA` stays the build-start HEAD across steps and every scope criterion must name the cumulative allowed set. Verified by the sdlc-lite `skills/chain/SKILL.md:42`.
- A vitest `-t` filter that matches nothing exits 0, and a missing path filter beside a matching one exits 0. That is why new behavior goes in new test files and step 3 has a `test -f` precondition. Verified by probes on `produce-loop.test.ts`, `prompt-drift.test.ts`, and `anthropic-sse.test.ts` plus the absent `anthropic-timeouts.test.ts`.
- `doc_lint.py` (nonoun-plugins docs 1.22.5) prints "not a functional document" and exits 0 on every scrub-list file, so it cannot go red there. The biting doc gates are `site/lib/docs-grammar.test.ts`, `sitemap.test.ts` and `adr.test.ts`. Verified by running it on all ten scrub files.
- Adding ADR-0234 while 0233 is absent opens a numbering gap that `docs-grammar.test.ts` S8 (:230-258) reds, unless 233 joins `KNOWN_GAPS`. Verified by `ls .claude/docs/adr` (ends at 0232) and the no-barrels claim on 0233 (`/Users/kimgranlund/Projects/nonoun/agent-ui/.sdlc/work/no-barrels/handoff.md:40`).
- An ADR H1 must contain the U+2014 separator for the index generator: verified by `scripts/generate-sitemap.mjs:260` (`ADR_H1_RE`).
- The trace ships only on a meta-line that carries a note or an ask: verified by `produce.ts:1143` and :1230.
- The exact trace pin needing an update is `produce-loop.test.ts:903` (`toEqual`). No other test or fixture pins the trace shape: verified by `git grep` for trace `toEqual` and `"trace":{` across `*.ts`, `*.json` and `*.jsonl`.
- The proxies cap `personaSystem` and genui `sourceBody` at 16,384 chars: verified by `tools/agent/dev-proxy-plugin.ts:398` and `tools/agent/chat-validation.ts:49`. Derived catalog ids use `<base>--<persona>`: verified by `src/catalog/compose.ts:89`.
- PRs #1805 and #1806 are OPEN (1806 CONFLICTING). They change `runRound` (deadline, stall, `fetchWithRetry`) but not `parseAnthropicSSE`: verified by `gh pr view` and `gh pr diff`.
- Gates are green at HEAD f348f2bb: `npm run check` exit 0 (28 s), `npm test` exit 0 (115 s, 623 files), the producer test dirs exit 0 (9 s), and `npx tsc` exit 0 (10 s; root `tsconfig.json:47` covers `packages/agent-ui/*/src`). The tree was unchanged afterwards. Verified by running each.
- Anthropic usage field shapes (`message_start.message.usage`, cumulative `message_delta.usage`): verified by the architect against the streaming doc on 2026-10-05 (`.sdlc/0003-context-budget-trace/architect-L1.md`, Carry forward).

## Risks
- A turn whose model emits no note or ask carries no meta-line, and an exhausted turn throws `ProduceHalt` with no trace. Either way the provider tokens actually spent never reach the trace or devtools. Fixing this, either with a trace-only meta-line or by attaching the trace to `ProduceHalt`, is a design call for a follow-up ticket.
- Step 3 cannot start until PRs #1805 and #1806 merge and the lane resyncs. #1806 is CONFLICTING today. Steps 1 and 2 can land meanwhile, but step 4 waits on step 3.
- The ceilings are measured at the 16 KB persona and sourceBody caps, so runtime `over` is rare. The gate's value is catching growth in hand-authored prompt text. An agent config with a mini-skill cap above 3 could exceed the measured matrix.
- A stream that errors before `message_stop`, or omits usage, reports nothing for that request, so `trace.usage` under-counts failed requests. Consumers must not read an absent `usage` as zero spend.
- Main syncs from the T-0004, no-barrels and behavior-evals lanes may touch `produce.ts`, `system-prompt.ts` or the live-agent SPEC/LLD and conflict. If ADR-0233 lands first, the `KNOWN_GAPS` entry becomes inert.
- Type errors from steps 1 to 3 surface as a criterion only in step 4's `npm run check`. Each step's Do runs `npx tsc` to catch them early.
