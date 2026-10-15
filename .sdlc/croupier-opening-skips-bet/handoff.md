---
id: T-0232
title: "Croupier opens a blackjack-family game already dealt at a default stake, with no bet strip"
type: bug             # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-15
branch: fix/lane-h-agent-behavior
worktree: .claude/worktrees/wave-lh
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
A Croupier game's first table opens in the betting phase, so the player picks the first stake on the CardTable bet strip, as Deal again does since T-0211.

## Repro
1. `npx vitest run scripts/e2e-admin/probe/replays/croupier-sonnet-opening-dealt.test.mjs` (pins the trace; every check is green today).
2. Open `.sdlc/evals/rounds/2026-10-15-r2-presets/runs/croupier-blackjack-rounds-sonnet-1/turn-1.png` (git-ignored pngs, in the wave-r2 worktree).

## Expected
"Let's play blackjack." opens one CardTable in phase betting, empty hands, bankroll 1,000, `"betAction":"deal"`.

## Actual
Sonnet 5.5 deals at a stake it picked: "You start with 1,000 chips and a 50 bet is down. I'm showing a 10, and you have 14." (`2026-10-15.jsonl:104`), and pontoon the same, "50 is on this hand. You hold 15" (:125). The run's next step clicks the "100" chip and finds only Hit, Stand, Double (Twist, Stick, Buy). 2 of 8 Sonnet openings; Haiku and Opus opened in betting every time.

## Context
`newRoundFindings` (NEW_ROUND_NOT_BETTING, `packages/agent-ui/a2ui/src/catalog/personas/croupier/checks.ts`) judges only an action turn that answers Deal again; a say turn's first table is never judged. Guess: extend the same finding to a CardTable created on a say turn that names no stake. A typed "Deal me in for 100" names one and stays legal. Found by T-0225 (`.sdlc/evals/rounds/2026-10-15-r2-presets/report.md`).

## Constraints
The failing test lands before or with the fix, never after. No em dashes.

## Acceptance criteria
- (red) `npx vitest run --project packages packages/agent-ui/a2ui/src/catalog/personas/croupier/checks.test.ts` exits 0: a say turn whose new CardTable is dealt with no stake in the user's words gets NEW_ROUND_NOT_BETTING; a typed stake passes.
- `npx vitest run scripts/e2e-admin/probe/replays/croupier-sonnet-opening-dealt.test.mjs` exits 0 with the replay now recording the repair round, or the test rewritten to expect the finding.
- `npm run check` exits 0.
