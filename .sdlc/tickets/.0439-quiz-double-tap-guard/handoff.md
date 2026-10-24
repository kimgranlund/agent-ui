---
id: T-0439
title: "A QuestionCard locks after a pick until the reveal arrives"
type: bug             # feature | bug | chore | spike | idea
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
After a quiz pick commits, the QuestionCard stops sending further answers until the reveal arrives: a second tap or Space before the next turn lands sends nothing, and the card shows the pick as pending.

## Context
T-0429 verifier decide note: a re-tap before the reveal turn lands sends a second answer action (factories.ts:308-312). Kim chose to guard it 2026-10-24.

## Constraints
Code only in the quizmaster factory and its tests; no model-read text change; the T-0429 commit rules stay (click or Space commits, arrows never, nothing once revealed).

## Done when
A test shows one answer for two quick taps and that a reveal re-arms the next round; npm run check plus the quizmaster tests pass.
- Lane: solo because size L1 (steps.py lane); overnight goal 2026-10-21

## Outcome

2026-10-24 · lane: solo L1 · verdict: pass · verifier: verifier-L1 (opus) · base: b066d868331f
- Changed: A QuestionCard locks after a pick until the reveal arrives, so a re-tap sends nothing
- Commits: none
- Check: 1 A test shows one answer for two quick taps and that a reveal re-arms the next round: pass
- Check: 2 npm run check plus the quizmaster tests pass: pass
- Follow-up: note: packages/agent-ui/a2ui/src/catalog/personas/quizmaster/factories.ts... -> notes.md
- Follow-up: note: packages/agent-ui/a2ui/src/catalog/personas/quizmaster/factories.ts... -> notes.md
