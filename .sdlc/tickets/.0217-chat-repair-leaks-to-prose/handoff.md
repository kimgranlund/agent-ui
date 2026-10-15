---
id: T-0217
title: "Repair corrections and surface ids leak into the Croupier's chat reply"
type: bug             # feature | bug | chore | spike | idea
status: done     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P3         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
The player never sees a repair round or an internal id in the Croupier's reply.

## Repro
1. Read turn 2 of `.sdlc/evals/rounds/2026-10-14-r1-croupier/runs/blackjack-moves-sonnet-1/report.json`, or `npx vitest run scripts/e2e-admin/probe/replays/croupier-first-deal-debit.test.mjs`.

## Expected
"Bet of 250 is down, leaving 750."

## Actual
After a repair round the reply opens "Corrected: the 250 bet is now taken out of your bankroll" (blackjack-moves-sonnet :65, blackjack-rounds-sonnet :55, spanish-21 haiku :19 and sonnet :75, pontoon-sonnet :85). Haiku also said "Table-3 is open" (blackjack-moves-haiku-1 turn 8, :12), naming the surface id.

## Context
Guess: the repair message invites a correction note, and the reply of the repaired round replaces the first one. Proposed: the repair prompt says the player never saw the rejected round; a probe check for `Corrected:` and `table-\d` / `ask-\d` in chat prose. Found by T-0184 (`.sdlc/evals/rounds/2026-10-14-r1-croupier/report.md`); run folders and screenshots under `.sdlc/evals/rounds/2026-10-14-r1-croupier/runs/` in the T-0184 lane commit; the trace file is git-ignored in the wave-cl worktree.

## Constraints
The failing test lands before or with the fix, never after. No em dashes.

## Acceptance criteria
- (red) `node scripts/chat-probe.mjs selftest` exits 0: a `Corrected:` note or a `table-3` style surface id in chat prose fails the new `no-internal-leak` check.
- (red) `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/produce-response-type.test.ts` exits 0: the render_surface repair feedback tells the model the user never saw the rejected surface, so the reply carries no correction note and no surface id.
- `npx vitest run scripts/e2e-admin/probe/replays` exits 0.
- `npm run check` exits 0.

## Outcome

2026-10-14 · lane: full L1 · verdict: closed by reason (Merged in #1997; batched lane verifier L2 pass) · verifier: none · base: none
- Changed: see commits
- Commits: none
