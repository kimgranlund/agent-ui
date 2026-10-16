---
id: T-0286
title: "Haiku plays Omaha streets and the stud reply in prose; no check sends them back"
type: bug             # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-15
branch: fix/poker-street-moves-prose
worktree: ../agent-ui.worktrees/wave-pk
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
A Croupier poker street move (Omaha check, call, bet; the stud reply) answered in prose with no table update is sent back with ACTION_NOT_APPLIED, as T-0280 does for word-board moves.

## Context
Split from T-0280 (2026-10-16): live round 4 cluster D (`.sdlc/evals/rounds/2026-10-15-r4-fixes/report.md`, ## Why it failed and how to fix it). T-0280 covered the Lexicographer guesses and give-up; the Omaha streets and stud reply remain.

## Done when
- A keyless replay of the round 4 Haiku Omaha (and stud) prose turns fails with ACTION_NOT_APPLIED on those turns, and a turn that updates the table stays quiet.
- The croupier checks tests and `npx vitest run scripts/e2e-admin/probe` exit 0; `npm run check` exits 0.

## Acceptance criteria
- `npx vitest run scripts/e2e-admin/probe/replays/croupier-omaha-haiku-street-prose.test.mjs` exits 0, pinned to ACTION_NOT_APPLIED on turn 4 only (turns 1 to 3 update table-1 and stay quiet).
- `npx vitest run scripts/e2e-admin/probe/replays/croupier-stud-haiku-street-prose.test.mjs` exits 0: no probe check fails (turn 1's target reads as stud-1), and the settled-table checks (turns 5, 6) stay quiet.
- `npx vitest run packages/agent-ui/a2ui/src/catalog/personas/croupier/checks.test.ts` exits 0.
- `npx vitest run scripts/e2e-admin/probe` exits 0.
- `npm run check` exits 0.
