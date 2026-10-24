---
id: T-0443
title: "The restaurant smoke probe expects BookingForm, the persona's shipped booking surface"
type: chore           # feature | bug | chore | spike | idea
status: done     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-24
claimed_by: claude:a8ce3b21 2026-10-24
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 5
---

## Goal
The restaurant smoke probe scenario (scripts/e2e-admin/probe/scenarios/restaurant.ts) expects the persona's BookingForm instead of Field, and plan.test.mjs is repinned, so the smoke reports the persona's real behavior.

## Context
T-0440 live sweep: the restaurant fail is a stale oracle; the persona ships one BookingForm (T-0403 settled the booking flow).

## Constraints
Change the expectation only; no persona or prompt change.

## Done when
The probe plan tests pass; npm run check plus the scripts/e2e-admin tests pass.
- Lane: solo because size L1 (steps.py lane); overnight goal 2026-10-21

## Outcome

2026-10-24 · lane: solo L1 · verdict: pass · verifier: verifier-L1 (opus) · base: cfa5d411205a
- Changed: The restaurant smoke probe expects BookingForm, the persona's shipped booking surface
- Commits: none
- Check: 1 The probe plan tests pass; npm run check plus the scripts/e2e-admin tests pass: pass
- Follow-up: note: scripts/e2e-admin/probe/replays/smoke-restaurant-reserve-table-haik... -> notes.md
