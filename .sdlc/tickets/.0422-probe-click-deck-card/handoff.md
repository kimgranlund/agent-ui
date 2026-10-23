---
id: T-0422
title: "chat:probe --click presses an OptionDeck card when no surface button carries the label"
type: bug             # feature | bug | chore | spike | idea
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
`npm run chat:probe -- --click <label>` presses an OptionDeck card whose title is the label when no surface button reads it, so a live probe can answer the single-pick decks T-0419 made the default. A click that matches neither still fails as click-target.

## Context
Follow-up from T-0419 (verifier note, architect-L1-2.md:139). scripts/e2e-admin/probe/run.ts:252 calls only `admin.clickSurfaceButton`; scripts/e2e-admin/admin-page.ts already has `surfaceOptionTitles` and `pickSurfaceOption` (T-0412).

## Constraints
Buttons keep precedence; the ClickReach and click-target semantics (T-0271, T-0172) stay intact. Keyless only, no live spend.

## Done when
A keyless test (beside the probe tests or an e2e-admin flow) proves a --click on a deck card title presses it and a missing label still reports click-target; npm run check plus the scripts/e2e-admin tests pass.
- Lane: solo because size L1 (steps.py lane); overnight goal 2026-10-21

## Outcome

2026-10-23 · lane: solo L1 · verdict: pass · verifier: verifier-L1 (opus) · base: 780958a30381
- Changed: chat:probe --click presses an OptionDeck card when no surface button reads the label; buttons keep precedence and a miss still reports click-target
- Commits: none
- Check: 1 A keyless test proves a --click on a deck card title presses it and a missing label still reports...: pass
- Check: 2 npm run check plus the scripts/e2e-admin tests pass: pass
- Follow-up: note: scripts/e2e-admin/README.md:25 says available on a missing click... -> notes.md
