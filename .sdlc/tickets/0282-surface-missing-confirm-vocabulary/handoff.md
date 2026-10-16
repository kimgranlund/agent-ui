---
id: T-0282
title: "SURFACE_MISSING misses 'Confirm it' and 'I'd like a table', so Haiku books a tour in prose with no surface"
type: bug             # feature | bug | chore | spike | idea
status: proposed     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-15
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
SURFACE_MISSING recognizes the booking and confirm asks the round scenarios actually use.

## Repro
`.sdlc/evals/rounds/2026-10-15-r4-fixes/`traces :84 (Haiku "Confirm it, the details are right."), :12 and :24 ("I'd like a table at Vela ..."), :14 ("Yes, confirm the table for four.").

## Expected
A confirm or booking ask answered in prose with no surface is SURFACE_MISSING.

## Actual
`CONFIRM` (`/\bconfirm\b[^.?!]*\b(booking|reservation|appointment|slot)\b/i`) and `BOOK` (`book|reserve|reservation`) miss "Confirm it", "confirm the table" and "I'd like a table". At :84 Haiku answered "Your half-day coastal boat tour is booked" with no surface and no check fired.

## Context
`packages/agent-ui/a2ui/src/catalog/personas/concierge/checks.ts:13-17`. A follow-up to T-0265. Found by T-0275.

## Done when
- `npx vitest run --project packages packages/agent-ui/a2ui/src/catalog/personas/concierge/checks.test.ts` exits 0 with cases for the three phrases above, and a pool-hours question still passes.
- `npm run check` exits 0.
