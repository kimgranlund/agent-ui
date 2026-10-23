---
id: T-0421
title: "The OptionDeck descriptor describes any lone single pick, not only a choice to start"
type: chore           # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-23
claimed_by: claude:a8ce3b21 2026-10-23
from: T-0419
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 5
---

## Goal
ui-option-deck's descriptor (description at :7 and the prose at :146) describes the deck as the control for any lone single pick among a few options, the press committing it, matching the T-0419 grammar, instead of "picking one of a few things to start".

## Context
Follow-up from T-0419 (verifier notes):

packages/agent-ui/components/src/controls/option-deck/option-deck.md:7,:146 the descriptor still says "things to start" (component non-goal; architect-L1-2.md:138 follow-up).

## Constraints
Descriptor prose only; no attribute, event or behaviour change. Regenerate every file the descriptor feeds with its script; a prompt-baseline or budget move follows skill a2ui-prompt-authoring's deliberate flow.

## Done when
npm run check plus the option-deck and a2ui agent tests pass; no em dashes.
- Lane: solo because size L1 (steps.py lane); overnight goal 2026-10-21

## Outcome

2026-10-23 · lane: solo L1 · verdict: closed by reason (descriptor prose only, gates green, verifier skipped as a trivial diff (OptionDeck now reads as any lone single pick)) · verifier: none · base: 41ed2e2a886a
- Changed: see commits
- Commits: none
- Deviation: verifier skipped: descriptor prose plus regenerated files, all gates green (process.md trivial diffs skip the checker)
