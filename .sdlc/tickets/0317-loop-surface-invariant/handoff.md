---
id: T-0317
title: "Repair loop: never drop a turn's surface silently (L1 to L3 found by the T-0314 property test)"
type: bug             # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L3             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-16
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
Kim 2026-10-16 (L1 ruling): the turn-scoped invariant wins over the T-0172 design. A surface that existed in the turn is kept or explicitly deleted; a later round that omits it is sent back, or the earlier version ships. `packages/agent-ui/a2ui/src/live-agent/check-contracts.test.ts` and `produce-loop-property.test.ts` (T-0314) is the gate: its allowlisted classes shrink to empty.

## Defects
- L1 named: a surface its own failure named can be dropped by a later round that ships other lines (shortest case [Aflag > B]).
- L2 misattributed: `surfacesToKeep` matches component ids across all surfaces, so `root->gone` on ask-1 is blamed on ask-2; the repair says keep the broken ask-1 and the valid ask-2 is lost.
- L3 unattributed: a round sent back only for SURFACE_DROPPED keeps none of its own surfaces, so its valid new surface is lost ([ABbroken > B > A]).

## Done when
- The property test's allowlisted classes are empty and I1 holds over every 2- and 3-round sequence on all transports; the existing replays pass (re-pinned only with a stated reason); the live-agent, probe suites and `npm run check` exit 0.
