---
id: T-0224
title: "Dev proxy and Worker silently drop a persona over 16,384 characters"
type: bug             # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
A persona over the 16,384-character limit fails loudly (a 4xx with a dev reason in the chat, and a trace line) instead of being silently dropped, in both the dev proxy and the Worker.

## Context
Found in T-0207 (lane 4): `packages/agent-ui/a2ui/tools/agent/dev-proxy-plugin.ts:525` and `packages/agent-ui/a2ui/tools/agent/worker/index.ts:266`. The T-0207 budget test already fails a shipped preset over the limit; a user-edited persona is not covered.

## Done when
- A test per path sends a 16,385-character persona and gets the loud failure, not a turn without the persona.
- `npm run check` plus the touched tests exit 0.
