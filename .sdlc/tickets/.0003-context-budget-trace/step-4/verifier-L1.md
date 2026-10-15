<!-- role=verifier level=L1 model=sonnet effort=medium -->
## Verdict
pass

## Criteria
- ADR-0234 exists, Status is `proposed`, and it cites ADR-0073, 0088, 0146, 0200, #1809 and #1797: pass. I ran the span in the worktree and it exited 0. The file is `.claude/docs/adr/0234-turn-trace-prompt-budget-and-token-usage.md`.
- `#adr-0234` in `site/public/adr-index.json`: pass. grep exit 0.
- (guard) site vitest on `docs-grammar`, `sitemap` and `adr`: pass. 3 files and 199 tests passed. I did not rerun at base: it is green on the built tree, and a failing run would have been a real red.
- Spec and LLD marker greps: pass. I looped every marker and no MISS printed.
  - Spec: `prompt?: PromptBudgetReport`, `usage?: TokenUsage` and `PROMPT_OVER_BUDGET`.
  - LLD: `prompt-budget.ts`, `newUsageCollector` and `PROMPT_OVER_BUDGET`.
- "apart from `trace.prompt`" at least twice in the spec: pass. The count is 3. Lines 1104 and 1170 are the R29 and R30 AC3 amendments, and line 7 is the header note.
- Devtools spec `usage?}` and record-and-replay `turn-end.*usage`: pass. Exit 0.
- Skill, `AGENTS.md`, glossary and `selection-guidance.ts` greps: pass. Exit 0.
- (guard) baseline JSON unchanged against `$SDLC_BASE_SHA`: pass. `git diff --quiet` exited 0.
- (guard) U+2014 dash count: pass. No file exceeds its allowance (the ADR gets one, every other file stays at or below its base count). No BAD lines printed.
- (guard) `npm run check`: pass. Exit 0, ending in "selftest: all green".
- (guard) `npm test`: pass. Exit 0, 631 files passed with 1 skipped, 12737 tests passed with 6 skipped.
- (guard) scope allowlist: pass. The `grep -vxE` pipeline printed nothing.

## Out of scope changes
None. `providers/anthropic.ts` (the `newUsageCollector` addition) and `anthropic-usage.test.ts` are uncommitted. Both are on the handoff's allowlist and the scope guard passed.

## For the next attempt
None.
