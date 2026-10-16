---
id: T-0305
title: "A repair round updates a surface it never created and no check catches it"
type: bug             # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-16
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
An updateComponents or updateDataModel for a surface id that no message in the turn or the conversation created is caught and repaired, so the guest never loses the surface.

## Context
Round 7 cluster B (`.sdlc/evals/rounds/2026-10-16-r7-fails/report.md`, P1): `long-concierge-booking-confirm-haiku` (:4): a repair round updated ask-1 without createSurface; the guest never saw the booking form. Keyless replay pinned in `scripts/e2e-admin/probe/replays/`.

## Scope
Either the validator rejects an update to a surface never created in the conversation (a named code in the repair feedback), or the dropped-surface logic in `produce.ts` (`surfacesToKeep`) catches it; pick the one that also covers a first round, and say why.

## Done when
- A test: an update to an uncreated surface fails with the named code and the repair asks for createSurface; red at the base.
- The cluster B replay is flipped; the live-agent, concierge and probe suites and `npm run check` exit 0.

## Lane bundle
- T-0304 render_surface messages sent as one JSON string (`.sdlc/tickets/0304-messages-as-json-string`)
- T-0305 a repair round updates a surface it never created (`.sdlc/tickets/0305-update-without-create`)
