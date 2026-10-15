---
id: T-0265
title: "Haiku answers in prose with no surface on game openings, Admiral shots and Concierge turns, and no check sends these back"
type: bug             # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-15
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
A Haiku turn that should draw or update a surface, but answers in prose only, is sent back the way a Croupier move already is (ACTION_NOT_APPLIED). This covers a game opening, an Admiral shot at its open board, and a Concierge booking or services turn.

## Repro
Read `.sdlc/evals/rounds/2026-10-15-r3-routing/``runs/` (all Haiku 5.5):
1. `regress-croupier-texas-holdem-haiku-1` t0 and `regress-croupier-five-card-draw-haiku-1` t0: the opening is dealt in prose with no table (:68, "Your hole cards are A♥ K♦").
2. `regress-admiral-opening-salvo-haiku-1` t4 and `regress-admiral-row-sweep-haiku-1` t2: `action-updates-surface`, "the say turn targeting enemy-waters was answered with no update to it".
3. `regress-concierge-spa-booking-haiku-1`: no surface on any of 4 turns (:96-:99). The booking is reviewed and "confirmed" in prose.

## Expected
Each of these turns ships its surface, or the repair round makes it.

## Actual
No check fires on these turns. ACTION_NOT_APPLIED (12 fires, all Haiku Croupier) covers only typed moves at an open Croupier table.

## Context
This follows up T-0214, which was fixed for Croupier moves. Sonnet and Opus never showed this shape in round 3. Found by T-0261.
