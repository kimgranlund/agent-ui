---
id: T-0485
title: "SemanticCheck gains requiresAny, and the GameHud check gates on GameHud plus any play control"
type: chore           # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-27
claimed_by: claude:a8ce3b21 2026-10-27
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 5
---

## Goal
A SemanticCheck can gate on any one of a set of components, and gameAskHudCheck uses it.

## Context
`SemanticCheck.requires` is all-of (`packages/agent-ui/a2ui/src/catalog/semantic-check.ts:145`). T-0482 gated `gameAskHudCheck` on `['GameHud']` and moved the play-control test into the body (`hidden-state-checks.ts:476-483`). Add an optional `requiresAny` (the check runs only when at least one listed component is in the catalog) and set it on `gameAskHudCheck` to its PLAY_CONTROLS.

## Constraints
No behavior change on any recorded fixture: the T-0468, T-0479 and T-0482 cases and the keyless sweep over round 14 and 15 fixtures stay unchanged. No model-read text changes. No em dashes.

## Done when
- A unit case for `requiresAny` (runs with one listed component, skipped with none).
- `npm run check` plus the touched folders' tests pass.
- Lane: solo because size L2 (steps.py lane)

## Outcome

2026-10-27 · lane: solo L2 · verdict: pass · verifier: verifier-L1 (opus) · base: be31c52e658a
- Changed: SemanticCheck gains requiresAny, and the GameHud check runs only when the catalog holds a play control
- Commits: none
- Check: 1 A unit case for `requiresAny` (runs with one listed component, skipped with none): pass
- Check: 2 `npm run check` plus the touched folders' tests pass: pass
- Follow-up: note: packages/agent-ui/a2ui/src/catalog/semantic-check.ts:148 gate is... -> notes.md
