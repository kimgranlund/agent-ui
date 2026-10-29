---
id: T-0535
title: "Cleanup and leak sweep: listeners, observers, timers and effects released on disconnect"
type: chore           # feature | bug | chore | spike | idea
status: done
size: L2
priority: P2         # P1 | P2 | P3
depends: []
created: 2026-10-28
claimed_by: claude:a8ce3b21 2026-10-28
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
A ranked list of ui-* controls, traits and app compositions that leave listeners, observers, timers, effects or popovers alive after disconnect, or break when reconnected.

## Intent
- Do: read every `connected()` and trait (traits are `(host, opts) => cleanup`, invoked from `connected()`) under `packages/agent-ui/components/src` and `packages/agent-ui/app/src` for `addEventListener` on window/document, `ResizeObserver`/`MutationObserver`/`IntersectionObserver`, `setTimeout`/`setInterval`/`requestAnimationFrame`, signal effects and popover or top-layer state without a matching release; spot-check suspects in a real browser with a connect, disconnect, reconnect loop counting listeners or observer callbacks. Write `## Findings` to this handoff.
- Non-goals: fixing anything.
- Done when: `## Findings` exists grouped High / Medium / Low, each with file:line, evidence and a one-line fix, plus a proposed ticket per group; High findings confirmed by a run or a quoted line; `git status --short -- . ':!.sdlc'` prints nothing.

## Constraints
Read-only outside `.sdlc`. Browser runs through `scripts/gate_lock.py`. No em dashes. No paid runs.
- Lane: solo because size L2 (steps.py lane)

## Acceptance criteria
- `## Findings` exists with `### High`, `### Medium` and `### Low` groups; each finding carries a file:line, evidence and a one-line fix, and each group ends with a proposed ticket.
- Every High finding is confirmed by a browser run or a quoted line (here: the High group is empty and says so, backed by the probe results under `.sdlc/runtime/tasks/0535-cleanup-leak-sweep/probe/`).
- Nothing outside `.sdlc` changed: `git status --short -- . ':!.sdlc'` prints nothing.

## Findings

Method. Static read of every `connected()`/`disconnected()` and trait under `packages/agent-ui/components/src` and `packages/agent-ui/app/src` for raw `addEventListener`, the three observers, `setTimeout`/`setInterval`/`requestAnimationFrame`, unscoped `effect()`/`computed()` and popover or dialog state. The base class (`dom/element.ts:176`, `#teardown`) disposes the connection scope and aborts the connection signal, so `this.listen`/`this.effect` are safe by construction; the sweep looked for code outside those two paths. Browser run (Chromium, through `gate_lock.py`): a probe instruments `EventTarget.prototype.addEventListener`/`removeEventListener` (honouring `signal`), wraps `ResizeObserver`/`MutationObserver`/`IntersectionObserver`, `setInterval`, `setTimeout` and `requestAnimationFrame`, then runs a warm-up cycle and three connect, disconnect, reconnect cycles over all 92 `CONTROLS` registry tags plus 11 app compositions (agent-admin excluded: keys and asset loads), with lazy paths armed (open overlays, `hotkey`, a tooltip `mouseenter`, an active status-stream entry, six text-field types with their pickers opened and type flips). Probe, config and raw results: `.sdlc/runtime/tasks/0535-cleanup-leak-sweep/probe/` (`leak-probe.browser.test.ts`, `instrument.ts`, `vitest.probe.config.ts`, `probe-results.json`); rerun with `npx vitest run --config .sdlc/runtime/tasks/0535-cleanup-leak-sweep/probe/vitest.probe.config.ts`.

Headline (measured): across 103 hosts, zero window/document listeners, zero observers, zero intervals and zero open popovers survive removal, and no host stacks listeners on reconnect (host listener count equal on cycles 1 and 3 for every tag; text-field type flips oscillate 8/12/8/12, never grow). Every observer in the tree has a matching `disconnect()` on the disconnect path; the instrumentation itself was live (for example ui-select 10 host listeners and 4 observers while connected, 0 observers after removal).

### High
None confirmed. No listener, observer, interval or top-layer leak reproduced in a real engine, and no static read found a global listener or observer outside a released path.
- Proposed ticket (High group): none for a defect. Optional chore: promote the probe to a standing `*.browser.test.ts` gate in the components shard (assert zero globals/observers/intervals after removal and equal host listener counts across reconnects for every `CONTROLS` tag) so a future control cannot regress the fleet-wide zero.

