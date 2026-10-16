---
id: T-0286
title: "Haiku plays Omaha streets and the stud reply in prose; no check sends them back"
type: bug             # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
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

## Outcome

2026-10-15 · lane: full L2 · verdict: closed by reason (Merged in #2043: poker street moves in prose sent back; JSON-wrapped render target read; verifier L2 pass) · verifier: verifier-L2 (sonnet) · base: 3b0ab74745d7
- Changed: see commits
- Commits: none
- Check: 1 Omaha replay exits 0, ACTION_NOT_APPLIED on turn 4 only: pass
- Check: 2 Stud replay exits 0, no probe check fails, turn 1 target stud-1, turns 5 and 6 quiet: pass
- Check: 3 croupier checks.test.ts exits 0: pass
- Check: 4 `npx vitest run scripts/e2e-admin/probe` exits 0: pass
- Check: 5 `npm run check` exits 0: pass
