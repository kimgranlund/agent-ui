---
id: T-0444
title: "/__a2ui/agent/chat aborts the paid call when the client disconnects"
type: bug            # feature | bug | chore | spike | idea
status: done     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-24
claimed_by: claude:a8ce3b21 2026-10-24
from: T-0438
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
A client disconnect from `/__a2ui/agent/chat` aborts the in-flight paid model call, the same guarantee the arena route got in T-0438.

## Context
Follow-up from T-0438 (verifier notes). The chat route buffers the whole reply and writes nothing while the paid call runs, so `request.signal` never fires on disconnect even with the `enable_request_signal` compat flag. T-0438 fixed the arena by streaming a 1 s heartbeat; see `a2ui/tools/agent/worker/arena-route.ts` and `request-signal.test.ts`.

## Constraints
The chat reply wire format the site and devtools read stays the same (or both readers change in the same diff). Keys never leave the Worker (ADR-0073 boundary).

## Acceptance criteria
- `npx vitest run packages/agent-ui/a2ui/tools/agent/worker/request-signal.test.ts` exits 0: the `/__a2ui/agent/chat` leg sees the upstream call aborted after a mid-call disconnect, and its no-flag negative control sees it run on.
- `npx vitest run packages/agent-ui/a2ui/tools/agent/worker/ site/lib/admin-live-runner.test.ts site/lib/agent-auto-name.test.ts` exits 0: the bundle's stall and deadline legs answer `200 {error}` with the plain-words lines, and the site runner reads a heartbeat-led `{text}` or `{error}` body.
- `npm run check` exits 0.

## Done when
- A Miniflare test shows a disconnect mid-call aborts the upstream call for the chat route.
- `npm run check` and the touched folders' tests pass.
- Lane: solo because size L2 (steps.py lane); overnight goal 2026-10-21

## Outcome

2026-10-24 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: 8c724c43552b
- Changed: The /__a2ui/agent/chat route streams a heartbeat so a client disconnect aborts the paid model call
- Commits: none
- Check: 1 request-signal.test.ts exits 0, chat leg aborts after disconnect, no-flag negative control runs on: pass
- Check: 2 worker/ + admin-live-runner + agent-auto-name tests exit 0: pass
- Check: 3 `npm run check` exits 0: pass
- Follow-up: note: packages/agent-ui/a2ui/tools/agent/chat-validation.ts:48 still says... -> notes.md
- Follow-up: note: the builder wrote the ## Acceptance criteria section into... -> notes.md
- Follow-up: note: wire asymmetry between the Worker 200 {error} and the dev proxy 500... -> notes.md
