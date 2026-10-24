---
id: T-0438
title: "Worker request.signal fires on client disconnect so arena and chat cancels abort paid calls"
type: bug             # feature | bug | chore | spike | idea
status: done     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-24
claimed_by: claude:a8ce3b21 2026-10-24
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
In the production Worker, a client disconnect or Cancel fires request.signal, so an in-flight arena match (/__a2a/arena) and a live chat turn (/__a2ui/agent) abort their paid model call, proven by a test under the workerd semantics the Worker runs with.

## Context
T-0430 left open whether request.signal fires in workerd: it needs the enable_request_signal compatibility flag (or a compatibility_date that includes it) in wrangler.jsonc; the arena route's writer.closed path covers only part of it, and GH #106 claims the same for /__a2ui/agent. Kim wants Cancel to really stop spend before the arena goes live.

## Constraints
Confirm against Cloudflare's own docs which flag or date enables it; no deploy; no live spend.

## Done when
wrangler.jsonc carries the flag or date with a cited reason; a test proves the abort reaches the provider signal; npm run check plus the worker tests pass.
- Lane: solo because size L2 (steps.py lane); overnight goal 2026-10-21

## Acceptance criteria
- `grep -n '"enable_request_signal"' wrangler.jsonc` exits 0, with the comment above it citing the Cloudflare compatibility-flags page.
- `npx vitest run packages/agent-ui/a2ui/tools/agent/worker/` exits 0: request-signal.test.ts runs the dry-run bundle in workerd (Miniflare) under wrangler.jsonc's flags and the stub upstream sees its fetch aborted after a socket drop on `/__a2a/arena` and `/__a2ui/agent`; the arena negative control (flag removed) sees no abort.
- `npm run check` exits 0.

## Outcome

2026-10-24 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: b066d868331f
- Changed: The Worker enables request.signal and the arena heartbeats, so a visitor leaving or cancelling aborts the paid match call
- Commits: none
- Check: 1 `grep -n '"enable_request_signal"' wrangler.jsonc` exits 0 with the comment citing the Cloudflare...: pass
- Check: 2 `npx vitest run packages/agent-ui/a2ui/tools/agent/worker/` exits 0 with request-signal.test.ts p...: pass
- Check: 3 `npm run check` exits 0: pass
- Follow-up: note: redck.py deviations printed no process deviation: lines, and the... -> notes.md
- Follow-up: note: packages/agent-ui/a2ui/tools/agent/worker/request-signal.test.ts... -> notes.md
- Follow-up: decide: /__a2ui/agent/chat buffers the whole reply and writes nothing... -> T-0444
- Follow-up: note: request-signal.test.ts imports miniflare as wrangler's hoisted... -> notes.md
