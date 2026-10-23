---
id: T-0415
title: "ACTION_NOT_APPLIED stops reading greetings and thinking-aloud at an open game as a move"
type: bug             # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-22
claimed_by: claude:a8ce3b21 2026-10-22
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 5
---

## Goal
On an open game target with no surface update, ACTION_NOT_APPLIED (packages/agent-ui/a2ui/src/catalog/hidden-state-checks.ts near :508) fires only for a real move, not for greetings and thinking aloud: "Good morning, shopkeeper.", "Greetings, merchant.", "Good evening, Dungeon Master.", "Let me think about it.", "Hmm.", "Good game so far." stay quiet, because the repair otherwise asks for a surface update the turn has no move for. "Describe the room." is a request for narration and also stays quiet.

## Intent
- Do: find why the classifier defaults to move (SMALL_TALK list too narrow, no greeting or hesitation class) and fix it at the classifier, not by growing a word list per example: a greeting form (salutation plus optional addressee), a hesitation or filler form, and a describe or narrate request. Add each phrase above as a quiet negative test that is red on main, and keep every existing positive move test green ("I attack the goblin", "Buy the sword", "Hit", "Guess E" style moves). Run the base vs built sweep the earlier hidden-state tickets used over the recorded rounds and replays and report counts; no recorded move may be lost.
- Non-goals: repair wording; other checks.
- Done when: the negatives fail on main and pass after; the sweep shows no lost hits; `npm run check`, `npx vitest run packages/agent-ui/a2ui/src/catalog packages/agent-ui/a2ui/src/live-agent` and `npx vitest run --project scripts scripts/e2e-admin/probe` exit 0.

## Context
From .sdlc/notes/notes.md :461 (T-0363-era verifier probe). T-0409 just narrowed the game gate in the same file (hidden-state-checks.ts :542); this is the move classifier, a different function. Never rewrite .sdlc/evals/rounds.

## Constraints
No em dashes. ADRs frozen.
- Lane: solo because size L1 (steps.py lane); overnight goal 2026-10-21

## Acceptance criteria
1. `npx vitest run packages/agent-ui/a2ui/src/catalog/hidden-state-checks.test.ts` exits 0, and the T-0415 quiet test ("a greeting, a hesitation, praise or a describe request stays quiet") fails on main (`git stash`-free check: the test file applied over the base hidden-state-checks.ts).
2. The T-0415 positive test keeps short moves and a move after a greeting or hesitation as ACTION_NOT_APPLIED.
3. The base vs built classifier sweep over the recorded intents in `.sdlc/evals/rounds` and `scripts/e2e-admin/probe` shows no intent that was a move at base and is quiet after.
4. `npm run check`, `npx vitest run packages/agent-ui/a2ui/src/catalog packages/agent-ui/a2ui/src/live-agent` and `npx vitest run --project scripts scripts/e2e-admin/probe` exit 0.

## Outcome

2026-10-22 · lane: solo L1 · verdict: pass · verifier: verifier-L3 (fable) · base: 6762132bd16c
- Changed: playsMove reads a greeting, a hesitation and a describe request as non-moves, so ACTION_NOT_APPLIED stays quiet on them; the recorded-intent sweep loses no move
- Commits: none
- Check: 1 `npx vitest run packages/agent-ui/a2ui/src/catalog/hidden-state-checks.test.ts` exits 0, and the ...: pass
- Check: 2 The T-0415 positive test keeps short moves and a move after a greeting or hesitation as ACTION_NO...: pass
- Check: 3 The base vs built classifier sweep over the recorded intents in `.sdlc/evals/rounds` and `scripts...: pass
- Check: 4 `npm run check`, `npx vitest run packages/agent-ui/a2ui/src/catalog packages/agent-ui/a2ui/src/li...: pass
- Follow-up: decide: packages/agent-ui/a2ui/src/catalog/hidden-state-checks.ts:511: a... -> notes.md
