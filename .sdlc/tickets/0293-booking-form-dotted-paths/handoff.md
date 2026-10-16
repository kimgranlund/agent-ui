---
id: T-0293
title: "A BookingForm with dotted field paths renders blank, and the T-0278 hold then lets a prose 'is booked' pass with no code"
type: bug             # feature | bug | chore | spike | idea
status: proposed     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-15
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
A BookingForm whose field paths miss its bound value is sent back, and a confirm on such a form never passes as a prose booking.

## Repro
Keyless: `npx vitest run scripts/e2e-admin/probe/replays/concierge-haiku-dotted-booking-paths.test.mjs` (pinned, `// expectedFail: T-0293`). Live: `.sdlc/evals/rounds/2026-10-15-r5-fixes/` traces :60-:61; screenshot `$AGENT_UI_EVIDENCE_DIR/2026-10-15-r5-fixes/regress-concierge-facilities-then-tour-haiku-1/turn-3.png` shows every field blank.

## Expected
Turn 2 gets a finding that names the key-only paths; the repaired form renders pre-filled.

## Actual
:60 binds `value` to `/booking` and names fields `booking.tour`, `booking.date`, `booking.guests`, `booking.name`; the factory prefills from `value[field.path]`, so all four render blank, and no check fires. On :61 "Confirm it, the details are right." the T-0278 hold sees blank required fields and keeps SURFACE_MISSING quiet; Haiku replies "Your half-day coastal boat tour is booked" with flowEnd and no surface.

## Context
Fog report `4095416195875afe423e60ea`, decision d6, finding f6 (T-0287). `blankRequiredField` and `confirmHeldOpen` in `packages/agent-ui/a2ui/src/catalog/personas/concierge/checks.ts`; the prefill in `packages/agent-ui/a2ui/src/catalog/personas/concierge/factories.ts`. Not T-0278's case (that form was genuinely blank).

## Constraints
The failing test lands before or with the fix.
