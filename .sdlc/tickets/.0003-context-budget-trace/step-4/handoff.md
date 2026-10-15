## Task goal
Make each turn report what it assembled and what the provider billed: a declared whole-prompt budget with a structured over-budget result (never silent truncation), prompt-section sizes on `TurnTrace`, and token usage from the provider on the trace and the devtools timeline. Tracks GH #1809 and the token accounting remainder of GH #1797.

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
     - token counts only, no prices anywhere;
     - `trace.prompt` reports the composed prompt, so two runs that differ only in a prompt-composition gate (`a2uiEnabled`, genui `exclusive`, `authoringSurface`) differ in that one field. SPEC-R29 AC3 and SPEC-R30 AC3 now read "identical apart from `trace.prompt`", and the three stream pins compare through `withoutTracePrompt`.
   - The H1 must use the `ADR_H1_RE` separator, the U+2014 dash (`scripts/generate-sitemap.mjs:260`). That H1 is the only place a U+2014 dash may appear in the ADR.
2. **ADR index.** Run `node scripts/generate-sitemap.mjs` to regenerate `site/public/adr-index.json`. Add `233` to `KNOWN_GAPS` in `site/lib/docs-grammar.test.ts:253`, with a reserved-in-flight note: ADR-0233 is claimed by the no-barrels lane. The entry is inert once that ADR lands, the 192/193 precedent.
3. **`.claude/docs/spec/a2ui-live-agent.spec.md`.**
   - The header version note (:5 convention).
   - The TurnTrace definition (:374).
   - A SPEC-R6 (:530) paragraph on the whole-prompt budget, plus an AC8 row in the traceability table (:1825-1836).
   - The typed contract `interface TurnTrace` (:1655): add `prompt?: PromptBudgetReport; usage?: TokenUsage;` and the three new types.
   - The SSE note (:1749): usage extraction and `PROMPT_OVER_BUDGET`.
   - Amend SPEC-R29 AC3 (:1075-1081: "the outgoing meta-line is IDENTICAL to the gate-ON run's") and SPEC-R30 AC3 (:1142-1146: "yields a stream byte-identical to the gate-ON run's"). Each now holds apart from `trace.prompt` (ADR-0234), which reports the prompt the gate steers. In each AC, keep the words "apart from `trace.prompt`" on one physical line: the criterion greps line by line and the spec hard-wraps.
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
   - `genui-surface.spec.md:145,429` and `line-framing-and-heal.md:87`: single fields only. `genui-surface.spec.md:43,564` are prompt-byte claims, not stream claims;
   - `producer-order-and-yield.md`;
   - `.claude/docs/decompositions/gh716-builder-mission.spec-amendment.md:71-74`: a dated amendment sheet, which stays. The SPEC carries no other gate-OFF stream AC: `git grep -n "gate OFF whose model" .claude/docs/spec` finds only SPEC-R30 AC3;
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
- `test "$(grep -cE "apart from .trace\.prompt." .claude/docs/spec/a2ui-live-agent.spec.md)" -ge 2`
- `grep -qF "usage?}" .claude/docs/spec/devtools-harness.spec.md && grep -qE "turn-end.*usage" .claude/skills/a2ui-jsonl-mcp/references/record-and-replay.md`
- `grep -qF "PROMPT_CHAR_BUDGET_BASE" .claude/skills/a2ui-prompt-authoring/SKILL.md && grep -qF "prompt-budget.test.ts" packages/agent-ui/a2ui/AGENTS.md && grep -qF "**prompt budget**" .claude/docs/references/agent-model.md && grep -qF "prompt-budget.ts" packages/agent-ui/a2ui/src/agent/selection-guidance.ts`
- (guard) `git diff --quiet "$SDLC_BASE_SHA" -- packages/agent-ui/a2ui/src/live-agent/prompt-equivalence.baseline.json`
- (guard) `d=$(printf "\342\200\224"); for f in $(git diff --name-only "$SDLC_BASE_SHA" -- . ":(exclude).sdlc"); do if test -f "$f"; then a=$(git show "$SDLC_BASE_SHA:$f" 2>/dev/null | grep -o "$d" | wc -l); b=$(grep -o "$d" "$f" | wc -l); test "$b" -le "$a" || exit 1; fi; done; for f in $(git ls-files --others --exclude-standard -- . ":(exclude).sdlc"); do case "$f" in .claude/docs/adr/0234-*) m=1;; *) m=0;; esac; n=$(grep -o "$d" "$f" | wc -l); test "$n" -le "$m" || exit 1; done`
- (guard) `npm run check`
- (guard) `npm test`
- (guard) `{ git diff --name-only "$SDLC_BASE_SHA" -- . ":(exclude).sdlc"; git ls-files --others --exclude-standard -- . ":(exclude).sdlc"; } | grep -vxE "packages/agent-ui/a2ui/src/agent/(meta-line|agent-transport|system-prompt|prompt-budget|produce|index|selection-guidance)\.ts|packages/agent-ui/a2ui/src/agent/providers/anthropic\.ts|packages/agent-ui/a2ui/src/live-agent/(meta-line|prompt-budget|produce-budget-usage|produce-loop|a2ui-surface-toggle|genui-exclusive|anthropic-usage)\.test\.ts|packages/agent-ui/devtools/src/timeline/(events\.ts|turn-usage\.test\.ts)|packages/agent-ui/devtools/src/capture/format\.ts|packages/agent-ui/a2ui/AGENTS\.md|\.claude/docs/adr/0234-[a-z0-9-]+\.md|site/public/adr-index\.json|site/lib/docs-grammar\.test\.ts|\.claude/docs/spec/(a2ui-live-agent|devtools-harness)\.spec\.md|\.claude/docs/lld/a2ui-live-agent\.lld\.md|\.claude/skills/a2ui-prompt-authoring/SKILL\.md|\.claude/skills/a2ui-jsonl-mcp/references/record-and-replay\.md|\.claude/docs/references/agent-model\.md" | { ! grep -q .; }`
