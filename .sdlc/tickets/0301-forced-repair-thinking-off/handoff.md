---
id: T-0301
title: "A forced render_surface repair round turns thinking off so the forced tool reaches the model"
type: bug             # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-16
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
T-0298's forced `toolChoice` render_surface takes effect on live Haiku: the forced repair round runs with thinking off, so the Anthropic adapter does not drop the forced choice.

## Context
T-0298 (closed) forces render_surface on a repair round after a no-tool round, but `providers/anthropic.ts` drops a forced tool_choice while thinking is on (the API rejects forced tool use with extended thinking). Live rounds run Haiku at effort medium, thinking on, so round 6 cluster C (`.sdlc/evals/rounds/2026-10-15-r6-matrix/report.md`) would not change. Kim 2026-10-16: file it.

## Scope
`packages/agent-ui/a2ui/src/agent/produce.ts` (the forceSurface round) and the provider request build: on the forced round only, disable thinking (and keep it for every other round). Do it per provider capability, not per model name, where the adapter exposes it.

## Done when
- A produce test: at effort medium (thinking on), a no-tool ACTION_NOT_APPLIED round builds round 2 with thinking off and tool_choice render_surface, and round 1 keeps thinking on; red at the base.
- The live-agent tests and `npm run check` exit 0.
