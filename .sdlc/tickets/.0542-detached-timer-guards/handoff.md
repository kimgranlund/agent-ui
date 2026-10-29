---
id: T-0542
title: "Timers and deferred turns stop acting on a detached host"
type: bug             # feature | bug | chore | spike | idea
status: done
size: L1
priority: P2         # P1 | P2 | P3
depends: []
created: 2026-10-28
claimed_by: claude:a8ce3b21 2026-10-28
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 5
---

## Goal
The Low findings below are fixed: no timer, rAF or deferred turn acts on a host after it is removed, and the misleading parameter name is corrected.

## Intent
- Do: add `isConnected` guards (or cancel on disconnect) for conversation-dialog `followTail` and agent-admin's deferred surface turns; clear roving-focus `typeTimer` in its cleanup; guard the one-shot ready rAFs; rename text-field's `typeAc` parameter; a jsdom or browser test per guard that fails on base where a test is practical.
- Done when: each guarded path is proved (test or mutation noted); `npm run check` and the touched tests exit 0.

## Context
From the T-0535 cleanup and leak sweep (#2336):

### Low
1. `packages/agent-ui/app/src/controls/conversation/conversation-dialog.ts:98` `setTimeout(tick, TAIL_FOLLOW_CHECK_MS)`: the `followTail` poll keeps writing `scrollTop` on a detached host. Evidence (run): 1 pending timeout right after removal, the promise still resolved `settled`. Bounded (about 1 s) and harmless. Fix: `if (!this.isConnected) { resolve('skipped'); return }` at the top of `tick`.
2. `packages/agent-ui/app/src/controls/agent-admin/agent-admin.ts:2930` and `:2936` `setTimeout(() => this.#runSurfaceTurn(...), 0)`: a surface turn deferred one macrotask runs even if the admin was removed in between (static read; not probed, agent-admin needs keys). Fix: guard the callback with `if (!this.isConnected) return`.
3. `packages/agent-ui/components/src/traits/roving-focus.ts:205` `typeTimer = setTimeout(...)`: `cleanup()` at `:251` cancels `settleHandle` but not `typeTimer`. 200 ms, only clears a local buffer. Fix: `if (typeTimer !== null) clearTimeout(typeTimer)` in `cleanup()`.
4. One-shot motion-gate frames such as `requestAnimationFrame(() => this.internals.states?.add('ready'))` (`button.ts:72`, `toggle.ts:75`, `tabs.ts:208`, `text-field.ts:667` and ten more) and `conversation.ts:1361` (copy label reset) run once on a possibly detached host. Benign by design. Fix: none needed; note only.
5. `packages/agent-ui/components/src/controls/text-field/text-field.ts:915` and `:1002`: the parameter is named `typeAc` but is an `AbortSignal`, so `{ signal: typeAc }` at `:934`, `:956`, `:1022`, `:1029` reads like the controller bug it is not. Fix: rename the parameter `typeSignal`.

- Proposed ticket (Low group): "Detached-host timer guards": add `isConnected` guards to conversation-dialog `followTail` and agent-admin's deferred surface turns, clear roving-focus `typeTimer` in cleanup, and rename text-field's `typeAc` signal parameter.


## Constraints
Browser runs through `scripts/gate_lock.py`. No em dashes.
- Lane: solo because size L1 (steps.py lane)

## Outcome

2026-10-28 · lane: solo L1 · verdict: pass · verifier: verifier-L1 (opus) · base: 006e977b7e5d
- Changed: Timers and deferred turns stop acting on a detached host, and roving-focus clears its type-ahead timer
- Commits: none
- Check: 1 each guarded path is proved (test or mutation noted): pass
- Check: 2 `npm run check` and the touched tests exit 0: pass
- Follow-up: note: packages/agent-ui/app/src/controls/agent-admin/agent-admin.ts:2932... -> notes.md
- Follow-up: note: the builder used git stash for its mutation check 0542-solo-L1.md... -> notes.md
