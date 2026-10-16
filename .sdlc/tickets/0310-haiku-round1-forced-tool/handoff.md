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

verifier: L3

## Acceptance criteria
- (red) `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/produce-forced-surface.test.ts` exits 0: round 1 of a Haiku 5.5 click turn (effort unset, low, medium, high) sends `thinking: {type:'disabled'}` and `tool_choice: {type:'tool', name:'render_surface'}`; at xhigh, on a typed-message Haiku turn and on a Sonnet 5.5 click turn, round 1 carries no `toolChoice` and no thinking override at the seam; the T-0298 and T-0301 repair-round forcing still holds.
- (red) `grep -q T-0310 .claude/docs/spec/response-type-selection.spec.md` exits 0 (RTS-R2 names the round-1 forcing).
- `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent` exits 0.
- `npx vitest run --project scripts scripts/e2e-admin/probe/replays` exits 0.
- `npm run check` exits 0.
- Live measurement (not a gate): the next live round counts round-1 `render_surface` calls on Haiku click turns against r7's 12 no-tool round-1 calls.
