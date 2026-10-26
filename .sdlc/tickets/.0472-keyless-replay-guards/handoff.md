---
id: T-0472
title: "Keyless replays guard the round 14 fixes proven only by paid runs"
type: chore           # feature | bug | chore | spike | idea
status: done     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-26
claimed_by: claude:a8ce3b21 2026-10-26
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 5
---

## Goal
The shopkeeper cold compare (T-0453) and the same-turn ask deck (T-0467) each have a keyless regression guard.

## Context
T-0453 closed with no `reach-shopkeeper-compare` scenario or `--from-trace` replay (notes: shopkeeper.ts:11). T-0467 (`mintedThisTurn` in conversation.ts) has unit tests but no browser or probe replay of the round 14 trace. Wave 2.

## Constraints
Replays come from recorded traces via `chat:probe --from-trace`; no paid run. No em dashes.

## Done when
- A replay of the shopkeeper cold compare passes on main and fails with the T-0453 seed reverted.
- A replay of the round 14 same-turn ask deck passes on main and fails with `mintedThisTurn` removed.
- `npm run check` plus the touched folders' tests pass.
- Lane: solo because size L1 (steps.py lane)

## Outcome

2026-10-26 · lane: solo L1 · verdict: pass · verifier: verifier-L1 (opus) · base: 3bb64e01f5a1
- Changed: A keyless replay guards the round 14 same-turn ask deck (T-0467) in the probe and in ui-conversation
- Commits: none
- Check: 1 A replay of the shopkeeper cold compare passes on main and fails with the T-0453 seed reverted: pass
- Check: 2 A replay of the round 14 same-turn ask deck passes on main and fails with `mintedThisTurn` removed: pass
- Check: 3 `npm run check` plus the touched folders' tests pass: pass
- Check: 4 Lane: solo because size L1 (steps.py lane): pass
- Follow-up: note: scripts/e2e-admin/probe/replays/mentalist-haiku-same-turn-ask-deck.... -> notes.md
- Follow-up: note: the solo report's T-0467 ordering dependency is moot; T-0467 is... -> notes.md
