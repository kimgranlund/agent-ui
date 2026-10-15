<!-- role=builder level=L3 model=opus effort=high -->
## Status
blocked

## Changes
- `packages/agent-ui/a2ui/src/agent/meta-line.ts`: added the `TokenUsage`, `PromptSectionId`, `PromptSection` and `PromptBudgetReport` types. `TurnTrace` gains `prompt?` and `usage?`. Added the ADR-0234 header paragraph. The file still has zero imports.
- `packages/agent-ui/a2ui/src/agent/agent-transport.ts`: `ProviderEvent.kind` gains `'usage'`, plus a `usage?: TokenUsage` member (`import type`). The doc comment now says usage is summed rather than staged.
- `packages/agent-ui/a2ui/src/agent/system-prompt.ts`: new `buildSystemPromptSections` with the same 9 params. `buildSystemPrompt` now returns its `.text`.
- `packages/agent-ui/a2ui/src/agent/prompt-budget.ts` (new): `PROMPT_CHAR_BUDGET_BASE` and `PROMPT_CHAR_BUDGET_DERIVED` (both 140_000, with MEASURED comments), `promptBudgetFor` and `assessPromptBudget`. Type-only import.
- `packages/agent-ui/a2ui/src/agent/index.ts`: adds `export * from './prompt-budget.ts'`.
- `packages/agent-ui/a2ui/src/agent/produce.ts`:
  - calls `buildSystemPromptSections`;
  - assesses the report once per turn;
  - adds `ProduceOptions.promptBudget`, and halt mode throws `PROMPT_OVER_BUDGET` before the loop;
  - always installs `onEvent`, and it sums usage events;
  - the comment about no callback when progress is off is repaired;
  - `traceFor` attaches `prompt` always, and `usage` only when at least one usage event arrived.
- `packages/agent-ui/a2ui/src/live-agent/meta-line.test.ts`: one new case, a trace carrying `prompt` and `usage` round-trips.
- `packages/agent-ui/a2ui/src/live-agent/produce-loop.test.ts`: the `:903` pin now expects `prompt` (recomputed) and asserts there is no `usage` key.
- `packages/agent-ui/a2ui/src/live-agent/prompt-budget.test.ts` (new): unit cases, the section-sum leg (8 baseline shapes plus both matrices), the budget legs and the negative control.
- `packages/agent-ui/a2ui/src/live-agent/produce-budget-usage.test.ts` (new): cases (a) to (g), plus a case showing halt mode under the limit runs normally.

## Checks
- Criterion 1 (meta-line type greps): exit 0.
- Criterion 2 (guard, zero imports in meta-line.ts): exit 0.
- Criterion 3 (agent-transport `usage` greps): exit 0.
- Criterion 4 (barrel line): exit 0.
- Criterion 5 (prompt-budget.ts has only type imports): exit 0.
- Criterion 6 `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/prompt-budget.test.ts`: exit 0, 39 tests passed.
- Criterion 7 `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/produce-budget-usage.test.ts`: exit 0.
- Criterion 8 (guard) `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent packages/agent-ui/a2ui/src/agent`: **failed**, 3 failed out of 808 tests. Failing:
  - `a2ui-surface-toggle.test.ts:199` "a2uiEnabled:false never changes produce() peel/heal/validate mechanics..."
  - `genui-exclusive.test.ts:95` "the SAME model output composes byte-identical produce() behavior whether or not exclusive is set..."
  - `produce-loop.test.ts:1372` "the passthrough is GATE-BLIND: ... byte-identical stream to the gate-ON run (SPEC-R30 AC3)"
- Pre-build check at base: in a throwaway worktree at `$SDLC_BASE_SHA` (`git worktree add --detach "$SDLC_TMP_WORKTREES/base" "$SDLC_BASE_SHA"`), the same three files passed (3 files, 138 tests, exit 0). The failures are new, not inherited. The worktree has been removed.
- Criterion 9 (guard, baseline.json unchanged): exit 0.
- Criterion 10 (guard, prompt-budget.ts not in gates.test.ts): exit 0.
- Criterion 11 (guard, file list): exit 0.
- `npx tsc --noEmit -p .`: exit 0.
- Em dash count per touched file matches base (meta-line 84, agent-transport 23, system-prompt 91, produce 264, index 4). New files have 0.

## Notes
plan defect: (guard) `npx vitest run --project packages .../live-agent .../agent` contradicts the (guard) file-list criterion under step 6's "`traceFor` attaches `prompt: report` always". Three existing stream-equality pins compare two `produce()` runs that differ only in a prompt-composition gate (`a2uiEnabled`, genui `exclusive`, `authoringSurface`). Those runs now differ in `trace.prompt` section sizes on the note meta-line; for example, the genui section is 3375 vs 2887 chars. Two of the three files (`a2ui-surface-toggle.test.ts` and `genui-exclusive.test.ts`) are outside the allowed edit list.

- **Step 7 is wrong:** it says only `produce-loop.test.ts:903` pins the trace. These three tests pin the whole stream, trace included.
- **Replan options:**
  1. Widen the file list so those two tests can compare streams with `trace.prompt` stripped, or compare content lines plus the trace minus `prompt`.
  2. Same as option 1, but compare A2UI lines and meta fields only.
  3. Change step 6 so `prompt` is not always attached. This conflicts with the architect's design and with case (d).
- **Left in the tree:** all work is still there. All three failing cases, including `produce-loop.test.ts:1372`, are left unfixed on purpose so the replan applies one approach to all of them.
- **Measured values (2026-10-05):**
  - Base worst case: 126,563 chars (`agent-ui`, mode default).
  - Derived worst case: 127,103 chars (`agent-ui--concierge`, mode default).
  - Both give `Math.ceil(x * 1.1 / 1000) * 1000` = 140,000, so DERIVED equals BASE at this measurement.
  - Worst k=3 exemplars: `backable-wizard`, `crud-entry-list-drawer`, `invite-decline-then-focus-block`.
  - Largest agent-ui mini-skills: `crud-entry-list`, `greeting-card`, `nested-record-editor`. None are scoped to `a2ui-basic`.
- **Real prompt size:** a real default-catalog turn measured about 47k chars, well under the limit.
