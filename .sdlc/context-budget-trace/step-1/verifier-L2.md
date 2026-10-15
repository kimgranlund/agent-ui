<!-- role=verifier level=L2 model=sonnet effort=high -->
## Verdict
pass

## Criteria
- Meta-line type greps (`TokenUsage`, `PromptSection`, `PromptBudgetReport`, `PromptSectionId`, `prompt?`, `usage?`): pass. Evidence: the loop over all six patterns printed no MISSING line. I also read the diff: `meta-line.ts` has the three interfaces, the union type, and the two new `TurnTrace` fields.
- (guard) `meta-line.ts` has zero `^import` lines: pass. Evidence: `grep -c "^import"` was 0 (exit 0).
- `usage?: TokenUsage` and `'usage'` in `ProviderEvent.kind` in `agent-transport.ts`: pass. Evidence: both greps exit 0; diff at :101-109 matches.
- `export * from './prompt-budget.ts'` in `index.ts`: pass. Evidence: `grep -qxF` exit 0.
- `prompt-budget.ts` exists and has only `import type`: pass. Evidence: exit 0; the file's one import is `import type {...} from './meta-line.ts'`.
- `prompt-budget.test.ts`: pass. Evidence: 39 passed. I copied it into a throwaway worktree at `$SDLC_BASE_SHA`, where its file failed (the module doesn't exist at base). That shows the check can go red.
- `produce-budget-usage.test.ts`: pass. Evidence: 8 passed in the tree. In the base worktree it also failed, so it bites.
- `withoutTracePrompt` helper and its error text in all three dependent test files: pass. Evidence: the grep loop printed no FAIL line. At base, the helper throws in the two dependent tests that run it (2 failed of the 26 tests run in that worktree), because no line carries `trace.prompt` there. So it cannot pass vacuously.
- `npx vitest run --project packages .../live-agent .../agent`: pass. Evidence: exit 0; 44 files passed, 1 skipped; 807 tests passed, 1 skipped. I also ran all of `packages/agent-ui/a2ui` plus `packages/agent-ui/devtools` as a broader dependents check: exit 0; 120 files passed, 1 skipped; 2811 tests passed, 1 skipped.
- (guard) `prompt-equivalence.baseline.json` unchanged vs `$SDLC_BASE_SHA`: pass. Evidence: `git diff --quiet` exit 0. The base-SHA gate-check worktree was not needed because the guard is green.
- (guard) `prompt-budget.ts` is not named in `gates.test.ts`: pass. Evidence: `! grep -qF` exit 0.
- (guard) changed-file allowlist: pass. Evidence: the diff and untracked-files pipeline exited 0. `git status` shows only the allowlisted `agent/` and `live-agent/` files, with `.sdlc/` excluded by the criterion.
- Extra checks:
  - `npx tsc --noEmit -p .` exits 0.
  - `buildSystemPrompt` now returns `buildSystemPromptSections(...).text` over the same composition order. Its byte-identity is covered by the section-sum leg and by the baseline guard staying green.
  - `produce.ts` throws the `ProduceHalt` before the round loop, and `onEvent` is always installed with non-usage events gated on `emitProgress`. The progress-off case (g) is among the 8 passing tests.
  - Em-dash counts per edited test file equal base: 20/20, 18/18, 152/152.

Steelman: I drafted a fail on "the always-installed `onEvent` changes the progress-off stream". That rebuttal holds. Without `emitProgress`, the plain `for await` loop runs, `onEvent` pushes nothing, and test (g) plus the passing `produce-loop` stream tests cover it. Dropped.

## Out of scope changes
None. The changed files are exactly the allowlist: `agent/{meta-line,agent-transport,system-prompt,prompt-budget,produce,index}.ts` and `live-agent/{meta-line,prompt-budget,produce-budget-usage,produce-loop,a2ui-surface-toggle,genui-exclusive}.test.ts`. `.sdlc/` is untracked run records.

## For the next attempt
None
