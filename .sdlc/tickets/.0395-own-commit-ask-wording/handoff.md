---
id: T-0395
title: "Game-ask 'ONE commit Button' wording and OptionCompare's pick intent match the own-commit rule"
type: chore           # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-21
claimed_by: claude:a8ce3b21 2026-10-21
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
The producer's teaching agrees with T-0384's ask rule (an ask needs no commit Button when its answer control commits by its own press) everywhere, and OptionCompare's selection intents only route a pick to it.

## Intent
- Do:
  1. The game-ask "its ONE commit Button" wording at `packages/agent-ui/a2ui/src/agent/prompts/grammar.md:47`, the `FEED_SCOPE_HUD_HINT` in `packages/agent-ui/a2ui/src/agent/produce.ts` (about 1195-1199) and `.claude/docs/spec/a2ui-live-agent.spec.md:657` gain the same own-commit exception (an OptionDeck pick needs no commit Button).
  2. OptionCompare's second selection intent in `packages/agent-ui/a2ui/src/catalog/default/selection.json` ("legs, rooms, plans or products side by side") gains a pick word, so a facts-only "compare plans side by side" ask does not route to OptionCompare over Stat tiles plus a Table.
- Non-goals: any other grammar change.
- Done when: the model-read wording is settled by the debate rule (Opus architect, then fable plan-reviewer) before it is applied; a deliberate prompt-equivalence recapture; pins in `system-prompt-grammar.test.ts`; `npm run check`, the a2ui prompt and selection tests and the whole jsdom suite once exit 0.

## Context
- Raised by the T-0386/T-0384 debate reviewer and the T-0393 verifier (2026-10-21), recorded in `.sdlc/notes/notes.md`.
- Decided by the conductor under Kim's 2026-10-21 overnight goal ("you make the decisions while I sleep").

## Constraints
- grammar.md is byte-pinned: the debate rule and a deliberate recapture; both prompt budgets hold; no em dashes.
- Lane: solo because size L2 (steps.py lane); overnight goal 2026-10-21

## Debate: own-commit ask wording
Ask (architect, debate rule): propose exact replacement text for the ticket's Do items: grammar.md:47 (game ask "its ONE commit Button"), produce.ts FEED_SCOPE_HUD_HINT (about 1195-1199), a2ui-live-agent.spec.md:657, and OptionCompare's second intent in default selection.json (at most 60 chars, a pick word, the T-0393 verifier note). Match the T-0384 clause now at grammar.md:37-39 ("or none when its answer control commits by its own press (an OptionDeck, an AmountPicker with \"actionName\")"). For each span give before text with line numbers, after text and why; measure the byte delta against both prompt budgets and the selection-guidance budget; list pins and dependents; no em dashes. Write no file except your result.

Ask (plan-reviewer, debate rule): review the architect's wording in `.sdlc/runtime/tasks/0395-own-commit-ask-wording/architect-L1.md` as the second voice. Is "(none when that control commits by its own press)" unambiguous to a model in both the grammar and the hint? Is the new OptionCompare intent a pick-only route that leaves a facts-only "compare side by side" ask to the comparison-table branch? Keep or strip span 3b (the stale spec sentence)? Check the budget figures, noting BASE is left 21 characters under its limit, and say whether that headroom is acceptable or a constant should be re-measured. Verdict pass or replan, with any exact wording fixes.
- Debate outcome 2026-10-22: the architect (architect-L1.md) and the fable reviewer (plan-reviewer-L1.md, pass) agree. Spans 1 to 4 land as written, span 3b kept, and the prompt budgets are re-measured (BASE 147 200, DERIVED 148 200 with RE-MEASURED lines), per the reviewer.

## Acceptance criteria
verifier: L3
- grammar.md's game ask reads "its ONE commit Button (none when that control commits by its own press)", the `FEED_SCOPE_HUD_HINT` in produce.ts carries the same parenthetical, and spec :658 carries the full own-commit clause plus the 3b retire-update and HUD allowance (architect-L1.md spans 1 to 3b).
- OptionCompare `intents[1]` in default selection.json is "pick a leg, room, plan or product shown side by side" (span 4).
- `PROMPT_CHAR_BUDGET_BASE = 147_200` and `PROMPT_CHAR_BUDGET_DERIVED = 148_200`, each with a `RE-MEASURED 2026-10-21 (T-0395)` comment line (plan-reviewer-L1.md).
- assets.gen.ts, selection-projection.gen.ts and both capability-registry.json copies are regenerated; the prompt-equivalence baseline moves only `default`, `defaultExplicit`, `specific` and `blueSky`.
- Pins in system-prompt-grammar.test.ts (game-ask parenthetical, OptionCompare clause) and produce-loop.test.ts (repair hint) pass.
- `npm run check` exit 0; `npx vitest run` (whole jsdom suite, `env -u NODE_OPTIONS`) exit 0.
- Conductor: verify the spans landed exactly as debated (architect-L1.md, plan-reviewer-L1.md), the recapture moved only the four expected keys, the pins bite, and the re-measured budgets follow the prompt-budget.ts rule. Run npm run check, the a2ui prompt and selection tests and the whole jsdom suite once.

## Outcome

2026-10-21 · lane: solo L2 · verdict: pass · verifier: verifier-L3 (fable) · base: 05650993413d
- Changed: Game ask, repair hint and spec carry the own-commit exception; OptionCompare's second intent names the pick; prompt budgets re-measured (debated)
- Commits: bb22122 T-0395: game ask, repair hint and spec carry the own-commit exception; OptionCompare's intent names the pick; prompt budgets re-measured (debated)
- Check: 1 grammar.md game ask, FEED_SCOPE_HUD_HINT parenthetical, spec :658 own-commit clause plus 3b (arch...: pass
- Check: 2 OptionCompare `intents[1]` is "pick a leg, room, plan or product shown side by side": pass
- Check: 3 `PROMPT_CHAR_BUDGET_BASE = 147_200`, `PROMPT_CHAR_BUDGET_DERIVED = 148_200`, each with a `RE-MEAS...: pass
- Check: 4 assets.gen.ts, selection-projection.gen.ts and both capability-registry.json copies regenerated; ...: pass
- Check: 5 Pins in system-prompt-grammar.test.ts (game-ask parenthetical, OptionCompare clause) and produce-...: pass
- Check: 6 `npm run check` exit 0; `npx vitest run` (whole jsdom suite, `env -u NODE_OPTIONS`) exit 0: pass
- Check: 7 Conductor: spans landed as debated, recapture moved only the four keys, pins bite, budgets follow...: pass
- Follow-up: decide: .sdlc/tickets/0395-own-commit-ask-wording/handoff.md:20 note: cites... -> notes.md
- Follow-up: decide: .sdlc/notes/notes.md:671 note: the T-0393 decide: line about... -> notes.md
- Follow-up: decide: site/agent-content/game-hud-placement.test.ts:28 note: pins exactly... -> notes.md
