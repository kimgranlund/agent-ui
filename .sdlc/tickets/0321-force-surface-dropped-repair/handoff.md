---
id: T-0321
title: "Force render_surface on a SURFACE_DROPPED repair round; the fallback never ships a round a check already failed"
type: bug             # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-16
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
Kim 2026-10-16: a SURFACE_DROPPED repair round gets the forced render_surface (the T-0298/T-0301 mechanism), and the T-0302 earlier-round fallback never ships a round that a semantic check already failed.

## Context
Round 8 cluster B, `.sdlc/evals/rounds/2026-10-16-r8-matrix/report.md` (`## Why it failed and how to fix it`): `long-booking-confirm-haiku` (:169): round 1 failed BOOKING_FORM_MISSING, rounds 2 and 3 answered in prose with thinking on and no tool call, then T-0302 shipped round 1 (EARLIER_ROUND_SHIPPED, SEMANTIC_UNCORRECTED). `produce.ts:1711` sets no forceSurfaceRound after SURFACE_DROPPED. This narrows the T-0302 reading ("a semantic finding never blocks the fallback").

## Done when
- A produce test: after SURFACE_DROPPED the next Haiku round is forced with thinking off; a fallback candidate that failed a semantic check is not shipped (the turn degrades or halts as the spec says); red at the base. The T-0317 property test and the replays stay green (re-pin with a stated reason); `npm run check` exits 0; RTS spec updated.
