## Task goal
Make each turn report what it assembled and what the provider billed: a declared whole-prompt budget with a structured over-budget result (never silent truncation), prompt-section sizes on `TurnTrace`, and token usage from the provider on the trace and the devtools timeline. Tracks GH #1809 and the token accounting remainder of GH #1797.

## Step 5: Loose ends
level: L2
guard timeout: 420
### Read first
- `packages/agent-ui/a2ui/AGENTS.md`
### Do
1. Trace the two ADR-0234 claims against the built code, line by line. Claim A: an over-budget halt (`promptBudget.mode` halt, `PROMPT_OVER_BUDGET`) fires before any provider call. Claim B: `buildSystemPrompt` stays byte-identical to `buildSystemPromptSections(...).text`. Where the ADR wording is wrong or imprecise, fix the wording to match the code (never change the code to match the ADR). Cite the verified `produce.ts:<line>` for claim A in the ADR text.
2. Pin claim A with a test in `packages/agent-ui/a2ui/src/live-agent/produce-budget-usage.test.ts` if none asserts that the provider stream is never called under halt; pin claim B with an equality assertion in `packages/agent-ui/a2ui/src/live-agent/prompt-budget.test.ts` if none exists.
### Acceptance criteria
- `grep -qE "produce\.ts:[0-9]+" .claude/docs/adr/0234-*.md`
- `grep -qE "buildSystemPromptSections\(.*\)\.text" packages/agent-ui/a2ui/src/live-agent/prompt-budget.test.ts`
- `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/prompt-budget.test.ts packages/agent-ui/a2ui/src/live-agent/produce-budget-usage.test.ts`
- (guard) `git diff --quiet "$SDLC_BASE_SHA" -- packages/agent-ui/a2ui/src/live-agent/prompt-equivalence.baseline.json`
- (guard) `npm run check`