### Medium
1. `packages/agent-ui/components/src/controls/status-stream/status-stream.ts:376` (`connected()`) never calls `#refreshTicking()`; `disconnected()` at `:420` calls `this.#stopTicking()`. The only re-arm callers are `:498` (`appendEntry`), `:533` (`update`) and `:969` (`oneline`). Evidence (run, `status-stream-reconnect`): intervals 1 while connected with an `active` entry, 0 after removal, 0 after reconnect, and the elapsed text did not change across 1.1 s after reconnect. A moved or re-attached stream shows frozen elapsed times until the next entry update. Fix: call `this.#refreshTicking()` at the end of `connected()`.
2. `packages/agent-ui/components/src/traits/overlay.ts:827` (`cleanup()`, registered at `:848` via `host.effect(() => cleanup)`) hides the popup on disconnect but emits no `close`/`toggle` and leaves the host `open` prop true; each control's model effect (`tooltip.ts:158`, `popover.ts:128`, and the `modal.ts:108` / drawer equivalents) re-opens on reconnect. Evidence (run, `*-open-reconnect`): for ui-popover, ui-menu, ui-select, ui-tooltip, ui-modal and ui-drawer, `open` stays true after removal and the panel or dialog is showing again after reconnect (1 open before, 1 open after). For a DOM move this preserves state, but a two-way bind sees `open` true while the element is detached with no event, a hover-only tooltip re-shows with no hover, and a modal re-runs `showModal()` (focus trap, inert page) on re-insertion. Fix: decide the contract per family; for tooltip at least, set `open = false` in `disconnected()`; for the rest either announce `close` on disconnect or document reopen-on-reconnect in the descriptors.

- Proposed ticket (Medium group): "Reconnect contract for timers and overlays": re-arm status-stream ticking in `connected()`, and rule the overlay family's open-across-disconnect behaviour (close tooltip on disconnect; announce or document for popover, menu, select, combo-box, form-popover, modal, drawer), each with a connect, disconnect, reconnect browser test.

### Low
1. `packages/agent-ui/app/src/controls/conversation/conversation-dialog.ts:98` `setTimeout(tick, TAIL_FOLLOW_CHECK_MS)`: the `followTail` poll keeps writing `scrollTop` on a detached host. Evidence (run): 1 pending timeout right after removal, the promise still resolved `settled`. Bounded (about 1 s) and harmless. Fix: `if (!this.isConnected) { resolve('skipped'); return }` at the top of `tick`.
2. `packages/agent-ui/app/src/controls/agent-admin/agent-admin.ts:2930` and `:2936` `setTimeout(() => this.#runSurfaceTurn(...), 0)`: a surface turn deferred one macrotask runs even if the admin was removed in between (static read; not probed, agent-admin needs keys). Fix: guard the callback with `if (!this.isConnected) return`.
3. `packages/agent-ui/components/src/traits/roving-focus.ts:205` `typeTimer = setTimeout(...)`: `cleanup()` at `:251` cancels `settleHandle` but not `typeTimer`. 200 ms, only clears a local buffer. Fix: `if (typeTimer !== null) clearTimeout(typeTimer)` in `cleanup()`.
4. One-shot motion-gate frames such as `requestAnimationFrame(() => this.internals.states?.add('ready'))` (`button.ts:72`, `toggle.ts:75`, `tabs.ts:208`, `text-field.ts:667` and ten more) and `conversation.ts:1361` (copy label reset) run once on a possibly detached host. Benign by design. Fix: none needed; note only.
5. `packages/agent-ui/components/src/controls/text-field/text-field.ts:915` and `:1002`: the parameter is named `typeAc` but is an `AbortSignal`, so `{ signal: typeAc }` at `:934`, `:956`, `:1022`, `:1029` reads like the controller bug it is not. Fix: rename the parameter `typeSignal`.

- Proposed ticket (Low group): "Detached-host timer guards": add `isConnected` guards to conversation-dialog `followTail` and agent-admin's deferred surface turns, clear roving-focus `typeTimer` in cleanup, and rename text-field's `typeAc` signal parameter.

## Outcome

2026-10-28 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: 5a4ff7e81424
- Changed: Cleanup and leak sweep: no leaks after removal; reconnect and detached-timer findings with proposed tickets
- Commits: none
- Check: 1 `## Findings` has `### High`, `### Medium`, `### Low`, each finding with file:line, evidence and ...: pass
- Check: 2 High group is empty, backed by probe results under `.sdlc/runtime/tasks/0535-cleanup-leak-sweep/p...: pass
- Check: 3 Nothing outside `.sdlc` changed: pass
- Follow-up: note: handoff Low item 4 groups conversation.ts:1361 under one-shot rAF... -> notes.md
- Follow-up: note: I did not rerun the browser probe; I relied on the saved... -> notes.md
