---
id: T-0309
title: "Infer flowEnd when a turn declares no ask and no surface instead of a FLOW_END_MISSING repair round (Kim's N1 ruling)"
type: feature        # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-16
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
Kim 2026-10-16 (N1): when a turn declares no ask and no surface, the producer sets `flowEnd` itself and tallies it (e.g. FLOW_END_INFERRED) instead of spending a FLOW_END_MISSING repair round. r6's costliest code (/bin/zsh.67, mostly Opus; on 3 of 5 Opus turns round 1 was already a correct close). Source: `.sdlc/work/routing-architecture-review/` (proposals, challenge and rebuttal under `.sdlc/runtime/tasks/routing-architecture-review/`).

## Done when
- A produce test: a closing turn with no ask and no surface ships in one round with flowEnd set and the tally; a turn with an ask still gets FLOW_END_MISSING where it applies; red at the base.
- The live-agent tests and `npm run check` exit 0; RTS spec lines updated.
