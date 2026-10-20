---
id: T-0386
title: "grammar.md stale-affordance rule names Buttons, not an OptionDeck greet"
type: chore           # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-20
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
The stale-affordance rule in `packages/agent-ui/a2ui/src/agent/prompts/grammar.md` (about line 234, "remove its action Buttons (or the row holding them)") also names a greet OptionDeck, so a model retiring a greet deck strips the deck. grammar.md lines 50-51 and `mini-skills/greeting-card.md` already retire "greet cards" (T-0193).

## Context
Raised by the T-0193 step 3 verifier, 2026-10-20. Kim filed it as its own ticket. grammar.md is byte-pinned, so the wording goes through the debate rule (Opus architect plus fable reviewer) and a deliberate prompt-equivalence recapture. T-0384 (the "exactly one commit Button" rule versus a control's own commit) edits nearby grammar; consider landing the two together.

## Constraints
Minimal wording, no new rule, no em dashes.
