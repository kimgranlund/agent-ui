---
id: T-0310
title: "R8 experiment: force render_surface with thinking off on round 1 of Haiku click turns"
type: feature        # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-16
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
Kim 2026-10-16 (R8): on round 1 of a Haiku turn triggered by a click (an action event), force `tool_choice` render_surface with thinking off, through the per-capability row (T-0301 mechanism). Targets r7's 12 round-1 no-tool calls. Source: `.sdlc/work/routing-architecture-review/` (proposals, challenge and rebuttal under `.sdlc/runtime/tasks/routing-architecture-review/`).

## Done when
- A produce test: a Haiku click turn builds round 1 with thinking disabled and tool_choice render_surface; a typed-message turn and a Sonnet click turn are unchanged; red at the base.
- The live-agent tests and `npm run check` exit 0; the next live round measures round-1 tool calls on Haiku click turns.
