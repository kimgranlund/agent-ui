<!-- role=builder level=L2 model=opus effort=low -->
## Status
done

## Changes
- `.claude/docs/adr/0234-turn-trace-prompt-budget-and-token-usage.md`: Decision §2 now cites `produce.ts:1025` for the halt. It also says the halt fires before the round loop's first `deps.provider.stream` call and before any line is yielded.
- `packages/agent-ui/a2ui/src/live-agent/prompt-budget.test.ts`: added the equality assertion `expect(buildSystemPromptSections(...args).text).toBe(buildSystemPrompt(...args))` to the section-sum leg.

## Checks
- `grep -qE "produce\.ts:[0-9]+" .claude/docs/adr/0234-*.md`: exit 0
- `grep -qE "buildSystemPromptSections\(.*\)\.text" .../prompt-budget.test.ts`: exit 0
- `npx vitest run --project packages .../prompt-budget.test.ts .../produce-budget-usage.test.ts`: exit 0, 2 files, 47 tests passed
- (guard) `git diff --quiet "$SDLC_BASE_SHA" -- .../prompt-equivalence.baseline.json` (base dce7f6fe): exit 0
- (guard) `npm run check`: exit 0

## Notes
- Claim A matches the code. `produce.ts:1025` throws `ProduceHalt([{code:'PROMPT_OVER_BUDGET'}])` before the round loop starts. The first `deps.provider.stream` call is at `produce.ts:1080`.
- Test (f) in `produce-budget-usage.test.ts` already checks that the provider stream is never called (`calls()` is 0) and that no lines are yielded. I added no new test there.
- Claim B matches the code. `buildSystemPrompt` returns `buildSystemPromptSections(...).text` (`system-prompt.ts:411`). The existing test checked this through a destructured `text`. I added the direct one-line form so the grep criterion matches.
- The ADR's other wording was accurate, so the citation is the only ADR change.
