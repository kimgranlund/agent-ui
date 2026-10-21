---
id: T-0386
title: "grammar.md stale-affordance rule names Buttons, not an OptionDeck greet"
type: chore           # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-20
claimed_by: claude:a8ce3b21 2026-10-21
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
The stale-affordance rule in `packages/agent-ui/a2ui/src/agent/prompts/grammar.md` (about line 234, "remove its action Buttons (or the row holding them)") also names a greet OptionDeck, so a model retiring a greet deck strips the deck. grammar.md lines 50-51 and `mini-skills/greeting-card.md` already retire "greet cards" (T-0193).

## Context
Raised by the T-0193 step 3 verifier, 2026-10-20. Kim filed it as its own ticket. grammar.md is byte-pinned, so the wording goes through the debate rule (Opus architect plus fable reviewer) and a deliberate prompt-equivalence recapture. T-0384 (the "exactly one commit Button" rule versus a control's own commit) edits nearby grammar; consider landing the two together.

## Constraints
Minimal wording, no new rule, no em dashes.
- Lane: solo because size L2 (steps.py lane); fanout 2026-10-21

## Debate: grammar.md stale affordance and one commit Button (T-0386 with T-0384)
Kim 2026-10-21: run this lane with T-0384 bundled (its handoff: `.sdlc/tickets/.0384-packages-agent-ui-a2ui-src/handoff.md`); grammar.md changes go through the debate rule (Opus architect, then fable plan-reviewer) and a deliberate prompt-equivalence recapture; a solo then applies the settled spans.

Ask (architect, debate rule): propose exact replacement text for (1) T-0386: the stale-affordance rule (search "remove its action Buttons (or the row holding them)"; T-0198 just edited nearby line 234) so a model retiring a greet does not strip a greet OptionDeck, consistent with grammar.md lines 50-51 and `mini-skills/greeting-card.md`; (2) T-0384: the "EXACTLY ONE commit Button" ask rule (about line 37) so a control that commits by its own action (OptionDeck, AmountPicker `actionName`, ConfirmReceipt, StepFlow finish) is not contradicted. Re-check T-0384's premise first against the current tree: T-0198 rewrote booking-flow so its scene-2 AmountPicker no longer commits in-flow. For each span give the before text with line numbers, the after text and why; keep the grammar's register, no em dashes, measure the byte delta against the prompt budget, and list every dependent (pins in system-prompt-grammar.test.ts, mini-skills, workflows). If a ticket's premise no longer holds, say so and propose no edit for it. Write no file except your result.

Ask (plan-reviewer, debate rule): review the architect's proposed wording in `.sdlc/runtime/tasks/0386-grammar-stale-affordance-deck/architect-L1.md` as the second voice. Is "retire a greet deck by disabling it" right against the renderer, conversation and surface-host mechanics it cites, for a root deck and a nested deck? Is the T-0384 exception clause (no commit Button when the answer control commits by its own action) unambiguous to a model and consistent with option-deck.md, quantity.md and feed-catalog.ts? Is each after-span in the grammar's register with no added em dashes, the byte delta right against both budgets, and the dependents (pins in system-prompt-grammar.test.ts, mini-skills) complete? Verdict pass or replan, with any exact wording fixes.
- Debate outcome 2026-10-21: the architect (architect-L1.md) and the fable reviewer (plan-reviewer-L1.md, pass) agree. The three spans land as written (T-0386: a greet deck is retired by resending it with "disabled":true; T-0384: an ask may have no commit Button when its answer control commits by its own action), with the reviewer's pins. Left as is, for a follow-up: the game-ask "ONE commit Button" wording at grammar.md:47, produce.ts FEED_SCOPE_HUD_HINT and a2ui-live-agent.spec.md:657.
- Conductor: verify that the three grammar.md spans landed exactly as debated (../../runtime/tasks/0386-grammar-stale-affordance-deck/architect-L1.md and plan-reviewer-L1.md), the recapture moved only default, defaultExplicit, specific and blueSky, the new pins bite, and T-0384's handoff is satisfied by span 1. Run npm run check, the a2ui prompt tests and the whole jsdom suite once.

## Outcome

2026-10-21 · lane: full L2 · verdict: pass · verifier: verifier-L3 (fable) · base: 4b95ae06d541
- Changed: grammar.md retires a greet OptionDeck by resending it disabled, and a superseded surface's stale affordances generally (debated)
- Commits: none
- Check: 1 the three grammar.md spans landed exactly as debated (architect-L1.md spans, plan-reviewer-L1.md ...: pass
- Check: 2 the recapture moved only default, defaultExplicit, specific and blueSky: pass
- Check: 3 the new pins bite: pass
- Check: 4 T-0384's handoff is satisfied by span 1: pass
- Check: 5 npm run check: pass
- Check: 6 the a2ui prompt tests: pass
- Check: 7 the whole jsdom suite once: pass
- Follow-up: note: .sdlc/tickets/0386-grammar-stale-affordance-deck/handoff.md carries... -> notes.md
- Follow-up: fix-now: .sdlc/notes/notes.md:621 the T-0386 "decide:" line is now settled... -> notes.md
- Follow-up: fix-now: .sdlc/tickets/.0384-packages-agent-ui-a2ui-src/handoff.md:16 and :24... -> notes.md
- Follow-up: note: the throwaway worktree and my probe script are removed; the... -> notes.md
