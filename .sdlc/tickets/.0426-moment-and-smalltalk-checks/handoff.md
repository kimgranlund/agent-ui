---
id: T-0426
title: "Composite moments prove the mutation clause in tree and SMALL_TALK covers good morning and thinking-aloud forms"
type: chore           # feature | bug | chore | spike | idea
status: done     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-23
claimed_by: claude:a8ce3b21 2026-10-23
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 5
---

## Goal
composite-moments.test.ts proves the mutation clause in tree, and hidden-state-checks.ts SMALL_TALK reads "good morning", "hmm" and "let me think" forms as non-moves, each with a test.

## Context
From the 2026-10-23 notes triage (verified still true against main):
- notes.md:406: decide: packages/agent-ui/a2ui/src/catalog/composite-moments.test.ts:400: decide: the "fires with the game gate or CardTable `lacks` removed" clause is proven only by a verifier-run mutation; `compositeMomentCheck` is exported, so an in-tree assertion over a mutated row would pin it.
- notes.md:461: decide: packages/agent-ui/a2ui/src/catalog/hidden-state-checks.ts:508: decide: greetings outside the SMALL_TALK list fire at an open game target with no update: "Good morning, shopkeeper.", "Greetings, merchant.", "Good evening, Dungeon Master.", and so do "Let me think about it.", "Hmm.", "Describe the room." and "Good game so far." (probe run; the classifier defaults to move). The repair then asks for a surface update the turn has no move for.

## Constraints
No game move phrase may become quiet; MOVE_WORD semantics stay.

## Done when
npm run check plus the touched folders' tests pass; no em dashes in added lines.
- Lane: solo because size L1 (steps.py lane); overnight goal 2026-10-21

## Outcome

2026-10-23 · lane: solo L1 · verdict: pass · verifier: verifier-L1 (opus) · base: 00837f149b62
- Changed: Composite moments prove the GAME_HUD_MISSING mutation clause in tree
- Commits: none
- Check: 1 composite-moments.test.ts proves the mutation clause in tree; SMALL_TALK forms ("good morning", "...: pass
- Check: 2 npm run check plus the touched folders' tests pass; no em dashes in added lines: pass
- Follow-up: note: composite-moments.test.ts:550 pins only the lacks half of the... -> notes.md
