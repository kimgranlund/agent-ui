---
id: T-0298
title: "Haiku repair rounds never call render_surface: force the tool on a no-tool repair round"
type: bug             # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-16
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
A Haiku repair round after a turn with a target meta-line and no tool call is asked with tool_choice render_surface, so the update is applied.

## Context
Round 6 cluster C (`.sdlc/evals/rounds/2026-10-15-r6-matrix/report.md`): :2 ran three rounds with no tool call while Haiku's reasoning said it needed to send the update; :75 missed rounds 1 and 2. 33 failed Haiku rounds had a target meta-line and no tool call. Opus applies the same deal in one round (:366). Cause (c), with a harness lever.

## Scope
`packages/agent-ui/a2ui/src/agent/produce.ts` and `providers/anthropic.ts` toolChoice: on a repair round after a no-tool round (ACTION_NOT_APPLIED or similar) for a model where forced tool use is allowed (thinking off; the API rejects forced tool_choice with extended thinking), set tool_choice to render_surface.

## Done when
- A produce test: a no-tool ACTION_NOT_APPLIED round builds a Haiku round 2 request with tool_choice render_surface, and a thinking-on request does not; red at the base.
- The live-agent tests and `npm run check` exit 0.

## Acceptance criteria
- (red) `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/produce-forced-surface.test.ts`
- (guard) `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent`
- (guard) `npm run check`
