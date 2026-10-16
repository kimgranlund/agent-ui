---
id: T-0325
title: "The texas-holdem scenario assumes a showdown: no fixed click after a move that can end the hand"
type: bug             # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-16
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
Round 8 cluster G, `.sdlc/evals/rounds/2026-10-16-r8-matrix/report.md` (`## Why it failed and how to fix it`): in `texas-holdem-opus` (:411) the dealer folded to Bet 50, the hand ended, and the scripted Check started round 2; the later Deal again click found Check, Bet and Fold. The play is legal; the scenario is wrong.

## Done when
- `scripts/e2e-admin/probe/scenarios/croupier.ts` texas-holdem has no fixed click after a move that can end the hand (or clicks Deal again only when present); the scenario test pins the new steps and the round generators regenerate cleanly; the probe suite and `npm run check` exit 0.

## Acceptance criteria
- The live-round texas-holdem steps put Deal again or the harmless street (`STUD_STREET`, "If the hand is already over, leave the table as it is.") after every move that can end the hand (Bet 50, Fold, Raise 100), keep four betting rounds before the first Deal again, and leave the frozen T-0184 `SCENARIOS` alone; the pin is red at the base (`33e530b6`) and green after: `npx vitest run scripts/e2e-admin/probe/scenarios/croupier.test.mjs -t "T-0325"` exits 0 (exit 1 at the base).
- The round generators regenerate cleanly: the r2 to r6 and r8 `live-commands.sh` files are regenerated with only their texas-holdem lines changed, and every round pin is green: `npx vitest run scripts/e2e-admin/probe/scenarios` exits 0.
- The probe suite: `npx vitest run scripts/e2e-admin/probe` exits 0.
- `npm run check` exits 0.
