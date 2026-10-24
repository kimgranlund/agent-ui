---
id: T-0436
title: "App, code and router descriptors each carry a description"
type: chore           # feature | bug | chore | spike | idea
status: done     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-24
claimed_by: claude:a8ce3b21 2026-10-24
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 5
---

## Goal
Every descriptor under packages/agent-ui/app, code and router carries a one-line description:, like the 34 components descriptors T-0433 filled, and the descriptor-description test covers those packages too.

## Context
T-0433 left 17 app, code and router descriptors without description:.

## Constraints
Short plain lines in the existing style, no em dashes; outside the attributes fence; regenerate everything descriptors feed with its scripts; a prompt baseline or budget move follows skill a2ui-prompt-authoring's deliberate flow.

## Done when
The widened descriptor-description test passes; npm run check plus the touched tests pass.
- Lane: solo because size L1 (steps.py lane); overnight goal 2026-10-21

## Outcome

2026-10-24 · lane: solo L1 · verdict: pass · verifier: verifier-L1 (opus) · base: b066d868331f
- Changed: App, code and router descriptors each carry a description
- Commits: none
- Check: 1 The widened descriptor-description test passes: pass
- Check: 2 npm run check plus the touched tests pass: pass
- Follow-up: note: the ticket said 17 descriptors, the diff fills 18 all app, code and... -> notes.md
